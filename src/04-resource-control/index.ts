import { Effect } from "effect"

// --- Resources: acquire/release guarantees cleanup ---
// try/finally works for sync. acquireRelease works across async, concurrency, and interrupts.

// --- A "database connection" that must be opened and closed ---

const makeDbConnection = Effect.acquireRelease(
  Effect.gen(function* () {
    yield* Effect.log("[DB] Connecting...")
    return {
      query: (sql: string) =>
        Effect.log(`[DB] Executing: ${sql}`).pipe(Effect.as({ rows: [] })),
    }
  }),
  // Release: always runs — on success, error, or interrupt
  () => Effect.log("[DB] Disconnecting")
)

// --- A second resource: file store ---

const makeFileStore = Effect.acquireRelease(
  Effect.gen(function* () {
    yield* Effect.log("[FS] Opening file store...")
    return {
      write: (path: string, data: string) =>
        Effect.log(`[FS] Writing ${data.length} bytes to ${path}`),
    }
  }),
  () => Effect.log("[FS] Closing file store")
)

// --- Use both resources in a scoped block ---

const main = Effect.scoped(
  Effect.gen(function* () {
    const db = yield* makeDbConnection
    const store = yield* makeFileStore
    yield* db.query("SELECT * FROM tasks WHERE status = 'pending'")
    yield* store.write("/output/result.json", '{"status":"done"}')
    yield* Effect.log("Task processed")
  })
)

// Output order:
//   [DB] Connecting...
//   [FS] Opening file store...
//   [DB] Executing: SELECT ...
//   [FS] Writing 17 bytes to ...
//   Task processed
//   [FS] Closing file store     ← released in reverse order
//   [DB] Disconnecting          ← always runs

Effect.runPromise(main)
