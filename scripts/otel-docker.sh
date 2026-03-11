#!/usr/bin/env bash
# Start Grafana LGTM for the telemetry demo.
# Automatically finds a free port for Grafana UI if the default (3033) is busy.

GRAFANA_PORT="${GRAFANA_PORT:-3033}"

# Find a free port starting from GRAFANA_PORT
while lsof -i :"$GRAFANA_PORT" -t >/dev/null 2>&1; do
  GRAFANA_PORT=$((GRAFANA_PORT + 1))
done

echo ""
echo "============================================"
echo "  Grafana UI: http://localhost:${GRAFANA_PORT}"
echo "============================================"
echo ""
echo "  (ignore 'localhost:3000' in container output below — that's the internal port)"
echo ""
echo "  After 'pnpm run 09', find your traces:"
echo "    1. Open http://localhost:${GRAFANA_PORT}"
echo "    2. Left sidebar -> Explore (compass icon)"
echo "    3. Data source dropdown -> Tempo"
echo "    4. Search tab -> Service Name: effect-presentation"
echo "    5. Run query -> click on the trace"
echo ""

docker run \
  -p "${GRAFANA_PORT}:3000" \
  -p 4317:4317 \
  -p 4318:4318 \
  --rm -it docker.io/grafana/otel-lgtm
