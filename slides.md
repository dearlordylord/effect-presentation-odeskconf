---
marp: true
theme: default
paginate: true
backgroundColor: #1e1e2e
color: #cdd6f4
style: |
  section {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 22px;
  }
  h1, h2, h3 {
    color: #89b4fa;
  }
  code {
    background: #313244;
    color: #a6e3a1;
  }
  pre {
    background: #181825 !important;
    border: 1px solid #313244;
  }
  a { color: #89b4fa; }
  strong { color: #f9e2af; }
  em { color: #cba6f7; }
  blockquote { border-left: 4px solid #89b4fa; padding-left: 1em; color: #a6adc8; }
  .small { font-size: 0.78em; }
  .muted { color: #a6adc8; }
  .skip { color: #fab387; font-size: 0.76em; }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.2rem;
  }
  .three {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.8rem;
  }
  .intro {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    position: relative;
  }
  .intro h1 {
    margin-bottom: 0.25em;
  }
  .intro-subtitle {
    color: #f9e2af;
    margin: 0 0 1rem;
    font-size: 1.05em;
  }
  .intro-link {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.85em;
    margin-right: 1rem;
  }
  .intro-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 2px solid #89b4fa;
    object-fit: cover;
  }
  .intro-links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.45rem;
  }
  .intro-row {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.85em;
  }
  .ie-badge {
    width: 42px;
    height: 42px;
    object-fit: contain;
  }
---

<div class="intro">
  <h1>Igor Loskutov</h1>
  <p class="intro-subtitle">software design enthusiast</p>
  <div class="intro-links">
    <a class="intro-link" href="https://github.com/dearlordylord">
      <img src="assets/igor-avatar.png" class="intro-avatar" />
      github.com/dearlordylord
    </a>
    <a class="intro-row" href="https://dearlordylord.com/">
      <img src="assets/internet-explorer.svg" class="ie-badge" />
      dearlordylord.com
    </a>
  </div>
</div>

---

# Effect-TS

### The missing typescript standard library

- error handling
- dependency injection
- structured concurrency
- resource management
- numerous other QOL features
- all that composable with each other

---

## Effect?

![h:260 Effect type anatomy](assets/effect-type.svg)

- description of work
- typically runs at program edge

```typescript
Effect.runPromise(program)
```

- can be seen as `(rs: Requirements) => Promise<() => {error: Error} | {success: Success}>`

---

```typescript
// plain ts example
async function firstIssueTitle(projectId: string): Promise<string> {
  const response = await fetch(`/projects/${projectId}/issues`)
  const data = await response.json()
  return data.items[0].title
}
```


---

## What do callers see?

Plain TS:

```typescript
firstIssueTitle:
  (projectId: string) => Promise<string>
```

Effect:

```typescript
firstIssueTitle:
  (projectId: ProjectId) =>
    Effect<string, HttpClientError | ParseError | NoIssuesFound, HttpClient>
```

- `Promise<string>`: success shape only
- `Effect<string, HttpClientError | ParseError | NoIssuesFound, HttpClient>`: success + failure + requirement

---

## Where did the cognitive load go?

```typescript
async function firstIssueTitle(projectId: string): Promise<string> {
  const response = await fetch(`/projects/${projectId}/issues`)
  const data = await response.json()
  return data.items[0].title
}
```

- HTTP can fail
- JSON may not match the expected shape
- `items` may be missing or empty
- `title` may not be a string


---

## Boundary validation

```typescript
const TaskInput = Schema.Struct({
  id: Schema.String,
  title: Schema.NonEmptyString,
  priority: Schema.Literal("low", "medium", "high"),
})

type TaskInput = typeof TaskInput.Type

Schema.decodeUnknown(TaskInput)(userInput)
// Effect<TaskInput, ParseError>
```

- validates unknown input
- inferred static type
- error channel: `ParseError`

---

## Rewritten: setup

```typescript
const ProjectId = Schema.String.pipe(Schema.brand("ProjectId"))
type ProjectId = typeof ProjectId.Type

const ProjectIssues = Schema.Struct({
  items: Schema.Array(Schema.Struct({
    title: Schema.String,
  })),
})

class NoIssuesFound extends Schema.TaggedError<NoIssuesFound>()(
  "NoIssuesFound",
  { projectId: ProjectId }
) {}
```

---

## Rewritten

```typescript
const firstIssueTitle =
  (projectId: ProjectId) =>
    Effect.gen(function* () {
      const response =
        yield* HttpClient.get(`/projects/${projectId}/issues`)

      yield* HttpClientResponse.filterStatusOk(response)

      const data =
        yield* HttpClientResponse.schemaBodyJson(ProjectIssues)(response)

      const first = data.items[0]
      if (!first) return yield* Effect.fail(new NoIssuesFound({ projectId }))

      return first.title
    })

// Effect<string, HttpClientError | ParseError | NoIssuesFound, HttpClient>
```

---

# Problem 1

## "What can this throw?"

---

## The classic code hides the contract

```typescript
async function fetchTask(id: string): Promise<Task> {
  const row = await db.get(id)
  if (!row) throw new Error("not found")
  return row
}

async function startTask(id: string): Promise<Task> {
  const task = await fetchTask(id)
  if (task.status !== "pending") throw new Error("bad status")
  return db.update(id, { status: "running" })
}
```

- visible: `Promise<Task>`
- hidden: `not found`
- hidden: `bad status`

---

## Effect puts failures in the type

```typescript
fetchTask:
  (id: string) => Effect<Task, TaskNotFoundError>

startTask:
  (id: string) =>
    Effect<Task, TaskNotFoundError | InvalidStatusError>
```

---

## Errors are domain values

```typescript
class TaskNotFoundError extends Schema.TaggedError<TaskNotFoundError>()(
  "TaskNotFoundError",
  { id: Schema.String }
) {
  get message() {
    return `Task '${this.id}' not found`
  }
}
```

---

## Handle one problem, leave the rest visible

```typescript
const result = yield* startTask("missing").pipe(
  Effect.catchTag("TaskNotFoundError", (e) =>
    createTask({ id: e.id, title: "Untitled" })
  )
)

// Before: Effect<Task, TaskNotFoundError | InvalidStatusError>
// After:  Effect<Task, InvalidStatusError>
```

- remaining error: `InvalidStatusError`

---

# Problem 2

## "My tests need a real service"

---

## The pain

- start a database
- seed it in the correct order
- configure a fake API key
- avoid conflicting ports
- clean up after a failed run
- hope nobody else changed staging state
- how to run many worktrees coding agent harnesses in parallel?

---

## Define **what**, not **how**

```typescript
type TaskId = string
type TaskStatus = "pending" | "running" | "done" | "failed"

class TaskRepository extends Context.Tag("TaskRepository")<
  TaskRepository,
  {
    readonly fetchById:
      (id: TaskId) => Effect<Task, TaskNotFoundError>
    readonly updateStatus:
      (id: TaskId, status: TaskStatus) =>
        Effect<Task, TaskNotFoundError>
  }
>() {}
```

- named service contract

---

## Business logic asks for the service

```typescript
const startTask = (id: TaskId) =>
  // Effect<Task, TaskNotFoundError | InvalidStatusError, TaskRepository>
  Effect.gen(function* () {
    const repo = yield* TaskRepository
    const task = yield* repo.fetchById(id)

    if (task.status !== "pending") {
      return yield* Effect.fail(new InvalidStatusError({
        id,
        current: task.status,
        expected: "pending",
      }))
    }

    return yield* repo.updateStatus(id, "running")
  })
```

- no constructor plumbing
- no global singleton
- no hidden import

---

## Provide the implementation at the edge

```typescript
const main = startTask("1").pipe(
  Effect.tap((task) => Effect.log(`Started: ${task.title}`)),
  Effect.provideService(TaskRepository, inMemoryRepo)
)
```

- before: requires `TaskRepository`
- after: requirement satisfied

---

## Layer: package the implementation

```typescript
const TaskRepositoryTest =
  Layer.succeed(TaskRepository, testRepo)

const result = startTask("1").pipe(
  Effect.provide(TaskRepositoryTest)
)
```

- one service: `provideService`
- app graph: `Layer`

---

## Layers constitute dependency graph

![h:260 Layers constitute dependency graph](assets/layer-dependency.svg)

- `Effect.provide(AppLayer)`

---

## Swappable layer combinations

![h:260 Swappable layer combinations](assets/layer-combinations.svg)

- any service can move independently
- production service + fake LLM
- real HTTP + in-memory database
- disabled telemetry + real cache

---

## Plain TS mock

```typescript
jest.mock("./TaskRepository", () => ({
  fetchById: jest.fn(),
  updateStatus: jest.fn(),
}))

beforeEach(() => {
  jest.resetAllMocks()
  mocked(fetchById).mockResolvedValue(mockTask)
  mocked(updateStatus).mockResolvedValue({ ...mockTask, status: "running" })
})
```

---

## Effect test implementation

```typescript
const testRepo = TaskRepository.of({
  fetchById: (id) =>
    id === "1"
      ? Effect.succeed(mockTask)
      : Effect.fail(new TaskNotFoundError({ id })),

  updateStatus: (_id, status) =>
    Effect.succeed({ ...mockTask, status }),
})
```

---

# Problem 3

## "Time made my test flaky"

---

## Date.now() is a global dependency

```typescript
function assertFresh(task: Task): Task {
  const elapsed = Date.now() - task.createdAt
  if (elapsed > 30_000) throw new Error("expired")
  return task
}
```

- global dependency
- patch globals
- fake timers
- real waiting

---

## Clock.currentTimeMillis

```typescript
const assertFresh = (task: Task) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const elapsed = now - task.createdAt

    if (elapsed > TASK_TIMEOUT_MS) {
      return yield* Effect.fail(new TaskExpiredError({ id: task.id, elapsed }))
    }

    return task
  })
```

- `Clock` -> `TestClock`
- `Random` -> seeded / controlled random
- time / sleeps / timeouts
- random IDs / sampling / jitter

---

## No real waiting

```typescript
it("expires after 30 seconds", () =>
  Effect.gen(function* () {
    const task: Task = {
      id: "1",
      title: "Old task",
      status: "running",
      createdAt: 0,
    }

    yield* TestClock.adjust("31 seconds")

    const exit = yield* Effect.exit(assertFresh(task))
    expect(Exit.isFailure(exit)).toBe(true)
  }).pipe(
    Effect.provide(TestContext.TestContext),
    Effect.runPromise
  ))
```

- virtual time
- no wall-clock wait

---

## This is the bridge to parallel work

![h:270 Agentic feedback loops](assets/agent-feedback.svg)

- isolated service state
- no wall-clock sleeps
- faster local validation for coding agents

---

## Runtime execution model

```text
Effect<Success, Error, Requirements>
```

describes the work.

The runtime executes it with:

- scopes: lifetime boundaries
- fibers: structured concurrent work
- schedules: retry / repeat policies
- spans: telemetry attached to work

---

## Cleanup

```typescript
async function processTask(signal: AbortSignal) {
  const db = await connectDb()
  const store = await openFileStore()

  try {
    signal.throwIfAborted()
    await db.query("SELECT * FROM tasks")
    signal.throwIfAborted()
    await store.write("/output/result.json", "{}")
  } finally {
    await store.close()
    await db.close()
  }
}
```

- cleanup is local
- cancellation is manual
- every async boundary needs attention

---

## Resource lifetime should be explicit

```typescript
const makeDbConnection = Effect.acquireRelease(
  Effect.gen(function* () {
    // call whatever DB connection mechanics
    return { query: (sql) => Effect.log(`[DB] ${sql}`) }
  }),
  (_db) => Effect.sync(() => {
    // call whatever DB disconnection mechanics
  })
)
```

- release on success
- release on failure
- release on interruption

---

## Scopes

```typescript
const main = Effect.scoped(
  Effect.gen(function* () {
    const db = yield* makeDbConnection
    const store = yield* makeFileStore

    yield* db.query("SELECT * FROM tasks")
    yield* store.write("/output/result.json", "{}")
  })
)
```

- acquire on scope entry
- release on scope exit
- reverse release order

---

## Interruption and scoped finalizers

```typescript
const longTask = Effect.gen(function* () {
  for (let i = 1; i <= 5; i++) {
    yield* Effect.log(`Task: step ${i}/5`)
    yield* Effect.sleep("300 millis")
  }
}).pipe(
  Effect.onInterrupt(() =>
    Effect.log("Task: interrupted! releasing connections...")
  )
)
```

- cooperative interruption
- interrupt handlers run on interruption
- scoped resources release through scopes

---

## Bounded parallelism

```typescript
const results = yield* Effect.all(
  taskIds.map((id) =>
    Effect.gen(function* () {
      yield* Effect.log(`Task ${id}: start`)
      yield* Effect.sleep("50 millis")
      return id
    })
  ),
  { concurrency: 3 }
)
```

- `Promise.all` shape
- runtime concurrency limit

---

## Schedules / retry

```typescript
const retrySchedule = Schedule.intersect(
  Schedule.exponential("100 millis"),
  Schedule.recurs(3)
)

const withRetry = flakyCall.pipe(
  Effect.retry({
    schedule: retrySchedule,
    while: (e) => e.retryable,
  })
)
```

- retry policy is a value
- retryable errors retry
- non-retryable errors fail immediately

---

## Composable observability

---

## Spans attach to the work

```typescript
const processTask = (name: string) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("task.name", name)
    yield* op("validate", 4)
    yield* fetchDeps(name)
    yield* op("persist", 8)
  }).pipe(Effect.withSpan(`processTask[${name}]`))
```

---

## Visuals

![h:520 Grafana trace view](assets/grafana-trace.png)

---

## Bigger example

```typescript
async function ingestBatch(urls: string[]): Promise<IngestSummary> {
  const pages = await Promise.all(
    urls.map((url) => fetch(url).then((r) => r.text()))
  )

  const records = pages.flatMap(extractRecords)
  await saveRecords(records)
  console.log(`ingested: ${records.length}`)
  return summarize(records)
}
```

- retry?
- concurrency limit?
- validation?
- partial failure?
- persistence errors?
- trace?
- cancellation?
- timeout?

---

## Bigger example: TS with those concerns

<div class="small">

```typescript
async function ingestBatch(urls: string[], signal: AbortSignal): Promise<IngestResult> {
  const timeout = AbortSignal.timeout(10_000)
  const combined = AbortSignal.any([signal, timeout])
  const span = tracer.startSpan("ingestBatch")
  try {
    const pages = await pLimit(8).map(
      urls,
      (url) => retry(() => fetchText(url, combined), 3)
    )

    const parsed = SourceRecords.safeParse(pages.flatMap(extractRecords))
    if (!parsed.success) return { ok: false, error: "InvalidRecords" }
    combined.throwIfAborted()

    await saveRecords(parsed.data, combined)
    console.log(`ingested: ${parsed.data.length}`)
    span.setStatus({ code: SpanStatusCode.OK })
    return { ok: true, summary: summarize(parsed.data) }
  } catch (error) {
    span.recordException(error)
    return { ok: false, error: classify(error) }
  } finally {
    span.end()
  }
}
```

</div>

---

## Bigger example: ingestion in Effect

```typescript
const retryPolicy =
  Schedule.exponential(Duration.millis(100)).pipe(
    Schedule.compose(Schedule.recurs(3))
  )

const ingestBatch = (urls: ReadonlyArray<SourceUrl>) =>
  Effect.gen(function* () {
    const pages = yield* Effect.all(
      urls.map((url) => fetchText(url).pipe(
        Effect.retry(retryPolicy)
      )),
      { concurrency: 8 }
    )

    const records = yield* Schema.decodeUnknown(SourceRecords)(
      pages.flatMap(extractRecords)
    )
    yield* saveRecords(records)
    return summarize(records)
  }).pipe(
    Effect.timeoutFail({
      duration: Duration.seconds(10),
      onTimeout: () => new IngestError({ reason: "Timeout" }),
    }),
    Effect.tap((summary) => Effect.logInfo(`ingested: ${summary.count}`)),
    Effect.withSpan("ingestBatch")
  )
```

---

## Bigger example: caller view

```typescript
ingestBatch:
  (urls: ReadonlyArray<SourceUrl>) =>
    Effect<
      IngestSummary,
      HttpError | ParseError | DbError | IngestError,
      HttpClient | RecordRepository
    >
```

---

## Takeaways

1. failures in type
2. external services behind contracts
3. time/config/random as dependencies
4. isolated and deterministic tests are good for coding agents
5. runtime execution model: scopes, fibers, schedules, telemetry

---

# Thanks

- [effect.website/docs](https://effect.website/docs)
- [effect.solutions](https://www.effect.solutions/)
- [youtube.com/@effect-ts](https://www.youtube.com/@effect-ts)
