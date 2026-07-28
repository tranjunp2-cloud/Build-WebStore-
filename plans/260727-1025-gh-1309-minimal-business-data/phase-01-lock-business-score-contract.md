# Phase 1 — Lock Business Score Contract

## Goal

Define the exact Business Data calculation in the existing score module without activating a partial 85-point production formula.

Effort: 2h. Status: Completed (2026-07-27).

## Contract

Add an exported pure helper in `src/lib/seo/local-seo-score.ts`:

```ts
calculateBusinessDataScore({
  businessName,
  streetAddress,
  city,
  postcode,
  country,
  phone,
})
```

Rules after trimming strings:

- business name present: +7;
- all four address parts present: +8;
- phone present: +5;
- state is optional;
- legacy free-text address and all old Business signals are ignored.

The helper should return the Business subtotal and, if useful to the existing breakdown shape, the three earned signal values. Do not introduce a second score model or a new file.

## Changes

| Status | File | Change |
|---|---|---|
| [x] | `docs/qa/F37-local-seo.md` | Revised stale `TC-F37-01-10` to the exact 7/8/5 contract and registered `TC-F37-01-26/27` for later phone/browser coverage |
| [x] | `src/lib/seo/local-seo-score.ts` | Added pure 7/8/5 helper; production engine wiring remains deferred to #1312 |
| [x] | `src/__tests__/unit/seo/local-seo-score.test.ts` | Implemented the revised TC-ID and retained the current full-engine assertion until #1312 cutover |

## Tests

- [x] full data = 20;
- [x] name + phone = 12;
- [x] complete address only = 8;
- [x] each missing address part makes address = 0;
- [x] whitespace-only input earns 0;
- [x] missing state does not affect address;
- [x] legacy address, hours, category, website, and description cannot contribute.

Follow AAA and import the helper from source. Do not duplicate the calculation in fixtures.

Completed using AAA and source imports without duplicating the calculation in fixtures. The QA registry reuses `TC-F37-01-10` for the rewritten score AC instead of its obsolete “delta >= 20 from hours/category” meaning. `TC-F37-01-26/27` are registered for the still-pending Phase 2/3 validation and browser flows.

## Completion Evidence

- `npm test -- src/__tests__/unit/seo/local-seo-score.test.ts`: 15/15 passed (9 Business contract cases plus 6 legacy-engine regression cases).
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Code review: approved at 9.8/10 with 0 critical issues and 0 warnings.
- Runtime `calculateLocalSeoScore`, the score API route, schema, and migrations were not changed.

## #1312 Handoff

#1312 must:

1. consume this helper from the main engine;
2. map `site.name`, four structured address fields, and `contactInfo.phone` in the score route;
3. remove the legacy free-text address fallback;
4. update the full formula and API tests atomically so the maximum remains 100.

When #1312 implementation starts, update this plan with its PR URL and exact API test file/command. Until then, Phase 3 verifies only the pure contract and editor behavior; it does not claim runtime score acceptance.

## Exit Criteria

- [x] The helper is deterministic, dependency-free, and bounded at 20.
- [x] Unit cases lock every Phase 1 AC1/AC2 pure-contract boundary.
- [x] No runtime score cutover, API route, collection, or migration change is present in the Phase 1 diff.

The #1312 handoff above remains unresolved by design and is not part of Phase 1 completion.
