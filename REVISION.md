# Slide Revision Plan

## Meta

### 9. All code snippets must be compilable, validatable, and testable
- Note for implementation phase: extract each slide's code into a file, run tsc --noEmit, add to CI or test script
- Every snippet shown on slides must actually compile against current Effect API

---

## Slide-by-slide fixes

### 1. Subtitle
DECIDED: "The production TS framework she tells you not to worry about"

### 4. Error slide title
DECIDED: "I just don't know what went wrong" — Derpy Hooves
(use as a quote/epigraph on the slide)

### 7. Show resulting type of `result` in comments
After catchTag("InvalidStatusError", handler):
```
// startTask("2")                            => Effect<Task, TaskNotFoundError | InvalidStatusError>
// .pipe(catchTag("InvalidStatusError", ...)) => Effect<Task, TaskNotFoundError>
//                                                             ^^^^^^^^^^^^^^^^
//                                          InvalidStatusError removed from the union
// result (after yield*)                     => Task
```
DECIDED: yes, show this type progression

### 10. Layer as DAG node — yes, layers form a DAG
From Effect docs: "To represent the dependency graph of our program and manage these dependencies more effectively, we can utilize a powerful abstraction called Layer."

Proposed ASCII DAG for slide:
```
         Config
        /      \
       v        v
    Logger --> Database
```
- Config has no deps (leaf)
- Logger depends on Config
- Database depends on Config + Logger
- Layer.provide composes the graph: `Layer.provide(DatabaseLive, Layer.merge(ConfigLive, LoggerLive))`
- Effect deduplicates shared nodes (Config built once, shared)

### 10 (second item). Rename findById → fetchById
Where TaskNotFoundError is relevant (slide 10 has TaskRepository with findById). Rename to fetchById.

### 11. Type annotation is inferred — don't need to write it
Change:
```typescript
const startTask = (
  id: string
): Effect<Task, TaskNotFoundError | InvalidStatusError, TaskRepository> =>
```
To:
```typescript
const startTask = (id: string) =>
  //  ^? Effect<Task, TaskNotFoundError | InvalidStatusError, TaskRepository>
  //     (inferred — you never write this)
```
Use `^?` twoslash-style comment to show "hover" type. Or just a comment like "// inferred type: ..."

### 12. "is GONE" → "is no more"
```
// The TaskRepository requirement is no more — it's been satisfied.
```

### 14. "automatically replaced" — don't bold. Color in rainbow if possible
Remove bold. For rainbow, Marp supports inline HTML:
```html
<span style="background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">automatically replaced</span>
```

### 15. checkExpiry → assertFresh
Rename function in slide and in source file (src/03-clocks/index.ts)

### 16. "No real delays. Deterministic. Instant." → "No delays."
Just: "No delays."

### 18. async has finally. Remove caps lock.
- Acknowledge that async/await does have `finally`. The distinction is: acquireRelease works across async + concurrency + interrupts (finally doesn't compose with those).
- Change "ALWAYS runs" to just "always runs" (lowercase)
- General rule: scan all slides for caps lock usage. Remove all caps unless explicitly asked. Caps reads as ironic.

Full caps audit — instances to fix:
- Slide 4: "PART OF THE TYPE" → "part of the type"
- Slide 5: "EXACTLY" → "exactly"
- Slide 7: "NOT caught" → "not caught"
- Slide 12: "GONE" → already fixed to "no more"
- Slide 18: "ALWAYS" → "always"
- Slide 19: "No matter what" in bold → remove
- Slide 23: (none found)
- Slide 25: (none found)
- Slide 30: "ALL" → "all"
- Slide 42: "ALL" → "all"

### 19. Remove fake strong phrasing
"Both acquired, both released. No matter what." → rewrite to just state the fact:
"Both resources acquire on entry, release on exit — including on error or interrupt."

### 21. fork/forkScoped — reconsider inclusion
From Effect docs, four forking strategies:
1. `Effect.fork` — structured concurrency, child supervised by parent (default, usually what you want)
2. `Effect.forkDaemon` — global scope, lives independently
3. `Effect.forkScoped` — tied to local scope, can outlive parent
4. `Effect.forkIn` — tied to specific scope

For an intro presentation: `Effect.fork` is the core concept. forkScoped/forkDaemon are advanced.
Proposal: mention only `Effect.fork` on the slide. Add a single line noting forkScoped/forkDaemon exist for when you need different lifetimes. Don't give them equal billing.

Remove: "No leaked background work. No orphan promises." — replace with factual: "child fibers are interrupted when parent completes"

### 22. onInterrupt is not cleanup — title/code mismatch
`onInterrupt` only runs on interruption, not on normal completion or failure.
For true "cleanup on all exits", use `Effect.ensuring` or `Effect.addFinalizer`.

DECIDED: (c) Show both: `ensuring` for always-run cleanup, `onInterrupt` for interrupt-specific handling

### 23. "One option. No semaphores. No pool libraries." — remove
Replace with factual: "`concurrency` option controls max parallel fibers"

### 25. onInterrupt is not cleanup (interrupts slide)
Same issue as 22. Here it's more correct because we're explicitly interrupting.
But the log message says "cleaning up resources..." which implies general cleanup.
Change to: "interrupted! releasing connections..." or similar interrupt-specific language.

### 26. Interrupts — add plain TypeScript comparison
Show how AbortController works in plain TS, especially:
- manual signal threading through every function call
- libraries that don't accept AbortSignal at all
- nested cancellation (cancelling a parent doesn't propagate without manual wiring)

Sketch:
```typescript
// Plain TypeScript interrupt attempt:
const controller = new AbortController()
async function fetchData(signal: AbortSignal) {
  const resp = await fetch(url, { signal }) // ok, fetch supports it
  const parsed = await parseResponse(resp)  // parseResponse doesn't accept signal
  await db.save(parsed)                     // db.save doesn't either
  // if controller.abort() is called during parseResponse or db.save,
  // nothing happens — those operations don't know about signals
}
```
vs Effect where every yield* point is interruptible by default.

### 29. "e.retryable" needs elaboration
Show the error class definition:
```typescript
class ExternalServiceError extends Schema.TaggedError<ExternalServiceError>()(
  "ExternalServiceError",
  { message: Schema.String, retryable: Schema.Boolean }
) {}
```
Then explain: "`while: (e) => e.retryable` — retry on timeout/network errors, fail immediately on auth errors or bad requests"

### 32. PubSub example too synthetic
DECIDED: (a) Remove PubSub slide entirely (Queue is enough for intro)

### 36. Docker trace viewer
Already in src/09-telemetry/index.ts:
```
docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -it docker.io/grafana/otel-lgtm
```
This is Grafana LGTM (Loki+Grafana+Tempo+Mimir) all-in-one image.
- Grafana UI at http://localhost:3000
- OTLP receiver at port 4318 (HTTP) / 4317 (gRPC)
- After running `pnpm run 09`, go to Grafana → Explore → Tempo → Search → find trace

Add to slide:
1. Docker command
2. "run pnpm run 09"
3. "open http://localhost:3000 → Explore → Tempo"
4. Consider: screenshot of the trace tree in Grafana? (can add later)

Alternative: Jaeger (simpler UI, single purpose). But Grafana LGTM is already set up in the code.
Recommendation: stick with Grafana LGTM, it's already wired.

### 38. "null done right" — bad wording
DECIDED: (d) Remove the subtitle, just show the code

### 42. "No manual wiring. The compiler does it" — reword
DECIDED: (c) Remove the line, let the code speak

### 43. Layers compose slide
DECIDED: (c) Merge into slide 42 as a one-liner

### 44. Key insight
DECIDED: (A) "Effect gives you one API for things that are usually separate libraries: error handling, retries, concurrency, DI, resource management, observability. They share one type and compose without glue code."
