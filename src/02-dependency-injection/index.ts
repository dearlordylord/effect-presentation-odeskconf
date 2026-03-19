import { Effect, Context, Schema } from "effect"

// --- Domain (same as 01) ---

export interface Task {
  readonly id: string
  readonly title: string
  readonly status: "pending" | "running" | "done" | "failed"
}

export class TaskNotFoundError extends Schema.TaggedError<TaskNotFoundError>()(
  "TaskNotFoundError",
  { id: Schema.String }
) {}

export class InvalidStatusError extends Schema.TaggedError<InvalidStatusError>()(
  "InvalidStatusError",
  { id: Schema.String, current: Schema.String, expected: Schema.String }
) {}

// --- Service definition: what, not how ---

export class TaskRepository extends Context.Tag("TaskRepository")<
  TaskRepository,
  {
    readonly fetchById: (id: string) => Effect.Effect<Task, TaskNotFoundError>
    readonly updateStatus: (
      id: string,
      status: Task["status"]
    ) => Effect.Effect<Task, TaskNotFoundError>
  }
>() {}

// --- In-memory implementation ---

const tasks = new Map<string, Task>([
  ["1", { id: "1", title: "Write docs", status: "pending" }],
  ["2", { id: "2", title: "Fix bug", status: "running" }],
])

const inMemoryRepo = TaskRepository.of({
  fetchById: (id) =>
    Effect.gen(function* () {
      const task = tasks.get(id)
      if (!task) return yield* new TaskNotFoundError({ id })
      return task
    }),
  updateStatus: (id, status) =>
    Effect.gen(function* () {
      const task = tasks.get(id)
      if (!task) return yield* new TaskNotFoundError({ id })
      const updated = { ...task, status }
      tasks.set(id, updated)
      return updated
    }),
})

// --- Business logic: depends on TaskRepository, doesn't know the implementation ---

// note no need for explicit type
export const startTask = (
  id: string
): Effect.Effect<Task, TaskNotFoundError | InvalidStatusError, TaskRepository> =>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const task = yield* repo.fetchById(id)
    if (task.status !== "pending") {
      return yield* new InvalidStatusError({
        id,
        current: task.status,
        expected: "pending",
      })
    }
    return yield* repo.updateStatus(id, "running")
  })

// --- Wire it up: provideService removes the requirement from the type ---

const main = startTask("1").pipe(
  Effect.tap((task) => Effect.log(`Started: ${task.title}`)),
  Effect.provideService(TaskRepository, inMemoryRepo)
  // After provideService: Effect<Task, TaskNotFoundError | InvalidStatusError>
  // The TaskRepository requirement is no more — it's been satisfied.
)

Effect.runPromise(main)
