# Phase 02 — Emit Schema and Score Exactly 35

**Status:** Completed for implementation and automated verification.

## Objective

Selectively retain the safe runtime-hardening WIP, replace superseded category-derived/FAQ/40-point logic, and expose a pure generated-node scorer for FR-04..11.

## Exact score contract

| Breakdown key | Proof from emitted nodes | Points |
|---|---|---:|
| `localBusiness` | non-empty name plus complete PostalAddress (street, city, postcode, country) | 10 |
| `subtype` | one compatible persisted specific subtype equals emitted `@type` | 4 |
| `openingHours` | at least one valid, non-closed OpeningHoursSpecification | 5 |
| `geo` | both coordinates finite in GeoCoordinates | 4 |
| `telephone` | trimmed non-empty telephone on the canonical strict node | 3 |
| `url` | absolute normalized HTTP(S) URL on the canonical strict node | 3 |
| `priceRange` | explicit or broad-category-derived emitted value | 3 |
| `organization` | one separate Organization with trimmed name and absolute normalized HTTP(S) URL | 3 |
| **Total** | exact additive maximum | **35** |

FAQ is absent from scorer input, breakdown, and total.

## Related files and actions

- `/home/liam/data/ech-prime-web-v2/src/lib/seo/schema-helpers.ts:82` — retire F37 direct `businessCategory → @type`; retain F01 `schemaTypeFor(siteType)`, complete-address/time guards, and category-only price fallback. Add a compatible subtype resolver backed by Phase 01 mapping.
- `/home/liam/data/ech-prime-web-v2/src/lib/seo/json-ld.ts:229` — strict homepage generator uses compatible `schemaSubtype`, otherwise generic `LocalBusiness`; require trimmed name and complete structured address for strict parent; omit incomplete hours/geo and invalid nested values.
- `/home/liam/data/ech-prime-web-v2/src/lib/seo/json-ld.ts:350` — aggregate Organization and one strict homepage LocalBusiness without duplication; independent generator failures do not crash unrelated schemas.
- `/home/liam/data/ech-prime-web-v2/src/lib/seo/json-ld.ts:25` — retain and exclusively use `serializeJsonLd()` for `<`, `>`, `&`, `</script>`, U+2028/U+2029 safety.
- `/home/liam/data/ech-prime-web-v2/src/components/site-renderer/SiteRenderer.tsx:430` and `:669` — retain the existing generation/injection seam; no renderer architecture rewrite.
- `/home/liam/data/ech-prime-web-v2/src/lib/seo/schema-score.ts` — replace WIP Schema 40 with a pure scorer accepting one `SchemaGenerationArtifact` produced from one immutable site snapshot. The artifact contains the canonical strict LocalBusiness node, Organization node, and validated category/subtype evidence; no arbitrary cross-site node/context mixing, Payload/network/API calls.
- `/home/liam/data/ech-prime-web-v2/src/lib/seo/local-seo-score.ts` and score route — do not rewire; US-F37-04 owns the top-level engine/API.

## Compatibility and failure rules

- Legacy records with no subtype emit generic `LocalBusiness` and earn 0/4.
- An invalid persisted pair is treated as generic at generation and scores 0/4 even if data bypassed save validation.
- Weak Contact fallback may render only when it cannot duplicate the strict node; it never earns strict parent or child points. It may emit a specific type only if the same pair validation succeeds.
- Weak/legacy nodes never enter `SchemaGenerationArtifact`. All LocalBusiness child signals come from the exact canonical strict node; signals cannot be combined across duplicates and cannot score without its valid parent.
- Closed-only/incomplete hours, half/non-finite geo, malformed nodes, or throwing optional generators omit only the invalid signal.
- Keep explicit priceRange first, category fallback second. Never emit `aggregateRating`.
- URL predicates reject non-HTTP(S), relative, credential-bearing, control-character, and malformed values. Use the same canonical URL builder for emission and scoring; domain ownership remains the existing site/domain subsystem's responsibility.

## Test plan

Before editing tests, Phase 00 must register fresh IDs after TC-F37-02-32 and replace the current uncommitted `29..44` collisions.

- `src/__tests__/unit/seo/local-business-json-ld.test.ts`
  - TC-F37-02-10 serializer matrix remains security coverage, not FAQ score.
  - TC-F37-02-32 generic vs exact compatible subtype, plus invalid persisted pair.
  - Fresh registered IDs: strict parent/address, all-closed/incomplete hours, half/non-finite geo, phone, URL, explicit/derived price, Organization, duplicate/legacy fallback, generator resilience, no aggregateRating.
- `src/__tests__/unit/seo/schema-score.test.ts`
  - TC-F37-02-32 exact subtype 0/4.
  - Fresh IDs: each criterion positive and zero, exact full 35 and empty 0, child-without-parent 0, malformed/duplicate node resistance, FAQ invariance.
- Add a generation-to-score integration case proving “earned” at the US02 boundary from one immutable site snapshot; it does not assert Dashboard/API visibility.
- Add raw rendered-HTML coverage with a malicious tenant sentinel and assert escaped `\\u003c/script\\u003e`; DOM parsing alone is not the XSS proof.
- Keep existing `json-ld-enrichment.test.ts` behavior unless the v2.6 contract explicitly supersedes an assertion; remap only truly conflicting F37 cases.

## Todos

- [x] Rebase the defensive JSON-LD WIP and remove category-derived type behavior.
- [x] Enforce strict parent/child and weak-fallback boundaries at generation.
- [x] Rewrite `schema-score.ts` to the exact eight-signal result.
- [x] Remove FAQ from score input, breakdown, totals, and score tests.
- [x] Renumber collided WIP tests only after QA registration.
- [x] Implement AC-01..04 / FR-04..11 positive, zero, malformed, and security evidence.
- [x] Define/export the concrete `SchemaGenerationArtifact` and same-snapshot scorer signature for #1312.

## Verification

- Scoped JSON-LD/scorer suites; exact assertions `max=35`, `empty=0`, FAQ unchanged.
- Typecheck, lint touched files, `git diff --check`.
- Confirm scorer has no `getPayload`, fetch, database, route, Dashboard, or environment dependency.

## Exit criteria

- Emission and scoring share the same compatible-subtype and strict-node predicates.
- Every criterion has a deterministic predicate for trimming, canonical node selection, URL validity, duplicate handling, and sibling-vs-parent failure.
- Full nodes score exactly 35; each signal independently falls to zero without suppressing valid siblings.
- No unregistered or colliding TC ID remains.
- All tenant-controlled JSON-LD is safe and invalid subtype injection cannot reach `@type`.

## Risks and security

- Checking only `@type !== 'LocalBusiness'` grants forged subtype points; require stored category compatibility.
- Scoring raw booleans drifts from emitted output; derive from generated nodes.
- Plain `JSON.stringify` in script markup is stored-XSS risk; serializer is mandatory.
- Do not let defensive fallbacks hide invalid required data or award strict points.
