# Phase 01 — Slug Collision Fix (rename plan 260429 `customers` → `audience`)

## Context links

- This plan: [plan.md](./plan.md)
- Colliding plan: `plans/260429-1024-cms-customer-tracking/plan.md` (status: pending, NOT merged)
- Colliding phase: `plans/260429-1024-cms-customer-tracking/phase-02-customers-virtual-collection.md`
- Verified context (file:line) in `plan.md` → "Verified context" section
- Rule reference: `.claude/rules/database-schema.md`

## Overview

- Date: 2026-05-20
- Priority: P0 (blocker — must run before any other phase)
- Implementation status: completed
- Review status: completed
- Description: Rename the pending `customers` virtual collection in plan 260429 to `audience` so this plan can claim `customers` for the shop customer entity. Plan 260429 is NOT yet merged — no DB migration ran for slug `customers` — so this is a textual rename across plan/phase markdown files + a placeholder note. No code touched.

## Key insights

- Plan 260429 was authored before the missing-features audit surfaced the Group B3 shop-customers gap. Its "open questions §1" already flagged the collision risk ("rename if F09 storefront-commerce introduces real shop customers entity").
- Slug `customers` is the natural shop-entity slug (PW1 alignment, REST URL clarity, admin breadcrumb). Plan 260429 aggregates contact+newsletter — better described as `audience` (marketing audience view).
- Decision: rename plan 260429 slug `customers` → `audience`. Rationale: (a) noun is accurate for the aggregation feature (newsletter subs + contact form leads are "audience members", not buyers); (b) clear semantic split from shop "customers" (people who placed orders); (c) avoids future ambiguity in `COLLECTION_SLUGS[]`. Alternative `contact-leads` rejected because it understates newsletter half.

## Requirements

**Functional**

1. All references to slug `customers` in plan 260429 changed to `audience`.
2. All references to feature id `F24-customer-tracking` updated to `F24-audience-tracking` for consistency (within plan 260429 only — not yet in `docs/`).
3. File names that contain `customers` in plan 260429 are renamed via `git mv` to use `audience`.
4. Plan 260429 status remains `pending`; we are NOT executing or merging it as part of this work.
5. Verification: `grep -rn "customers" plans/260429-1024-cms-customer-tracking/` returns zero matches after fix.

**Non-functional**

- Zero code-side changes. Zero migration changes. Zero `src/` edits.
- Rename is a pure docs/plan operation, fully reversible by `git revert`.

## Architecture

```
plans/260429-1024-cms-customer-tracking/
  plan.md                                      ← rename slug + F24 label inside
  phase-02-customers-virtual-collection.md     ← rename file + rename slug inside
                  ↓ rename file to:
  phase-02-audience-virtual-collection.md
```

No schema, no DB, no Payload registration affected.

## Related code files

**READ**

- `plans/260429-1024-cms-customer-tracking/plan.md` (full)
- `plans/260429-1024-cms-customer-tracking/phase-02-customers-virtual-collection.md` (full)
- `plans/260429-1024-cms-customer-tracking/phase-01-tenant-access-refactor.md` (cross-check for incidental `customers` mentions)
- `plans/260429-1024-cms-customer-tracking/phase-03-smoke-verification.md` (same)

**MODIFY**

- `plans/260429-1024-cms-customer-tracking/plan.md`
- `plans/260429-1024-cms-customer-tracking/phase-01-tenant-access-refactor.md` (only if it contains `customers` references)
- `plans/260429-1024-cms-customer-tracking/phase-03-smoke-verification.md` (same)

**RENAME (git mv)**

- `phase-02-customers-virtual-collection.md` → `phase-02-audience-virtual-collection.md`

**CREATE**

- None.

**DELETE**

- None.

## Implementation steps

1. **Audit** all matches: `grep -rn "customers\|customer-tracking" plans/260429-1024-cms-customer-tracking/`. Record line counts per file.
2. **Rename** file: `git mv plans/260429-1024-cms-customer-tracking/phase-02-customers-virtual-collection.md plans/260429-1024-cms-customer-tracking/phase-02-audience-virtual-collection.md`.
3. **Search-replace** within plan 260429 directory:
   - `slug: 'customers'` → `slug: 'audience'`
   - `'customers'` (any quoted slug) → `'audience'`
   - `customers-list-view` → `audience-list-view`
   - `customers.create_table` → `audience.create_table`
   - `customers_id` → `audience_id`
   - `Customers virtual collection` → `Audience virtual collection`
   - `F24-customer-tracking` → `F24-audience-tracking`
   - `cms-customer-tracking` left in folder name (folder name reflects original intent; safe to keep, or rename folder in a separate commit if PM prefers — flagged in open questions).
4. **Update** plan 260429 `plan.md` "Open questions §1" — replace with: "Slug finalized to `audience` per plan 260520-1432-customers-module phase-01. Folder name retained for git history continuity."
5. **Add** a one-line note at top of plan 260429 `plan.md` (under YAML frontmatter): `> **NOTE 2026-05-20**: Renamed slug from \`customers\` to \`audience\` to free namespace for shop customers (F25, plan 260520-1432).`
6. **Verify** grep is clean: `grep -rn "'customers'\|customers.create_table\|customers_id" plans/260429-1024-cms-customer-tracking/` returns nothing.
7. **Verify** no cross-impact: `grep -rn "audience" plans/260429-1024-cms-customer-tracking/` returns the new references coherently.

## Todo

- [x] Audit grep matches in plan 260429
- [x] `git mv` phase-02 file
- [x] Search-replace 8 token classes (slug, table, rel col, list view, etc.)
- [x] Update plan 260429 "Open questions §1"
- [x] Add 2026-05-20 note in plan 260429
- [x] Final grep verification (zero `customers` matches)

## Success criteria

- Zero remaining `customers` token in plan 260429 markdown files (excluding the historical folder name, which is acceptable).
- Renamed phase file present; old filename absent from `git ls-files`.
- Phase 02 of this plan can use slug `customers` without grep collision.
- `git diff` shows only `.md` file changes — no `src/` or `scripts/` files touched.

## Risk assessment

| Risk | L×I | Mitigation |
|------|-----|------------|
| Incomplete rename leaves `customers` ref → phase 02 grep collision | L×M | Step 6 grep verification mandatory before phase complete |
| Folder name `cms-customer-tracking` retained creates future ambiguity | L×L | Note added at top of plan 260429; folder rename deferred (PM call) |
| Plan 260429 contributor objects to slug change | L×L | Decision documented in this plan's "Strategy decision"; PM sign-off captured at plan review |

## Security considerations

None — markdown-only change, no auth/data surface affected.

## Next steps

- On completion, phase 02 begins (Customers collection schema). No other dependencies.
- Future: when plan 260429 is eventually executed, it will use slug `audience` end-to-end — DB migrations + collection + admin view all align.
