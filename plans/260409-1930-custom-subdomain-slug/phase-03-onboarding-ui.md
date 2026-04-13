# Phase 03: Onboarding Slug Picker UI

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 + 02
- Priority: P2 | Effort: 2h

## Overview
After user enters business name in onboarding, show auto-generated slug with inline edit + real-time availability check.

## Requirements
- Auto-suggest slug from business name (debounced, 300ms)
- Show preview: `{slug}.web-v2.dev.ecommercehub.my`
- Real-time availability indicator (green check / red X)
- User can edit slug freely
- Optional: show during AI generation "Building your site at mybakery.web-v2.dev.ecommercehub.my..."

## Architecture
```
┌─────────────────────────────────────────────────────┐
│ Choose your website address                          │
│                                                      │
│ ┌──────────────────┐ .web-v2.dev.ecommercehub.my    │
│ │ rimba-tours      │ ✅ Available                    │
│ └──────────────────┘                                 │
│                                                      │
│ 💡 You can change this later in Settings             │
└─────────────────────────────────────────────────────┘
```

## Related Files
- `src/app/(frontend)/onboarding/page.tsx` — add slug step
- `src/components/onboarding/SlugPicker.tsx` — NEW component

## Implementation Steps
1. Create `SlugPicker.tsx` component with:
   - Input field (controlled, debounced)
   - Domain suffix label
   - Availability indicator (loading/available/taken)
   - Suggestions list when taken
2. Integrate into onboarding flow after business name step
3. Pass chosen slug to generate-site/apply-template API
4. Handle loading state during availability check

## Success Criteria
- User sees and can edit subdomain during onboarding
- Real-time feedback on availability
- Chosen slug saved to tenant on creation
