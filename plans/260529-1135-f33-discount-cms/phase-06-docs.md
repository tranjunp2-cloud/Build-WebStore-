# Phase 06 — Docs

**Priority:** P3 · **Status:** pending · **Effort:** 1h · **Blocks on:** 01–05

Update canonical docs after the feature lands (docs-manager). Per `CLAUDE.md` canonical doc map.

## Context links

- Doc map: `CLAUDE.md` "Canonical docs" table
- Migration matrix to flip: `docs/migration/pw1-vs-pw2-feature-matrix.md` §2.7

## Requirements

| Doc | Update |
|-----|--------|
| `docs/architecture/F33-discount-cms.md` | CREATE — collections, data flow, **gateway-agnostic** `computeOrderTotal()` integration (COD/QR/Stripe), usage tracking |
| `docs/prd/F33-discount-cms.md` | CREATE — feature spec / acceptance from §2.7 |
| `docs/qa/F33-discount-cms.md` | Already created in Phase 05 — cross-link |
| `docs/CODEBASE_SUMMARY.md` | Add `Discounts.ts`, `DiscountUsageHistory.ts`, `src/lib/discounts/*`, `src/lib/orders/compute-total.ts`, export route |
| `docs/CHANGELOG.md` | Entry: "feat(F33): discount setting CMS — collections, checkout apply (all payment methods), CSV export" |
| `docs/architecture/_OVERVIEW.md` | Add F33 to per-feature index |
| `docs/migration/pw1-vs-pw2-feature-matrix.md` | §2.7 rows ❌ → ✅ (discount applies across COD/QR/Stripe via centralized pricing — NO "Stripe deferred" caveat) |

## Implementation steps

1. Write `docs/architecture/F33-discount-cms.md` (layer diagram + data flow from plan.md; document the single `computeOrderTotal()` → `finalAmount` consumed by all three payment paths).
2. Write `docs/prd/F33-discount-cms.md` (scope, in/out, acceptance).
3. Append CHANGELOG entry under unreleased.
4. Update CODEBASE_SUMMARY with new files (incl. `compute-total.ts`).
5. Flip §2.7 statuses to ✅. State discount applies across ALL payment methods via centralized pricing. Be precise about Stripe: F33 charges `finalAmount` by rebuilding session line items to sum to it — it does NOT create a Stripe Coupon/Promotion-code object (do not over-claim).
6. Add F33 link to `_OVERVIEW.md` index.

## Todo

- [ ] architecture/F33-discount-cms.md (gateway-agnostic pricing documented)
- [ ] prd/F33-discount-cms.md
- [ ] CHANGELOG entry
- [ ] CODEBASE_SUMMARY updated (incl. compute-total.ts)
- [ ] _OVERVIEW index entry
- [ ] §2.7 matrix flipped to ✅ (no Stripe-deferred caveat; precise Stripe wording)

## Success criteria

- All listed docs updated; links resolve; §2.7 reflects actual delivered scope: discount across all payment methods via shared pricing, Stripe charges `finalAmount` (no Stripe Coupon object — accurately scoped, not over-claimed).

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Over-claiming Stripe (implying a Stripe Coupon object) | M×M | Doc states the concrete mechanism: line items rebuilt to sum to `finalAmount`; no Coupon/Promotion object |

## Next steps

git-manager: conventional commit(s), PR to `staging` with `Relates to #1114`
(NEVER `Closes`). GitHub issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1114
