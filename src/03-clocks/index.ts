import { Effect, Clock, Schema } from "effect"

// --- Clock: abstracting time makes code testable ---
// Effect's Clock service is automatically replaced by TestClock in tests.
// No mocking libraries. No monkey-patching Date.now().

export interface Task {
  readonly id: string
  readonly title: string
  readonly status: "pending" | "running" | "done" | "failed"
  readonly createdAt: number // epoch ms
}

export class TaskExpiredError extends Schema.TaggedError<TaskExpiredError>()(
  "TaskExpiredError",
  { id: Schema.String, elapsed: Schema.Number }
) {
  get message() {
    return `Task '${this.id}' expired after ${this.elapsed}ms`
  }
}

export const TASK_TIMEOUT_MS = 30_000 // 30 seconds

// Uses Clock.currentTimeMillis — NOT Date.now()
// This means tests can control time without real delays.
export const assertFresh = (task: Task): Effect.Effect<Task, TaskExpiredError> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const elapsed = now - task.createdAt
    if (elapsed > TASK_TIMEOUT_MS) {
      return yield* new TaskExpiredError({ id: task.id, elapsed })
    }
    return task
  })

// --- Demo with real clock ---

const main = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis
  const task: Task = {
    id: "1",
    title: "Recent task",
    status: "running",
    createdAt: now - 5_000, // 5 seconds ago
  }
  const result = yield* assertFresh(task)
  yield* Effect.log(`Task '${result.title}' is still valid`)
})

Effect.runPromise(main)
