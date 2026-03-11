import { Effect, Exit, Cause, Option } from "effect"
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

const testRepo = TaskRepository.of({
  fetchById: (id) =>
    id === "1"
      ? Effect.succeed(mockTask)
      : Effect.fail(new TaskNotFoundError({ id })),
  updateStatus: (_id, status) => Effect.succeed({ ...mockTask, status }),
})

describe("startTask", () => {
  it("starts a pending task", async () => {
    const result = await Effect.runPromise(
      startTask("1").pipe(Effect.provideService(TaskRepository, testRepo))
    )
    expect(result.status).toBe("running")
  })

  it("fails for non-existent task", async () => {
    const exit = await Effect.runPromiseExit(
      startTask("999").pipe(Effect.provideService(TaskRepository, testRepo))
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
    const runningRepo = TaskRepository.of({
      fetchById: () => Effect.succeed(runningTask),
      updateStatus: (_id, status) => Effect.succeed({ ...runningTask, status }),
    })
    const exit = await Effect.runPromiseExit(
      startTask("1").pipe(Effect.provideService(TaskRepository, runningRepo))
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
