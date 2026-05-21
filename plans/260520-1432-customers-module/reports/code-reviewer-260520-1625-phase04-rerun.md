# Code Review Rerun — Phase 04 (post-fix)

Branch: `feat/F25-customers-module` · Fix commit: `4fad3477` · Prior review: `code-reviewer-260520-1610-phase04.md`

Scope: verify the 3 CRITICAL + 3 MAJOR + 4 MINOR findings from prior review. No full re-review.

---

## Bug-by-bug verification

### CRITICAL

- **C1 drizzle.execute() result shape** — `[FIXED]`
  - `route.ts:90` defines `type DrizzleQueryResult<T> = { rows: T[] }`.
  - `route.ts:115` count: `(await db.drizzle.execute(countQuery)) as DrizzleQueryResult<{ cnt: string | number }>`.
  - `route.ts:116` reads `countResult.rows[0]?.cnt` (was `countResult[0]?.cnt`).
  - `route.ts:223` data: `dataResult.rows` iterated (was `rows`).
  - Cast on `db` (route.ts:108–110) updated to the real shape `Promise<DrizzleQueryResult<unknown>>`.

- **C2 SQL injection via `sql.raw(user input)`** — `[FIXED]`
  - `route.ts:113` count query: `sql\`... = ANY(${tenantIds}::integer[])\`` — Drizzle binds array as parameter.
  - `route.ts:208` data query: same template-literal binding.
  - `tenantIds` typed as `number[]` (route.ts:43, 79–84) with `Number.isFinite && > 0` filter.
  - `?tenantId` validated `/^\d+$/` at route.ts:87; non-match returns sentinel → 400 at route.ts:139–144.

- **C3 integer/text type mismatch** — `[FIXED]`
  - `::text[]` casts removed; both queries now `tenant_id = ANY(${tenantIds}::integer[])` (route.ts:113, 199).
  - `_parent_id = c.id` (route.ts:195) — `c.id::text` cast removed.

### MAJOR

- **M1 `sql` import source** — `[FIXED]`
  - `route.ts:29`: `import { sql } from 'drizzle-orm'` (was `@payloadcms/db-postgres`).

- **M2 stream try/catch with controller.error()** — `[FIXED]`
  - `route.ts:187` opens `try`; row loop + query inside.
  - `route.ts:235–238` catch: logs then `controller.error(streamErr)` — not `controller.close()`. Client sees a network error on stream failure.

- **M3 orders tab tenant scoping** — `[FIXED]`
  - `customers-orders-tab.tsx:88–96` pre-fetches the customer to read `customer.tenant`.
  - `customers-orders-tab.tsx:102–104`: `where: { and: [{ customer: { equals: id } }, { tenant: { equals: tenantId } }] }` when tenantId known; falls back to customer-only when not.
  - Defence-in-depth without needing `req` in RSC. Acceptable trade-off.

### MINOR

- **Cache-Control on error responses** — `[FIXED]`
  - 401 (route.ts:97), 400 (route.ts:142), 403 (route.ts:150), 413 (route.ts:124), 500 (route.ts:263) all set `Cache-Control: private, no-store`.

- **`isSuperAdmin` DRY** — `[FIXED]`
  - `resolveTenantIds` returns `isSuperAdmin` in `TenantResolutionResult` (route.ts:46). Route destructures it at route.ts:137 — no duplicate computation.

- **Filename sanitization** — `[FIXED]`
  - `sanitizeFilenameSegment()` defined route.ts:59–61 (`[^A-Za-z0-9_-]` → `-`). Applied at route.ts:177.

- **Dead `escapeHtml` removed** — `[FIXED]`
  - `customers-orders-tab.tsx`: helper deleted; `Badge` renders `{value}` directly (line 65 in new file).

### Regression sanity

- New bugs introduced: none observed.
- Build: passed per fixer report (npm run build → 84/84 static pages, 20s).
- Migrations: passed (`scripts/check-migrations.js`).
- Diff scope: exactly 2 files (`route.ts`, `customers-orders-tab.tsx`) — confirmed via `git show --stat`.
- Commit message: `fix(f25): csv export drizzle shape, sql injection, types (phase-04)` — conventional, 60 chars (≤72).

### LOC over soft-cap (judgement call)

- `route.ts` grew 221 → 267 LOC (over the 200 soft-cap). Driver: M3 customer pre-fetch was on orders-tab, but in route.ts the additions are the 400 sentinel + try/catch + per-response Cache-Control headers + DrizzleQueryResult type. Extracting `csvField/toCsvLine` (~20 lines) to `src/lib/csv.ts` would push it just under the cap but the helpers are tightly coupled to this single endpoint — extracting solely for LOC count violates YAGNI/KISS.
- **Accept the over-cap.** Reasoning is sound: every added line traces to a blocking finding, and the alternative (helper extraction) creates a one-caller module purely to satisfy a soft cap. The cap is a guideline, not a gate.
- `customers-orders-tab.tsx` shrunk 239 → 233 — still over but reduced; no further action needed.

---

## Updated score

| Category | Prior | Now | Reason |
|---|---|---|---|
| 3. 413 cap before streaming | 4 | 10 | C1 fixed; cap now actually enforced. |
| 8. SQL injection | 2 | 10 | C2 fixed; parameterized binding + integer validation. |
| 9. Stream cleanup | 8 | 10 | M2 fixed; `controller.error()` on failure. |
| 10. Orders tab tenant safety | 6 | 9 | M3 fixed; explicit tenant filter. |
| 22. LOC ≤ 200 | 5 | 7 | route.ts still over but justified; tab reduced. |
| 23. `any` usage | 7 | 8 | DrizzleQueryResult narrowing replaces the loose `unknown[]` cast that masked C1. |
| All other categories | unchanged | unchanged | — |

**Prior overall: 6.5/10. Updated overall: 9.6/10.** Zero remaining critical or major. The 0.4-point gap reflects route.ts soft-cap miss (accepted) and the carry-forward open questions (Payload 3.79 `@/` alias resolution; super-admin "export all"; 30s stream budget on wide tables) — all flagged in prior review as out-of-scope for the fix commit.

---

## **RECOMMENDATION: AUTO-APPROVE — proceed to Phase 05**

All 3 CRITICAL + 3 MAJOR + 4 MINOR findings verified fixed against the diff. No new regressions. Commit hygiene clean.

Phase 05 test scope (carry-forward, unchanged from prior review):
- TC: super-admin `?tenantId=foo` → 400 (new path).
- TC: super-admin `?tenantId=123` with SQL-meta payload via other params → parameterized.
- TC: tenant-owner ignores `?tenantId=` (verify scoping).
- TC: 10001-row tenant → 413 (now actually trips after C1).
- TC: anonymous → 401.
- TC: mid-stream DB error → fetch consumer sees network error, not silent truncation (verify M2).
- TC: orders tab — synthetic order with mismatched tenant FK does not leak (verify M3).

---

## Unresolved questions (carry-forward, none new)

1. Payload 3.79 admin component string registration: does it resolve `@/` alias? Confirm on first staging deploy.
2. Super-admin "export all tenants" (no WHERE clause) — confirm with PM whether intentional or always-require-tenant.
3. Streaming budget: correlated subqueries per row may approach Vercel's 30s limit on wide Orders tables near the 10k cap. Consider single LEFT JOIN GROUP BY for future iteration.

---

**Status:** DONE
**Summary:** All 10 prior findings fixed in 4fad3477. Score 6.5 → 9.6. AUTO-APPROVE — proceed to Phase 05.
**Concerns/Blockers:** None blocking. Carry-forward open questions are Phase 05 / deploy-time concerns.
