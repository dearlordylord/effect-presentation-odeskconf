import { Effect, Layer, Context } from "effect"

// --- Resources: acquire/release guarantees cleanup ---
// Unlike try/finally, this works with async, concurrency, and interrupts.

// --- A "database connection" that must be opened and closed ---

interface DbConnection {
  readonly query: (sql: string) => Effect.Effect<unknown>
}

class Database extends Context.Tag("Database")<Database, DbConnection>() {}

// Layer.scoped + acquireRelease: connection lives for the layer's lifetime
const DatabaseLive = Layer.scoped(
  Database,
  Effect.acquireRelease(
    // Acquire
    Effect.gen(function* () {
      yield* Effect.log("[DB] Connecting...")
      return {
        query: (sql: string) =>
          Effect.log(`[DB] Executing: ${sql}`).pipe(Effect.as({ rows: [] })),
      }
    }),
    // Release: ALWAYS runs — even on error, even on interrupt
    () => Effect.log("[DB] Disconnecting")
  )
)

// --- A second resource: file store ---

interface FileStore {
  readonly write: (path: string, data: string) => Effect.Effect<void>
}

class Storage extends Context.Tag("Storage")<Storage, FileStore>() {}

const StorageLive = Layer.scoped(
  Storage,
  Effect.acquireRelease(
    Effect.gen(function* () {
      yield* Effect.log("[FS] Opening file store...")
      return {
        write: (path: string, data: string) =>
          Effect.log(`[FS] Writing ${data.length} bytes to ${path}`),
      }
    }),
    () => Effect.log("[FS] Closing file store")
  )
)

// --- Business logic uses both — doesn't care about lifecycle ---

const processTask = Effect.gen(function* () {
  const db = yield* Database
  const store = yield* Storage
  yield* db.query("SELECT * FROM tasks WHERE status = 'pending'")
  yield* store.write("/output/result.json", '{"status":"done"}')
  yield* Effect.log("Task processed")
})

// --- Layer.merge composes resources. Both acquired, both released. ---

const main = processTask.pipe(
  Effect.provide(Layer.merge(DatabaseLive, StorageLive))
)

// Output order:
//   [DB] Connecting...
//   [FS] Opening file store...
//   [DB] Executing: SELECT ...
//   [FS] Writing 16 bytes to ...
//   Task processed
//   [FS] Closing file store     ← released in reverse order
//   [DB] Disconnecting          ← always runs

Effect.runPromise(main)
