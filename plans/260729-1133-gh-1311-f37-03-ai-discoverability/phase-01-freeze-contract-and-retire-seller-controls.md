---
title: "Phase 01 — Freeze Contract and Retire Seller Controls"
status: completed
effort: 4h
---

# Phase 01 — Freeze Contract and Retire Seller Controls

## Context Links

- GitHub issue #1311 — verify/synchronize if stale seller-toggle criteria remain
- PR #1559 — merged F37-03 route/toggle implementation
- PR #1677 — merged v2.6 platform-managed contract (`38d5868e`)
- Parent plan: [plan.md](./plan.md)

## Overview

Use the merged PRD v2.6 contract to make approved crawler access a platform invariant and remove obsolete seller-facing controls without destructive schema work. Implementation and automated validation are complete.

## Key Insights

- Existing `aiCrawlersEnabled=false` records must not keep blocking approved assistants after cutover.
- The obsolete feature crosses Dashboard composition, block customization, API, types, localization, analytics, and tests.
- The safest schema transition is to retain the existing column and migration as inert compatibility data.

## Requirements

- Implement against merged PRD v2.6; synchronize issue #1311 before acceptance review if its wording remains stale.
- Always emit allow groups for GPTBot, ClaudeBot, Google-Extended, PerplexityBot, and CCBot.
- Preserve generic search crawler access, known scraper blocks, and `/api/` plus `/admin/` restrictions.
- Remove the complete seller-visible SEO Action Tools section under v2.6, including its crawler, sitemap-resubmit, and embedded auto-meta controls. The separate Dashboard SEO-page auto-meta control is outside this phase.
- Remove the custom crawler-toggle mutation surface and its obsolete analytics event after confirming no remaining consumer.
- Gracefully discard persisted `tools` dashboard block IDs rather than breaking existing preferences.
- Keep `sites.ai_crawlers_enabled` and its migration; the value becomes non-authoritative.

## Architecture

The public robots route becomes the single source of crawler policy. Dashboard data no longer transports crawler state, and no seller mutation can alter the policy. Persistence remains backward-compatible, but application reads of the legacy value are forbidden in robots and score paths.

## Related Code Files

### Modify

- `src/app/sites/[slug]/robots.txt/route.ts`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/lib/dashboard/seo-data.ts`
- `src/lib/dashboard/dashboard-types.ts`
- `src/lib/dashboard-utils.ts`
- `src/components/dashboard/revamp/customize-modal.tsx`
- `src/components/dashboard/revamp/atoms.tsx`
- `src/app/(dashboard)/dashboard/dashboard-revamp.css`
- `src/collections/Sites.ts` only to mark the existing field hidden/deprecated; do not add/remove a field
- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`
- `src/__tests__/unit/seo/ai-crawlers-robots.test.ts`
- `src/__tests__/unit/dashboard/dashboard-blocks.test.ts`
- `src/__tests__/unit/dashboard/customize-modal-scroll-lock.test.tsx`

### Delete after consumer search

- `src/components/dashboard/revamp/seo-tools.tsx`
- `src/app/api/seo/ai-crawlers-toggle/route.ts`
- `src/__tests__/unit/seo/ai-crawlers-toggle-api.test.ts`

### Must not modify

- `scripts/db-setup.js`
- `src/lib/seo/local-seo-score.ts`
- `src/app/api/sites/[siteId]/local-seo-score/route.ts`

## Implementation Steps

1. Confirm work continues on `feat/F37-03-1311-ai-discoverability` from the latest `staging`.
2. Read the merged PRD v2.6 and record US-F37-03 AC-01..03, the approved bot list, and UI removals in the implementation PR description.
3. Use `rg` to enumerate every `aiCrawlersEnabled`, `ai-crawlers-toggle`, `SeoTools`, `tools` block, and analytics consumer.
4. Change robots generation to ignore the legacy field and preserve all non-AI safety directives.
5. Remove the SEO Tools render path, block registration, data/type wiring, translations, and obsolete event code.
6. Delete the custom crawler-toggle API only after confirming there is no internal or external caller; choose a documented `410` transition if compatibility is required.
7. Hide/deprecate the existing Payload field without changing its schema shape; leave SQL setup intact.
8. Update regression tests, including a legacy-false site that still allows approved bots.

## Todo

- [x] Select PR #1677 as the US-F37-03 implementation contract.
- [x] Merge PR #1677 into staging (`38d5868e`).
- [x] Update the dedicated F37-03 branch from latest `origin/staging`.
- [x] Confirm the canonical approved bot list.
- [x] Confirm no remaining crawler-toggle API consumer; remove the obsolete route.
- [x] Remove seller controls and stale dashboard block wiring.
- [x] Make robots policy invariant.
- [x] Prove no migration or score ownership leaked into this phase.

## Completion Evidence

- Approved bots ignore legacy `aiCrawlersEnabled=false`; scraper and private-path rules remain covered.
- Persisted `tools` block IDs are normalized without breaking Dashboard customization.
- No score helper/API or SQL migration changed.
- Included in the formal Phase 02 validation baseline: targeted 67/67, full 11,111/11,111, typecheck pass, lint 0 errors, and `git diff --check` pass.

## Success Criteria

- Seller UI exposes none of the prohibited controls.
- Persisted Dashboard layouts containing `tools` load without an exception.
- Approved assistants are allowed for both legacy `true` and `false` records.
- Scraper/search-engine regression tests remain green.
- No `DROP`, no new schema migration, and no score-file diff exists.

## Risk Assessment

- Future PRD drift is high impact: pause and reconcile any post-v2.6 contract change before acceptance review.
- Deleting a mutation route can affect unknown clients: inventory consumers and document the chosen compatibility behavior.
- Removing a persisted dashboard block can corrupt customization unless unknown IDs are normalized.

## Security Considerations

- Keep authentication and tenant checks intact until the mutation endpoint is removed.
- Do not weaken scraper blocks or private-path restrictions while broadening approved assistant access.
- Never log tenant, auth, or site configuration data during migration compatibility checks.

## Next Steps

Phase 02 completed. Proceed to Phase 03 documentation, TC-ID, E2E, and staging closeout.
