# Workshop Flow

## Before the workshop

### Prerequisites (your machine)
- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Docker (for telemetry demo)

### Setup
```bash
pnpm install
pnpm run slides
```

### Pre-pull the Docker image (avoid waiting during the talk)
```bash
docker pull docker.io/grafana/otel-lgtm
```

### Verify everything works
```bash
pnpm test              # 6 tests pass
pnpm run 01            # typed errors demo
pnpm run 09            # telemetry (will fail to export without docker, but should run)
```

---

## During the workshop

### Slides
Open `slides.html` in browser. Navigate with arrow keys, `f` for fullscreen.

### Demo order

| Slide section | Command | What to show |
|---|---|---|
| 01 -- Typed Errors | `pnpm run 01` | catchTag handling, error in output |
| 02 -- Dependency Injection | `pnpm run 02` | service wiring, "Started: Write docs" |
| 02 -- DI tests | `pnpm test` | mock repo, all 6 tests pass |
| 03 -- Clocks | `pnpm run 03` | "Task is still valid" |
| 03 -- Clock tests | `pnpm test` | TestClock.adjust, instant deterministic tests |
| 04 -- Resource Control | `pnpm run 04` | acquire/release order in output |
| 05 -- Fibers | `pnpm run 05` | workers ticking, then interrupted, then bounded parallelism |
| 06 -- Interrupts | `pnpm run 06` | interrupt mid-task, cleanup runs |
| 07 -- Scheduling & Retry | `pnpm run 07` | 3 attempts, then success |
| 08 -- Queues | `pnpm run 08` | queue backpressure demo |
| 09 -- Telemetry | see below | trace tree in Grafana |
| 10 -- Standard Library | (slide only) | |
| 11 -- Composability | (slide only) | |

### Telemetry demo (09) -- requires preparation

1. Start Grafana LGTM in a separate terminal **before** reaching slide 09:
   ```bash
   pnpm run docker:otel
   ```
   This auto-finds a free port for Grafana UI (default 3033, increments if busy).
   Wait until you see "The OpenTelemetry collector and the Grafana LGTM stack are up and running".
   Note the Grafana URL printed in the output.

2. When you reach the telemetry slides, run:
   ```bash
   pnpm run 09
   ```

3. Switch to browser, open the Grafana URL from step 1
   - Go to Explore (compass icon in sidebar)
   - Select "Tempo" as data source
   - Click "Search" tab
   - Service Name: "effect-presentation"
   - Click "Run query"
   - Click on the trace to see the span tree

4. Show the span tree -- it matches the ASCII diagram on the slide.

---

## Troubleshooting

- **Telemetry demo shows no traces**: wait a few seconds after `pnpm run 09` for the batch exporter to flush. Re-run the query in Grafana.
- **Port conflict on OTLP ports (4317/4318)**: these are standard OTLP ports and shouldn't be changed (the exporter defaults to 4318). Kill any other OTel collector on those ports.
- **pnpm run 09 errors**: make sure Docker is running and the LGTM container is up.
- **Custom Grafana port**: `GRAFANA_PORT=4000 pnpm run docker:otel`
