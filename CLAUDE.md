# CLAUDE.md — ECH Prime Web v2

> Project-specific rules for AI code assistants (Claude, Cursor, Antigravity).

## Database Schema Changes

When modifying Payload CMS collections (adding/removing fields), you MUST follow these rules:

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ech-prime-web-v2** (4719 symbols, 7114 relationships, 90 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/ech-prime-web-v2/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool             | When to use                   | Command                                                                 |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `query`          | Find code by concept          | `gitnexus_query({query: "auth validation"})`                            |
| `context`        | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})`                              |
| `impact`         | Blast radius before editing   | `gitnexus_impact({target: "X", direction: "upstream"})`                 |
| `detect_changes` | Pre-commit scope check        | `gitnexus_detect_changes({scope: "staged"})`                            |
| `rename`         | Safe multi-file rename        | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher`         | Custom graph queries          | `gitnexus_cypher({query: "MATCH ..."})`                                 |

## Impact Risk Levels

| Depth | Meaning                               | Action                |
| ----- | ------------------------------------- | --------------------- |
| d=1   | WILL BREAK — direct callers/importers | MUST update these     |
| d=2   | LIKELY AFFECTED — indirect deps       | Should test           |
| d=3   | MAY NEED TESTING — transitive         | Test if critical path |

## Resources

| Resource                                          | Use for                                  |
| ------------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/ech-prime-web-v2/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/ech-prime-web-v2/clusters`       | All functional areas                     |
| `gitnexus://repo/ech-prime-web-v2/processes`      | All execution flows                      |
| `gitnexus://repo/ech-prime-web-v2/process/{name}` | Step-by-step execution trace             |

## Self-Check Before Finishing

Before completing any code modification task, verify:

1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->

### 1. Add migration to `scripts/db-setup.js`

Every new column or table must have a matching entry in the `MIGRATIONS` array.

### 2. Follow Payload Drizzle naming convention

| Field Type                 | Table                  | id               | order col | parent col   | Extra             |
| -------------------------- | ---------------------- | ---------------- | --------- | ------------ | ----------------- |
| `type: 'array'`            | `{collection}_{field}` | `varchar` (UUID) | `_order`  | `_parent_id` | `_uuid varchar`   |
| `type: 'select' + hasMany` | `{collection}_{field}` | `serial`         | `order`   | `parent_id`  | `value varchar`   |
| `type: 'group'`            | same table             | —                | —         | —            | `{group}_{field}` |
| `type: 'relationship'`     | same table             | —                | —         | —            | `{field}_id`      |

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

## Docker Standalone Constraints

- `push: true` in payload.config.ts only works with `NODE_ENV=development`
- Docker standalone does NOT have Drizzle compiler — pushDevSchema may not work
- All schema changes MUST go through `scripts/db-setup.js` migrations
- `db-setup.js` runs as Docker CMD before starting the Next.js server

## Email/SMTP

- SMTP via AWS SES — configured in `payload.config.ts` using `MAIL_*` env vars
- If `MAIL_HOST` env is not set → Payload uses stream transport (logs to console, no crash)
- OTP + welcome email use `payload.sendEmail()` (fire-and-forget `.catch()` pattern)
- Custom `sendEmail()` utility at `src/lib/email/send.ts` also uses Payload SMTP

## Environment Variables & Secrets

**Source of truth: GitHub Secrets** → auto-synced to DigitalOcean on every deploy.

### How it works

```
GitHub Secrets → CI (sync-do-envs.py) → DigitalOcean App → Running container
```

- Script `.github/scripts/sync-do-envs.py` syncs all secrets from GitHub → DO on every staging/production deploy
- Dev NEVER hardcodes secrets in code, Dockerfile, or `.do/app.yaml`
- `.env.local` is for local development only (gitignored)

### Adding a new env var (2 steps only)

1. **Add placeholder to both env files:**
   - `.env.staging.example` — staging values/placeholders
   - `.env.production.example` — production values/placeholders

2. **Add real value to GitHub Secrets:**
   ```bash
   gh secret set MY_NEW_KEY --body "my-secret-value"
   ```

That's it! CI auto-syncs ALL GitHub Secrets to DO on deploy. No need to edit ci.yml or sync script.

- CI will **block PR** if code uses `process.env.NEW_VAR` but env files are missing the key.
- CI-only secrets (webhooks, test creds) are auto-excluded from DO sync.

### Env files structure

| File                      | Purpose                  | Commit to git?             |
| ------------------------- | ------------------------ | -------------------------- |
| `.env.example`            | Local dev template       | ✅ Yes (placeholders only) |
| `.env.staging.example`    | Staging env var names    | ✅ Yes (placeholders only) |
| `.env.production.example` | Production env var names | ✅ Yes (placeholders only) |
| `.env.local`              | Local dev real values    | ❌ No (gitignored)         |

### Current secrets required

| Secret                               | Service     | Required for             |
| ------------------------------------ | ----------- | ------------------------ |
| `MAIL_HOST`                          | AWS SES     | Email/OTP                |
| `MAIL_PORT`                          | AWS SES     | Email/OTP                |
| `MAIL_USERNAME`                      | AWS SES     | Email/OTP                |
| `MAIL_PASSWORD`                      | AWS SES     | Email/OTP                |
| `MAIL_FROM_ADDRESS`                  | AWS SES     | Email sender             |
| `MAIL_FROM_NAME`                     | AWS SES     | Email sender name        |
| `OPENAI_API_KEY`                     | OpenAI      | AI Builder, SEO auto-gen |
| `STRIPE_SECRET_KEY`                  | Stripe      | Payment processing       |
| `STRIPE_WEBHOOK_SECRET`              | Stripe      | Webhook verification     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe      | Frontend checkout        |
| `S3_ENDPOINT`                        | AWS S3      | File/media upload        |
| `S3_ACCESS_KEY_ID`                   | AWS S3      | File/media upload        |
| `S3_SECRET_ACCESS_KEY`               | AWS S3      | File/media upload        |
| `PAYLOAD_SECRET`                     | Payload CMS | JWT signing              |
| `LARK_APP_ID`                        | Lark        | Bot integration          |
| `LARK_APP_SECRET`                    | Lark        | Bot integration          |
| `LARK_ENCRYPT_KEY`                   | Lark        | Webhook security         |
| `LARK_VERIFICATION_TOKEN`            | Lark        | Webhook verification     |
| `LARK_BOT_OPEN_ID`                   | Lark        | Bot messaging            |
| `GH_BOT_TOKEN`                       | GitHub      | Bot actions              |
| `ECH_DISTRIBUTION_API_URL`           | ECH         | Distribution API         |
| `ECH_DISTRIBUTION_API_KEY`           | ECH         | Distribution API         |

### IMPORTANT rules

- NEVER commit real secrets to `.env.example` — use placeholders only
- NEVER hardcode secrets in `.do/app.yaml` — let sync script handle it
- Local dev: copy `.env.example` → `.env.local`, fill in real values
- Check if secret exists: `gh secret list`
- Missing secret on DO → feature silently fails (no crash, just logs error)

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

| File                              | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `scripts/db-setup.js`             | Migration executor + server orchestrator        |
| `scripts/check-migrations.js`     | CI schema validation                            |
| `scripts/check-env-vars.js`       | CI env var validation                           |
| `src/payload.config.ts`           | Payload + DB config                             |
| `src/collections/*.ts`            | Collection definitions (schema source of truth) |
| `.github/workflows/ci.yml`        | CI pipeline                                     |
| `.github/scripts/sync-do-envs.py` | Sync GitHub Secrets → DO env vars               |
| `.github/GIT_AND_CI_RULES.md`     | Git rules + issue lifecycle                     |
| `.github/CONTRIBUTING.md`         | Dev/QC workflow guide                           |
| `Dockerfile`                      | Docker build (CMD = db-setup.js)                |
