#!/usr/bin/env bash
# Start Grafana LGTM for the telemetry demo.
# Automatically finds a free port for Grafana UI if the default (3033) is busy.

GRAFANA_PORT="${GRAFANA_PORT:-3033}"

# Find a free port starting from GRAFANA_PORT
while lsof -i :"$GRAFANA_PORT" -t >/dev/null 2>&1; do
  GRAFANA_PORT=$((GRAFANA_PORT + 1))
done

echo "Starting Grafana LGTM..."
echo "  Grafana UI: http://localhost:${GRAFANA_PORT}"
echo "  OTLP HTTP:  http://localhost:4318"
echo "  OTLP gRPC:  http://localhost:4317"
echo ""
echo "After running 'pnpm run 09', open:"
echo "  http://localhost:${GRAFANA_PORT}/explore -> Tempo -> Search"
echo ""

docker run \
  -p "${GRAFANA_PORT}:3000" \
  -p 4317:4317 \
  -p 4318:4318 \
  --rm -it docker.io/grafana/otel-lgtm
