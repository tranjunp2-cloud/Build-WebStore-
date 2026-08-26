# Phase 01 — Backend: limit bump + 429 response shape + route test

## Context Links
- Plan: [plan.md](./plan.md) · GH-1599
- Source: `src/app/api/ai/products-bulk-parse/route.ts` (lines 16-23, limit + 429 body)
- Rate limiter: `src/lib/rateLimit.ts:86-111` (`checkRateLimit` → `{allowed, remaining, resetAt}`) — read-only, no change
- Test: `src/__tests__/api/ai.test.ts:876-903` (existing bulk-parse describe, mock at :33-38)

## Overview
- Priority: P1 · Status: completed
- Raise bulk-parse rate limit 5 → 10/hr and return a machine-readable 429 body carrying `resetAt`.

## Key Insights
- `checkRateLimit` already computes `resetAt` (ms epoch) — route currently discards it. Zero limiter changes needed.
- Existing route test already flips `mockRateLimitAllowed=false` and asserts `status === 429`; extend it, do not duplicate.
- The 500-path catch (route.ts:147-161) that emits `aiQuotaExceeded`/`aiTimeout` is unrelated to the 429 path — leave it untouched.

## Requirements
Functional:
1. `checkRateLimit(String(user.id), 10)` (bump `5`→`10`).
2. On `!allowed`, return `NextResponse.json({ error: 'rateLimitExceeded', resetAt: rateLimit.resetAt }, { status: 429 })`.

Non-functional: KISS — 2-line change; no new deps; comment updated ("10 bulk AI tasks per hour").

## Architecture
Data flow: request → `withAuth` → `checkRateLimit(userId, 10, 3_600_000 default)` → if blocked, serialize
`{error, resetAt}` at 429. `resetAt` is a raw number (ms) so the client can compute minutes without extra parsing.
No schema, no collection, no migration.

## Related Code Files
- Modify: `src/app/api/ai/products-bulk-parse/route.ts`
- Modify: `src/__tests__/api/ai.test.ts`
- Read-only: `src/lib/rateLimit.ts`

## Implementation Steps
1. route.ts:16 — update comment to "10 bulk AI tasks per hour".
2. route.ts:17 — `checkRateLimit(String(user.id), 10)`.
3. route.ts:18-23 — replace body with `{ error: 'rateLimitExceeded', resetAt: rateLimit.resetAt }` (keep `{ status: 429 }`).
4. ai.test.ts — in the existing `POST /api/ai/products-bulk-parse` describe:
   - Extend the 429 test to also `const json = await res.json()`; assert `json.error === 'rateLimitExceeded'` and `typeof json.resetAt === 'number'`.
   - Add assertion that the mocked `checkRateLimit` was called with `10` as 2nd arg (import the mocked fn / use `vi.mocked(checkRateLimit).mock.calls`). The mock at :34-38 already returns a numeric `resetAt` — no mock change needed beyond exposing the fn for call assertion.
   - Keep the existing `beforeEach` reset of `mockRateLimitAllowed`.
5. `npx tsc --noEmit` (or project typecheck) — confirm compiles.

## Todo List
- [x] Bump limit 5→10 + comment
- [x] Return `{error:'rateLimitExceeded', resetAt}` on 429
- [x] Extend route 429 test: body shape + numeric resetAt
- [x] Assert checkRateLimit called with limit 10
- [x] Typecheck passes

## Success Criteria
- 429 body is exactly `{error:'rateLimitExceeded', resetAt:<number>}`.
- Test proves limit arg is 10 and the body shape; `npm test` green for `ai.test.ts`.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Renamed code breaks any other 429 consumer | Low×Med | Only this route emits this body; frontend (phase 02) is the sole consumer. Grep `'Rate limit exceeded. Try again later.'` to confirm no other refs before deleting the literal. |
| `resetAt` semantics differ Upstash vs in-memory | Low×Low | Both return ms-epoch `reset`/`resetAt`; client uses `Math.ceil((resetAt-now)/60000)` clamped ≥1, tolerant of small skew. |

## Security Considerations
- `resetAt` is a coarse timestamp — no PII, safe to expose. Limit still enforced server-side per `user.id`; raising to 10 stays within heavy-resource guardrail.

## Next Steps
- Frozen contract feeds phase-02 catch branch. No follow-up migrations.
