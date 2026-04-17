# CLAUDE.md — ECH Prime Web v2

> Project-specific rules for AI code assistants (Claude, Cursor, Antigravity).

## Database Schema Changes

When modifying Payload CMS collections (adding/removing fields), you MUST follow these rules:

### 1. Add migration to `scripts/db-setup.js`

Every new column or table must have a matching entry in the `MIGRATIONS` array.

### 2. Follow Payload Drizzle naming convention

| Field Type | Table | id | order col | parent col | Extra |
|---|---|---|---|---|---|
| `type: 'array'` | `{collection}_{field}` | `varchar` (UUID) | `_order` | `_parent_id` | `_uuid varchar` |
| `type: 'select' + hasMany` | `{collection}_{field}` | `serial` | `order` | `parent_id` | `value varchar` |
| `type: 'group'` | same table | — | — | — | `{group}_{field}` |
| `type: 'relationship'` | same table | — | — | — | `{field}_id` |

**CRITICAL:**
- Array tables use `varchar` id (UUID) — NEVER `serial`
- Array tables use `_parent_id` and `_order` (WITH underscore)
- Select hasMany tables use `parent_id` and `order` (NO underscore)
- NEVER write `DROP TABLE` in migrations — use `CREATE TABLE IF NOT EXISTS`

### 3. Test before PR

```bash
node scripts/check-migrations.js origin/staging
```

CI will block PR if migration is missing or uses wrong convention.

### 4. Example

```javascript
// Adding array field 'tenants' to Users collection
{
  name: 'users_tenants.create_table',
  sql: `CREATE TABLE IF NOT EXISTS users_tenants (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    _order integer NOT NULL DEFAULT 0,
    _parent_id integer NOT NULL,
    _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
    tenant_id integer,
    role varchar DEFAULT 'viewer');`,
},
```

## Vercel Deploy Architecture (CI-driven, since 2026-04-13)

> **CRITICAL:** All deploys go through GitHub Actions using `VERCEL_TOKEN`. Vercel's git webhook is **disabled** (`vercel.json` → `git.deploymentEnabled: false`). DO NOT re-enable.

### How it works

```
Push to staging  →  ci.yml: quality-check → test → deploy-staging
Push to main     →  ci.yml: quality-check → test → deploy-production

deploy-staging job:
  vercel pull --environment=staging --token=$VERCEL_TOKEN
  vercel build --target=staging --token=$VERCEL_TOKEN
  vercel deploy --prebuilt --target=staging --archive=tgz --token=$VERCEL_TOKEN
  Verify alias rollover (API check web-v2.dev.ecommercehub.my)
  smart-notify deploy_success
```

All deploys attributed to `phuongltweb` (token owner) → bypasses Vercel's commit-author access check that blocks non-team-member commits.

### Why this exists
Vercel Pro plan rejects deploys whose commit author isn't on the Vercel team. Team has 1 member (phuongltweb). Without CI deploy, Junkio/Duylinh03/etc commits → "Blocked because the commit author does not have contributing access". CI uses owner's token → all commits land.

### How to check deploy status
1. Wait for GitHub Actions CI to finish (~11 min: 1.5m quality + 4.5m test + 6m deploy)
2. `gh run watch <run-id>` from terminal, or watch in GitHub Actions UI
3. After `Deploy: Vercel (staging)` job passes, alias rollover step verifies via API
4. Vercel dashboard: filter `Source: cli` to see CI deploys (excludes webhook noise from old branches)
5. Lark notify in CI/CD group `[PrimeWeb - V2] — CI/CD` (preview-target events are filtered out by prime-bot-assistant since 2026-04-13)

### Required GitHub secrets
- `VERCEL_TOKEN` — project-scoped token from `vercel.com/account/tokens`, scope `Nguyen Phuong's projects`, rotate yearly (next: 2027-04)
- `VERCEL_ORG_ID = team_H3WAlHhz2xqvIFRcxfWevPTs`
- `VERCEL_PROJECT_ID = prj_84DQ47BSv2hBX28w0FzjFScfbuRr`

### CRITICAL rules
- DO NOT re-enable Vercel git webhook (`git.deploymentEnabled` must stay `false`)
- DO NOT remove `--target=staging` from `vercel build` or `vercel deploy` — must match all 3 stages (pull/build/deploy)
- DO NOT change `vercel pull --environment=staging` — file `.vercel/.env.staging.local` has `VERCEL_TARGET_ENV=staging` which the prebuilt check requires
- Old feature branches (created before 2026-04-13) still have outdated vercel.json → webhook may fire and ERROR (harmless dashboard noise) until rebased; bot filters these out from Lark notifications
- Plan history: `plans/260413-1126-vercel-deploy-blocked/` (6 PRs documented: #559, #560, #562, #565, #567, #569)

## Legacy Docker Standalone (DEPRECATED 2026-04-12)

> Project migrated from DigitalOcean App Platform to Vercel on 2026-04-12. Following section retained as historical reference for `scripts/db-setup.js` migration patterns which are STILL active (`vercel build` runs db-setup.js as part of the buildCommand).

- `push: true` in payload.config.ts only works with `NODE_ENV=development`
- Docker standalone does NOT have Drizzle compiler — pushDevSchema may not work
- All schema changes MUST go through `scripts/db-setup.js` migrations
- `db-setup.js` runs as Docker CMD before starting the Next.js server (legacy DO) AND as part of `vercel build` buildCommand (current Vercel)

## Email/SMTP

- SMTP via AWS SES — configured in `payload.config.ts` using `MAIL_*` env vars
- If `MAIL_HOST` env is not set → Payload uses stream transport (logs to console, no crash)
- OTP + welcome email use `payload.sendEmail()` (fire-and-forget `.catch()` pattern)
- Custom `sendEmail()` utility at `src/lib/email/send.ts` also uses Payload SMTP

## Environment Variables & Secrets

**Source of truth: Vercel Project Environment Variables** (Dashboard → Settings → Environment Variables). GitHub Secrets are only used for CI tooling (`VERCEL_TOKEN`, `BOT_*`, `GH_BOT_TOKEN`), test creds (`E2E_*`), and bot routing (`LARK_WEBHOOK_*`).

### How it works (current — Vercel CI)

```
Vercel Dashboard env vars → vercel pull (in CI) → .vercel/.env.staging.local → vercel build → bundle
```

- App runtime env vars are managed at `vercel.com/nguyen-phuongs-projects/ech-prime-web-v2/settings/environment-variables`
- Custom env `staging` has its own scope; vars must be explicitly added to it (Preview scope does NOT auto-inherit)
- `vercel pull --environment=staging` in CI downloads the merged env into `.vercel/.env.staging.local`
- `vercel build --target=staging` reads the local file and bakes `NEXT_PUBLIC_*` into the bundle
- Non-public vars (DATABASE_URI, SMTP, etc.) are read at runtime by the running serverless function
- `.env.local` is for local development only (gitignored)
- `.vercel/` directory is gitignored (contains pulled secrets)

### Legacy DO sync (DEPRECATED — script kept for reference but no longer runs)

`.github/scripts/sync-do-envs.py` synced GitHub Secrets → DigitalOcean App on every deploy. Now defunct (DO project retired 2026-04-12). Will remove in cleanup PR.

### Adding a new env var (Vercel-first)

1. **Add to Vercel Dashboard** (the source of truth):
   - `vercel.com/nguyen-phuongs-projects/ech-prime-web-v2/settings/environment-variables`
   - Choose scope: `Production`, `Preview`, `Custom Environment: staging`, or all
   - For staging custom env, must be explicitly added (Preview scope does NOT auto-inherit)

2. **Add placeholder to both env files:**
   - `.env.staging.example` — staging values/placeholders
   - `.env.production.example` — production values/placeholders

3. **Local dev:** copy real value into `.env.local`

Next CI run will `vercel pull` the new var into the runner automatically. No GitHub secret needed (unless it's a CI-tooling secret like VERCEL_TOKEN).

- CI will **block PR** if code uses `process.env.NEW_VAR` but env files are missing the key.

### Env files structure

| File | Purpose | Commit to git? |
|------|---------|---------------|
| `.env.example` | Local dev template | ✅ Yes (placeholders only) |
| `.env.staging.example` | Staging env var names | ✅ Yes (placeholders only) |
| `.env.production.example` | Production env var names | ✅ Yes (placeholders only) |
| `.env.local` | Local dev real values | ❌ No (gitignored) |

### Current secrets required

| Secret | Service | Required for |
|--------|---------|-------------|
| `MAIL_HOST` | AWS SES | Email/OTP |
| `MAIL_PORT` | AWS SES | Email/OTP |
| `MAIL_USERNAME` | AWS SES | Email/OTP |
| `MAIL_PASSWORD` | AWS SES | Email/OTP |
| `MAIL_FROM_ADDRESS` | AWS SES | Email sender |
| `MAIL_FROM_NAME` | AWS SES | Email sender name |
| `OPENAI_API_KEY` | OpenAI | AI Builder, SEO auto-gen |
| `STRIPE_SECRET_KEY` | Stripe | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | Frontend checkout |
| `S3_ENDPOINT` | AWS S3 | File/media upload |
| `S3_ACCESS_KEY_ID` | AWS S3 | File/media upload |
| `S3_SECRET_ACCESS_KEY` | AWS S3 | File/media upload |
| `PAYLOAD_SECRET` | Payload CMS | JWT signing |
| `LARK_APP_ID` | Lark | Bot integration |
| `LARK_APP_SECRET` | Lark | Bot integration |
| `LARK_ENCRYPT_KEY` | Lark | Webhook security |
| `LARK_VERIFICATION_TOKEN` | Lark | Webhook verification |
| `LARK_BOT_OPEN_ID` | Lark | Bot messaging |
| `GH_BOT_TOKEN` | GitHub | Bot actions |
| `ECH_DISTRIBUTION_API_URL` | ECH | Distribution API |
| `ECH_DISTRIBUTION_API_KEY` | ECH | Distribution API |

### IMPORTANT rules

- NEVER commit real secrets to `.env.example` — use placeholders only
- App env vars belong in **Vercel Dashboard**, not GitHub Secrets
- GitHub Secrets are only for: CI tooling (`VERCEL_TOKEN`, `BOT_*`, `GH_BOT_TOKEN`), test creds (`E2E_*`), bot routing (`LARK_WEBHOOK_*`)
- Local dev: copy `.env.example` → `.env.local`, fill in real values OR run `vercel pull --environment=development`
- Check Vercel env vars: `vercel env ls --token=$VERCEL_TOKEN`
- Check GitHub secrets: `gh secret list`
- Missing var on Vercel → feature fails at runtime (check Vercel deployment logs)

## Git Flow

**Merge thẳng staging.** Không dùng feature branch cha.

```
feat/F01-01-generate-site → PR → staging → QA test → Done
feat/F01-02-store-setup   → PR → staging → QA test → Done
feat/F08-01-product-crud  → PR → staging → QA test → Done
→ Tất cả pass → PR staging → main (release v1.0)
```

- 1 User Story = 1 branch = 1 PR vào staging
- Branch naming: `feat/FXX-YY-mô-tả` (ví dụ: `feat/F01-01-generate-site`)
- PR title: `feat(F01): [US-F01-01] mô tả` → bot auto-link issue
- Dùng `Relates to #N` (KHÔNG dùng `Closes #N` — issue phải qua QA trước khi close)

Chi tiết: `.github/GIT_AND_CI_RULES.md` + `.github/CONTRIBUTING.md`

## PR Rules (BẮT BUỘC khi tạo PR)

Khi tạo PR, PHẢI dùng đúng template `.github/pull_request_template.md`. Format:

```markdown
## Story
- **Relates to:** #N (KHÔNG dùng Closes)
- **Ticket / Story ID:** US-FXX-YY
- **Mô tả ngắn:** 1-2 câu

## Changes
- [x] Thay đổi 1
- [x] Thay đổi 2

**API / Contract thay đổi:**
- [x] Breaking change: Không

## Checklist
- [x] **9-Point Done**: Loading, Empty, Error, Mobile 375px, TypeScript clean
- [x] **TypeScript / lint:** tsc --noEmit pass
- [x] **Test:** test cases đã thêm/sửa
- [x] **Security:** không commit secret, input validated

## Test Steps
1. Bước verify cụ thể
2. Happy path + edge case

## Ghi chú
- Files mới, deploy notes, docs
```

**Rules:**
- PR title: `type(scope): lowercase description` (max 72 chars)
- type: `feat` | `fix` | `chore` | `docs` | `test` | `refactor` | `perf`
- KHÔNG viết hoa chữ đầu subject (commitlint sẽ chặn)
- LUÔN có `Relates to #N` — KHÔNG dùng `Closes #N`
- Review checklist chi tiết: `.github/REVIEW_CHECKLIST.md`

## Commit Rules

```
feat(auth): add google oauth login
fix(api): handle null response from payment gateway
chore(deps): upgrade next.js to 14.2
```

- Max 72 chars subject line
- Lowercase, imperative mood
- Co-authored footer tự động — không cần thêm
- Nếu commitlint fail → sửa subject, KHÔNG dùng `--no-verify`

## Testing

Follow `docs/TEST_CONVENTION.md` for all test code. Key rules:

- Every test MUST reference TC-ID from `docs/qa/F*.md`
- Import from source code — NEVER re-implement logic in tests
- AAA pattern: Arrange, Act, Assert
- `vi.mock()` at top of file, never inside test functions
- `beforeEach`/`afterEach` cleanup mandatory
- Gold standard files to copy patterns from:
  - `src/__tests__/unit/otp/otp-generate.test.ts` (pure function)
  - `src/__tests__/unit/builder/builder-store.test.ts` (store)
  - `src/__tests__/unit/localization/f21-localization.test.tsx` (component + TC-ID)

## Key Files

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel build/deploy config; `git.deploymentEnabled: false` (do not change) |
| `.vercelignore` | Excludes plans/docs/.claude from `vercel deploy --prebuilt` upload |
| `scripts/db-setup.js` | Migration executor; runs as part of `vercel build` buildCommand |
| `scripts/check-migrations.js` | CI schema validation |
| `scripts/check-env-vars.js` | CI env var validation |
| `src/payload.config.ts` | Payload + DB config |
| `src/collections/*.ts` | Collection definitions (schema source of truth) |
| `.github/workflows/ci.yml` | CI pipeline (quality + test + deploy-staging + deploy-production) |
| `.github/actions/smart-notify/action.yml` | Lark notify action (calls prime-bot-assistant API) |
| `.github/scripts/sync-do-envs.py` | DEPRECATED — DO sync, retained for history |
| `.github/GIT_AND_CI_RULES.md` | Git rules + issue lifecycle |
| `.github/CONTRIBUTING.md` | Dev/QC workflow guide |
| `Dockerfile` | DEPRECATED — only used for local docker-compose dev |
| `plans/260413-1126-vercel-deploy-blocked/` | Full plan + reports for Option B rollout |
