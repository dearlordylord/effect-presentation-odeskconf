---
marp: true
theme: default
paginate: true
backgroundColor: #1e1e2e
color: #cdd6f4
style: |
  section {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 22px;
  }
  h1, h2, h3 {
    color: #89b4fa;
  }
  code {
    background: #313244;
    color: #a6e3a1;
  }
  pre {
    background: #181825 !important;
    border: 1px solid #313244;
  }
  a { color: #89b4fa; }
  strong { color: #f9e2af; }
  em { color: #cba6f7; }
  blockquote { border-left: 4px solid #89b4fa; padding-left: 1em; color: #a6adc8; }
  .rainbow {
    background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
---

# Effect-TS

### The missing standard library for TypeScript

The production TS framework she tells you not to worry about

---

## What is Effect?

A **type-level runtime** for TypeScript:

```
Effect<Success, Error, Requirements>
          |        |         |
          |        |         +-- What services does this need?
          |        +------------ What typed errors can occur?
          +---------------------- What does it produce?
```

Errors, dependencies, async, resources, concurrency -- all tracked in the type system.

---

# 01 -- Typed Errors

`pnpm run 01` | `src/01-typed-errors/index.ts`

---

## "I just don't know what went wrong"

```typescript
async function findTask(id: string): Promise<Task> { ... }
async function startTask(id: string): Promise<Task> { ... }
```

What errors can these throw? The type doesn't say.

---

## Typed Errors with Effect

Errors are part of the type:

```typescript
findTask:  (id: string) => Effect<Task, TaskNotFoundError>
startTask: (id: string) => Effect<Task, TaskNotFoundError | InvalidStatusError>
```

The compiler forces you to handle them.

---

## Schema.TaggedError -- discriminated error classes

```typescript
class TaskNotFoundError extends Schema.TaggedError<TaskNotFoundError>()(
  "TaskNotFoundError",
  { id: Schema.String }
) {
  get message() {
    return `Task '${this.id}' not found`
  }
}

class InvalidStatusError extends Schema.TaggedError<InvalidStatusError>()(
  "InvalidStatusError",
  { id: Schema.String, current: Schema.String, expected: Schema.String }
) {}
```

---

## Selective error handling with catchTag

```typescript
const result = yield* startTask("2").pipe(
  Effect.catchTag("InvalidStatusError", (e) =>
    Effect.gen(function* () {
      yield* Effect.log(`Handled: ${e.message}`)
      return yield* findTask(e.id)
    })
  )
  // TaskNotFoundError is not caught -- stays in the error channel.
)
// startTask("2")                            => Effect<Task, TaskNotFoundError | InvalidStatusError>
// .pipe(catchTag("InvalidStatusError", ...)) => Effect<Task, TaskNotFoundError>
//                                                             ^^^^^^^^^^^^^^^^
//                                          InvalidStatusError removed from the union
// result (after yield*)                     => Task
```

---

# 02 -- Dependency Injection

`pnpm run 02` | `src/02-dependency-injection/index.ts`

---

## Service definition: what, not how

```typescript
class TaskRepository extends Context.Tag("TaskRepository")<
  TaskRepository,
  {
    readonly fetchById: (id: string) => Effect<Task, TaskNotFoundError>
    readonly updateStatus: (
      id: string, status: Task["status"]
    ) => Effect<Task, TaskNotFoundError>
  }
>() {}
```

An interface as a first-class value. Implementation comes later.

---

## Business logic doesn't know the implementation

```typescript
const startTask = (id: string) =>
  //  ^? Effect<Task, TaskNotFoundError | InvalidStatusError, TaskRepository>
  //     inferred -- you never write this annotation
  Effect.gen(function* () {
    const repo = yield* TaskRepository  // "give me the repo"
    const task = yield* repo.fetchById(id)
    if (task.status !== "pending") {
      return yield* new InvalidStatusError({ ... })
    }
    return yield* repo.updateStatus(id, "running")
  })
```

Third type parameter: `TaskRepository` is a *requirement*.

---

## provideService removes the requirement

```typescript
const main = startTask("1").pipe(
  Effect.tap((task) => Effect.log(`Started: ${task.title}`)),
  Effect.provideService(TaskRepository, {
    fetchById: (id) => ...,
    updateStatus: (id, status) => ...,
  })
  // After provideService: Effect<Task, TaskNotFoundError | InvalidStatusError>
  // The TaskRepository requirement is no more -- it's been satisfied.
)
```

Swap the implementation for tests or production -- zero business logic changes.

---

# 03 -- Testable Clocks

`pnpm run 03` | `pnpm test` | `src/03-clocks/index.ts`

---

## Date.now() is untestable

```typescript
// How do you test code that depends on "now"?
// Mock Date.now()? Monkey-patch globals? jest.useFakeTimers()?
```

Effect's `Clock` service is <span class="rainbow">automatically replaced</span> by `TestClock` in tests.

---

## Clock.currentTimeMillis instead of Date.now()

```typescript
const assertFresh = (task: Task): Effect<Task, TaskExpiredError> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis  // not Date.now()
    const elapsed = now - task.createdAt
    if (elapsed > TASK_TIMEOUT_MS) {
      return yield* new TaskExpiredError({ id: task.id, elapsed })
    }
    return task
  })
```

---

## Deterministic tests with TestClock

```typescript
it("expires after 30 seconds", () =>
  Effect.gen(function* () {
    const task = { id: "1", createdAt: 0, ... }
    yield* TestClock.adjust("31 seconds")  // instant!
    const result = yield* Effect.exit(assertFresh(task))
    // assert error._tag === "TaskExpiredError"
  }).pipe(
    Effect.provide(TestContext.TestContext),
    Effect.runPromise
  ))
```

No delays.

---

# 04 -- Resource Control

`pnpm run 04` | `src/04-resource-control/index.ts`

---

## Resources: acquire/release guarantees cleanup

`try/finally` works for sync code. `acquireRelease` works across async, concurrency, and interrupts.

```typescript
const makeDbConnection = Effect.acquireRelease(
  // Acquire
  Effect.gen(function* () {
    yield* Effect.log("[DB] Connecting...")
    return { query: (sql) => Effect.log(`[DB] ${sql}`) }
  }),
  // Release: always runs -- on success, error, or interrupt
  () => Effect.log("[DB] Disconnecting")
)
```

---

## Effect.scoped manages the lifetime

```typescript
const main = Effect.scoped(
  Effect.gen(function* () {
    const db = yield* makeDbConnection
    const store = yield* makeFileStore
    yield* db.query("SELECT * FROM tasks WHERE status = 'pending'")
    yield* store.write("/output/result.json", '{"status":"done"}')
    yield* Effect.log("Task processed")
  })
)
// [DB] Connecting...
// [FS] Opening file store...
// [DB] Executing: SELECT ...
// Task processed
// [FS] Closing file store     <-- released in reverse order
// [DB] Disconnecting          <-- always runs
```

Both resources acquire on entry, release on exit -- including on error or interrupt.

---

# 05 -- Fibers

`pnpm run 05` | `src/05-fibers/index.ts`

---

## Lightweight threads with structured concurrency

```
Effect.fork = child fiber supervised by parent
              (interrupted when parent completes)
```

Child fibers are interrupted when parent completes.

`Effect.forkScoped`, `Effect.forkDaemon` exist for when you need different lifetimes.

---

## ensuring vs onInterrupt

```typescript
const worker = (id: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`Worker ${id}: tick`)
    yield* Effect.sleep("30 millis")
  }).pipe(
    Effect.forever,
    // ensuring: runs on success, failure, AND interrupt
    Effect.ensuring(Effect.log(`Worker ${id}: finalized`)),
    // onInterrupt: runs ONLY on interrupt
    Effect.onInterrupt(() => Effect.log(`Worker ${id}: was interrupted`))
  )

const demo = Effect.gen(function* () {
  yield* Effect.fork(worker(1))
  yield* Effect.fork(worker(2))
  yield* Effect.sleep("100 millis")
  // parent completes -> child fibers interrupted
})
```

---

## Bounded parallelism

```typescript
const results = yield* Effect.all(
  taskIds.map((id) =>
    Effect.gen(function* () {
      yield* Effect.log(`Task ${id}: start`)
      yield* Effect.sleep("50 millis")
      return id
    })
  ),
  { concurrency: 3 }  // at most 3 at a time
)
```

`concurrency` option controls max parallel fibers.

---

# 06 -- Interrupts

`pnpm run 06` | `src/06-interrupts/index.ts`

---

## Cancellation in plain TypeScript

```typescript
const controller = new AbortController()

async function fetchData(signal: AbortSignal) {
  const resp = await fetch(url, { signal })   // ok, fetch supports it
  const parsed = await parseResponse(resp)    // doesn't accept signal
  await db.save(parsed)                       // doesn't accept signal either
  // if controller.abort() called during parseResponse or db.save,
  // nothing happens -- those operations don't know about signals
}
```

Manual signal threading. Libraries that don't support it. No propagation.

---

## In Effect: every yield* is interruptible

```typescript
const longTask = Effect.gen(function* () {
  for (let i = 1; i <= 5; i++) {
    yield* Effect.log(`Task: step ${i}/5`)
    yield* Effect.sleep("300 millis")  // interruptible
  }
}).pipe(
  Effect.onInterrupt(() =>
    Effect.log("Task: interrupted! releasing connections...")
  )
)

const main = Effect.gen(function* () {
  const fiber = yield* Effect.fork(longTask)
  yield* Effect.sleep("800 millis")
  yield* Fiber.interrupt(fiber)  // cooperative cancel
  yield* Effect.log("Main: task was interrupted cleanly")
})
```

---

## Interrupt output

```
Task: starting work...
Task: step 1/5
Task: step 2/5
Main: sending interrupt...
Task: interrupted! releasing connections...
Main: task was interrupted cleanly
```

`onInterrupt` runs only on interruption -- use `ensuring` for all-exit cleanup.

---

# 07 -- Scheduling & Retry

`pnpm run 07` | `src/07-scheduling-retry/index.ts`

---

## Composable retry strategies

```typescript
// Exponential backoff: 100ms -> 200ms -> 400ms -> 800ms
const exponential = Schedule.exponential("100 millis")

// Cap at 3 retries
const maxRetries = Schedule.recurs(3)

// Combine: exponential backoff AND max 3 retries
const retrySchedule = Schedule.intersect(exponential, maxRetries)
```

Schedules are values. Compose them like data.

---

## Conditional retry

```typescript
class ExternalServiceError extends Schema.TaggedError<ExternalServiceError>()(
  "ExternalServiceError",
  { message: Schema.String, retryable: Schema.Boolean }
) {}

const withRetry = flakyCall.pipe(
  Effect.retry({
    schedule: retrySchedule,
    while: (e) => e.retryable,
    // retryable: true  -> timeout, network error  -> retry
    // retryable: false -> auth error, bad request  -> fail immediately
  })
)
```

Other combinators: `Schedule.union`, `Schedule.andThen`, `Schedule.jittered`

---

# 08 -- Queues

`pnpm run 08` | `src/08-queues-pubsub/index.ts`

---

## Queue with backpressure

```typescript
const queue = yield* Queue.bounded<string>(3)

yield* Queue.offer(queue, "task-1")
yield* Queue.offer(queue, "task-2")
yield* Queue.offer(queue, "task-3")
// Queue.offer(queue, "task-4") would suspend until consumer takes
```

4 strategies: `bounded` (suspends), `dropping` (silent drop), `sliding` (drop oldest), `unbounded`

Type-safe producer/consumer separation: `Queue.Enqueue<A>` (offer only), `Queue.Dequeue<A>` (take only)

---

# 09 -- Telemetry

`pnpm run 09` | `src/09-telemetry/index.ts`

---

## Just `withSpan` + `annotateCurrentSpan`

```typescript
const processTask = (name: string) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("task.name", name)
    yield* op("validate", 4)
    yield* fetchDeps(name)
    yield* op("persist", 8)
  }).pipe(Effect.withSpan(`processTask[${name}]`))
```

---

## Complex trace tree -- zero extra boilerplate

```
processTaskBatch
+-- loadConfig
+-- connectDatabase
+-- processTask["Write docs"]
|   +-- validate
|   +-- fetchDeps -> authenticate, queryAPI
|   +-- persist
+-- processTask["Fix bug"]
|   +-- validate
|   +-- fetchDeps -> authenticate, queryAPI
|   +-- persist
+-- notifyResults
    +-- email + slack (concurrent)
    +-- 3x /poll (concurrent)
```

---

## Try it: OTel in Docker

```bash
# 1. Start Grafana LGTM (auto-finds free port for Grafana UI)
pnpm run docker:otel

# 2. Run the telemetry demo (in another terminal)
pnpm run 09

# 3. Open Grafana at the URL printed by docker:otel
#    -> Explore -> Tempo -> Search -> find trace
```

OTel setup in code:
```typescript
const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: "effect-presentation" },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}))
// provide it to your program with Effect.provide(NodeSdkLive)
```

---

# 10 -- Standard Library

(slide only)

---

## The TypeScript std we didn't have

No lodash. No ramda. Everything typed, pipeable, tree-shakeable.

```typescript
Option.fromNullable(map.get("key"))
  .pipe(
    Option.map((t) => t.title),
    Option.getOrElse(() => "unknown")
  )
```

---

## Schema -- runtime validation + type inference

```typescript
const TaskInput = Schema.Struct({
  title: Schema.NonEmptyString,
  priority: Schema.Literal("low", "medium", "high"),
})
type TaskInput = typeof TaskInput.Type
// { title: string; priority: "low" | "medium" | "high" }

Schema.decodeUnknown(TaskInput)(userInput)
// => Effect<TaskInput, ParseError>
```

---

## Config, Collections, Duration, and more

```typescript
// Typed env vars -- fail at startup, not at 3am
const appConfig = Config.all({
  port: Config.number("PORT"),
  host: Config.string("HOST").pipe(Config.withDefault("localhost")),
})

// Collections
Array.groupBy(tasks, (t) => t.status)
// => Record<string, NonEmptyArray<Task>>

// Duration
Duration.decode("5 seconds")  // Duration
Duration.toMillis(d)           // number
```

Also: Match, Order, Equal, Hash, Predicate, Struct

---

# 11 -- Composability

(slide only)

---

## Everything composes with everything

```typescript
const a: Effect<User, AuthError, Database>
const b: Effect<Order, PaymentError, PaymentGateway>

const c = Effect.all([a, b])
//    ^  Effect<[User, Order],
//              AuthError | PaymentError,
//              Database | PaymentGateway>
```

Errors: union. Requirements: union. Success: tuple.

---

## The key insight

Effect gives you one API for things that are usually separate libraries: error handling, retries, concurrency, DI, resource management, observability.

They share one type and compose without glue code.

---

# Thanks

All demos: `pnpm run 01` through `pnpm run 11`

github.com/dearlordylord/effect-presentation-odeskconf
