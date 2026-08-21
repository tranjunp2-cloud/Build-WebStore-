# Research 02 — Codebase gap and implementation architecture

**Scope:** US-F37-02 against staging `38d5868e671eb41c71a0eebde539499170c57c79` and the approved F37 PRD v2.6 contract. This report is read-only research; it does not treat the uncommitted Phase-2 work as accepted implementation.

## 1. Executive finding

The existing repository already has most Local Business input surfaces and a legacy JSON-LD pipeline, but the approved story is not implementable by only changing the scorer. Four connected changes are required:

1. Add and persist `localBusiness.schemaSubtype`.
2. Enforce one versioned `businessCategory -> allowed schemaSubtype[]` mapping in the Editor, Payload collection validation, and save-route Zod validation.
3. Make JSON-LD use the validated subtype, never infer `@type` directly from `businessCategory`.
4. Replace the uncommitted 40-point schema scorer with the exact eight-signal, 35-point contract.

The current uncommitted Phase-2 diff contains useful defensive JSON-LD work, but it was written for the superseded 40-point contract and currently reuses TC-F37-02-29..44 for unrelated cases. It must be selectively ported, not accepted wholesale.

## 2. Current code map and exact gaps

### 2.1 Data model and migration

| Surface | Existing implementation | v2.6 gap / action |
|---|---|---|
| `src/collections/Sites.ts` | `localBusiness` group already has address, lat/lng, `businessCategory`, `priceRange`, service area and `openingHours`. `sanitizeOpeningHoursOnValidate` is wired in `hooks.beforeValidate`. | Add `schemaSubtype` as a select field immediately after `businessCategory`. Its options should be the union of the static versioned mapping. Add non-throwing compatibility validation using sibling `businessCategory`; do not weaken the existing opening-hours hook. |
| `scripts/db-setup.js` | Group fields use additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; opening hours already has a compliant child table with `id varchar`, `_order`, `_parent_id`, `_uuid`. | Add exactly `sites.local_business_schema_subtype varchar`. No new array table and no `DROP`. |
| `src/lib/seo/local-business-constants.ts` | Shared category, price, day and time constants are reused by Payload and Zod. Categories currently double as schema-shaped values. | Make this the dependency-free source of truth for a versioned category-to-subtype map, subtype option union and helpers such as `getCompatibleSchemaSubtypes`, `isCompatibleSchemaSubtype`, and category-change reconciliation. `businessCategory` remains broad UI data; only `schemaSubtype` controls `@type`. |
| `src/components/editor/local-business/types.ts` | `LocalBusinessData` mirrors the save schema. | Add `schemaSubtype?: string`. Keep nullable persistence handling consistent with existing fields. |

Required migration invariant from `AGENTS.md`: because `src/collections/Sites.ts` gains a group field, the same change must add `ALTER TABLE sites ADD COLUMN IF NOT EXISTS local_business_schema_subtype varchar;` in `scripts/db-setup.js`.

### 2.2 Save boundary and Editor behavior

| Surface | Existing implementation | v2.6 gap / action |
|---|---|---|
| `src/lib/validations/sites.ts` | `localBusinessSchema` validates category, coordinates, price and opening hours. | Extend with the subtype union and `.superRefine()` for the pair. Empty subtype is allowed and earns zero; a non-empty subtype with no category or an incompatible pair must fail. Validation must import the same static mapping as the UI. |
| `src/app/api/sites/[siteId]/save/route.ts` | Parses through `saveSiteSchema`, enforces auth/tenant access, then writes `siteUpdateData.localBusiness`. Failed validation occurs before persistence, so a rejected complete payload preserves the prior DB value. | No new route is needed. Add API regression evidence for direct invalid payload and zero `payload.update` calls. If sparse `localBusiness` patches are introduced by PR #1708 or later, validation must compare the effective persisted+patch pair rather than validating only the sparse object. |
| `src/components/editor/SettingsPanel.tsx` | Business Category and Price Range selects already live in Local Business. `handleLocalBusinessChange()` merges and sends the full localBusiness group. | Add the subtype select directly below category. Disable it until category exists. On category change, atomically save `{ businessCategory, schemaSubtype }`: preserve compatible subtype, auto-select the sole option, otherwise clear. Never issue category and subtype as two competing saves. Add stable labels/test hooks only where needed. |
| `src/app/(editor)/editor/[siteId]/page.tsx` | Merges local-business changes into parent site state and includes them in the PATCH body. | Type propagation should be sufficient once `LocalBusinessData` changes, but regression-test parent wiring and rollback/error behavior because PR #1708 also edits this save path. |
| `src/app/api/sites/[siteId]/editor-data/route.ts` | Returns `site.localBusiness || {}`. | Payload will carry the new group field automatically; verify it survives the typed Editor hydration path. |
| `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` | Labels exist for category and price range only. | Add subtype label, placeholder, disabled hint and invalid-pair feedback in both locales. |

`src/components/editor/local-business/completion-checklist.tsx` currently tracks category, not subtype. Do not silently count subtype as “category complete” unless the approved UI/score wording explicitly requires it; subtype has its own 4-point schema signal.

### 2.3 JSON-LD and storefront integration

| Surface | Existing implementation | v2.6 gap / action |
|---|---|---|
| `src/lib/seo/schema-helpers.ts` | Committed code maps `businessCategory` directly to a schema type. The uncommitted diff adds complete-address and valid-time helpers. | Retain the complete-address/time helpers. Replace the F37 category-derived type path with a validated subtype selector: compatible specific subtype -> exact type; empty/invalid -> generic `LocalBusiness`. Keep the separate F01 `schemaTypeFor(siteType)` vocabulary untouched. Keep `priceRangeForLocalBusinessCategory()` category-derived. |
| `src/lib/seo/json-ld.ts` | Existing generators produce Organization/WebSite/WebPage/Breadcrumb/FAQ/LocalBusiness. `SiteRenderer` calls `generatePageSchemas()`. The uncommitted diff adds strict identity checks and defensive unknown narrowing. | Reuse the defensive narrowing, finite-coordinate checks, valid open-row filtering, safe serializer, and strict complete-address gate. Change `@type` source to `schemaSubtype`. Ensure an invalid persisted pair can never emit the invalid type even if old data bypasses the save API. Do not award or require FAQ for this story. |
| `src/components/site-renderer/SiteRenderer.tsx` | Uses `page.isHomepage === true`, calls `generatePageSchemas({ blocks, site, page, isHomepage })`, and injects the serialized array into a JSON-LD script. | No architectural rewrite is needed. Add integration/browser evidence that the homepage contains one valid strict LocalBusiness plus Organization and that subpages do not create a duplicate strict node. |

Important compatibility decision: the uncommitted aggregator falls back to the legacy Contact-block LocalBusiness when the strict homepage contract is incomplete. That can preserve old rendering, but it must not earn the 10 strict LocalBusiness points and must not allow an incompatible subtype. The implementation plan should explicitly decide whether the homepage may still emit that weak legacy node or whether legacy fallback is limited to non-home Contact pages.

### 2.4 Scoring ownership

There are two distinct scorer surfaces:

- `src/lib/seo/local-seo-score.ts` and `src/app/api/sites/[siteId]/local-seo-score/route.ts` are the **legacy** 35/30/20/15 model. They conflict with PRD v2.6 and are marked target-not-built under US-F37-04.
- Untracked `src/lib/seo/schema-score.ts` derives score from emitted nodes, which is the right shape for preventing source/emission drift, but it implements the superseded **40-point** formula and includes FAQ.

US-F37-02 should own a pure schema scorer that validates generated nodes and totals exactly:

| Signal | Points |
|---|---:|
| Strict LocalBusiness: non-empty name + complete PostalAddress | 10 |
| Compatible selected specific subtype | 4 |
| At least one valid open `OpeningHoursSpecification` | 5 |
| Finite complete GeoCoordinates | 4 |
| Non-empty telephone | 3 |
| Non-empty URL | 3 |
| Explicit or derived priceRange emitted | 3 |
| Valid Organization | 3 |
| **Total** | **35** |

FAQ must be removed from the input, breakdown, tests and total. Subtype credit must require both a specific `@type` and compatibility with the stored category/mapping; checking only `@type !== "LocalBusiness"` is not enough.

Recommended ownership boundary:

- US-F37-02: `schema-score.ts`, exact `SchemaScoreResult`, emitted-node derivation and unit coverage.
- US-F37-04: cut the top-level 0-100 engine/API/dashboard over to `20/35/15/30`.

Unresolved product/API decision: AC-01 says points are earned, but the current public score API is US-F37-04-owned and legacy. The plan must choose either (a) expose an additive nested `schema` result now without changing the legacy top-level response, or (b) prove earning through the pure scorer and leave route aggregation to #1312. Do not partially rewrite the top-level endpoint in this story.

### 2.5 Tests and browser verification

Mandatory conventions:

- Read and follow `docs/TEST_CONVENTION.md`.
- Every new test maps to the existing QA TC-ID and uses real source imports plus AAA.
- Browser coverage uses Playwright, not mocked route tests.

Minimum coverage map:

| Contract | Test surface |
|---|---|
| TC-F37-02-29 category filtering, disabled state, single auto-select, multi explicit selection | Component/pure mapping tests under `src/__tests__/unit/editor/`; extend `settings-panel.test.tsx` only if its existing harness remains readable. |
| TC-F37-02-30 preserve/clear on category change | Pure reconciliation helper plus Editor integration asserting one atomic save patch. |
| TC-F37-02-31 server rejects invalid pair and preserves prior value | `src/__tests__/unit/validations/sites-local-business.test.ts` plus `src/__tests__/api/sites.test.ts`; cover Payload/admin validation if the collection field validation is custom. |
| TC-F37-02-32 subtype controls exact JSON-LD type and 0/4 scoring | `src/__tests__/unit/seo/local-business-json-ld.test.ts` and `src/__tests__/unit/seo/schema-score.test.ts`. |
| AC-01..03 and FR-04,06..11 | The same JSON-LD/scorer files: complete strict node, all-closed/incomplete hours, half/non-finite geo, telephone/url/price/org positives and zero cases. |
| TC-F37-02-10 serializer security | Keep the uncommitted `<`, `>`, `&`, U+2028/U+2029 matrix. |
| Storefront integration | New `e2e/f37-schema-rich-local-markup.spec.ts`: read a known fixture, parse actual `script[type="application/ld+json"]`, assert strict LocalBusiness and Organization, and assert no invalid/duplicate type. |

`playwright.config.ts` currently discovers all `e2e/*.spec.ts` in the authenticated `chromium` project, while its `tests/` storefront project only matches `cart-drawer.spec.ts`. Therefore the least disruptive location is `e2e/f37-schema-rich-local-markup.spec.ts`. Reuse existing `E2E_SITE_ID` resolution/auth patterns; adding a new `process.env` key would require placeholders in both `.env.staging.example` and `.env.production.example` under repository rules. CI should fail clearly when the required acceptance fixture is missing; a documented local skip is acceptable only if the execution gate still runs against staging before completion.

No new page or API route is required by the implementation itself.

## 3. Selective reuse of the uncommitted Phase-2 work

### Reuse after rebasing/remapping

- Runtime `unknown` narrowing in Organization, WebSite, Breadcrumb, WebPage, FAQ and LocalBusiness generators.
- `hasCompleteStructuredAddress`.
- `isValidOpeningTimeRange` and defensive opening-hours emission.
- Strict homepage LocalBusiness builder shape.
- Finite complete geo and safe `hasMap`.
- Explicit-then-derived price range behavior.
- Safe `serializeJsonLd` matrix for `<`, `>`, `&`, U+2028 and U+2029.
- Generated-node-based scorer architecture and its malformed-input testing style.

### Incompatible and must be replaced

- Category-derived `@type` through `schemaTypeForLocalBusiness(businessCategory)`.
- `isLocalBusinessSchemaType()` based only on the old direct category map.
- 40-point weights `8/5/6/5/3/3/3/4/3`.
- FAQ score input and FAQ 4 points.
- Current TC-F37-02-29..44 assignments in the uncommitted tests. TC 29..32 are reserved by current QA for subtype UI/validation/emission/score.
- Old plan/docs assertions of Schema 40 and overall `20/40/20/20`.

Do not delete unrelated WIP (`docker-compose.yml`, `scripts/db-migrate-dev.js`, `docker-compose.worktree.yml`) and do not mix it into this story.

## 4. Dependency and open-PR ownership

PR #1708 (`feat(F37): [US-F37-01] minimal business data`) is still **OPEN**, head `9009b5b413d5fac12076c10473512a301d399aff`, and GitHub reports it **CONFLICTING/DIRTY** against staging. It overlaps:

- `src/lib/seo/local-business-constants.ts`
- `src/lib/validations/sites.ts`
- `src/components/editor/SettingsPanel.tsx`
- `src/app/(editor)/editor/[siteId]/page.tsx`
- `src/lib/seo/local-seo-score.ts`
- `src/app/api/sites/[siteId]/local-seo-score/route.ts`
- Editor/scorer tests and `docs/qa/F37-local-seo.md`

Its hardened save mutex/rollback and additive persisted Business Data score are dependency-relevant but are not present on current staging. Plan implementation may prepare additive commits, but the final integration gate must first resolve #1708: either land it and rebase, or explicitly port its accepted save semantics. Do not independently rewrite its US-F37-01 fields or top-level score contract.

## 5. Risks and guardrails

1. **Invalid type injection / data integrity:** UI filtering is not a security boundary. Validate the pair in Zod and defensively revalidate at emission/scoring time.
2. **Save race:** category change and subtype reconciliation must be one atomic localBusiness patch. This is higher risk until #1708's mutex work lands.
3. **Schema/SQL drift:** `Sites.ts` and `scripts/db-setup.js` must land together. Only additive SQL.
4. **Stored legacy data:** old category-derived records have no subtype. They must emit generic `LocalBusiness`, earn 0 subtype, and remain editable without migration failure.
5. **Contract drift:** score emitted nodes, not raw booleans, and assert exact max 35. No FAQ points.
6. **Malformed nested values:** retain primitive narrowing so tenant-controlled objects cannot crash the storefront or suppress unrelated schemas.
7. **XSS:** all JSON-LD continues through `serializeJsonLd`; never interpolate tenant strings into script markup.
8. **Duplicate/weak nodes:** explicitly define strict homepage vs legacy Contact fallback to avoid two LocalBusiness nodes or false score credit.
9. **Performance:** mapping is static and dependency-free; no runtime Schema.org/Google fetch. Generate the homepage nodes once and reuse them for scoring where practical.
10. **Tenant isolation:** no new endpoint is needed; any additive score response must preserve the existing auth, rate limit and tenant checks.
11. **PR collision:** #1708 touches the same Editor/save/scorer files; delay final conflict resolution until its accepted state is known.

## 6. Minimum executable phase structure

### Phase 1 — Lock dependency, mapping and persistence

- Record the exact v2.6 weights/TC ownership and resolve the #1708 integration strategy.
- Define/version the category-subtype mapping and pure reconciliation helpers.
- Add `schemaSubtype` to Payload, SQL migration, Editor type and both locales.
- Add Zod/Payload compatibility validation.
- Implement Editor disabled/filter/auto-select/preserve/clear behavior with atomic save.
- Gate: TC-F37-02-29..31, migration drift check, typecheck.

### Phase 2 — Emit strict schema and calculate exact 35

- Selectively port defensive JSON-LD WIP.
- Source `@type` from compatible `schemaSubtype`; generic fallback otherwise.
- Preserve strict address, hours, geo, telephone, url, price range and Organization behavior.
- Rewrite `schema-score.ts` to eight signals / max 35; remove FAQ.
- Remap tests to current QA IDs and fill positive/zero/security cases.
- Gate: TC-F37-02-10/32 plus AC-01..04/FR-04..11 unit suite, exact max-35 assertion, typecheck.

### Phase 3 — Storefront integration and acceptance handoff

- Verify SiteRenderer homepage injection and no duplicate/invalid LocalBusiness.
- Add and execute Playwright against a tenant-owned prepared fixture; parse real JSON-LD.
- Run scoped regressions, `git diff --check`, migration validation and manual Rich Results validation for TC-F37-02-09.
- Sync QA status and hand off only the full 0-100 aggregation/dashboard work to US-F37-04/#1312.

## 7. Decisions still required before implementation

1. Which reviewed, dated category-to-subtype mapping/version is authoritative for the current category vocabulary?
2. Does US-F37-02 expose an additive schema-score result through the existing GET API, or is pure scorer evidence sufficient until US-F37-04?
3. Is weak legacy Contact LocalBusiness allowed on an incomplete homepage, or restricted to non-home compatibility behavior?
4. Must implementation wait for PR #1708 to land, or may it proceed with a mandatory final rebase/semantic reconciliation gate?
5. Which staging fixture guarantees complete name/address/category/subtype/hours/geo/price data for the required browser and Rich Results checks?
