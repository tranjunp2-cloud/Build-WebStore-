#!/usr/bin/env bash
# Post-deploy template seed — plan 260419-2022 Phase 03.
# Waits for $DEPLOY_URL healthy, then force-reseeds via Bearer $SEED_TOKEN.
# Fails (exit 1) on timeout, non-200, or body success != true.
#
# Required env: DEPLOY_URL (e.g. https://web-v2.dev.ecommercehub.my), SEED_TOKEN

set -euo pipefail

: "${DEPLOY_URL:?DEPLOY_URL required}"
: "${SEED_TOKEN:?SEED_TOKEN required}"

# Mask token in any downstream logs even if it slips into an error body.
echo "::add-mask::${SEED_TOKEN}"

DEPLOY_URL="${DEPLOY_URL%/}"
SEED_URL="${DEPLOY_URL}/api/templates/seed?v3=true&force=true"
HEALTH_URL="${DEPLOY_URL}/api/health"

echo "[seed] target=${DEPLOY_URL}"

# 1. Wait up to 120s for deploy health (try /api/health then /)
deadline=$(( $(date +%s) + 120 ))
attempt=0
while :; do
  attempt=$((attempt + 1))
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || echo "000")
  [ "$code" = "200" ] && { echo "[seed] health ok (attempt=${attempt})"; break; }
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DEPLOY_URL/" || echo "000")
  case "$code" in
    200|301|302) echo "[seed] root ok code=${code} (attempt=${attempt})"; break ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "::error::[seed] health gate timeout 120s (last=${code})"
    exit 1
  fi
  sleep 5
done

# 2. POST seed with 2 retries (3 total attempts)
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
http=0
for try in 1 2 3; do
  http=$(curl -sS -o "$tmp" -w "%{http_code}" --max-time 180 \
    -X POST \
    -H "Authorization: Bearer ${SEED_TOKEN}" \
    -H "Content-Type: application/json" \
    "$SEED_URL" || echo "000")
  [ "$http" = "200" ] && break
  echo "[seed] try=${try} http=${http} — retry in 15s..."
  [ "$try" -lt 3 ] && sleep 15
done

if [ "$http" != "200" ]; then
  echo "::error::[seed] http=${http} body (truncated 2KB):"
  head -c 2048 "$tmp" || true
  exit 1
fi

# 3. Parse body — require success=true
if command -v jq >/dev/null 2>&1; then
  ok=$(jq -r '.success // false' "$tmp" 2>/dev/null || echo "false")
  created=$(jq -r '.data.created // 0' "$tmp" 2>/dev/null || echo "0")
  total=$(jq -r '.data.total // 0' "$tmp" 2>/dev/null || echo "0")
  if [ "$ok" != "true" ]; then
    echo "::error::[seed] success=false body (truncated 2KB):"; head -c 2048 "$tmp"; exit 1
  fi
  echo "[seed] ok — created=${created}/${total}"
else
  grep -q '"success":true' "$tmp" || { echo "::error::[seed] success!=true body (truncated 2KB):"; head -c 2048 "$tmp"; exit 1; }
  echo "[seed] ok (no jq — raw body truncated 2KB):"; head -c 2048 "$tmp"
fi
