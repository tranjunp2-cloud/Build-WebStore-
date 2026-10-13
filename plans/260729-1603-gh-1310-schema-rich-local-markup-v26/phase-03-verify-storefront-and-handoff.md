# Phase 03 — Verify Storefront and Handoff

**Status:** In progress — local automation and #1708 semantic reconciliation verified; live staging and manual Rich Results evidence pending.

## Objective

Prove the shipped behavior on a real published storefront, complete manual structured-data evidence, and hand the pure Schema 35 result to #1312 without crossing its ownership boundary.

## Entry gates

- Phase 00 contract/QA sync is complete.
- Phase 01 and 02 automated gates pass.
- A dedicated E2E account owns exactly one site. The test discovers that site through the authenticated Editor flow, then verifies its storefront with an unauthenticated browser context.
- A fixture manifest records owner, immutable expected values, account-based discovery, provisioning/verification command, and lifecycle. Browser acceptance uses the complete happy-path fixture; edge states remain deterministic unit/integration coverage.

## Related files and actions

- `./tests/f37-schema-rich-local-markup.spec.ts` — new read-only public-storefront Playwright test per AGENTS.md. Resolve the E2E account's sole site through existing auth state, fetch raw HTML before DOM parsing, then visit the public homepage and parse every `script[type="application/ld+json"]`.
- `./playwright.config.ts:48` — add a dedicated `f37-storefront-regression` project so existing storefront tests keep their original dependency graph. Authentication is used only to discover the account's sole site; storefront requests use the project's unauthenticated context.
- `./docs/qa/fixtures/F37-schema-rich-local-markup.md` — keep the non-secret account-based fixture and CI preflight contract.
- `./docs/qa/F37-local-seo.md:118` — update only after evidence exists.
- Issue `#1312` / US-F37-04 — document pure `SchemaScoreResult` input/output and the downstream exact overall weights `20/35/15/30`.

## Browser acceptance

1. Preflight the authenticated E2E account has exactly one site and that site is published with complete name/address/category/subtype/open hours/finite geo/phone/canonical URL/price.
2. Run the real browser flow and parse JSON rather than matching script text.
3. Assert one strict homepage LocalBusiness, exact allowed `@type`, complete PostalAddress, valid hours/geo/telephone/url/priceRange, and one valid Organization.
4. Assert no `aggregateRating`, incompatible type, duplicate strict LocalBusiness, or storefront crash. Inspect raw response HTML before browser parsing; the malicious tenant sentinel matrix remains deterministic TC-F37-02-43 coverage.
5. Confirm a published subpage does not create duplicate LocalBusiness nodes.
6. Local missing account credentials may use an explicit skip message. CI/staging acceptance fails clearly when credentials, the sole site, expected data, publication state, or public route are missing; do not silently pass.
7. Do not introduce a site-ID environment key.

## Manual evidence

- Run Google Rich Results Test for TC-F37-02-09 against the derived public non-secret fixture URL; record date, URL/fixture identifier, result link or screenshot, and zero blocking errors.
- Validate exact subtype against current Google Local Business guidance and the checked-in Schema.org mapping snapshot.
- Verify at 375px and desktop that the dependent select remains keyboard-accessible and save errors restore the previous valid pair.

## Regression and release gates

- Run focused unit/component/API/E2E suites, then repository typecheck and appropriate lint/test gates.
- Run migration drift checks and `scripts/db-setup.js --migrate-only` only in the approved validation environment.
- Run `git diff --check`; inspect diff for secrets, `any`, empty catches, unguarded logs, unrelated changes, and route/page additions.
- Confirm no new process env variable, no `DROP`, no new page/route, and no score API/Dashboard mutation.
- PR title uses Conventional Commits/story ID; body says `Relates to #1310`.

## #1708 completed semantic reconciliation

US-F37-02 does not require US-F37-01 `minimalBusinessData` or score API work. PR #1708 has landed on staging, so this branch completed the semantic reconciliation while keeping the stories independently releasable:

- Preserve its accepted save mutex, last-write behavior, rollback, validation errors, nested `minimalBusinessData`, and Business 20 ownership.
- Resolve overlaps in `SettingsPanel.tsx`, editor page state, constants, validations, and tests semantically—not by choosing one side wholesale.
- Remove any stale `20/40/20/20` or FAQ-scoring handoff text.
- Do not modify `local-seo-score.ts` or the score API merely to ease the merge.

## #1312 handoff

Provide a pure, stable `SchemaGenerationArtifact → SchemaScoreResult` contract. The artifact and result come from the same immutable site snapshot:

```ts
type SchemaGenerationArtifact = {
  strictLocalBusiness: JsonLdNode | null
  organization: JsonLdNode | null
  subtypeEvidence: ValidatedSubtypeEvidence | null
}

calculateSchemaScore(artifact): {
  score: 0..35
  breakdown: {
    localBusiness: 0|10, subtype: 0|4, openingHours: 0|5, geo: 0|4,
    telephone: 0|3, url: 0|3, priceRange: 0|3, organization: 0|3
  }
}
```

#1312 invokes this pure contract in the production aggregation path and owns database/page aggregation, authenticated API response, overall `Business 20 + Schema 35 + AI 15 + Technical 30`, Dashboard buckets/issues, and fix actions.

## Todos

- [x] Account-based sole-site discovery and CI failure policy are specified.
- [x] Read-only `tests/f37-schema-rich-local-markup.spec.ts` is wired into the storefront project and passes local discovery/no-credential gates.
- [ ] The read-only spec passes against the live staging fixture.
- [ ] TC-F37-02-09 manual evidence is attached.
- [x] #1708 landed first; its per-site revisioned/coalescing serializer is retained and US02 rollback is reconciled against persisted snapshots.
- [x] QA status/evidence is updated without TC collisions.
- [x] #1312 handoff is documented with 0..35 pure contract and 20/35/15/30 boundary.
- [x] Local security, migration, typecheck, regression, lint, and diff gates pass after the staging reconciliation.

## Local verification evidence

- Current focused regression: 10 files/219 tests pass; 3 schema-drift checks require a running local PostgreSQL and are environment-blocked.
- TypeScript typecheck, lint, and `git diff --check` passed.
- Playwright lists 2 TC-F37-02-45 tests in 1 file.
- Local no-credential run explicitly skips both tests without invoking auth setup or a server; CI remains fail-closed.
- The `.github/workflows` directory remains unchanged. The F37 spec is discoverable through the Playwright storefront project and must be invoked explicitly for live staging evidence.
- Debugger fixes removed the duplicate page-level Organization/WebSite graph and pass the resolved canonical origin to the single `SiteRenderer` schema owner.
- Preflight derives the public route from `tenantSlug`; it requires neither persisted `site.domain` nor `E2E_SITE_ID`.
- TC-F37-02-47 covers direct rollback, newer-revision preservation, and late cross-site failure isolation; `publish-flow.test.tsx` passes 21/21 including US01 ordering regressions.

Current blockers:

- E2E account credentials and staging `BASE_URL` are not exported in the current shell, so the live storefront run is pending.
- The staging ensure-test-user endpoint does not create a site; the dedicated account's sole F37 fixture must be provisioned before the CI/live run.
- TC-F37-02-09 still needs manual Google Rich Results evidence.

## Exit criteria

- All AC-01..04 and FR-04..11 have registered automated/manual evidence.
- Storefront output is valid, safe, non-duplicated, and read-only tested.
- Story completion does not depend on US-F37-01, an API/Dashboard change, or US-F37-04 work.

## Risks

- Shared fixture mutation causes flaky/destructive tests; keep browser checks read-only.
- Google validators can be transient; record reproducible evidence and distinguish warnings from blocking errors.
- Future changes to the reconciled serializer can silently regress saves; rerun atomic-save, coalescing, cross-site isolation, rollback, and newer-revision preservation tests.
