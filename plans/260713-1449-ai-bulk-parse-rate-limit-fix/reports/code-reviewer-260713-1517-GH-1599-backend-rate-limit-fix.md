# Code Review — GH-1599 Phase 1 (backend rate-limit + 429 shape)

**Score: 10/10**

## Scope
- `src/app/api/ai/products-bulk-parse/route.ts` (6 lines changed)
- `src/__tests__/api/ai.test.ts` (7 lines added)
- Verified: `npx vitest run src/__tests__/api/ai.test.ts -t "rate limit"` → 2 passed. `tsc --noEmit` → no errors in touched files.

## Correctness vs plan contract
- Limit bumped 5→10, comment updated to "10 bulk AI tasks per hour" — matches plan exactly.
- 429 body is exactly `{ error: 'rateLimitExceeded', resetAt: rateLimit.resetAt }` — matches frozen contract.
- `resetAt` sourced directly from `checkRateLimit`'s `RateLimitResult.resetAt` (ms epoch, consistent whether served by Upstash `result.reset` or in-memory `Date.now()+windowMs` fallback in `src/lib/rateLimit.ts`) — no transformation, no risk of unit mismatch.
- Rate-limit early-return sits before the `promptText` parse and before the OpenAI-call try/catch that classifies `aiQuotaExceeded`/`aiTimeout`/`parseError` — confirmed no interference between the two error paths (different code, disjoint control flow).

## Security
- Agree `resetAt` (ms-epoch timestamp) is safe to expose — no PII, no internal state/stack trace leak, doesn't reveal infra details (Upstash vs in-memory).
- Rate limiting remains enforced server-side keyed on `String(user.id)` — raising 5→10 doesn't touch the auth/authz path (still gated by `withAuth`).

## Regression check
- Grepped `'Rate limit exceeded. Try again later.'` — only remains in 9 unrelated routes (seo/fix, generate-blog, rewrite-text, apply-template, edit-block, seo-generate, product-description, translate, products/generate-description). None reference `products-bulk-parse`'s literal; correctly out of scope per plan's risk note.
- No other code path (grepped `rateLimitExceeded` and `products-bulk-parse`) reads the old string for this route — only the test and the frontend `BulkCreateModal.tsx` (phase 2, expected untouched) consume this endpoint.

## Test quality
- Test extends the existing 429 case in place (no duplication), asserts on the real response object (`res.json()`), not a re-implementation of route logic.
- Asserts `checkRateLimit` was called with `('user-xyz', 10)` via `vi.mocked(checkRateLimit)` — genuinely exercises the limit-arg change, not just the mock's return value.
- `typeof json.resetAt === 'number'` correctly checks shape without over-coupling to a specific timestamp value (mock returns `Date.now()+60000`, appropriately non-deterministic-tolerant).
- Ran independently, passes.

## Minor observations (non-blocking)
- The describe block title still references `TC-F08-04-01 & TC-F08.18`; `TC-F08-04-01` in `docs/qa/F08-product-crud.md` covers the happy-path NLP parse, not rate-limiting, and `TC-F08.18` isn't found in `docs/qa/`. This TC-ID mismatch pre-dates this diff (title untouched) — not introduced by this change, flagging only for awareness, not a blocker for this PR.

## Recommended Actions
None required — diff is minimal, matches the frozen contract, and is fully test-covered. Ready to proceed to phase 2 (frontend + i18n).

## Unresolved Questions
- Should `TC-F08.18` be added/reconciled in `docs/qa/F08-product-crud.md`, or is it tracked elsewhere? (pre-existing, not blocking this PR)
