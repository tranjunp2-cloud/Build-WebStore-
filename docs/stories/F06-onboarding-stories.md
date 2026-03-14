# User Stories: Onboarding Flow (F06)

> **Feature:** F06 — Onboarding Flow  
> **PRD:** [F06-onboarding.md](../prd/F06-onboarding.md)  
> **Source:** Adapted from ECH Webstore v2 PRD (US-001→US-003)

---

## US-001 — User Registration & Auto-Login

**As a** new user  
**I want to** register with my email and password and be automatically logged in after email verification  
**So that** I can start building my store without additional friction

### Acceptance Criteria

**AC-1: Registration + Verification**
```gherkin
GIVEN I am on the registration page and submit a valid email + password (min 8 chars)
WHEN  I click "Create Account"
THEN  I receive a verification email within 60 seconds
  AND the page shows "Check your email" state
```

**AC-2: Auto-Login after Verification**
```gherkin
GIVEN I click the verification link in the email
WHEN  the token is valid and not expired (< 24h)
THEN  I am automatically logged in
  AND redirected to /onboarding (Welcome screen)
```

**AC-3: Duplicate Email Error**
```gherkin
GIVEN I try to register with an already-registered email
WHEN  I submit the form
THEN  I see an inline error "This email is already registered. Log in instead?"
  AND a link to /login — NOT a generic error
```

> **Tech note:** Auth handled by Payload CMS built-in auth. Email via Resend.

---

## US-002 — Welcome Screen — Zero Friction to AI Builder

**As a** newly registered user  
**I want to** see a brief welcoming screen that immediately guides me to the AI Builder  
**So that** I don't get lost or confused about what to do first

### Acceptance Criteria (Checklist)

- [ ] Welcome screen has a single primary CTA: "Buat Webstore Saya / Create My Store" — no other competing actions
- [ ] Screen explains the 5-minute promise in 1–2 sentences maximum — no walls of text
- [ ] Progress indicator shows "Step 1 of 2: Create Store" to set expectations
- [ ] CTA click navigates to /builder/new within 300ms — no loading screen
- [ ] Screen is skippable — "Set up later" link available, goes to /dashboard
- [ ] Mobile-responsive: CTA button full-width below 480px viewport

---

## US-003 — Basic Store Setup (Slug + Delivery Defaults)

**As a** new store owner  
**I want to** set my store URL slug and basic delivery defaults early in onboarding  
**So that** my store has a proper URL and can accept orders from day one

### Acceptance Criteria

**AC-1: Slug Availability Check**
```gherkin
GIVEN I enter a store slug (e.g., "kedai-baju-mira")
WHEN  I type each character
THEN  live availability check runs (300ms debounce)
  AND shows green ✓ "Available" or red ✗ "Taken, try kedai-baju-mira-2"
```

**AC-2: Store Creation**
```gherkin
GIVEN I submit the setup form
WHEN  all required fields are valid
THEN  Store record is created in Payload CMS with status: DRAFT
  AND I am redirected to /builder/new with store context loaded
```

### Additional Criteria

- [ ] Slug must be lowercase, alphanumeric + hyphens only — auto-sanitize on input
- [ ] Default delivery fee pre-filled as RM 8 — user can change
- [ ] State selection (Selangor, KL, Penang, etc.) auto-populates delivery zone rules
- [ ] All fields except store name are optional with sensible defaults — do not block progress
