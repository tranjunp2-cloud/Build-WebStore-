# US-F37-02 Contract & Traceability Research

## Executive conclusion

Plan from the merged staging contract at commit
`38d5868e671eb41c71a0eebde539499170c57c79` (PR #1677), not from the current
GitHub issue body or `docs/stories/F37-local-seo-stories.md`. The authoritative
US-F37-02 target is:

- **Schema bucket: 35 points**, with eight criteria:
  `10 + 4 + 5 + 4 + 3 + 3 + 3 + 3`.
- **FR ownership: FR-04 through FR-11**.
- **No FAQ criterion or FAQ points** in US-F37-02.
- `businessCategory` is a broad category; a separately persisted and
  server-validated `localBusiness.schemaSubtype` controls the emitted `@type`.
- US-F37-02 owns schema data entry, persistence/validation, JSON-LD emission,
  and a stable 35-point Schema signal/bucket contract. US-F37-04/#1312 owns the
  overall `20/35/15/30` score engine/API cutover, page/database aggregation,
  Dashboard, and root-cause issue actions.

The old Schema-40 plan is invalid. Its runtime-hardening work is reusable, but
its FAQ ownership, weights, subtype derivation, TC mapping, E2E fixture
assumptions, and #1312 handoff must be rewritten.

## Evidence hierarchy

1. **Canonical product contract:** `docs/prd/F37-local-seo-search-performance.md`
   explicitly labels §5 authoritative and §6.1 source of truth. Its current
   US-F37-02 AC and traceability are at lines 207-257; exact FRs are at
   lines 272-279.
2. **Canonical technical contract:** `docs/architecture/F37-local-seo.md`:
   `schemaSubtype` data shape at line 34, emission rule at line 96, separate
   category/subtype vocabularies at lines 117-132, and 35-point bucket at
   lines 188-196.
3. **Canonical QA registry:** `docs/qa/F37-local-seo.md` marks the story
   `PARTIAL — subtype dropdown NOT BUILT` at lines 118-120 and reserves
   TC-F37-02-29..32 for the approved subtype workflow at lines 133-136.
4. **Merged decision record:** PR #1677
   `docs(F37): [US-F37-04] align SEO health and subtype contract` merged into
   staging at `2026-07-29T07:56:23Z`, merge SHA `38d5868e...`. Its stated scope
   removes FAQ from the active score and defines the category-to-subtype
   contract.
5. **Stale references, not contract authorities:** GitHub #1310 and
   `docs/stories/F37-local-seo-stories.md:59-105` still describe Schema 40-era
   FAQ ownership, a category-derived non-generic type, AC-1..3, and FR-04..12.
   They conflict with the PRD, architecture, QA, and merged PR #1677.

## Exact US-F37-02 contract

### Story and acceptance criteria

Canonical story: hours, broad business category, a **compatible schema
subtype**, coordinates, and price range power LocalBusiness and Organization
JSON-LD and their Schema points.

| AC | Required behavior |
|---|---|
| AC-01 Happy | With name + complete address, broad category + compatible specific subtype, at least one valid open-hours row, finite lat/lng, and priceRange, homepage emits LocalBusiness with PostalAddress, openingHoursSpecification, geo, priceRange, and exactly the selected `@type`; matching Schema points are earned. |
| AC-02 Edge | Closed-only or incomplete hours emit no `openingHoursSpecification`, earn 0/5 hours, and do not suppress other valid Schema points. |
| AC-03 Error | Only one coordinate, or a non-finite coordinate, emits no geo and earns 0/4 without crashing. |
| AC-04 Error/security | Save rejects a category/subtype pair absent from the shared mapping; the previous valid pair remains persisted and the invalid `@type` is never emitted. |

### FR and point traceability

| FR | Criterion | Points | Source/proof boundary |
|---|---|---:|---|
| FR-04 | Strict LocalBusiness JSON-LD when trimmed name + complete structured address exist | 10 | Homepage generated node; full address is street, city, postcode, country; state optional |
| FR-05 | Compatible specific `schemaSubtype` | 4 | Shared versioned mapping drives Editor options, server validation, emission, and score; empty subtype emits generic `LocalBusiness` for 0/4 |
| FR-06 | Valid non-closed `openingHoursSpecification` | 5 | At least one row with valid day, `opens`, `closes`; closed/incomplete rows omitted |
| FR-07 | `geo` | 4 | `GeoCoordinates` only when latitude and longitude are both finite |
| FR-08 | Schema `telephone` | 3 | Emitted non-empty `contactInfo.phone` |
| FR-09 | Schema `url` | 3 | Emitted URL from non-empty site domain |
| FR-10 | `priceRange` | 3 | Explicit value or broad-category fallback; broad category remains valid only for fallback/filtering |
| FR-11 | Separate valid Organization node | 3 | Platform-generated Organization for valid site |
| **Total** |  | **35** | Exact additive bucket; no FAQ row |

Additional invariants:

- Do not emit `aggregateRating` on LocalBusiness.
- One primary subtype only; multiple `@type` values are out of scope.
- Mapping is a checked-in/versioned snapshot based on current Google Local
  Business guidance and the Schema.org LocalBusiness hierarchy; never fetch at
  runtime.
- If a category has one compatible subtype, auto-select it. Multiple options
  require explicit selection.
- Changing category preserves subtype only if it remains compatible; otherwise
  clear it.
- UI filtering is not a security boundary; server validation must use the same
  mapping.
- JSON-LD must use `serializeJsonLd()`; malformed tenant data must omit invalid
  properties/nodes without crashing the storefront.

## TC-ID ownership

| IDs | Ownership/status in current QA registry | Planning rule |
|---|---|---|
| TC-F37-02-01..09 | Existing JSON-LD/general schema gaps; some remain untested, TC-09 is manual Rich Results evidence | Preserve and implement only where needed to prove current FR-04..11; do not relabel them as new subtype tests |
| TC-F37-02-10..12 | Security/edge/additional coverage: serializer, incomplete hours, `hasMap` | Preserve; FAQ is used only as a serializer test fixture, not as a score criterion |
| TC-F37-02-13..28 | Already-built opening-hours/editor/legacy data regressions | Preserve as regression suite; do not rewrite or reuse IDs |
| **TC-F37-02-29** | Category filters subtype dropdown | Required new acceptance evidence |
| **TC-F37-02-30** | Category change preserves/clears subtype | Required new acceptance evidence |
| **TC-F37-02-31** | Server rejects incompatible pair and preserves prior valid data | Required new security/data evidence |
| **TC-F37-02-32** | Empty/compatible subtype controls exact JSON-LD `@type` and 0/4 score | Required new integration evidence |
| Old-plan TC-F37-02-29..46 | Untracked local Schema-40 positive/zero matrix that collides with canonical 29..32 | Remove this mapping. Allocate fresh, non-colliding IDs in QA before retaining any 35-point scorer cases |

The deterministic Schema-35 matrix still needs positive/zero evidence for all
eight criteria, total 35/0, malformed nodes, and child-without-valid-parent.
The planner must first reserve new QA IDs after 32; it must not overwrite
29..32.

## Required implementation surfaces

The merged contract makes subtype work mandatory; it is not a JSON-LD-only
story.

- `src/collections/Sites.ts`: add `localBusiness.schemaSubtype`.
- `scripts/db-setup.js`: matching idempotent group-column migration
  (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`); no `DROP`.
- `src/lib/seo/local-business-constants.ts` or a focused helper: shared,
  versioned broad-category → compatible subtype mapping and predicates.
- `src/lib/validations/sites.ts`: validate the category/subtype pair at the
  save boundary.
- `src/components/editor/SettingsPanel.tsx` and local-business types/components:
  dependent subtype dropdown, single-option auto-select, compatible preserve,
  incompatible clear, pending/error behavior.
- `src/lib/seo/schema-helpers.ts` / `json-ld.ts`: stop deriving `@type` directly
  from `businessCategory`; emit the validated `schemaSubtype`, otherwise generic
  `LocalBusiness`. Keep broad-category price fallback.
- Focused unit/component/API tests and one real browser flow covering
  TC-F37-02-29..32, plus the exact 35-point signal matrix.

Because a Payload group field is added, AGENTS.md makes the SQL migration a P0
gate. The new Editor behavior is frontend work and needs 375px/browser
verification. No environment variable is implied.

## #1312 boundary

US-F37-02 may expose a pure, node-derived `SchemaScoreResult` worth 0..35 so
emission and points use one source of truth. It must not:

- activate or rewrite the top-level authenticated score API;
- scan Payload pages or derive other buckets;
- compose Business 20 + Schema 35 + AI 15 + Technical 30;
- change Dashboard `SeoHealth`, issue ownership, CTA/destination, or AI Fix All.

Those are #1312/US-F37-04 responsibilities under PRD FR-19..21. The handoff
should be generated Schema nodes/signals in and exact `{ score, breakdown }`
out, with no database/network I/O.

GitHub issue #1312 is also stale: it still mentions OG image/bad slug and
“up to three actions.” Plan against PRD FR-19..21 and merged PR #1677, and
schedule issue/story sync rather than importing the stale body into US02.

## External dependencies and gates

### PR #1708 / US-F37-01

- State: **OPEN**, head `9009b5b4...`, currently
  `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`, review required.
- It modifies `local-seo-score.ts`, the score API, `SettingsPanel.tsx`,
  `local-business-constants.ts`, `validations/sites.ts`, tests, QA, and Editor
  page surfaces that US02 also needs.
- Its PR text still says #1312 owns `20/40/20/20`; that note is stale after
  #1677.
- Treat as an explicit semantic-rebase/integration gate, not a contract source.
  Do not overwrite its minimal-business save mutex, rollback, validation, or
  nested `minimalBusinessData` compatibility work. Resolve against staging's
  35-point contract once its final disposition is known.

### Documentation sync

- `docs/stories/F37-local-seo-stories.md` and GitHub issues #1310/#1312 require
  follow-up sync to the merged contract.
- This discrepancy must be visible in the plan. It does not justify reverting
  merged PR #1677 or retaining FAQ points.

### External validation

- Google/Schema.org sources are needed once, at implementation time, to curate
  the checked-in mapping; no runtime dependency.
- Google Rich Results validation remains manual evidence and must use a public,
  non-secret storefront URL.
- A real tenant-owned published fixture is needed for browser acceptance.
  `E2E_SITE_ID` availability was not established by docs and must not be assumed;
  define explicit local skip/CI failure or provisioning behavior before writing
  the E2E.

## Old plan: preserve / remove / rewrite

### Preserve

- Strict name + complete structured-address gate and shared address predicate.
- Defensive narrowing of nested tenant values in Organization/WebSite/
  Breadcrumb/WebPage/LocalBusiness generation.
- Safe serializer coverage for `<`, `>`, `&`, `</script>`, U+2028/U+2029.
- Defensive hours validation, partial/non-finite geo omission, explicit/derived
  priceRange, no `aggregateRating`, strict-first + legacy Contact compatibility,
  node-derived pure scoring concept, and read-only storefront verification.
- No database/network access in the pure Schema scorer; no Dashboard/API
  expansion in US02.

### Remove

- FAQPage as US02 scope or a 4-point Schema criterion.
- Schema 40, weights `8/5/6/5/3/3/3/4/3`, and overall `20/40/20/20`.
- Direct `businessCategory → @type` derivation.
- Old TC-F37-02-29..46 assignment.
- Claims that collection fields, migrations, Editor UI, and validation are out
  of scope.
- Claims that PR #1677 is open/informational.
- Any assumption that `E2E_SITE_ID` is already provisioned.

### Rewrite

- Phase 1: pin merged SHA/PRD v2.6, reserve non-colliding TC IDs, add a
  documentation-sync task, and lock mapping/version rules.
- Phase 2: add subtype model + SQL migration + shared mapping + save validation
  + Editor workflow and TC-F37-02-29..31.
- Phase 3: adapt strict JSON-LD and scorer to exact Schema 35; subtype controls
  emission and 0/4 points; TC-F37-02-32 plus fresh scorer IDs.
- Phase 4: delegated regression/browser/manual validation, semantic integration
  with #1708, and #1312 handoff using `20/35/15/30`.

## Unresolved decisions to expose at the plan gate

1. **Documentation governance:** whether US02 itself updates
   `docs/stories/F37-local-seo-stories.md` and then requests Story Sync for
   #1310/#1312, or a separate docs ticket owns the sync. The implementation
   contract is still PRD v2.6 either way.
2. **Mapping snapshot contents/version label:** product behavior is fixed, but
   the exact category/subtype option list must be curated and reviewed against
   current Google + Schema.org primary sources before implementation.
3. **PR #1708 sequencing:** merge/rebase US01 first, or implement US02 with a
   mandatory final semantic integration gate. Its current conflicting state
   prevents treating its head as stable.
4. **Browser fixture:** identify/provision the published tenant fixture and
   exact CI policy before claiming E2E coverage; do not silently skip in CI.
