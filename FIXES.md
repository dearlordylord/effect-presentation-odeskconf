# Fixes

## Critical

- [ ] **FIX-1** `05-fibers/index.ts` — Revert `forkScoped` to `Effect.fork`. Remove `Effect.scoped` wrapper. `fork` already provides structured concurrency (child dies with parent). Run as standalone gen so workers don't leak into bounded demo.
- [ ] **FIX-2** `03-clocks/index.ts:44` — Replace `Date.now()` with `Clock.currentTimeMillis` in the demo `main`.
- [ ] **FIX-3** `tsconfig.json:17` — Remove `@effect/language-service` plugin (not installed).

## Important

- [ ] **FIX-4a** `02-dependency-injection/index.test.ts` — Strengthen failure assertions: check error `_tag`, not just `Exit.isFailure`.
- [ ] **FIX-4b** `03-clocks/index.test.ts` — Same: check `TaskExpiredError._tag` in failure case.
- [ ] **FIX-5a** `05-fibers/index.ts:12` — `onInterrupt` callback: accept `(_interruptors)` param.
- [ ] **FIX-5b** `06-interrupts/index.ts:14` — Same.
- [ ] **FIX-6** `04-resource-control/index.ts:73` — Fix output comment: 17 bytes, not 16.
- [ ] **FIX-7** `09-telemetry/index.ts:30-48` — Update span tree comment to include `/poll` children.
- [ ] **FIX-8** `07-scheduling-retry/index.ts:25` — Add comment noting mutable `attempt` limitation.
- [ ] **FIX-9** `06-interrupts/index.ts:40-41` — Remove dangling `acquireRelease` comment (not demonstrated in this file).
- [ ] **FIX-10** `10-standard-library/index.ts:49` — Fix `Array.groupBy` return type: `Record<string, NonEmptyArray<Task>>`.

## Recommendations (comment-only)

- [ ] **FIX-12** `package.json` — Remove `@opentelemetry/sdk-trace-web` (browser package, not needed).
- [ ] **FIX-13** `02-dependency-injection/index.ts` — Add comment mentioning `Effect.Service` as newer alternative.
