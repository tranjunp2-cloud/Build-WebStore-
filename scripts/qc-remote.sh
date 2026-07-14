#!/usr/bin/env bash
# QC remote runner — pull QC env from Vercel then run the given npm script.
#
# Removes the manual .env.qc-test dance: no more copying values from Vercel
# Dashboard into a local file. The Vercel CLI pulls the current Preview
# (qc-test) env into .vercel/.env.qc-test.local (gitignored, wiped on exit).
#
# Usage:
#   bash scripts/qc-remote.sh db:seed-qc-scaled   # seed 300 merchants
#   bash scripts/qc-remote.sh db:reset-qc         # wipe QC data
#   bash scripts/qc-remote.sh db:seed-qc          # baseline 5-tenant seed
#
# Prereqs (one-off): `vercel login` + project already linked (repo has
# .vercel/project.json). Both true for anyone who has run any vercel CLI
# command in this repo before.
#
# Safety:
#   - Refuses to run if APP_ENV != 'qc-test' (env pull mis-scoped guard)
#   - Env file wiped via EXIT trap even on failure — no stale secrets on disk

set -euo pipefail

CMD="${1:-}"
if [[ -z "$CMD" ]]; then
  echo "Usage: bash scripts/qc-remote.sh <npm-script-name>"
  echo "Examples:"
  echo "  bash scripts/qc-remote.sh db:seed-qc-scaled"
  echo "  bash scripts/qc-remote.sh db:reset-qc"
  exit 1
fi

ENV_FILE=".vercel/.env.qc-test.local"

cleanup() {
  rm -f "$ENV_FILE"
}
trap cleanup EXIT

echo "→ Pulling QC env from Vercel (Preview scope, branch=qc-test)..."
npx vercel env pull "$ENV_FILE" --environment=preview --git-branch=qc-test --yes

echo "→ Loading env vars..."
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# Safety guard — the env file MUST have stamped APP_ENV=qc-test. If it
# didn't (branch-filter misconfig / wrong scope), abort before we touch
# any database.
if [[ "${APP_ENV:-}" != "qc-test" ]]; then
  echo "❌ APP_ENV='${APP_ENV:-<unset>}' — expected 'qc-test'. Refusing to run '$CMD'."
  echo "   Check Vercel Dashboard → Env Vars → APP_ENV must be scoped Preview + branch=qc-test."
  exit 1
fi

echo "→ Running: npm run $CMD"
npm run "$CMD"

echo "✅ Done. Env file wiped."
