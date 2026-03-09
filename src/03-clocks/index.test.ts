import { Effect, TestClock, TestContext, Exit } from "effect"
import { describe, it, expect } from "vitest"
import { checkExpiry, type Task } from "./index.js"

// TestClock starts at epoch 0 and ONLY advances via TestClock.adjust.
// No real time passes. Tests are instant and deterministic.

describe("checkExpiry", () => {
  // Task created at time 0, clock at time 0 → not expired
  it("passes for a fresh task", async () => {
    const task: Task = { id: "1", title: "Fresh", status: "running", createdAt: 0 }

    const result = await Effect.runPromise(
      checkExpiry(task).pipe(Effect.provide(TestContext.TestContext))
    )
    expect(result.id).toBe("1")
  })

  // Advance clock past timeout → expired
  it("expires after 30 seconds", async () => {
    const task: Task = { id: "1", title: "Old", status: "running", createdAt: 0 }

    const program = Effect.gen(function* () {
      yield* TestClock.adjust("31 seconds")
      return yield* checkExpiry(task)
    })

    const exit = await Effect.runPromiseExit(
      program.pipe(Effect.provide(TestContext.TestContext))
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  // Advance clock to just under timeout → still valid
  it("does not expire at exactly 30 seconds", async () => {
    const task: Task = { id: "1", title: "Edge", status: "running", createdAt: 0 }

    const program = Effect.gen(function* () {
      yield* TestClock.adjust("30 seconds")
      return yield* checkExpiry(task)
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestContext.TestContext))
    )
    expect(result.id).toBe("1")
  })
})
