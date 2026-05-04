# Research: Prime-Web-v2 Notify & Webhooks

## Smart-Notify Action
**Location:** `.github/actions/smart-notify/action.yml`

Two-tier notification: Bot API primary (8s timeout), Lark webhook fallback.

**Payload to Bot (nested format):**
```json
{
  "event": "ci_fail|deploy_success|deploy_fail|ci_pass",
  "project": "PrimeWeb",
  "branch": "...",
  "environment": "staging|production",
  "author": "github_actor",
  "commit": { "sha": "7-char", "message": "msg" },
  "pr": { "number": "", "title": "", "url": "" },
  "ci": { "statusLine": "...", "failedStep": "step_name" },
  "urls": { "run": "gh_actions_url", "staging": "site_url" }
}
```

20+ inputs: bot-url, bot-secret, lark-webhook-url, lark-sign-key, event, branch, author, commit-sha, commit-msg, ci-status, failed-step, run-url, staging-url.

## Existing Vercel Webhook Handler
**Location:** `src/app/api/webhooks/vercel/route.ts` (162 lines)

1. Receives Vercel webhooks (deployment.ready, deployment.error, deployment.canceled)
2. Verifies HMAC-SHA1 from `x-vercel-signature` using `VERCEL_WEBHOOK_SECRET`
3. Extracts: branch, author, commitSha, commitMsg, deployUrl, inspectUrl from `deployment.meta`
4. Transforms → smart-notify format → tries Bot API (8s), falls back Lark webhook (5s)
5. Uses: `BOT_NOTIFY_URL`, `BOT_SECRET`, `LARK_WEBHOOK_CI`, `LARK_SIGN_KEY_CI`

**This handler is essentially a Vercel→Bot adapter already running inside prime-web-v2.** Moving it to Bot makes architectural sense.

## CI Workflow Integration
- `notify-fail` job uses smart-notify action for ci_fail events
- Vercel GitHub App auto-deploys; Vercel webhook → /api/webhooks/vercel → Bot
- No deploy notification in CI workflow itself

## Vercel Config
- `vercel.json`: Next.js, sin1 region, 60s functions, cron keep-alive

## Key Findings
- Dual notification paths: smart-notify (CI) + Vercel webhook handler (deploy)
- Both ultimately send to same Bot `/api/ci/notify` endpoint
- Vercel handler is self-contained, safe to remove after migration
- Same env vars shared: BOT_NOTIFY_URL, BOT_SECRET, LARK_WEBHOOK_CI, LARK_SIGN_KEY_CI
- Vercel HMAC-SHA1 verification logic already implemented (can port to Bot)

## Unresolved Questions
- Is VERCEL_WEBHOOK_SECRET configured? Need to verify.
- Any other Vercel webhook subscribers outside Next.js app?
