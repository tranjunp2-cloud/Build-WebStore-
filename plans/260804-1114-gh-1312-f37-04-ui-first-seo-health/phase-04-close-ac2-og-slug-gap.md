# Phase 4 — Close AC-2 OG image and bad slug gap

## Context Links

- Issue #1312 AC-2 currently contains stale OG/bad-slug scoring wording; confirmed scope excludes those fields from Local SEO scoring.
- PRD: `docs/prd/F37-local-seo-search-performance.md` §5, §12.2, §12.3.
- Existing score engine: `src/lib/seo/local-seo-score.ts`.
- Existing legacy technical predicates: `src/lib/seo/technical-score.ts`.
- Existing SEO editor: `src/components/editor/SettingsPanel.tsx`.
- Existing page slug validation: `src/app/api/sites/[siteId]/pages/[pageId]/route.ts`.
- Existing OG editor: `src/components/editor/og-image-editor.tsx`.

## Overview

- Priority: P0
- Status: Documentation resolution
- Goal: reconcile issue #1312 AC-2 with the confirmed Local SEO contract without changing the score formula.

## Scope Challenge

Existing OG upload, page slug editing, slug validation, canonical encoding, score response validation, checklist action routing, and test harnesses are reusable. The minimum safe change is documentation reconciliation. Do not add score, issue, API, UI, database, or generic URL action code for this finding.

The issue/story wording is stale for this scope: OG image and bad slug are Editor SEO concerns, but they do not affect the Local SEO score. The confirmed contract keeps PRD §5 unchanged: Technical Health remains metadata coverage, content quality, verification, and indexability.

## Contract Decision

1. Keep `calculateLocalSeoScore` and Technical Health weights unchanged.
2. Do not add OG image or bad slug deductions to the Local SEO score.
3. Do not add OG/bad-slug Local SEO checklist issue codes or actions.
4. Update issue #1312 AC-2 and the F37 story/QA traceability to state that OG image and slug remain Editor SEO controls outside the Local SEO formula.
5. Retain the existing SEO Editor controls and any separate non-F37 technical scoring code; do not delete or repurpose them.

No code implementation is required for this review finding after the contract confirmation.

## Requirements

### Functional

- Local SEO score remains exactly the existing 20/35/15/30 contract.
- OG image and bad slug are explicitly documented as outside this formula.
- Existing SEO Editor controls remain unchanged.

### Non-functional

- No score/API/UI code changes for this finding.
- No database schema or environment changes.
- Issue, PRD, story, and QA references must not contradict one another.

## Resolution Flow

1. Update the source story and synced issue #1312 AC-2 to remove the claim that OG image/bad slug affect Local SEO Technical Health.
2. Update F37 story/QA traceability to preserve the Editor SEO scope while excluding those fields from the Local SEO formula.
3. Add a documentation-contract regression assertion only if the repository's existing QA contract requires it.
4. Add a clear PR #1751 review note linking the synchronized docs and re-review against the confirmed contract.

## Related Documentation Files

### Modify

- `docs/stories/F37-local-seo-stories.md` — remove the stale claim that OG/bad slug affect Local SEO scoring.
- `docs/prd/F37-local-seo-search-performance.md` — clarify OG/slug Editor SEO scope versus Local SEO scoring formula.
- `docs/qa/F37-local-seo.md` — update AC-2 traceability and remove the P0 mismatch.

### Explicitly out of scope for this finding

- `src/lib/seo/local-seo-score.ts`
- `src/lib/seo/local-seo-evaluation.ts`
- `src/lib/seo/local-seo-score-contract.ts`
- SEO Health dashboard components

## Implementation Steps

1. Update the synced story source and issue #1312 AC-2 to reflect the confirmed scope.
2. Clarify in PRD §5/§12 that OG image and slug are Editor SEO controls and not Local SEO score inputs.
3. Update QA traceability so no test expects OG/bad-slug deductions.
4. Verify the existing score/API/UI tests remain unchanged and pass.
5. Comment on/re-review PR #1751 and close the finding as a specification correction.

## Todo List

- [ ] Synchronize issue/story wording.
- [ ] Clarify PRD formula and Editor SEO boundary.
- [ ] Update QA traceability.
- [ ] Verify no code regression and re-review PR #1751.

## Success Criteria

- Issue, PRD, story, and QA docs agree that OG image and bad slug do not affect Local SEO scoring.
- Existing 20/35/15/30 formula remains unchanged.
- No new OG/bad-slug score deductions or checklist actions are introduced.
- PR review finding is closed as a documentation/contract correction.

## Risk Assessment

- **Stale issue sync:** update the source story and issue together.
- **Accidental score drift:** add a review check that score engine files are unchanged for this remediation.
- **Scope confusion:** document the boundary between Editor SEO and Local SEO.

## Security Considerations

No new API, input, URL, authorization, or data-storage behavior is introduced.

## Next Steps

After the confirmed scope is synchronized into issue/story/PRD/QA docs, re-review PR #1751. No source-code implementation is expected for this P0 finding.
