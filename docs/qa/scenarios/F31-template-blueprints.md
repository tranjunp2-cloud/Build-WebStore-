# Scenario Analysis: Template Blueprints Redesign (F31)

> Generated: 2026-04-06 | Dimensions: 7/12 | Total: 32 scenarios

## Dimensions Analyzed
Input Extremes, Scale, State Transitions, Error Cascades, Data Integrity, Integration, Business Logic

## Dimensions Skipped
- User Types — admin-seeded, not user-generated
- Timing — single-admin operation
- Authorization — withAuth() unchanged
- Environment — config/data layer only
- Compliance — no PII

## Scenarios

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | Input Extremes | Duplicate preset id | Critical | Seed fails: "Duplicate preset id: {id}" |
| 2 | Input Extremes | Empty pages array (0 pages) | High | Throw: "minimum 4 pages required" |
| 3 | Input Extremes | Invalid blockType typo ('heros') | High | Throw: "Unknown blockType 'heros'" |
| 4 | Input Extremes | businessIndex out of range (5 when max 3) | High | Throw: "businessIndex out of range" |
| 5 | Input Extremes | themePreset undefined | High | Fallback to category default, log warning |
| 6 | Scale | 56 templates × 5 pages = 250 pages batch insert | Medium | Batch by 5, total < 60s |
| 7 | Scale | Template list 56 items picker performance | Low | OK, within limits |
| 8 | Scale | 3000 block objects in memory during seed | Medium | Stream/batch processing |
| 9 | State Transitions | Seed interrupted at template #30 | Critical | Transaction rollback or idempotent seed |
| 10 | State Transitions | force=true deletes 48, then seed FAILS → 0 templates | Critical | Two-phase: seed new first, delete old after |
| 11 | State Transitions | Seed twice without force → 112 duplicates | High | Skip existing by id, return skipped count |
| 12 | State Transitions | Old composeTemplate() called after rewrite | High | Deprecated wrapper works, logs warning |
| 13 | Error Cascades | Content file missing for 'events' | Critical | Clear error, not silent undefined |
| 14 | Error Cascades | Font pairing ID doesn't exist | Medium | Fallback default, log warning |
| 15 | Error Cascades | buildBlock() missing case for industry block | High | Throw, never skip |
| 16 | Error Cascades | Collection missing new category options | High | Payload rejects invalid enum |
| 17 | Data Integrity | Old templates FK from user sites | Critical | Templates are COPIED, no FK. Verify. |
| 18 | Data Integrity | templatePages format mismatch | Medium | Match existing TemplatePage shape |
| 19 | Data Integrity | Homepage detection: pages[0] vs isHomepage | High | Enforce both |
| 20 | Data Integrity | businessIndex 4 never used | Low | Acceptable, spare |
| 21 | Integration | Template picker reads 'tier' (removed) | High | Update to read 'personality' |
| 22 | Integration | apply-template reads defaultBlocks (legacy) | Critical | Must handle templatePages |
| 23 | Integration | generate-site expects old TemplateSeed shape | Medium | Verify output shape matches |
| 24 | Integration | EditorTemplateModal reads fields | Medium | Additive fields, won't break |
| 25 | Business Logic | logo-cloud block doesn't exist | Critical | Verify in block registry |
| 26 | Business Logic | mid-CTA = cta variant banner? | High | Use valid blockType |
| 27 | Business Logic | Health category only fits 2 moods | Medium | Force 4 distinct personalities |
| 28 | Business Logic | TEMPLATE_CATEGORY_OPTIONS: code or DB? | High | If code: update array. If DB: migration. |
| 29 | Business Logic | 56 unique orders with fixed standard blocks | Low | Uniqueness = variable section only |
| 30 | Business Logic | New category content quality | Medium | Must match existing MY-localized quality |
| 31 | Data Integrity | Name collision between old and new templates | Low | Different naming conventions |
| 32 | Error Cascades | Payload create() fails mid-seed | High | allSettled, log failures, continue |

## Summary
- **Critical:** 6
- **High:** 10
- **Medium:** 7
- **Low:** 4
- **Total:** 32 scenarios across 7 dimensions
