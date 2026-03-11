import { Effect } from "effect"
import { NodeSdk } from "@effect/opentelemetry"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

// --- Telemetry: just withSpan + annotateCurrentSpan ---
//
// Start the OpenTelemetry backend first:
//   pnpm run docker:otel
//
// Then run: pnpm run 09
// Then open: Grafana URL printed by docker:otel → Explore → Tempo → Search

// Helper: a named operation that takes time and produces a span
const op = (
  name: string,
  delay: number,
  children: ReadonlyArray<Effect.Effect<void>> = []
) =>
  Effect.gen(function* () {
    yield* Effect.log(name)
    yield* Effect.sleep(`${delay} millis`)
    for (const child of children) {
      yield* child
    }
    yield* Effect.sleep(`${delay} millis`)
  }).pipe(Effect.withSpan(name))

// --- A complex trace tree simulating a task processing pipeline ---
//
// processTaskBatch
// ├── loadConfig
// ├── connectDatabase
// ├── processTask["Write docs"]
// │   ├── validate
// │   ├── fetchDeps["Write docs"]
// │   │   ├── authenticate
// │   │   └── queryAPI
// │   └── persist
// ├── processTask["Fix bug"]
// │   ├── validate
// │   ├── fetchDeps["Fix bug"]
// │   │   ├── authenticate
// │   │   └── queryAPI
// │   └── persist
// └── notifyResults
//     ├── email        ┐
//     ├── slack        ┘ concurrent
//     ├── /poll        ┐
//     ├── /poll        ┤ concurrent
//     └── /poll        ┘

const authenticate = op("authenticate", 5)
const queryAPI = op("queryAPI", 15)

const fetchDeps = (taskName: string) =>
  op(`fetchDeps[${taskName}]`, 3, [authenticate, queryAPI])

const processTask = (name: string) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("task.name", name)
    yield* op("validate", 4)
    yield* fetchDeps(name)
    yield* op("persist", 8)
  }).pipe(Effect.withSpan(`processTask[${name}]`))

const poll = op("/poll", 1)

const notifyResults = op("notifyResults", 2, [
  // email and slack notifications run concurrently
  Effect.all([op("email", 10), op("slack", 8)], { concurrency: "unbounded" }),
  Effect.all([poll, poll, poll], { concurrency: "unbounded" }),
])

const program = op("processTaskBatch", 2, [
  op("loadConfig", 3),
  op("connectDatabase", 10),
  processTask("Write docs"),
  processTask("Fix bug"),
  notifyResults,
])

// --- OTel setup: just a Layer ---

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: "effect-presentation" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}))

Effect.runPromise(
  program.pipe(
    Effect.provide(NodeSdkLive),
    Effect.catchAllCause(Effect.logError)
  )
)
