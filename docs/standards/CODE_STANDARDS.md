---
owner: Dev
co_owners: [QC]
last_updated: 2026-04-19
---

# Code Standards

Canonical reference for linting, TypeScript strictness, imports, naming, modularization, and error handling. Consolidates rules scattered across workspace CLAUDE.md, TEST_CONVENTION.md, and tooling config.

## TypeScript

- `strict: true` — enforced via `tsconfig.json`. No `any` unless absolutely unavoidable and justified with a comment.
- Target: ES2017. Module: esnext. Resolution: bundler.
- Path alias: `@/*` → `./src/*`. Use aliases over deep relative paths (`@/lib/ai/...` not `../../../lib/ai/...`).
- Prefer `const` over `let`; never `var`.
- Use `async/await` over `.then()` chains.
- Named exports > default exports (except Next.js pages/layouts which require default).

## Linting

- Run `npm run lint` (Next.js ESLint).
- Run `npm run typecheck` (tsc --noEmit).
- ESLint warnings target: eventually hard-fail. Current baseline: warnings permitted; new code should be warning-free.

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Variables/functions | camelCase | `getUserById` |
| React components | PascalCase | `UserProfileCard` |
| Component files | PascalCase | `UserProfileCard.tsx` |
| Utility/hook files | kebab-case | `use-auth.ts`, `format-date.ts` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Database tables | snake_case | `user_profiles`, `pages_blocks` |
| API endpoints | kebab-case | `/api/v1/user-profiles` |
| Env variables | SCREAMING_SNAKE | `DATABASE_URI`, `OPENAI_API_KEY` |

## Imports

Import order (ESLint auto-sorts; check manually if auto-sort is off):

1. External packages (`react`, `next`, `@payloadcms/*`, ...)
2. Internal `@/*` aliases (grouped by domain)
3. Relative imports (`./`, `../`)
4. Type-only imports last (`import type { ... }`)

Co-locate types with where they're used; move to `src/types/` only when shared by 2+ modules.

## Modularization

- Target: keep files under 200 lines of code.
- Split boundaries: functions, classes, concerns (e.g. fetching vs rendering vs validation).
- Prefer composition over inheritance for complex components.
- Extract utility functions to separate modules once reused.
- Use long descriptive kebab-case names (self-documenting for LLM tools).

## Error Handling

- Always handle errors explicitly — no silent catches.
- Validate input at system boundaries (user input, external APIs).
- Trust internal code and framework guarantees — don't add validation that can't fail.
- Use try/catch for async errors; return typed error objects from API routes (`{ data, error }`).
- Never expose raw error messages to end users (leaks internals). Log detailed, respond generic.

## API Design

- RESTful: `GET /resources`, `POST /resources`, `PATCH /resources/:id`, `DELETE /resources/:id`
- Response shape: `{ data, meta, error }` where `error: null` on success
- HTTP codes: 200/201 success, 400 validation, 401 unauth, 403 forbidden, 404 not found, 422 entity error, 500 server
- Versioning: new cross-service endpoints use `/api/v1/*` (current example: `/api/v1/sso`). Internal app routes under `/api/*` without version prefix — promote to v1 when stabilizing an external contract.
- Paginate list endpoints: `page`, `limit`, `total` in meta

## Testing (§QA — QC co-owned)

See `docs/TEST_CONVENTION.md` for full conventions. Summary:

- Every test references a TC-ID from `docs/qa/F*.md`
- AAA pattern: Arrange, Act, Assert
- `vi.mock()` at top of file, never inside `describe` or `it`
- `beforeEach` / `afterEach` cleanup mandatory
- Import from source — NEVER re-implement logic in tests
- Coverage targets: Lines 70% / Branches 70% / Functions 70% (raised 2026-04-19)

## Security

- Never expose secrets, tokens, or credentials in logs, error messages, or client bundles
- Validate + sanitize all user input (Zod schemas preferred)
- Use parameterized queries / Payload ORM — never raw SQL concat
- Check authorization, not just authentication
- CORS configured per-environment (not open `*` in production)

## Performance

- Avoid N+1 queries (use Payload `populate`, Drizzle `with`)
- Profile before optimizing (next/webpack-bundle-analyzer for client, pg_stat_statements for DB)
- Server Components by default; `'use client'` only when needed
- Use `next/image` for images (auto-optimize)
- Lazy load large components (`dynamic()` with `ssr: false` for heavy client-only)

## Comments

- Default: no comments. Well-named identifiers > comments.
- Exception: non-obvious WHY (hidden constraint, workaround, invariant, surprising behavior).
- Never explain WHAT the code does (code shows that).
- Never reference tasks, PRs, callers (rots over time).
