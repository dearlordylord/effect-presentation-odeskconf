import { Effect } from "effect"

// ============================================================
// SLIDE: Composability — every feature composes with every other
// ============================================================
//
// --- The Effect type anatomy ---
//
//   Effect<Success, Error, Requirements>
//            │        │         │
//            │        │         └── What services does this need?
//            │        └──────────── What typed errors can occur?
//            └───────────────────── What does it produce on success?
//
// When you compose effects, the types compose automatically:
//
//   const a: Effect<User, AuthError, Database>
//   const b: Effect<Order, PaymentError, PaymentGateway>
//
//   const c = Effect.all([a, b])
//   //    ^  Effect<[User, Order], AuthError | PaymentError, Database | PaymentGateway>
//
//   Errors: union. Requirements: union. Success: tuple.
//   No manual wiring. The compiler does it.
//
// --- Layers compose the same way ---
//
//   const DatabaseLive:  Layer<Database, ConfigError, Config>
//   const PaymentLive:   Layer<PaymentGateway, never, Config>
//
//   const AppLive = Layer.merge(DatabaseLive, PaymentLive)
//   //    ^  Layer<Database | PaymentGateway, ConfigError, Config>
//
//   Effect.provide(program, AppLive)
//   // Satisfies ALL requirements in one call.
//
// --- Schedules compose ---
//
//   Schedule.intersect(Schedule.exponential("100 millis"), Schedule.recurs(3))
//   // Exponential backoff AND max 3 retries — both are values, both compose.
//
// --- The key insight ---
//
//   In most frameworks, you choose: error handling OR concurrency OR
//   resource management. In Effect, they're all the same abstraction.
//   A retry schedule works with a fiber that holds a scoped resource
//   that has typed errors — and the types track everything.
//
//   retry + resources + fibers + typed errors + DI = one program.
//   No escape hatches. No "but this doesn't work with that".

const main = Effect.log("(this topic is a slide, not a runnable demo)")
Effect.runPromise(main)
