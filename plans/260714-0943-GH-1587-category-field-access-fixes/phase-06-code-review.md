# Phase 06 — Code Review

## Context links
- Plan: [plan.md](./plan.md)
- Reviews Phases 01-05 diff
- Standards: `docs/standards/CODE_STANDARDS.md`, `.claude/rules/database-schema.md`

## Overview
- **Priority:** P1. **Status:** completed. Depends on 01-05.
- Delegated to `code-reviewer` agent (read-only).

## Requirements / review checklist
1. **Access control correctness:** field `access.update` denies dna(non-super-admin)/tenant/
   site/deletedAt; DNA route still works; delete flow overrideAccess:true does not over-broaden
   (top findByID gate remains overrideAccess:false).
2. **No new smuggling vector:** allowlist truly excludes dna/tenant/site/deletedAt; passthrough gone.
3. **Parent cross-tenant** logic sound for super-admin exemption + object-vs-id tenant shapes.
4. **Breadcrumb fallback** correct on partial updates.
5. **Sentinel codes** consistent between `Categories.ts` (emit) and `CategoryManager.tsx` (handle);
   i18n keys resolve.
6. **db-setup.js** DO-block idempotent, UNIQUE-only predicate, tenant_slug_uniq untouched, passes
   check-migrations.
7. **Tests** meaningful (no tautologies), TC-ID referenced, no fake data / skips.
8. **Docs** (Phase 03) match enforced behavior; M4 path applied as decided.
9. Standards: file size, error handling, no `.passthrough()` residue, no `--no-verify` needs.

## Success criteria
- Score ≥ 9.0 or all critical/high findings resolved.
- No security regression; no unaddressed correctness finding.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Reviewer misses silent-strip subtlety | Low×High | checklist item 1 explicitly calls it out |

## Security considerations
- Final gate confirming H1/H2/M1 closed before merge to staging.

## Next steps
- On pass → git-manager (conventional commit, PR to staging). Rebase (35 commits behind staging)
  handled at merge time — NOT part of these phases.
