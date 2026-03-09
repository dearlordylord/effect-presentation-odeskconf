import { Effect, Layer, Exit, Cause, Option } from "effect"
import { describe, it, expect } from "vitest"
import {
  TaskRepository,
  startTask,
  TaskNotFoundError,
  InvalidStatusError,
  type Task,
} from "./index.js"

// --- Swap the real repo for a test double ---
// Same business logic, zero infrastructure.

const mockTask: Task = { id: "1", title: "Test task", status: "pending" }

const TestTaskRepo = Layer.succeed(TaskRepository, {
  findById: (id) =>
    id === "1"
      ? Effect.succeed(mockTask)
      : Effect.fail(new TaskNotFoundError({ id })),
  updateStatus: (_id, status) => Effect.succeed({ ...mockTask, status }),
})

describe("startTask", () => {
  it("starts a pending task", async () => {
    const result = await Effect.runPromise(
      startTask("1").pipe(Effect.provide(TestTaskRepo))
    )
    expect(result.status).toBe("running")
  })

  it("fails for non-existent task", async () => {
    const exit = await Effect.runPromiseExit(
      startTask("999").pipe(Effect.provide(TestTaskRepo))
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause)
      expect(Option.isSome(error)).toBe(true)
      if (Option.isSome(error)) {
        expect(error.value._tag).toBe("TaskNotFoundError")
      }
    }
  })

  it("fails when task is not pending", async () => {
    const runningTask: Task = { ...mockTask, status: "running" }
    const RunningTaskRepo = Layer.succeed(TaskRepository, {
      findById: () => Effect.succeed(runningTask),
      updateStatus: (_id, status) => Effect.succeed({ ...runningTask, status }),
    })
    const exit = await Effect.runPromiseExit(
      startTask("1").pipe(Effect.provide(RunningTaskRepo))
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause)
      expect(Option.isSome(error)).toBe(true)
      if (Option.isSome(error)) {
        expect(error.value._tag).toBe("InvalidStatusError")
      }
    }
  })
})
