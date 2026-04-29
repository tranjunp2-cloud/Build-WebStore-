#!/bin/bash
set -e
node scripts/db-setup.js --migrate-only
if [ "$ENABLE_HARNESS" = "1" ]; then
  echo "[harness] ENABLE_HARNESS=1 — running gen+score"
  npx tsx scripts/test-harness/cli.ts --mode=full && \
    npx tsx scripts/test-harness/rubric/scorer.ts || \
    echo "[harness] WARNING: gen or scorer failed (non-blocking)"
else
  echo "[harness] ENABLE_HARNESS not set — skipping gen"
fi
next build
