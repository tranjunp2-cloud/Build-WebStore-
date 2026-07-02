# Phase 06 — i18n + tests + docs

**Priority:** P1 · **Status:** todo · **Depends:** 03, 04, 05

## i18n
- Add keys under `dashboard.orders.detail` / `.actions` / `.progress` (+ new groups) in ALL locales
  (`src/i18n/locales/*.json` — mirror en to every locale; keep existing keys).
- New strings: fulfillment states (confirm order, ready to ship, reserving/charging, label created,
  print label, schedule pickup, pickup date/slot labels, self-delivery, manual courier, COD blocked,
  missing weight), items table headers (item/qty/weight/price, show more, voucher), tracking timeline
  status labels (reuse status-map where possible), order actions (cancel/refund notes).
- No hardcoded user-facing English in components — route through `useI18n`.

## Tests (`tester` owns test files only)
- Unit-test the pure logic: `isCodBlocked()`, status→zone-state mapping, pickup cut-off/date logic
  (Sunday/holiday/cut-off), tracking-history sort/label mapping.
- Component tests for FulfillmentZone state routing (render per status) + self-delivery + create-label
  happy/error paths (mock fetch). Follow `.claude/rules/testing.md`: import from source, TC-IDs from
  `docs/qa/F14-shipping.md`, AAA, `vi.mock()` top-level.
- API route tests for `/self-deliver` + `/pickup` (validation, status transition, idempotency).
- `npm test` green on all new/changed files.

## Docs (`docs-manager`)
- `docs/architecture/F14-shipping.md` — note new order-detail page + endpoints + fields.
- `docs/qa/F14-shipping.md` — add TC-IDs for new states/flows.
- `docs/CHANGELOG.md` + `docs/CODEBASE_SUMMARY.md` — order detail route/components change.

## Todo
- [ ] i18n keys added to every locale, components use `t.*`
- [ ] unit tests for pure helpers
- [ ] component + API route tests
- [ ] `npm test` + `npm run build` green
- [ ] docs updated (architecture/qa/changelog/summary)

## Success criteria
- 100% pass on new code; no fabricated/mocked-to-pass tests.
- Docs reflect new surface; QA has TC-IDs to verify against.
