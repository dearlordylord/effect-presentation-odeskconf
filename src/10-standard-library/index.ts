import { Effect } from "effect"

// ============================================================
// SLIDE: Standard Library — the TypeScript STD we didn't have
// ============================================================
//
// Effect ships a complete standard library. No lodash. No ramda.
// Everything is typed, pipeable, and tree-shakeable.
//
// --- Option<A> — null done right ---
//
//   import { Option } from "effect"
//
//   Option.fromNullable(map.get("key"))          // Option<Task>
//     .pipe(
//       Option.map((t) => t.title),              // Option<string>
//       Option.getOrElse(() => "unknown")         // string
//     )
//
// --- Schema — runtime validation with type inference ---
//
//   import { Schema } from "effect"
//
//   const TaskInput = Schema.Struct({
//     title: Schema.NonEmptyString,
//     priority: Schema.Literal("low", "medium", "high"),
//   })
//   type TaskInput = typeof TaskInput.Type
//   // { title: string; priority: "low" | "medium" | "high" }
//
//   Schema.decodeUnknown(TaskInput)(userInput)
//   // => Effect<TaskInput, ParseError>
//
// --- Config — typed environment variables ---
//
//   import { Config } from "effect"
//
//   const appConfig = Config.all({
//     port: Config.number("PORT"),
//     host: Config.string("HOST").pipe(Config.withDefault("localhost")),
//   })
//   // Missing PORT? Fails at startup with a clear message. Not at 3am.
//
// --- Collections — Array, Record, HashMap, HashSet ---
//
//   import { Array, Record } from "effect"
//
//   Array.groupBy(tasks, (t) => t.status)
//   // => Record<string, NonEmptyArray<Task>>
//
// --- Duration — type-safe time ---
//
//   import { Duration } from "effect"
//
//   Duration.decode("5 seconds")  // Duration
//   Duration.toMillis(d)          // number
//
// --- And more: Match, Order, Equal, Hash, Predicate, Struct ---

const main = Effect.log("(this topic is a slide, not a runnable demo)")
Effect.runPromise(main)
