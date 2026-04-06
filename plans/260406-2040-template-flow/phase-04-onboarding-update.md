# Phase 04 — Onboarding Update

## Context
- `src/app/(frontend)/onboarding/_components/WelcomeScreenClient.tsx` — hien co 1 CTA "Create Store" + "Skip"
- Truoc do co 3 options (AI / Template / Scratch) — da don gian hoa
- `/builder/new` se co template picker built-in (Phase 01)

## Overview
Update onboarding screen phu hop voi flow moi. Template picker da nam trong builder, nen onboarding chi can 1 CTA chinh.

## Key Insights
- WelcomeScreenClient hien tai DA don gian: chi co "Create Store" link den `/builder/new` + "Skip to Dashboard"
- Flow moi: `/builder/new` bat dau bang template picker -> info -> generate
- Onboarding KO can thay doi nhieu — chi update copy/messaging
- `/templates` page van giu cho SEO/browsing nhung ko con la onboarding path

## Requirements
- [x] Update CTA copy phan anh template picker built-in
- [x] Optional: them subtitle mention "50+ templates" de tang appeal
- [x] Giu "Skip to Dashboard" cho users da co site
- [x] Remove old `/templates` link tu onboarding (neu con)

## Implementation Steps

### 1. Update WelcomeScreenClient copy
**File:** `src/app/(frontend)/onboarding/_components/WelcomeScreenClient.tsx`
- CTA button text: "Create Your Website" (giu nguyen hoac update)
- Subtitle: them mention "Choose from 48+ templates or let AI design from scratch"
- Keep link to `/builder/new` (ko doi)

### 2. Update i18n strings
**Files:** `src/i18n/locales/en.json`, `ms.json`, `vi.json`
- Update `onboarding.welcome.subtitle` them template mention
- Key moi: `onboarding.welcome.templateHint` = "48+ professional templates included"

### 3. Clean up old template path (neu con)
- Check `/templates` page (`src/app/(frontend)/templates/page.tsx`) — giu lai cho browsing/SEO
- Remove bat ky direct link tu onboarding den `/templates` (neu co)
- `/templates` page co the them CTA "Use with AI Builder" link den `/builder/new?template={id}`

### 4. Deep link support (optional)
**File:** `src/app/(builder)/builder/new/AIBuilderPageClient.tsx`
- Support query param `?template={id}` — auto-select template va skip picker
- Useful cho links tu `/templates` page, email campaigns, etc.

## Related Code Files
- `src/app/(frontend)/onboarding/_components/WelcomeScreenClient.tsx`
- `src/i18n/locales/*.json`
- `src/app/(frontend)/templates/page.tsx`

## Todo
- [ ] Update onboarding subtitle/copy
- [ ] Update i18n strings (en, ms, vi)
- [ ] Verify no old template path links remain in onboarding
- [ ] Optional: deep link `?template=` support
- [ ] Test onboarding -> builder -> template picker flow

## Success Criteria
- Onboarding -> "Create Website" -> thay template picker (step 1 cua builder)
- Copy mention templates de user biet co san
- Old flow ko bi break (backward compatible)
- `/templates` page van accessible nhung ko con la primary onboarding path
