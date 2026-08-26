# AGENTS.md — Review Guidelines for AI Code Review (Codex)

> This file tells AI code review bots (OpenAI Codex, CodeRabbit, etc.)
> what to check when reviewing PRs in this repo.

## Project Context

- **Stack:** Next.js 15 + Payload CMS 3 + PostgreSQL + TypeScript
- **Deploy:** Vercel Pro + Neon PostgreSQL (migrated from DO)
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

### 6. Acceptance Criteria Validation

If PR links to an issue (`Relates to #N`):

- **Read the linked issue** — it contains User Story and Acceptance Criteria (AC)
- **Verify code changes address ALL AC items** listed in the issue
- **Flag if any AC item is NOT covered** by the code changes
- AC format is Gherkin (GIVEN/WHEN/THEN) — check each scenario is implemented
- If issue has multiple AC sections (AC-1, AC-2, etc.), verify each one

### 7. PR Quality

- PR title must follow Conventional Commits: `type(scope): description`
- PR should have story ID in title: `feat(F01): [US-F01-01] description`
- PR should not mix unrelated changes — 1 PR = 1 feature/fix
- If PR is too large (>500 lines), suggest splitting

## Review Rules (P1 — flag when relevant)

### 8. Email

- `sendEmail()` utility uses Payload SMTP (AWS SES) — do NOT add Resend/other providers
- Email calls must use `.catch()` pattern (fire-and-forget, non-blocking)

### 9. Vercel Deployment

- All pages using `getPayload()` must have `export const dynamic = 'force-dynamic'`
- Payload `pushDevSchema` does NOT work reliably — always use SQL migrations
- API routes must have `maxDuration <= 60` (Vercel Pro limit)
- DB migrations via `scripts/db-setup.js --migrate-only` (runs in Vercel build step)

### 10. Performance

- Check for N+1 queries in API routes
- Check bundle size impact for new frontend dependencies
- Images should use Next.js `<Image>` component

### 11. Testing — E2E Required for New Features

**P1 — Flag if missing:**
- PR adds new **page/route** (`src/app/**/page.tsx` or `src/app/api/**/route.ts`) → **MUST** have E2E test in `tests/*.spec.ts`
- PR fixes **user-reported bug** → **SHOULD** have E2E test reproducing the bug
- PR only changes **CSS/refactor/docs** → no test needed

**What to check:**
- If `git diff --name-only` has new files in `src/app/` but NO new/modified files in `tests/` → flag: "⚠️ New route/page added without E2E test"
- E2E tests must test real browser flow (Playwright), NOT mocked unit tests
- Unit tests (Vitest) only needed for **pure functions** (utils, helpers)

**Do NOT flag:**
- Unit test coverage drops (existing unit tests are smoke tests with mocks)
- Missing unit tests for API routes (E2E covers this better)

**Test file locations:**
- E2E: `tests/*.spec.ts` (Playwright, browser-based)
- Unit: `src/__tests__/**` (Vitest, mock-based — existing only, don't require new)

### 13. Test Generation (when generating tests)

- Read `docs/TEST_CONVENTION.md` first — follow all patterns
- Map tests to TC-IDs from `docs/qa/F{XX}.md` — only test `[x] AUTO` flagged cases
- Import from source code — NEVER re-implement logic in test files
- Follow AAA pattern (Arrange, Act, Assert)
- `vi.mock()` at top of file only
- Copy patterns from gold standard files:
  - `src/__tests__/unit/otp/otp-generate.test.ts` (pure function)
  - `src/__tests__/unit/builder/builder-store.test.ts` (store)
  - `src/__tests__/unit/localization/f21-localization.test.tsx` (component)

### 12. Payload CMS Patterns

- Collections must use `slug` in snake_case (e.g., `blog_categories`)
- Hooks (`afterChange`, `beforeChange`) must not throw — use try/catch
- Access control functions must check tenant isolation
- Relationship fields need proper `relationTo` pointing to correct collection slug

## Review Behavior

### When to APPROVE
- Code follows all P0 rules
- AC items from linked issue are covered
- No security concerns

### When to REQUEST CHANGES
- Any P0 rule violated
- AC items missing from implementation
- Security vulnerability found
- Missing DB migration for schema change

### Review Format
- Keep comments concise and actionable
- Include code suggestions when possible
- Group related issues together

## Do NOT flag

- Styling preferences (Tailwind class order, etc.)
- Minor formatting differences
- Import order (handled by ESLint)
- Documentation typos in comments
- Variable naming style (camelCase is project standard)
