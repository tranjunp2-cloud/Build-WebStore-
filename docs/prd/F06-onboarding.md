# PRD: Onboarding Flow (F06)
> **Version:** 2.0 | **Updated:** 2026-03-13 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 1 | **Size:** M  
> **Depends on:** F02 Auth ✅ | **Blocks:** F01 AI Builder, F07 Templates  
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — Persona A

---

## 1. Problem Statement

After registering, users land on a blank dashboard with no guidance. They don't know how to create their first website — whether to use AI or pick a template. The onboarding flow must guide new users from registration to website creation with zero friction.

## 2. Target User

- SME owner who just signed up (Persona A from [malaysia-market-context.md](../malaysia-market-context.md))
- No technical skills, first time using a website builder
- Wants to see results within 5 minutes

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| Onboarding completion rate | > 70% |
| Time from register to builder/templates | < 60 seconds |
| Drop-off at onboarding | < 30% |

## 4. User Story

```
AS A newly registered SME owner
I WANT TO be guided to create my first website
SO THAT I don't get lost and start building immediately
```

## 5. Screen Layout

### Step 1: Store Setup (NEW — MY market)
```
┌─ /onboarding ──────────────────────────────────┐
│                                                  │
│     👋 Welcome to PrimeWeb, [Name]!             │
│                                                  │
│     Tell us about your business:                 │
│                                                  │
│     Store Name*:  [________________]             │
│                                                  │
│     Business Type*:                              │
│     [Fashion ▼] [F&B ▼] [Beauty ▼] [Other]      │
│                                                  │
│     Store Language*:                             │
│     ┌─────────┐  ┌─────────┐                    │
│     │ 🇲🇾 BM   │  │ 🇬🇧 EN   │                    │
│     └─────────┘  └─────────┘                    │
│                                                  │
│     [Continue →]                                 │
└──────────────────────────────────────────────────┘
```

### Step 2: Choose Method
```
┌─ /onboarding/method ───────────────────────────┐
│                                                  │
│     How would you like to create your website?   │
│                                                  │
│     ┌──────────────────┐  ┌──────────────────┐  │
│     │  🤖 AI Builder   │  │  📋 Templates    │  │
│     │                  │  │                  │  │
│     │  Describe your   │  │  Choose from     │  │
│     │  business, AI    │  │  ready-made      │  │
│     │  creates website │  │  designs         │  │
│     │                  │  │                  │  │
│     │  ⏱️ ~2 minutes   │  │  ⏱️ ~5 minutes   │  │
│     │                  │  │                  │  │
│     │  [Start Chat →]  │  │  [Browse →]      │  │
│     └──────────────────┘  └──────────────────┘  │
│                                                  │
│     Mobile: cards stack vertically               │
└──────────────────────────────────────────────────┘
```

## 6. Acceptance Criteria

### AC-1: Store Setup (NEW)
```gherkin
GIVEN user just registered (no sites yet)
WHEN  redirected to /onboarding
THEN  greeting shows "Welcome to PrimeWeb, [firstName]!"
AND   form: Store Name, Business Type (Fashion/F&B/Beauty/Other), Store Language (BM/EN)
AND   language saves to site.locale → used by AI for content generation
AND   business type saves to site.category → used by AI/SEO for MY keywords
```

### AC-1b: Choose Method
```gherkin
GIVEN user filled store setup and clicks "Continue"
WHEN  step 2 loads
THEN  2 option cards: "AI Builder" and "Templates"
AND   each card has icon, description, time estimate, CTA button
```

### AC-2: AI Builder Path
```gherkin
GIVEN user clicks "Start Chat →" (AI Builder)
WHEN  redirected to /builder/new
THEN  AI chat opens with welcome message
AND   site creation begins via chat
```

### AC-3: Template Path
```gherkin
GIVEN user clicks "Browse →" (Templates)
WHEN  redirected to /templates
THEN  template gallery shows available templates
AND   user can preview and apply a template
```

### AC-4: Return Visit
```gherkin
GIVEN user already has ≥1 site
WHEN  navigates to /onboarding
THEN  redirect to /dashboard (skip onboarding)
```

### AC-5: Mobile Responsive
```gherkin
GIVEN screen width < 768px
WHEN  on /onboarding
THEN  option cards stack vertically
AND   all buttons ≥ 44px tap target
```

## 7. Technical Requirements

### Components
| Component | File | Description |
|-----------|------|-------------|
| OnboardingPage | `app/(frontend)/onboarding/page.tsx` | Page component |
| OnboardingOptions | `components/frontend/OnboardingOptions.tsx` | 2 option cards |

### Logic
- Check if user has sites → redirect to /dashboard
- Use Payload auth to get firstName for greeting
- No API calls needed (just routing)

## 8. 9-Point Done Checklist

- [ ] Loading State — N/A (static page)
- [ ] Empty State — N/A (always shows options)
- [ ] Error State — Toast if site count fetch fails
- [ ] Form Validation — N/A
- [ ] Button States — Hover + active states on cards
- [ ] Toast Feedback — N/A
- [ ] Auth Redirect — Must be authenticated (redirect to /login if not)
- [ ] Mobile 375px — Cards stack, 44px tap targets
- [ ] TypeScript Clean — tsc --noEmit pass
