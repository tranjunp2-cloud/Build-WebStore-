---
phase: 3
title: "Vercel Webhook Setup + Remove Old Handler"
status: pending
priority: P1
effort: 30m
---

# Phase 3 — Vercel Webhook Setup + Remove Old Handler

**Parent:** [plan.md](plan.md)
**Repos:** `prime-bot-assistant` (env), `ech-prime-web-v2` (delete handler)
**Depends on:** Phase 2

## Overview

**Strategy: 2 PRs riêng biệt**

- **PR1 (Bot):** Deploy adapter code + add VERCEL_WEBHOOK_SECRET + setup webhook → verify hoạt động
- **PR2 (Web):** Xóa old `/api/webhooks/vercel` handler sau khi PR1 verified

1. Setup Vercel webhook cho ech-prime-web-v2 trỏ tới Bot
2. Add VERCEL_WEBHOOK_SECRET to Bot's environment
3. Verify Bot nhận và xử lý đúng Vercel webhooks
4. Remove old `/api/webhooks/vercel` handler from prime-web-v2 (separate PR)

## Implementation Steps

### 1. Add VERCEL_WEBHOOK_SECRET to Bot

```bash
# On prime-bot-assistant Vercel project
# Vercel Dashboard → Settings → Environment Variables
# OR via CLI:
cd prime-bot-assistant
vercel env add VERCEL_WEBHOOK_SECRET
# Enter the same secret that will be used in webhook config
```

Also add to `.env.example`:
```
VERCEL_WEBHOOK_SECRET=your-vercel-webhook-secret
```

### 2. Configure Vercel Webhook (ech-prime-web-v2 project)

**Vercel Dashboard → ech-prime-web-v2 → Settings → Webhooks → Add**

| Field | Value |
|-------|-------|
| URL | `https://prime-bot-assistant.vercel.app/api/ci/notify` |
| Events | `deployment.ready`, `deployment.error` |
| Secret | (generate new, save as VERCEL_WEBHOOK_SECRET on Bot) |

**Note:** Vercel generates the webhook secret when creating the webhook. Copy it → set on Bot.

### 3. Remove old handler from prime-web-v2

Delete: `src/app/api/webhooks/vercel/route.ts`

Also check and clean:
- [ ] Remove `VERCEL_WEBHOOK_SECRET` from `.env.example` / `.env.staging.example` / `.env.production.example` (if present)
- [ ] Remove from GitHub Secrets if it was there for prime-web-v2
- [ ] Check no other code imports from this route

### 4. Remove unused env vars from prime-web-v2

If `BOT_NOTIFY_URL` and `BOT_SECRET` were only used by the Vercel webhook handler:
- Check if smart-notify action uses them (yes — from GitHub Secrets, not app env)
- These env vars may still be needed in `.env.*.example` for smart-notify
- Only remove from app env if truly unused by app code

## Todo

- [ ] Add `VERCEL_WEBHOOK_SECRET` to Bot's Vercel env
- [ ] Add to Bot's `.env.example`
- [ ] Create Vercel webhook on ech-prime-web-v2 project → Bot URL
- [ ] Delete `src/app/api/webhooks/vercel/route.ts` from prime-web-v2
- [ ] Clean up env var references in prime-web-v2
- [ ] Verify no broken imports

## Success Criteria

- [ ] Vercel webhook configured and pointing to Bot
- [ ] Old handler removed from prime-web-v2
- [ ] No broken builds on either repo

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Brief notification gap during migration | Setup Bot webhook first, verify working, then remove old |
| Wrong webhook secret | Test with curl before removing old handler |
| Other code depends on /api/webhooks/vercel | Grep for imports/references before deleting |

## Security Considerations

- Webhook secret must be unique per project
- Never commit real secret to .env.example
- Old VERCEL_WEBHOOK_SECRET on prime-web-v2 can be removed after migration
