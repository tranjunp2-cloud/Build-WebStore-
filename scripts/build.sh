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
NODE_OPTIONS="--max-old-space-size=4096" next build
