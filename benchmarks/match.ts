import { performance } from "node:perf_hooks"
import { Effect, Exit } from "effect"
import { match } from "ts-pattern"

type AppError =
  | { readonly _tag: "NotFound"; readonly id: number }
  | { readonly _tag: "RateLimited"; readonly retryAfter: number }
  | { readonly _tag: "Invalid"; readonly reason: string }

type AppResult =
  | { readonly _tag: "Ok"; readonly value: number }
  | { readonly _tag: "Err"; readonly error: AppError }

const ITERATIONS = 250_000
const SAMPLES = 9

const results: ReadonlyArray<AppResult> = Array.from({ length: 1024 }, (_, i) => {
  switch (i % 4) {
    case 0:
      return { _tag: "Err", error: { _tag: "NotFound", id: i } }
    case 1:
      return { _tag: "Err", error: { _tag: "RateLimited", retryAfter: i % 10 } }
    case 2:
      return { _tag: "Err", error: { _tag: "Invalid", reason: "bad" } }
    default:
      return { _tag: "Ok", value: i }
  }
})

const effects: ReadonlyArray<Effect.Effect<number, AppError>> = results.map((result) =>
  result._tag === "Ok" ? Effect.succeed(result.value) : Effect.fail(result.error)
)

const handleError = (error: AppError): number => {
  switch (error._tag) {
    case "NotFound":
      return -error.id
    case "RateLimited":
      return -100 - error.retryAfter
    case "Invalid":
      return -200 - error.reason.length
  }
}

const runSwitchResult = (): number => {
  let checksum = 0
  const mask = results.length - 1
  for (let i = 0; i < ITERATIONS; i++) {
    const result = results[i & mask]
    switch (result._tag) {
      case "Ok":
        checksum += result.value
        break
      case "Err":
        checksum += handleError(result.error)
        break
    }
  }
  return checksum
}

const runTsPatternResult = (): number => {
  let checksum = 0
  const mask = results.length - 1
  for (let i = 0; i < ITERATIONS; i++) {
    checksum += match(results[i & mask])
      .with({ _tag: "Ok" }, ({ value }) => value)
      .with({ _tag: "Err", error: { _tag: "NotFound" } }, ({ error }) => -error.id)
      .with({ _tag: "Err", error: { _tag: "RateLimited" } }, ({ error }) => -100 - error.retryAfter)
      .with({ _tag: "Err", error: { _tag: "Invalid" } }, ({ error }) => -200 - error.reason.length)
      .exhaustive()
  }
  return checksum
}

const runSwitchExit = (): number => {
  let checksum = 0
  const mask = effects.length - 1
  for (let i = 0; i < ITERATIONS; i++) {
    const exit = Effect.runSyncExit(effects[i & mask])
    switch (exit._tag) {
      case "Success":
        checksum += exit.value
        break
      case "Failure":
        checksum -= 1
        break
    }
  }
  return checksum
}

const runEffectMatch = (): number => {
  let checksum = 0
  const mask = effects.length - 1
  for (let i = 0; i < ITERATIONS; i++) {
    checksum += Effect.runSync(
      Effect.match(effects[i & mask], {
        onFailure: handleError,
        onSuccess: (value) => value
      })
    )
  }
  return checksum
}

const runTsPatternExit = (): number => {
  let checksum = 0
  const mask = effects.length - 1
  for (let i = 0; i < ITERATIONS; i++) {
    checksum += match(Effect.runSyncExit(effects[i & mask]))
      .with({ _tag: "Success" }, ({ value }) => value)
      .with({ _tag: "Failure" }, () => -1)
      .exhaustive()
  }
  return checksum
}

const measure = (label: string, iterations: number, fn: () => number) => {
  for (let i = 0; i < 3; i++) fn()
  const samples: Array<number> = []
  let checksum = 0
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now()
    checksum = fn()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]!
  const opsPerMs = iterations / median
  console.log(`${label.padEnd(28)} ${median.toFixed(2).padStart(8)} ms  ${opsPerMs.toFixed(0).padStart(8)} ops/ms  checksum=${checksum}`)
}

console.log("switch/case vs Effect.match vs ts-pattern")
console.log(`iterations/sample=${ITERATIONS}, samples=${SAMPLES}`)
console.log("\nplain tagged union")
measure("switch/case", ITERATIONS, runSwitchResult)
measure("ts-pattern", ITERATIONS, runTsPatternResult)
console.log("\nEffect success/failure handling")
measure("runSyncExit + switch", ITERATIONS, runSwitchExit)
measure("Effect.match + runSync", ITERATIONS, runEffectMatch)
measure("runSyncExit + ts-pattern", ITERATIONS, runTsPatternExit)
