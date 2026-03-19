#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Setup branch protection rules for staging and main branches.
# Requires: gh CLI authenticated with admin access.
#
# What this does:
# - Requires CI to pass before merge (lint, typecheck, test, build, docker)
# - Requires at least 1 PR review approval
# - Prevents direct push to staging/main (must use PR)
# - Dismisses stale reviews when new commits are pushed
#
# Usage: bash scripts/setup-branch-protection.sh
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO="primeproduction/ech-prime-web-v2"

echo "🔒 Setting up branch protection for $REPO..."
echo ""

# ── Staging branch ─────────────────────────────────────────────────
echo "📌 Configuring staging branch protection..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/staging/protection" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=CI: Lint → Typecheck → Test → Build' \
  -f 'enforce_admins=false' \
  -f 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -f 'required_pull_request_reviews[require_code_owner_reviews]=false' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'restrictions=null' \
  --silent \
  && echo "  ✅ staging: CI required + 1 review + no direct push" \
  || echo "  ❌ staging: failed (need admin access?)"

echo ""

# ── Main branch ────────────────────────────────────────────────────
echo "📌 Configuring main branch protection..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/main/protection" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=CI: Lint → Typecheck → Test → Build' \
  -f 'enforce_admins=false' \
  -f 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -f 'required_pull_request_reviews[require_code_owner_reviews]=false' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'restrictions=null' \
  --silent \
  && echo "  ✅ main: CI required + 1 review + no direct push" \
  || echo "  ❌ main: failed (need admin access?)"

echo ""
echo "🎯 Done! Branch protection rules:"
echo "   staging: PR required → CI must pass → 1 approval → merge"
echo "   main:    PR required → CI must pass → 1 approval → merge"
echo ""
echo "💡 To verify: gh api /repos/$REPO/branches/staging/protection --jq '.required_status_checks.contexts[]'"
