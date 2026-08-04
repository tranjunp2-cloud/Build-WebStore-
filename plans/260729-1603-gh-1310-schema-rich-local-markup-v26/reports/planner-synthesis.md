# Planner synthesis — US-F37-02 v2.6

## Recommendation

Supersede the assumptions of the historical 40-point plan with a four-phase v2.6 plan. The merged contract makes this a full vertical slice: taxonomy, persistence, server validation, Editor behavior, JSON-LD, pure scoring, and storefront acceptance.

## Evidence used

- `research/researcher-01-contract-traceability.md`
- `research/researcher-02-codebase-gap-architecture.md`
- PRD v2.6 US-F37-02 and FR-04..11
- Architecture subtype/emission and Schema 35 sections
- QA TC-F37-02-29..32 registry
- Stale story text and historical plan, used only to identify conflicts
- Current code anchors in Sites, migration setup, Zod, SettingsPanel, Editor page, JSON-LD, renderer, scorer WIP, tests, and Playwright config

## Resolved defaults

1. PRD v2.6 is the implementation target; Phase 00 synchronizes stale issue/story text before cook/review.
2. US02 exports a pure node-derived 0..35 scorer only. It does not change the legacy/top-level API.
3. Legacy weak Contact LocalBusiness may render for compatibility but never earns strict points, duplicates a strict node, or emits an invalid subtype.
4. Additive work may begin before PR #1708 lands, but Done requires semantic reconciliation with its accepted save/rollback behavior.
5. Browser acceptance is blocked until a named fixture owner and provisioning/CI policy exist.
6. Existing defensive JSON-LD/serializer work is selectively retained; Schema 40, FAQ scoring, category-derived type, and collided TC mappings are replaced.

## Traceability

| Contract | Primary phase | Evidence |
|---|---|---|
| AC-04 / FR-05 pair persistence and rejection | 01 | TC-F37-02-29..31 |
| AC-01 / FR-04..11 schema and exact 35 | 02 | TC-F37-02-32 + freshly registered IDs after 32 |
| AC-02 hours omission | 02 | fresh registered positive/zero hours cases |
| AC-03 partial/non-finite geo | 02 | fresh registered geo cases |
| Storefront/Rich Results | 03 | read-only Playwright + TC-F37-02-09 manual |
| Overall 20/35/15/30 | downstream #1312 | handoff only |

## Critical sequencing

Phase 00 is a contract gate, Phase 01 establishes the only accepted subtype source, Phase 02 consumes that source for both output and scoring, and Phase 03 proves the composed storefront behavior. Product phases must not invent their own mapping or TC IDs.

## Main review hazards

- Missing `sites.local_business_schema_subtype` SQL is a P0 request-changes defect.
- UI-only validation permits forged `@type`.
- Sparse patches can invalidate a pair unless effective state is validated.
- Scoring `@type !== LocalBusiness` grants points to arbitrary tenant strings.
- Legacy fallback can create duplicate nodes or false points.
- Silent E2E skips can falsely mark acceptance complete.
- Merging #1708 text/logic wholesale can restore Schema 40 or break atomic saves.

## Scope boundary

No new route/page is needed. No runtime Google/Schema.org dependency, multiple subtype, top-level score API, Dashboard, issue list, or overall 100-point composition belongs in this plan.
