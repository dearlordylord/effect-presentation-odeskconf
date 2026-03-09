import { Effect, Queue, PubSub } from "effect"

// --- Queue: typed, effectful, with backpressure strategies ---

const queueDemo = Effect.gen(function* () {
  yield* Effect.log("=== Queue with backpressure ===")

  // bounded(3): offer SUSPENDS when full — automatic backpressure
  const queue = yield* Queue.bounded<string>(3)

  yield* Queue.offer(queue, "task-1")
  yield* Queue.offer(queue, "task-2")
  yield* Queue.offer(queue, "task-3")
  // Queue.offer(queue, "task-4") would SUSPEND here until a consumer takes

  const task = yield* Queue.take(queue)
  yield* Effect.log(`Processed: ${task}`)

  const size = yield* Queue.size(queue)
  yield* Effect.log(`Remaining: ${size}`)
})

// --- PubSub: broadcast to ALL subscribers ---

const pubsubDemo = Effect.gen(function* () {
  yield* Effect.log("\n=== PubSub broadcast ===")

  const pubsub = yield* PubSub.bounded<string>(16)

  // Effect.scoped: subscriptions auto-unsubscribe when scope closes
  yield* Effect.scoped(
    Effect.gen(function* () {
      const sub1 = yield* PubSub.subscribe(pubsub)
      const sub2 = yield* PubSub.subscribe(pubsub)

      // Publish — every subscriber gets the message
      yield* PubSub.publish(pubsub, "task-1 completed")

      const msg1 = yield* Queue.take(sub1)
      const msg2 = yield* Queue.take(sub2)
      yield* Effect.log(`Subscriber 1: ${msg1}`)
      yield* Effect.log(`Subscriber 2: ${msg2}`) // same message
    })
  )
  // Subscriptions closed here — no leaks
})

// Backpressure strategies:
//   Queue.bounded(n)   — offer SUSPENDS when full
//   Queue.dropping(n)  — new values SILENTLY DROPPED when full
//   Queue.sliding(n)   — OLDEST values removed to make room
//   Queue.unbounded()  — never blocks, grows without limit
//
// Type-safe producer/consumer separation:
//   Queue.Enqueue<A>  — offer only
//   Queue.Dequeue<A>  — take only

const main = Effect.gen(function* () {
  yield* queueDemo
  yield* pubsubDemo
})

Effect.runPromise(main)
