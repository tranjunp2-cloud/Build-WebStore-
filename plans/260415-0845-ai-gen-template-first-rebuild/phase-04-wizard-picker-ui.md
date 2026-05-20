# Phase 04 — Wizard Picker UI (`/builder/new-v2`)

## Context links
- **Parent**: [plan.md](./plan.md)
- **Depends on**: Phase 01 (sub-niche taxonomy), Phase 03 (templates populated for preview)
- **Parallel with**: Phase 03 (different skill, can run simultaneously)

## Overview
- **Date**: 2026-04-15
- **Description**: New wizard flow replacing current single-form AI gen entry. 5 steps: (1) category, (2) sub-niche, (3) brand personality, (4) business info, (5) template gallery → pick. Coexist với old `/builder/new` AI form via feature flag.
- **Priority**: P0
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 1 week (5-6 working days)

## Key Insights
- **5 steps max** — Wix has 7, Squarespace has 4. Sweet spot is 5 for conversion without feeling tedious.
- **Progressive disclosure** — step N depends on step N-1 answers. Beauty category → show beauty sub-niches only, not all 40.
- **Preview early, commit late** — show 3 template previews at step 5 before user commits, not a single auto-picked template.
- **Mobile-first** — 60%+ of builder traffic is mobile (per existing analytics). Design wizard mobile-first, desktop as enhancement.

## Requirements
- New route `/builder/new-v2` (old `/builder/new` kept)
- 5 step flow:
  1. **Category**: grid of 5 icons (beauty/restaurant/health/tech/business) — 5 categories for v1
  2. **Sub-niche**: dropdown/chips filtered by category (2-5 options)
  3. **Brand personality**: 4 option cards (modern / classic / bold / friendly) with example imagery
  4. **Business info**: compact form — name, short description, optional logo upload
  5. **Template gallery**: 3 top-ranked templates (from Phase 05 matching engine) → user picks 1
- Feature flag: `ENABLE_WIZARD_V2` in env — controls which flow loads
- Analytics events: step_complete, step_abandon, template_pick, template_swap
- Mobile-responsive (375px min)
- Loading states + error handling
- "Skip and use AI" escape hatch at any step

## Architecture

### New files
```
src/app/(builder)/builder/new-v2/page.tsx                     # wizard shell
src/app/(builder)/builder/new-v2/WizardClient.tsx             # client orchestrator
src/components/wizard/Step1Category.tsx
src/components/wizard/Step2SubNiche.tsx
src/components/wizard/Step3BrandPersonality.tsx
src/components/wizard/Step4BusinessInfo.tsx
src/components/wizard/Step5TemplateGallery.tsx
src/components/wizard/WizardProgressBar.tsx
src/components/wizard/WizardNavButtons.tsx
src/lib/wizard/state.ts                                       # Zustand store
src/lib/wizard/types.ts                                       # WizardAnswers type
src/lib/wizard/analytics.ts                                   # event tracking
```

### Reused components
- `src/components/blocks/*` — template preview uses existing renderer
- `src/lib/utils/image-upload.ts` — logo upload
- `src/app/api/templates/rank` — Phase 05 matching engine endpoint

### Wizard state
```ts
interface WizardAnswers {
  category: string           // 'beauty' | 'restaurant' | 'health' | 'tech' | 'business'
  subNiche: string           // e.g. 'dental-clinic'
  personality: 'modern' | 'classic' | 'bold' | 'friendly'
  businessInfo: {
    name: string
    description: string
    logoMediaId?: number
  }
  selectedTemplate?: TemplateEntry
}
```

### Feature flag
```ts
// Check on /builder/new redirect
if (env.ENABLE_WIZARD_V2 === 'true' || user.betaFlags?.wizardV2) {
  redirect('/builder/new-v2')
}
```

## Related code files
- `src/app/(builder)/builder/new/page.tsx` — existing AI form (reference)
- `src/components/builder/AIBuilderForm.tsx` — existing form components to reference
- `src/lib/payload/auth.ts` — auth check
- Phase 01 `reports/subniche-taxonomy.md` — data for step 2

## Implementation Steps
1. Scaffold wizard route + client shell (0.5 day)
2. Build WizardProgressBar + WizardNavButtons (0.5 day)
3. Step 1 — Category grid (0.5 day): 5 cards, icon + label, select → advance
4. Step 2 — Sub-niche chips (0.5 day): filter from taxonomy by selected category
5. Step 3 — Brand personality cards (0.5 day): 4 options with example imagery
6. Step 4 — Business info form (1 day): name + description + optional logo upload
7. Step 5 — Template gallery (1 day): stub with 3 fake templates (connect to matching engine in Phase 05)
8. Wizard state management Zustand (0.5 day)
9. Analytics events wiring (0.5 day)
10. Mobile responsive pass (0.5 day)
11. Feature flag + routing (0.5 day)
12. Review gate with anh + 2-3 internal users (30min)

## Todo list
- [ ] Scaffold route + shell
- [ ] Progress bar + nav buttons
- [ ] Step 1: Category grid
- [ ] Step 2: Sub-niche chips
- [ ] Step 3: Brand personality cards
- [ ] Step 4: Business info form
- [ ] Step 5: Template gallery (stub)
- [ ] Zustand state
- [ ] Analytics events
- [ ] Mobile responsive
- [ ] Feature flag
- [ ] Internal review

## Success Criteria
- Wizard renders on mobile (375px) + desktop
- All 5 steps navigate forward + back
- Step state persists across reloads (Zustand persist)
- Analytics events fire correctly (verified in dev)
- "Skip to AI" escape works at any step → redirects to old flow
- Internal testers complete wizard in ≤2 minutes without confusion

## Risk Assessment
- **UX uncertainty** — first wizard iteration may confuse users. Mitigation: user testing at internal review gate, iterate before Phase 07 rollout.
- **State management complexity** — 5 steps with back/forward → Zustand with persist handles most, but preview image upload async state tricky. Mitigation: use React Hook Form for step 4 form state.
- **Mobile preview rendering** — template previews need to render at 375px but templates are designed for 1440px. Mitigation: scale-down iframe with viewport meta.

## Security Considerations
- Feature flag env var — no user input → no injection risk
- Logo upload reuses existing Payload media upload (same XSS/file-size protection)
- Analytics events scrubbed of PII (no businessInfo.name in event payloads)

## Next steps
- Phase 05 replaces Step 5 stub with real matching engine
- Phase 06 personalizes picked template with businessInfo
- Phase 07 rollout controls feature flag
