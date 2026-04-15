---
phase: 4
title: "Test & Verify"
status: pending
priority: P1
effort: 15m
---

# Phase 4 — Test & Verify

**Parent:** [plan.md](plan.md)
**Depends on:** Phase 3

## Overview

Verify toàn bộ flow hoạt động đúng sau migration.

## Test Checklist

### 1. GitHub Actions → Bot (backward compat)

```bash
# Simulate smart-notify call
curl -X POST "https://prime-bot-assistant.vercel.app/api/ci/notify" \
  -H "Authorization: Bearer $BOT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "ci_fail",
    "project": "PrimeWeb",
    "branch": "test/verify-adapter",
    "environment": "staging",
    "author": "haynoikonike",
    "commit": { "sha": "abc1234", "message": "test: verify adapter" },
    "ci": { "lint": "success", "typecheck": "failure" }
  }'
```

Expected: Lark card in CI/CD group, source=github-actions

### 2. Vercel Webhook → Bot (new)

- Push small commit to staging branch
- Vercel auto-deploys
- Vercel sends webhook to Bot
- Bot receives, verifies HMAC-SHA1, normalizes, sends Lark card

Expected: Deploy success card in CI/CD group, source=vercel

### 3. Verify old handler removed

```bash
# Should 404
curl -s "https://web-v2.dev.ecommercehub.my/api/webhooks/vercel"
```

### 4. Verify no duplicate notifications

- Old handler removed → no more double notifications
- Only Bot sends Lark cards now

## Verification Commands

```bash
# Check Bot logs on Vercel
vercel logs prime-bot-assistant --follow

# Check Vercel webhook delivery
# Vercel Dashboard → ech-prime-web-v2 → Settings → Webhooks → View deliveries
```

## Todo

- [ ] Test GitHub Actions format (backward compat)
- [ ] Test Vercel webhook (new flow)
- [ ] Verify old endpoint returns 404
- [ ] Check Lark group receives correct cards
- [ ] No duplicate notifications

## Success Criteria

- [ ] All 4 event types work: deploy_success, deploy_fail, ci_pass, ci_fail
- [ ] Vercel webhook signature verification works
- [ ] GitHub Actions Bearer token auth still works
- [ ] Cards render correctly in Lark (v2 format)
- [ ] Zero downtime during migration
