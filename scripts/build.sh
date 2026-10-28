#!/bin/bash
set -e
node scripts/db-setup.js --migrate-only
npm run templates:seed
if [ "$ENABLE_HARNESS" = "1" ]; then
  echo "[harness] ENABLE_HARNESS=1 — running gen+score"
  npx tsx scripts/test-harness/cli.ts --mode=full && \
    npx tsx scripts/test-harness/rubric/scorer.ts || \
    echo "[harness] WARNING: gen or scorer failed (non-blocking)"
else
  echo "[harness] ENABLE_HARNESS not set — skipping gen"
fi
# The AI copilot packages pushed next build past a 4 GB heap (OOM on the CI runner).
# Print free memory first so a future OOM shows whether the runner itself is short.
free -m 2>/dev/null || true
NODE_OPTIONS="--max-old-space-size=6144" next build
