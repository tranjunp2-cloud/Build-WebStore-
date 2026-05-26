#!/usr/bin/env bash
# test-bt-expiry.sh
# Manually trigger the BT payment-expiry flow for local testing.
#
# Usage:
#   bash scripts/test-bt-expiry.sh             # list pending BT orders then prompt
#   bash scripts/test-bt-expiry.sh <order-id>  # expire a specific order immediately
#   bash scripts/test-bt-expiry.sh all         # expire ALL pending BT orders
#
# Requires: psql, curl, jq

set -euo pipefail

# ── Load .env.local ──────────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌  .env.local not found at $ENV_FILE"
    exit 1
fi
# shellcheck disable=SC2046
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

DB="${DATABASE_URI:-${DATABASE_URL:-}}"
SECRET="${CRON_SECRET:-}"
BASE_URL="${NEXT_PUBLIC_SERVER_URL:-http://localhost:3000}"

if [[ -z "$DB" ]]; then
    echo "❌  DATABASE_URI not set in .env.local"
    exit 1
fi
if [[ -z "$SECRET" ]]; then
    echo "❌  CRON_SECRET not set in .env.local"
    exit 1
fi

CRON_URL="${BASE_URL}/api/cron/payment-expiry"
ORDER_ARG="${1:-}"

# ── Step 1: Show pending BT orders ───────────────────────────────────────────
echo ""
echo "📋  Pending BT orders (awaiting_payment | pending_verification):"
echo "──────────────────────────────────────────────────────────────────"
psql "$DB" -t -A -F $'\t' -c "
    SELECT id, order_number, payment_status, payment_expires_at
    FROM orders
    WHERE payment_method = 'bank_transfer'
      AND payment_status IN ('awaiting_payment', 'pending_verification')
    ORDER BY created_at DESC
    LIMIT 20;
" | awk -F'\t' '{printf "  id=%-6s  #%-12s  %-24s  expires: %s\n", $1, $2, $3, $4}'
echo ""

# ── Step 2: Expire order(s) ──────────────────────────────────────────────────
if [[ "$ORDER_ARG" == "all" ]]; then
    echo "⏩  Setting paymentExpiresAt = NOW() - 1 minute for ALL pending BT orders..."
    UPDATED=$(psql "$DB" -t -A -c "
        UPDATE orders
        SET payment_expires_at = NOW() - INTERVAL '1 minute'
        WHERE payment_method = 'bank_transfer'
          AND payment_status IN ('awaiting_payment', 'pending_verification')
        RETURNING id, order_number;
    ")
    echo "$UPDATED" | awk '{print "  ✓ expired order id=" $1 "  #" $2}'
    ROWS=$(echo "$UPDATED" | grep -c . || true)
    echo "  → $ROWS order(s) updated"

elif [[ -n "$ORDER_ARG" ]]; then
    echo "⏩  Setting paymentExpiresAt = NOW() - 1 minute for order id=$ORDER_ARG..."
    psql "$DB" -c "
        UPDATE orders
        SET payment_expires_at = NOW() - INTERVAL '1 minute'
        WHERE id = $ORDER_ARG;
    "
    echo "  ✓ done"

else
    # Interactive: prompt for ID
    read -rp "Enter order id to expire (or 'all', or Ctrl-C to abort): " INPUT
    if [[ "$INPUT" == "all" ]]; then
        exec bash "$0" all
    else
        exec bash "$0" "$INPUT"
    fi
fi

echo ""

# ── Step 3: Call cron endpoint ───────────────────────────────────────────────
echo "🔄  Calling cron: $CRON_URL"
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $SECRET" \
    "$CRON_URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "    HTTP $HTTP_CODE"
echo ""

if command -v jq &>/dev/null; then
    echo "$BODY" | jq .
else
    echo "$BODY"
fi

echo ""
if [[ "$HTTP_CODE" == "200" ]]; then
    PROCESSED=$(echo "$BODY" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*' || echo "?")
    ERRORS=$(echo "$BODY" | grep -o '"errors":[0-9]*' | grep -o '[0-9]*' || echo "?")
    echo "✅  processed=$PROCESSED  errors=$ERRORS"
else
    echo "❌  Cron returned HTTP $HTTP_CODE — is the dev server running at $BASE_URL?"
fi
echo ""
