# Phase 00 — Sync Authoritative Contract and Dependencies

**Status:** Completed for contract artifacts; acceptance dependencies are tracked as open Phase 03 gates.

## Objective

Make PRD v2.6 the reviewable contract before product work is accepted. Resolve stale story/issue text, reserve non-colliding tests, freeze the subtype taxonomy snapshot, and define the #1708 and E2E gates.

## Requirements

- Scope is US-F37-02 AC-01..04 and FR-04..11 only.
- Exact Schema weights are `10/4/5/4/3/3/3/3 = 35`; FAQ has no Schema points.
- Canonical TC-F37-02-29..32 keep their current subtype ownership.
- Any additional scorer/emission cases receive fresh IDs after 32 in the QA registry before test code is written.
- Phase 00 updates stale project documentation and requests GitHub issue sync; it does not alter product behavior.

## Related files and anchors

- `./docs/prd/F37-local-seo-search-performance.md:207` — authoritative story/AC; `:272` — FR-04..11.
- `./docs/architecture/F37-local-seo.md:96` — subtype-driven emission; `:188` — Schema 35.
- `./docs/qa/F37-local-seo.md:118` — current partial status; `:133` — TC-F37-02-29..32.
- `./docs/stories/F37-local-seo-stories.md:59` — stale FAQ/Schema-40 contract to synchronize.
- GitHub issue `#1310` — stale AC/FR body; PR `#1677` merge SHA `38d5868e...` is the decision record.
- PR `#1708` — overlapping US-F37-01 save, validation, Editor, and scorer work; semantic dependency, not contract authority.

## Steps

1. Record PRD v2.6 as target in issue #1310 and story docs: compatible persisted subtype, AC-01..04, FR-04..11, Schema 35, no FAQ score, `Relates to #1310`.
2. Update `docs/qa/F37-local-seo.md` without reusing existing IDs:
   - retain TC-F37-02-29 category filtering/disabled/auto-select;
   - retain TC-F37-02-30 preserve-or-clear;
   - retain TC-F37-02-31 server rejection/preservation;
   - retain TC-F37-02-32 exact `@type` and 0/4 subtype score;
   - reserve fresh IDs `TC-F37-02-33+` for strict parent, hours, geo, telephone, URL, price, Organization, total 35/0, malformed-parent, and serializer cases; first inspect current WIP collisions and renumber every superseded 40-point reference consistently.
3. Produce a reviewed mapping annex with version/date, every broad category, allowed single subtypes, display labels, source links, fallback rules, and evolution policy. Name the product/SEO approver. The checked-in implementation is dependency-free and never fetches the taxonomy at runtime.
4. Document the conditional #1708 pre-merge checklist. US-F37-02 is independent and proceeds without US-F37-01; reconcile save semantics only if #1708 lands before this branch.
5. Create a fixture manifest naming the owner, sole-account-site provisioning contract, immutable expected values, derived public URL, verification command, lifecycle/expiry, and CI preflight behavior. Local runs may skip with a clear reason; staging/acceptance must fail clearly when the fixture is absent. Tests are read-only and no site-ID environment variable is introduced.
6. Keep the obsolete Schema-40 draft removed so plan discovery cannot resume it; this v2.6 directory is the only active US-F37-02 plan artifact.

## Decision record

- Pure scorer only; no additive or breaking API change in US02.
- “Points earned” at the US02 boundary means an integration test invokes production generation and the pure scorer on the same site snapshot. Live API aggregation/display remains #1312-owned and is not claimed by this plan.
- Weak legacy Contact fallback may render for compatibility, including incomplete homepage data only if it does not duplicate a strict node. It receives no strict parent/child points and uses generic `LocalBusiness` unless the stored pair passes the same mapping.
- #1708 is not a dependency or Done gate. It has landed on staging and its overlapping save semantics have been reconciled.
- Fixture owner/provisioning must be named before Phase 03 acceptance.

## Todos

- [x] Issue #1310 and story wording match PRD v2.6.
- [x] QA reserves and documents fresh IDs after 32; no WIP collision remains.
- [x] Mapping snapshot/version and reviewer are recorded.
- [x] #1708 conditional checklist was recorded and later executed after the PR landed on staging.
- [x] Fixture owner, sole-site provisioning contract, CI/local policy, and derived public route are recorded.
- [x] Obsolete local Schema-40 plan artifact is removed; only this replacement remains.

Open acceptance dependencies:

- Fixture ownership and the policy are documented, but the dedicated account sole site is not yet provisioned/verified on staging, so live acceptance evidence is unavailable.

## Exit criteria

- Reviewers can trace every AC/FR to a phase and registered TC.
- No active planning artifact claims Schema 40, FAQ points, category-derived subtype, or overall `20/40/20/20`.
- Product implementation began after issue/story sync; completion remains gated on live fixture and manual evidence. #1708 reconciliation is complete and is not a US02 dependency.

## Risks

- External issue editing requires repository authority; if unavailable, block cook rather than silently implementing against stale P0 AC.
- Taxonomy breadth can create UX churn; freeze a reviewed snapshot and version changes.
- Mapping evolution is additive within v2.6. A removal/reclassification requires an explicit compatibility alias or data-migration/remediation plan; it must not silently downgrade existing tenants.
- PR #1708 has landed; future staging syncs must preserve the reconciled per-site serializer and must not restore stale overall score text.
