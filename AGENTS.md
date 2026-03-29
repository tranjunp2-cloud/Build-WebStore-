# AGENTS.md — Review Guidelines for AI Code Review (Codex)

> This file tells AI code review bots (OpenAI Codex, CodeRabbit, etc.)
> what to check when reviewing PRs in this repo.

## Project Context

- **Stack:** Next.js 15 + Payload CMS 3 + PostgreSQL + TypeScript
- **Deploy:** Docker standalone → DigitalOcean App Platform
- **Git flow:** Merge thẳng staging. 1 US = 1 branch = 1 PR vào staging.

## Review Rules (P0 — always flag)

### 1. Database Schema Changes

If PR modifies any file in `src/collections/*.ts` (adding/removing fields):

- **MUST** have matching migration in `scripts/db-setup.js`
- Array fields (`type: 'array'`) need `CREATE TABLE IF NOT EXISTS` with:
  - `id varchar` (UUID) — NOT serial
  - `_order integer`, `_parent_id integer`, `_uuid varchar`
- Group fields (`type: 'group'`) need `ALTER TABLE ADD COLUMN IF NOT EXISTS {group}_{field}`
- New collections need slug added to `COLLECTION_SLUGS[]` in `db-setup.js`
- **NEVER** use `DROP TABLE` in migrations

### 2. Environment Variables

If PR adds new `process.env.SOMETHING`:

- Must exist in `.env.staging.example` AND `.env.production.example`
- Must NOT contain real secret values — only placeholders

### 3. Issue Linking

- PR description must have `Relates to #N` — NOT `Closes #N`
- Using `Closes` auto-closes issue on merge, skipping QA gate

### 4. Security

- No hardcoded secrets, API keys, or passwords in code
- No `console.log` with sensitive data
- Input validation for all API endpoints
- Auth/authorization checks on protected routes

### 5. TypeScript

- No `any` type unless absolutely necessary with comment explaining why
- Explicit error handling — no empty catch blocks
- Prefer `async/await` over `.then()` chains

## Review Rules (P1 — flag when relevant)

### 6. Email

- `sendEmail()` utility uses Payload SMTP (AWS SES) — do NOT add Resend/other providers
- Email calls must use `.catch()` pattern (fire-and-forget, non-blocking)

### 7. Docker Standalone

- All pages using `getPayload()` must have `export const dynamic = 'force-dynamic'`
- Payload `pushDevSchema` does NOT work reliably — always use SQL migrations

### 8. Performance

- Check for N+1 queries in API routes
- Check bundle size impact for new frontend dependencies
- Images should use Next.js `<Image>` component

### 9. Testing

- New business logic should have unit tests
- Coverage must not drop below thresholds in `vitest.config.ts`

## Do NOT flag

- Styling preferences (Tailwind class order, etc.)
- Minor formatting differences
- Import order (handled by ESLint)
- Documentation typos in comments
