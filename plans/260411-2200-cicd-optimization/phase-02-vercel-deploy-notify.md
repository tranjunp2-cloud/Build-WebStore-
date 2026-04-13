# Phase 2: Vercel Deploy → Lark Notification

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Vercel staging deployed (✅ done)
- Bot: `prime-bot-assistant` (port 3003 local, production: lionfish-app-6jhn6.ondigitalocean.app)
- **Priority:** P1 | **Status:** ⬜

## Problem
Vercel auto-deploy → team không biết deploy success/fail (DO deploy notify đã xóa).

## Solution: Vercel Webhook → App → Bot/Lark

```
Vercel deploy finish
  → POST /api/webhooks/vercel (on this app)
  → Verify HMAC signature
  → Format smart-notify payload
  → POST to BOT_NOTIFY_URL/api/ci/notify (Bot AI message)
  → Fallback: POST to LARK_WEBHOOK_CI (direct Lark card)
```

## Implementation Steps

### Step 1: Create webhook handler
```
src/app/api/webhooks/vercel/route.ts
```
- Verify `x-vercel-signature` header (HMAC-SHA1 with secret)
- Parse event: `deployment.ready` (success) or `deployment.error` (fail)
- Extract: environment (staging/production), URL, commit SHA, author
- Call Bot API with smart-notify format
- Fallback: call Lark webhook directly

### Step 2: Vercel Dashboard → Webhook config
- Settings → Webhooks → Add
- URL: `https://web-v2.dev.ecommercehub.my/api/webhooks/vercel`
- Events: `deployment.ready`, `deployment.error`
- Secret: generate + save as `VERCEL_WEBHOOK_SECRET` env var

### Step 3: Env vars
- Add `VERCEL_WEBHOOK_SECRET` to Vercel dashboard
- `BOT_NOTIFY_URL` already exists ✅
- `BOT_SECRET` already exists ✅
- `LARK_WEBHOOK_CI` needs adding to Vercel (currently only in GitHub Secrets)

### Step 4: Test
- Push to staging-vercel → deploy triggers
- Verify Lark message received in CI/CD group

## Smart-notify Payload Format
```json
{
  "event": "deploy_success",
  "project": "PrimeWeb",
  "branch": "staging",
  "environment": "staging",
  "author": "haynoikonike",
  "commit": {
    "sha": "abc1234",
    "message": "feat: add caching layer"
  },
  "urls": {
    "deployment": "https://web-v2.dev.ecommercehub.my",
    "run": "https://vercel.com/deployments/..."
  }
}
```

## Lark Fallback Card Format
```
🚀 Deploy Success — PrimeWeb
Branch: staging → Staging
Author: haynoikonike
Commit: feat: add caching layer
[View Deployment] [View Logs]
```

## Files Changed
| File | Action |
|------|--------|
| `src/app/api/webhooks/vercel/route.ts` | CREATE |
| `.env.staging.example` | ADD `VERCEL_WEBHOOK_SECRET` |

## Success Criteria
- [ ] Vercel deploy success → Lark message trong 30s
- [ ] Vercel deploy fail → Lark message with error details
- [ ] Bot API called first, Lark fallback if bot down
- [ ] Signature verification prevents spoofed webhooks

## Risk
- Bot down + Lark webhook down = no notification (accept — same as before)
- Webhook URL must be publicly accessible (behind auth via signature)
