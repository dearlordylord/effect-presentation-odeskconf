import { Effect, Fiber } from "effect"

// --- Interrupts: cooperative cancellation with guaranteed cleanup ---

const longTask = Effect.gen(function* () {
  yield* Effect.log("Task: starting work...")
  for (let i = 1; i <= 5; i++) {
    yield* Effect.log(`Task: step ${i}/5`)
    yield* Effect.sleep("300 millis") // each yield point is interruptible
  }
  yield* Effect.log("Task: completed!") // won't reach this
  return "done"
}).pipe(
  Effect.onInterrupt(() =>
    Effect.log("Task: interrupted! cleaning up resources...")
  )
)

const main = Effect.gen(function* () {
  // Fork the task as a child fiber
  const fiber = yield* Effect.fork(longTask)

  // Let it run for a bit
  yield* Effect.sleep("800 millis")

  // Cancel it
  yield* Effect.log("Main: sending interrupt...")
  yield* Fiber.interrupt(fiber)
  yield* Effect.log("Main: task was interrupted cleanly")
})

// Output:
//   Task: starting work...
//   Task: step 1/5
//   Task: step 2/5
//   Main: sending interrupt...
//   Task: interrupted! cleaning up resources...
//   Main: task was interrupted cleanly
//
// Key: acquireRelease acquisition is UNINTERRUPTIBLE — resource safety.
// The interrupt waits for acquire to finish before interrupting.

Effect.runPromise(main)
