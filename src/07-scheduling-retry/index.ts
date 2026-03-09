import { Effect, Schedule, Schema } from "effect"

// --- Schedule combinators: composable retry/repeat strategies ---
// Directly from our Huly MCP codebase (auth-utils.ts)

class ExternalServiceError extends Schema.TaggedError<ExternalServiceError>()(
  "ExternalServiceError",
  { message: Schema.String, retryable: Schema.Boolean }
) {}

// --- Build complex schedules from simple primitives ---

// Exponential backoff: 100ms → 200ms → 400ms → 800ms
const exponential = Schedule.exponential("100 millis")

// Cap at 3 retries (4 total attempts)
const maxRetries = Schedule.recurs(3)

// Combine: exponential backoff AND max 3 retries
// intersect = both must agree to continue, use longer delay
const retrySchedule = Schedule.intersect(exponential, maxRetries)

// --- Simulate a flaky service ---

// Mutable state for demo simplicity. In production, use Ref for effectful mutable state.
let attempt = 0

const flakyCall = Effect.gen(function* () {
  attempt++
  yield* Effect.log(`Attempt ${attempt}...`)
  if (attempt < 3) {
    return yield* new ExternalServiceError({
      message: "Connection timeout",
      retryable: true,
    })
  }
  return "success"
})

// --- Retry with condition ---
// Only retry if error is retryable (skip auth errors, bad requests, etc.)

const withRetry = flakyCall.pipe(
  Effect.retry({
    schedule: retrySchedule,
    while: (e) => e.retryable, // stop retrying non-retryable errors immediately
  })
)

const main = Effect.gen(function* () {
  const result = yield* withRetry
  yield* Effect.log(`Result: ${result} (took ${attempt} attempts)`)
})

// Other useful combinators:
//   Schedule.union(a, b)       — either can continue, shorter delay
//   Schedule.andThen(a, b)     — run a first, then switch to b
//   Schedule.jittered           — add randomness (avoid thundering herd)
//   Schedule.whileInput(s, p)  — continue only while input matches predicate
//   Schedule.whileOutput(s, p) — continue only while output matches predicate

Effect.runPromise(main)
