import { Effect, Schema } from "effect"

// ============================================================
// In plain TypeScript:
//
//   async function findTask(id: string): Promise<Task> { ... }
//   async function startTask(id: string): Promise<Task> { ... }
//
// What errors can these throw? You find out at runtime.
//
// With Effect, errors are PART OF THE TYPE:
//
//   findTask:  (id: string) => Effect<Task, TaskNotFoundError>
//   startTask: (id: string) => Effect<Task, TaskNotFoundError | InvalidStatusError>
// ============================================================

// --- Domain ---

export interface Task {
  readonly id: string
  readonly title: string
  readonly status: "pending" | "running" | "done" | "failed"
}

// --- Typed errors using Schema.TaggedError ---
// Each error is a tagged class — discriminated by _tag at runtime and in types

export class TaskNotFoundError extends Schema.TaggedError<TaskNotFoundError>()(
  "TaskNotFoundError",
  { id: Schema.String }
) {
  get message() {
    return `Task '${this.id}' not found`
  }
}

export class InvalidStatusError extends Schema.TaggedError<InvalidStatusError>()(
  "InvalidStatusError",
  { id: Schema.String, current: Schema.String, expected: Schema.String }
) {
  get message() {
    return `Task '${this.id}' is '${this.current}', expected '${this.expected}'`
  }
}

// --- Sample data ---

const tasks = new Map<string, Task>([
  ["1", { id: "1", title: "Write docs", status: "pending" }],
  ["2", { id: "2", title: "Fix bug", status: "running" }],
])

// --- Operations: return type tells you EXACTLY what can fail ---

export const findTask = (id: string): Effect.Effect<Task, TaskNotFoundError> =>
  Effect.gen(function* () {
    const task = tasks.get(id)
    if (!task) return yield* new TaskNotFoundError({ id })
    return task
  })

export const startTask = (
  id: string
): Effect.Effect<Task, TaskNotFoundError | InvalidStatusError> =>
  Effect.gen(function* () {
    const task = yield* findTask(id)
    if (task.status !== "pending") {
      return yield* new InvalidStatusError({
        id,
        current: task.status,
        expected: "pending",
      })
    }
    return { ...task, status: "running" as const }
  })

// --- Error handling: catchTag handles one error, leaves others in the type ---

const main = Effect.gen(function* () {
  // Task "2" has status "running" — startTask will fail with InvalidStatusError
  const result = yield* startTask("2").pipe(
    Effect.catchTag("InvalidStatusError", (e) =>
      Effect.gen(function* () {
        yield* Effect.log(`Handled: ${e.message}`)
        return yield* findTask(e.id) // fallback: return current state
      })
    )
    // TaskNotFoundError is NOT caught — it stays in the error channel.
    // The compiler tracks this for you.
  )
  yield* Effect.log(`Result: ${result.title} (${result.status})`)
})

Effect.runPromise(main)
