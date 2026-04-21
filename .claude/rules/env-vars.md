---
name: env-vars
description: Environment variable management — Vercel Dashboard source of truth, CI pulls, env files structure
paths:
  - ".env*"
  - "scripts/check-env-vars.js"
  - ".env.example"
  - ".env.staging.example"
  - ".env.production.example"
---

# Environment Variables & Secrets

**Source of truth: Vercel Project Environment Variables** (Dashboard → Settings → Environment Variables). GitHub Secrets are only used for CI tooling (`VERCEL_TOKEN`, `BOT_*`, `GH_BOT_TOKEN`), test creds (`E2E_*`), and bot routing (`LARK_WEBHOOK_*`).

## How it works (current — Vercel CI)

```
Vercel Dashboard env vars → vercel pull (in CI) → .vercel/.env.staging.local → vercel build → bundle
```

- App runtime env vars managed at `vercel.com/nguyen-phuongs-projects/ech-prime-web-v2/settings/environment-variables`
- Custom env `staging` has its own scope; vars must be explicitly added to it (Preview scope does NOT auto-inherit)
- `vercel pull --environment=staging` in CI downloads the merged env into `.vercel/.env.staging.local`
- `vercel build --target=staging` reads the local file and bakes `NEXT_PUBLIC_*` into the bundle
- Non-public vars (DATABASE_URI, SMTP, etc.) are read at runtime by the running serverless function
- `.env.local` is for local development only (gitignored)
- `.vercel/` directory is gitignored (contains pulled secrets)

## Legacy DO sync (DEPRECATED)

`.github/scripts/sync-do-envs.py` synced GitHub Secrets → DigitalOcean App on every deploy. Now defunct (DO project retired 2026-04-12). Will remove in cleanup PR.

## Adding a new env var (Vercel-first)

1. **Add to Vercel Dashboard** (the source of truth):
   - `vercel.com/nguyen-phuongs-projects/ech-prime-web-v2/settings/environment-variables`
   - Choose scope: `Production`, `Preview`, `Custom Environment: staging`, or all
   - For staging custom env, must be explicitly added (Preview scope does NOT auto-inherit)

2. **Add placeholder to both env files:**
   - `.env.staging.example`
   - `.env.production.example`

3. **Local dev:** copy real value into `.env.local`

Next CI run will `vercel pull` the new var into the runner automatically. No GitHub secret needed (unless it's a CI-tooling secret like `VERCEL_TOKEN`).

**CI will block PR** if code uses `process.env.NEW_VAR` but env files are missing the key (`scripts/check-env-vars.js`).

## Env files structure

| File | Purpose | Commit to git? |
|------|---------|---------------|
| `.env.example` | Local dev template | ✅ Yes (placeholders only) |
| `.env.staging.example` | Staging env var names | ✅ Yes (placeholders only) |
| `.env.production.example` | Production env var names | ✅ Yes (placeholders only) |
| `.env.local` | Local dev real values | ❌ No (gitignored) |

## Current secrets required

| Secret | Service | Required for |
|--------|---------|-------------|
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | AWS SES | Email/OTP |
| `OPENAI_API_KEY` | OpenAI | AI Builder, SEO auto-gen |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Payments |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | AWS S3 | File/media upload |
| `PAYLOAD_SECRET` | Payload CMS | JWT signing |
| `LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_ENCRYPT_KEY`, `LARK_VERIFICATION_TOKEN`, `LARK_BOT_OPEN_ID` | Lark | Bot integration |
| `GH_BOT_TOKEN` | GitHub | Bot actions |
| `ECH_DISTRIBUTION_API_URL`, `ECH_DISTRIBUTION_API_KEY` | ECH | Distribution API |

## IMPORTANT rules

- NEVER commit real secrets to `.env.example` — use placeholders only
- App env vars belong in **Vercel Dashboard**, not GitHub Secrets
- GitHub Secrets only for: CI tooling (`VERCEL_TOKEN`, `BOT_*`, `GH_BOT_TOKEN`), test creds (`E2E_*`), bot routing (`LARK_WEBHOOK_*`)
- Local dev: copy `.env.example` → `.env.local`, fill real values OR run `vercel pull --environment=development`
- Check Vercel env vars: `vercel env ls --token=$VERCEL_TOKEN`
- Check GitHub secrets: `gh secret list`
- Missing var on Vercel → feature fails at runtime (check Vercel deployment logs)
