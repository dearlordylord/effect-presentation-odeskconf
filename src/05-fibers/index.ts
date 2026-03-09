import { Effect } from "effect"

// --- Structured concurrency: child fibers can't outlive the parent ---
// Unlike setInterval or unmanaged Promise.all, no leaked background work.

const worker = (id: number) =>
  Effect.gen(function* () {
    yield* Effect.log(`Worker ${id}: tick`)
    yield* Effect.sleep("30 millis")
  }).pipe(
    Effect.forever,
    Effect.onInterrupt(() => Effect.log(`Worker ${id}: interrupted by parent`))
  )

const structuredDemo = Effect.scoped(
  Effect.gen(function* () {
    yield* Effect.log("=== Structured concurrency ===")

    // forkScoped: child fiber tied to THIS scope — interrupted when scope closes
    yield* Effect.forkScoped(worker(1))
    yield* Effect.forkScoped(worker(2))

    // Parent lives for 100ms then exits
    yield* Effect.sleep("100 millis")
    yield* Effect.log("Parent: exiting")
    // Scope closes here → children are automatically interrupted. They can't leak.
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
