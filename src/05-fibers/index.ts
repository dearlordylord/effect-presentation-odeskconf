import { Effect } from "effect"

// --- Fibers: lightweight threads with scope-based lifecycle ---
// Unlike setInterval or unmanaged Promise.all, no leaked background work.
//
// Effect.fork       = child supervised by parent fiber (dies when parent dies)
//                     — this is "structured concurrency" and usually what you want.
// Effect.forkScoped = child tied to a local Scope (dies when that scope closes)
//                     — useful when you need explicit control over fiber lifetime.

const worker = (id: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`Worker ${id}: tick`)
    yield* Effect.sleep("30 millis")
  }).pipe(
    Effect.forever,
    Effect.onInterrupt((_interruptors) => Effect.log(`Worker ${id}: interrupted by parent`))
  )

const structuredDemo = Effect.scoped(
  Effect.gen(function* () {
    yield* Effect.log("=== Structured concurrency ===")

    // forkScoped: child fiber tied to THIS scope — interrupted when scope closes.
    // We use forkScoped here so workers stop before the bounded parallelism demo starts.
    // In a real app, Effect.fork is usually what you want — children die automatically
    // with the parent fiber (structured concurrency).
    yield* Effect.forkScoped(worker(1))
    yield* Effect.forkScoped(worker(2))

    // Parent lives for 100ms then exits
    yield* Effect.sleep("100 millis")
    yield* Effect.log("Parent: exiting scope")
    // Scope closes here → forkScoped children are automatically interrupted.
  })
)

// --- Bounded parallelism with Effect.all ---

const taskIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const boundedDemo = Effect.gen(function* () {
  yield* Effect.log("\n=== Bounded parallelism ===")

  const results = yield* Effect.all(
    taskIds.map((id) =>
      Effect.gen(function* () {
        yield* Effect.log(`Task ${id}: start`)
        yield* Effect.sleep("50 millis")
        yield* Effect.log(`Task ${id}: done`)
        return id
      })
    ),
    { concurrency: 3 } // at most 3 at a time
  )

  yield* Effect.log(`Completed: [${results.join(", ")}]`)
})

const main = Effect.gen(function* () {
  yield* structuredDemo
  yield* boundedDemo
})

Effect.runPromise(main)
