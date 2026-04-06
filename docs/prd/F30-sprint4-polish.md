# PRD: Template System v2 — Sprint 4: UX Polish & Ship

**Feature ID:** F-TMPL-V2-S4
**Version:** 1.0
**Author:** Claude AI (PM)
**Date:** 2026-04-06
**Status:** Draft
**Priority:** P0 — Ship blocker
**Effort:** ~5 developer days (3 phases)
**Depends on:** F-TMPL-V2-S2 (Block Variants), F-TMPL-V2-S3 (Template Expansion)
**Plan:** [`plans/260405-master-template-system-v2/plan.md`](../../plans/260405-master-template-system-v2/plan.md)

---

## 1. Problem Statement

### Ai bi anh huong?
End users (Malaysia SMBs) dang bi frustrated boi 3 van de UX:

1. **Generation timeout vo han:** SSE stream chay >60s khong co timeout/cancel. User bi "stuck" tren generation screen, khong biet nen doi hay reload.
2. **Error messages khong ro rang:** Khi hit free tier limit (402), rate limit (429), hoac content unsafe (400), user chi thay generic "Generation failed" — khong biet nguyen nhan va cach xu ly.
3. **Template picker thieu UX:** Modal hien tai co search + category filter nhung thieu live preview on hover, search performance chua optimize, va mobile UX chua tot.

### Impact
- Generation abandon rate: ~25% user reload page khi generation >30s
- Support tickets: ~15% lien quan den "toi khong hieu loi gi"
- Template selection time: avg 45s (target: <20s voi better UX)

### Root Causes (tu codebase analysis)

**1. Khong co AbortController cho SSE stream:**
```typescript
// AIBuilderPageClient.tsx — hien tai
const startSSEGeneration = useCallback(async (info, ...) => {
    const response = await fetch('/api/ai/generate-site?stream=true', { ... })
    const reader = response.body?.getReader()
    // Khong co AbortController
    // Khong co timeout
    // User khong co cach cancel
    while (true) {
        const { done, value } = await reader.read()  // Block vinh vien neu server hang
        if (done) break
    }
})
```

**2. Error parsing mat context:**
```typescript
// AIBuilderPageClient.tsx:28-51
function getGenerationErrorMessage(errorData: unknown) {
    // Chi extract string message — mat error code
    // Khong map 402 → "Free tier limit reached"
    // Khong map 429 → "Rate limit, try again in X seconds"
    return 'Generation failed'  // Fallback generic
}
```

**3. BuilderGenerationView khong co cancel UI:**
```typescript
// BuilderGenerationView.tsx — chi co progress bar + spinner
// Khong co: timeout warning, cancel button, estimated time
```

**4. Template picker thieu hover preview:**
```typescript
// TemplateCard.tsx — iframe load moi template (expensive)
// Hover chi show overlay buttons — khong co enlarged preview
// EditorTemplateModal.tsx — search la client-side filter (OK cho 50, nhung khong debounce)
```

---

## 2. Goals & Success Metrics

| Goal | Metric | Current | Target | Do bang |
|------|--------|---------|--------|---------|
| Reduce generation abandonment | Users who reload during generation | ~25% | <5% | Analytics |
| Clear error communication | Users understanding error cause | ~40% | >90% | Support tickets |
| Faster template selection | Time from open picker to select | ~45s | <20s | Analytics |
| Mobile template QA pass | Templates passing 390px test | Unknown | 50/50 | QA checklist |
| i18n error coverage | Error messages with EN + MS | ~30% | 100% | Code audit |

---

## 3. Solution Overview

3 phases trong 5 ngay:

**Phase 4.1 (2 days):** P1 UX bugs
- Add AbortController + 60s timeout cho SSE generation
- Hien thi "Taking too long?" warning sau 30s + Cancel button
- Map error codes (402, 429, 400, 500) sang user-friendly messages (EN + MS)
- Retry with exponential backoff cho transient errors

**Phase 4.2 (1 day):** Template picker redesign
- Debounced search (300ms) voi category filter
- Hover preview: enlarged thumbnail + template info tooltip
- Mobile-optimized grid (1 col) + swipe gestures
- Keyboard navigation (arrow keys, Enter to select)

**Phase 4.3 (2 days):** QA all 50 templates + final fixes + ship
- Automated viewport tests cho 50 templates (390px + 1280px)
- Visual regression baseline
- Fix any horizontal scroll / overflow issues
- Final sign-off checklist

---

## 4. Target Users

| User | Technical Level | Language | Primary Goal |
|------|----------------|----------|-------------|
| Malaysia SMB owner | Non-technical | EN / MS | Create website quickly, understand errors |
| Return user (free tier) | Non-technical | EN / MS | Understand why they can't generate more |
| QA engineer | Technical | EN | Verify all 50 templates render correctly |

---

## 5. User Stories

### US-S4-01: User generating website (timeout + cancel)
**As** a business owner creating my website,
**I want** to see progress feedback and be able to cancel if generation takes too long,
**So that** I don't feel stuck and can retry or adjust my input.

### US-S4-02: User understanding errors
**As** a user who hit an error during generation,
**I want** to see a clear message explaining what went wrong and what I can do,
**So that** I can fix the issue myself without contacting support.

### US-S4-03: User browsing templates
**As** a user looking for a template for my restaurant,
**I want** to quickly search, filter by category, and preview templates before applying,
**So that** I can find the right design without trial-and-error.

### US-S4-04: QA engineer verifying templates
**As** a QA engineer,
**I want** to verify all 50 templates render correctly on mobile and desktop,
**So that** we can ship with confidence that no template is broken.

---

## 6. Functional Requirements

### Phase 4.1: Generation Timeout + Error Messages

| FR-ID | Requirement | Story Ref | Priority |
|-------|-------------|-----------|----------|
| FR-01 | Add AbortController to SSE fetch. Expose `cancelGeneration()` from builder store. When called: abort stream, set status to `'idle'`, return to form step. | US-S4-01 | P0 |
| FR-02 | Add 60s hard timeout. After 60s without `done` event, auto-abort + show timeout error. Show "Taking too long?" warning at 30s with Cancel button. | US-S4-01 | P0 |
| FR-03 | Map HTTP error codes to user-friendly messages (see Error Code Mapping table below). Support EN + MS via i18n. | US-S4-02 | P0 |
| FR-04 | For retryable errors (429, 500, 503), show "Retry" button with countdown timer based on `Retry-After` header or default 30s. | US-S4-02 | P1 |
| FR-05 | Show elapsed time counter on generation screen: "Generating... (12s)". Update every second. | US-S4-01 | P1 |
| FR-06 | Add `generation_cancelled` and `generation_timeout` analytics events. | US-S4-01 | P2 |

### Phase 4.2: Template Picker Redesign

| FR-ID | Requirement | Story Ref | Priority |
|-------|-------------|-----------|----------|
| FR-07 | Add debounced search input (300ms delay). Search matches template `name`, `description`, and `category` fields. | US-S4-03 | P0 |
| FR-08 | On template card hover (desktop): show enlarged preview tooltip (400x300 iframe) positioned to the right/left of card. On mobile: tap card to expand inline preview. | US-S4-03 | P1 |
| FR-09 | Add keyboard navigation: Tab through cards, Enter to select, Escape to close modal. Arrow keys to navigate grid. | US-S4-03 | P2 |
| FR-10 | Mobile layout: single column grid, larger touch targets (min 44px), swipeable category pills. | US-S4-03 | P1 |

### Phase 4.3: QA & Ship

| FR-ID | Requirement | Story Ref | Priority |
|-------|-------------|-----------|----------|
| FR-11 | Create automated test: render each of 50 templates at 390px width, assert no horizontal scrollbar (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`). | US-S4-04 | P0 |
| FR-12 | Create automated test: render each of 50 templates at 1280px width, assert all blocks visible and no layout overflow. | US-S4-04 | P0 |

---

## 7. Error Code Mapping Table

| HTTP Status | Error Code | EN Message | MS Message | Action Button |
|-------------|-----------|------------|------------|---------------|
| 402 | `PAYMENT_REQUIRED` | "You've used your free AI generation. Upgrade to Pro for unlimited creations." | "Anda telah menggunakan penjanaan AI percuma anda. Naik taraf ke Pro untuk penciptaan tanpa had." | "Upgrade to Pro" |
| 429 | `RATE_LIMIT` | "Too many requests. Please wait {seconds}s before trying again." | "Terlalu banyak permintaan. Sila tunggu {seconds}s sebelum mencuba lagi." | "Retry in {seconds}s" (countdown) |
| 400 | `CONTENT_UNSAFE` | "Your business description contains content that is not allowed. Please revise and try again." | "Penerangan perniagaan anda mengandungi kandungan yang tidak dibenarkan. Sila semak semula dan cuba lagi." | "Edit Info" |
| 400 | `VALIDATION_ERROR` | "Please check your business information: {fieldError}" | "Sila semak maklumat perniagaan anda: {fieldError}" | "Edit Info" |
| 401 | `UNAUTHORIZED` | "Your session has expired. Please sign in again." | "Sesi anda telah tamat. Sila log masuk semula." | "Sign In" |
| 408 | `TIMEOUT` | "Generation is taking too long. Please try again — sometimes a simpler description helps." | "Penjanaan mengambil masa terlalu lama. Sila cuba lagi — kadangkala penerangan yang lebih ringkas membantu." | "Try Again" |
| 500 | `SERVER_ERROR` | "Something went wrong on our end. Our team has been notified. Please try again." | "Sesuatu tidak kena di pihak kami. Pasukan kami telah dimaklumkan. Sila cuba lagi." | "Try Again" |
| 503 | `SERVICE_UNAVAILABLE` | "AI service is temporarily busy. Please try again in a moment." | "Perkhidmatan AI sibuk buat sementara waktu. Sila cuba lagi seketika." | "Retry in 30s" |
| — | `SSE_DISCONNECT` | "Connection lost during generation. Your progress may be saved — check your dashboard." | "Sambungan terputus semasa penjanaan. Kemajuan anda mungkin telah disimpan — semak papan pemuka anda." | "Go to Dashboard" / "Try Again" |

---

## 8. Template Picker UI Wireframe (ASCII)

### Desktop Layout (>= 1024px)
```
+------------------------------------------------------------------+
|  Choose a Template                                          [X]   |
+------------------------------------------------------------------+
|  [🔍 Search templates...        ]                                 |
|  [All] [Restaurant] [Beauty] [Tech] [Health] [Education] [+3]    |
+------------------------------------------------------------------+
|                                                                    |
|  +----------------+  +----------------+  +----------------+       |
|  |  ┌──────────┐  |  |  ┌──────────┐  |  |  ┌──────────┐  |      |
|  |  │ iframe   │  |  |  │ iframe   │  |  |  │ iframe   │  |      |
|  |  │ preview  │  |  |  │ preview  │  |  |  │ preview  │  |      |
|  |  │ 1200x800 │  |  |  │ 1200x800 │  |  |  │ 1200x800 │  |      |
|  |  │ scale0.3 │  |  |  │ scale0.3 │  |  |  │ scale0.3 │  |      |
|  |  └──────────┘  |  |  └──────────┘  |  |  └──────────┘  |      |
|  |  Template Name  |  |  Template Name  |  |  Template Name |      |
|  |  Description... |  |  Description... |  |  Description...|      |
|  |  [cat1] [cat2]  |  |  [cat1]         |  |  [cat1] [cat2] |     |
|  +----------------+  +----------------+  +----------------+       |
|                                                                    |
|  +----------------+  +----------------+  +----------------+       |
|  |     ...        |  |     ...        |  |     ...        |       |
|  +----------------+  +----------------+  +----------------+       |
|                                                                    |
+------------------------------------------------------------------+

HOVER STATE (card hovered):
+----------------+     +---------------------------+
|  ┌──────────┐  |     |  ┌─────────────────────┐  |
|  │ HOVERED  │  | --> |  │   Enlarged Preview   │  |
|  │  card     │  |     |  │   400 x 300 iframe   │  |
|  └──────────┘  |     |  │   (interactive)       │  |
|  Template Name  |     |  └─────────────────────┘  |
|  [Preview][Use] |     |  "Starter Resto"           |
+----------------+     |  Restaurant + Beauty        |
                        |  [👁 Preview] [✨ Use]      |
                        +---------------------------+
```

### Mobile Layout (< 1024px)
```
+--------------------------------+
| Choose a Template         [X]  |
+--------------------------------+
| [🔍 Search templates...      ] |
| ◀ [All] [Restaurant] [Beauty] ▶|
|   (horizontally scrollable)    |
+--------------------------------+
|                                |
| +----------------------------+ |
| | ┌────────────────────────┐ | |
| | │   iframe preview       │ | |
| | │   full width, h-48     │ | |
| | └────────────────────────┘ | |
| | Template Name              | |
| | Description text...        | |
| | [cat1] [cat2]              | |
| | [👁 Preview]  [✨ Use]     | |
| +----------------------------+ |
|                                |
| +----------------------------+ |
| |         ...                | |
| +----------------------------+ |
+--------------------------------+
```

### Generation Screen with Timeout Warning
```
+------------------------------------------------------------------+
|                                                                    |
|     🚀 Creating your website...                                   |
|                                                                    |
|     +------------------------------------------+                  |
|     |  ┌──────────────────────────────────┐    |                  |
|     |  │         [Spinner Icon]           │    |                  |
|     |  │    Creating Your Website...      │    |                  |
|     |  │                                  │    |                  |
|     |  │  ✅ Analyzing your business      │    |                  |
|     |  │  ⏳ Generating content & design  │    |                  |
|     |  │  3. Preparing your preview       │    |                  |
|     |  │                                  │    |                  |
|     |  │  Progress: ████████░░  72%       │    |                  |
|     |  │                                  │    |                  |
|     |  │  ⏱ Elapsed: 34s                 │    |   <-- new
|     |  │                                  │    |                  |
|     |  │  ⚠️ Taking too long?             │    |   <-- shows at 30s
|     |  │  [Cancel Generation]             │    |   <-- new
|     |  └──────────────────────────────────┘    |                  |
|     +------------------------------------------+                  |
|                                                                    |
+------------------------------------------------------------------+
```

---

## 9. Acceptance Criteria

### Generation Timeout & Cancel (US-S4-01)

| AC-ID | Scenario | Given | When | Then |
|-------|----------|-------|------|------|
| AC-01 | Timeout warning | Generation running >30s | 30s elapsed without `done` event | Show "Taking too long?" text + "Cancel Generation" button below progress bar |
| AC-02 | Cancel generation | Cancel button clicked | SSE stream is active | Abort stream via AbortController, set status to `idle`, return user to BusinessInfoForm with previous values preserved |
| AC-03 | Hard timeout | Generation running >60s | 60s elapsed without `done` event | Auto-abort stream, show timeout error message (AC-05), return to form |
| AC-04 | Elapsed timer | Generation starts | Every second while streaming | Display "Elapsed: {N}s" counter on generation screen, updating every 1s |

### Error Messages (US-S4-02)

| AC-ID | Scenario | Given | When | Then |
|-------|----------|-------|------|------|
| AC-05 | Free tier limit (402) | User on free plan, already used 1 generation | POST /api/ai/generate-site returns 402 | Show "You've used your free AI generation. Upgrade to Pro for unlimited creations." with "Upgrade to Pro" button |
| AC-06 | Rate limit (429) | User spamming generate button | POST returns 429 with Retry-After header | Show "Too many requests. Please wait {N}s" with countdown timer button |
| AC-07 | Content unsafe (400) | User entered inappropriate content | POST returns 400 CONTENT_UNSAFE | Show "Your business description contains content that is not allowed" with "Edit Info" button |
| AC-08 | SSE disconnect | Network drops during generation | ReadableStream throws error | Show "Connection lost during generation" with "Go to Dashboard" and "Try Again" buttons |
| AC-09 | i18n error messages | User locale is MS | Any error occurs | Error message displays in Bahasa Malaysia, matching the Error Code Mapping table |

### Template Picker (US-S4-03)

| AC-ID | Scenario | Given | When | Then |
|-------|----------|-------|------|------|
| AC-10 | Category search | Template picker open | User types "restaurant" in search | Templates filtered within 300ms, showing only templates matching "restaurant" in name, description, or category |
| AC-11 | Hover preview | Template card visible (desktop) | User hovers on card for 500ms | Show enlarged preview tooltip (400x300 iframe) adjacent to card, dismiss on mouse leave |
| AC-12 | Mobile single column | Template picker open on 390px viewport | Grid renders | Single column layout, category pills horizontally scrollable, each card full-width with visible action buttons (no hover required) |

### QA Templates (US-S4-04)

| AC-ID | Scenario | Given | When | Then |
|-------|----------|-------|------|------|
| AC-13 | Mobile no-scroll | All 50 templates rendered at 390px width | Check scrollWidth vs clientWidth | No horizontal scroll on any template (`scrollWidth <= clientWidth`) |
| AC-14 | Desktop layout | All 50 templates rendered at 1280px width | Visual inspection | All blocks visible, no overlapping elements, no text truncation on headings |

---

## 10. Non-Functional Requirements

| NFR-ID | Category | Requirement | Measurement |
|--------|----------|-------------|-------------|
| NFR-01 | Performance | Generation timeout: hard limit at 60s, warning at 30s. AbortController cleanup must not leak memory. | Manual test: abort 10x in a row, check memory via DevTools |
| NFR-02 | Performance | Template picker search must filter 50 templates in <50ms (debounce 300ms). No visible jank during typing. | Performance profiler: measure filter execution time |
| NFR-03 | Performance | Hover preview iframe must start loading within 200ms of hover. Use `loading="lazy"` + preconnect for template preview API. | Network tab: measure time-to-first-byte |
| NFR-04 | Accessibility | All error messages must be announced by screen readers (use `role="alert"` or `aria-live="assertive"`). Cancel button must be keyboard-focusable. | axe-core audit: 0 violations on error states |
| NFR-05 | i18n | All user-facing error messages and generation UI text must be available in EN and MS. Fallback to EN if locale key missing. | i18n key audit: grep for hardcoded strings |
| NFR-06 | Reliability | SSE disconnect must be detected within 5s (use heartbeat or stream error handler). No zombie connections after cancel. | Network tab: verify connection closed after abort |
| NFR-07 | Mobile | All 50 templates must render without horizontal scroll at 390px width (iPhone SE). Touch targets minimum 44x44px per WCAG 2.1. | Playwright viewport test + axe tap-target audit |

---

## 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| AbortController not supported in older browsers | Cancel button silently fails | Low | Feature-detect `AbortController`; fallback: hide cancel button, rely on hard timeout only |
| Hover preview (50 iframes) causes memory pressure | Page freezes when scrolling template grid | Medium | Only load iframe on hover (not on mount). Destroy iframe on mouse leave. Max 1 preview iframe at a time. |
| Some templates have CSS that causes horizontal scroll only on specific content lengths | QA passes with seed data but fails with real user content | Medium | Test with varied content lengths (short, medium, long text). Add `overflow-x: hidden` as safety net on template wrapper. |
| 60s timeout too aggressive for complex multi-page sites | Users with 5+ page sites always hit timeout | Medium | Start with 60s. Track timeout rate via analytics. If >10% timeout, increase to 90s in next sprint. Log server-side generation duration. |
| MS translations may have incorrect grammar | Malaysian users see awkward text | Low | Have native MS speaker review all strings before ship. Keep translations in separate PR for easy review. |

---

## 12. i18n Requirements

### New i18n Keys (add to `src/i18n/locales/en.json` and `ms.json`)

```jsonc
{
  "onboarding": {
    "generating": {
      // Existing keys (keep)
      // ...

      // New keys for Sprint 4
      "elapsed": "Elapsed: {seconds}s",
      "takingTooLong": "Taking too long?",
      "cancelGeneration": "Cancel Generation",
      "cancelConfirm": "Are you sure? Your generation will be lost.",
      "cancelYes": "Yes, Cancel",
      "cancelNo": "Keep Waiting"
    },
    "errors": {
      // New error message keys
      "paymentRequired": "You've used your free AI generation. Upgrade to Pro for unlimited creations.",
      "rateLimited": "Too many requests. Please wait {seconds}s before trying again.",
      "contentUnsafe": "Your business description contains content that is not allowed. Please revise and try again.",
      "validationError": "Please check your business information: {detail}",
      "sessionExpired": "Your session has expired. Please sign in again.",
      "generationTimeout": "Generation is taking too long. Please try again — sometimes a simpler description helps.",
      "serverError": "Something went wrong on our end. Our team has been notified. Please try again.",
      "serviceUnavailable": "AI service is temporarily busy. Please try again in a moment.",
      "connectionLost": "Connection lost during generation. Your progress may be saved — check your dashboard.",

      // Action buttons
      "upgradeToPro": "Upgrade to Pro",
      "retryIn": "Retry in {seconds}s",
      "editInfo": "Edit Info",
      "signIn": "Sign In",
      "tryAgain": "Try Again",
      "goToDashboard": "Go to Dashboard"
    }
  },
  "gallery": {
    // New keys for template picker
    "searchPlaceholder": "Search templates...",
    "noResults": "No templates match \"{query}\"",
    "clearSearch": "Clear search",
    "categoryAll": "All",
    "showingCount": "Showing {count} of {total} templates",
    "hoverToPreview": "Hover to preview"
  }
}
```

---

## 13. QA Checklist for 50 Templates

### Pre-QA Setup
- [ ] Seed all 50 templates: `POST /api/templates/seed`
- [ ] Verify template count: `GET /api/templates/list?limit=50` returns 50 docs
- [ ] Prepare test viewports: 390px (iPhone SE), 768px (iPad), 1280px (Desktop), 1920px (Full HD)

### Per-Template Checks (repeat for each of 50 templates)

| Check | 390px | 768px | 1280px | 1920px |
|-------|-------|-------|--------|--------|
| No horizontal scrollbar | [ ] | [ ] | [ ] | [ ] |
| All text readable (no truncation on headings) | [ ] | [ ] | [ ] | [ ] |
| Images load (no broken img) | [ ] | [ ] | [ ] | [ ] |
| Buttons/links are tappable (44px min) | [ ] | N/A | N/A | N/A |
| Navigation menu renders correctly | [ ] | [ ] | [ ] | [ ] |
| Footer visible at bottom | [ ] | [ ] | [ ] | [ ] |
| Color theme applies (not default blue) | [ ] | [ ] | [ ] | [ ] |
| Font pairing loads (Google Fonts) | [ ] | [ ] | [ ] | [ ] |
| Dark/light mode correct per theme | [ ] | [ ] | [ ] | [ ] |

### Cross-Template Checks
- [ ] Template picker search: type each category name, verify correct filtering
- [ ] Template picker: apply 3 different templates to same site, verify clean switch
- [ ] Preview modal: open preview for 10 random templates, verify iframe loads
- [ ] Performance: open template picker, scroll through all 50, no visible jank (60fps)

### Regression Checks
- [ ] AI generation still works end-to-end (form -> generate -> preview -> publish)
- [ ] Cancel generation mid-stream, verify form state preserved
- [ ] Hit free tier limit, verify upgrade message shows
- [ ] SSE disconnect (throttle network to offline mid-generation), verify error message
- [ ] Auto-save still works after generation completes
- [ ] Editor template modal still works (apply template from editor)

---

## 14. Technical Implementation Notes

### Phase 4.1: AbortController Pattern

```typescript
// AIBuilderPageClient.tsx — proposed change
const abortControllerRef = useRef<AbortController | null>(null)

const startSSEGeneration = useCallback(async (info, ...) => {
    // Cancel any existing generation
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Hard timeout at 60s
    const timeoutId = setTimeout(() => controller.abort('timeout'), 60_000)

    try {
        const response = await fetch('/api/ai/generate-site?stream=true', {
            signal: controller.signal,
            // ...existing config
        })
        // ...existing SSE handling
    } catch (error) {
        if (error?.name === 'AbortError') {
            // Distinguish cancel vs timeout
            const isTimeout = controller.signal.reason === 'timeout'
            // Handle accordingly
        }
    } finally {
        clearTimeout(timeoutId)
        abortControllerRef.current = null
    }
}, [])

const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort('user_cancel')
}, [])
```

### Phase 4.1: Error Code Parser

```typescript
// New: src/lib/utils/generation-errors.ts
interface GenerationError {
    code: string
    httpStatus: number
    messageKey: string  // i18n key
    action: 'upgrade' | 'retry' | 'edit' | 'signin' | 'dashboard'
    retryAfterSeconds?: number
}

function parseGenerationError(response: Response, body: unknown): GenerationError {
    const status = response.status
    const code = (body as any)?.code || 'UNKNOWN'
    const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10)

    const ERROR_MAP: Record<number, Partial<GenerationError>> = {
        402: { code: 'PAYMENT_REQUIRED', messageKey: 'errors.paymentRequired', action: 'upgrade' },
        429: { code: 'RATE_LIMIT', messageKey: 'errors.rateLimited', action: 'retry', retryAfterSeconds: retryAfter },
        400: { code, messageKey: code === 'CONTENT_UNSAFE' ? 'errors.contentUnsafe' : 'errors.validationError', action: 'edit' },
        401: { code: 'UNAUTHORIZED', messageKey: 'errors.sessionExpired', action: 'signin' },
        500: { code: 'SERVER_ERROR', messageKey: 'errors.serverError', action: 'retry' },
        503: { code: 'SERVICE_UNAVAILABLE', messageKey: 'errors.serviceUnavailable', action: 'retry', retryAfterSeconds: 30 },
    }

    return { httpStatus: status, ...ERROR_MAP[status] } as GenerationError
}
```

### Phase 4.2: Hover Preview Strategy

- Only 1 preview iframe exists at a time (singleton pattern)
- On hover: create iframe positioned via `getBoundingClientRect()` + portal
- On mouse leave: remove iframe after 300ms delay (prevents flicker when moving between cards)
- On mobile: no hover — tap card to expand inline with full-width preview
- Iframe src: `/api/templates/preview?id={templateId}` (existing endpoint)

---

## 15. Files to Modify

| File | Changes |
|------|---------|
| `src/app/(builder)/builder/new/AIBuilderPageClient.tsx` | Add AbortController, timeout logic, cancel handler, error code parsing |
| `src/components/builder/BuilderGenerationView.tsx` | Add elapsed timer, "Taking too long?" warning, Cancel button |
| `src/components/editor/EditorTemplateModal.tsx` | Debounced search, hover preview, mobile layout, keyboard nav |
| `src/components/frontend/TemplateCard.tsx` | Hover preview trigger, mobile tap-to-expand |
| `src/i18n/locales/en.json` | Add all new i18n keys (errors, generation, gallery) |
| `src/i18n/locales/ms.json` | Add all new i18n keys (MS translations) |
| `src/lib/utils/generation-errors.ts` | **NEW** — error code parser + mapping |
| `src/store/builderStore.ts` | Add `cancelGeneration` action |
| `src/__tests__/` | New test files for timeout, error parsing, template QA |

---

## 16. Out of Scope

- Payment/upgrade flow (just link to pricing page)
- Template creation/editing admin UI
- A/B testing different error messages
- Server-side generation timeout (handled separately in API)
- Template analytics (which templates are most popular)

---

## 17. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should cancel generation also delete the partially-created site from DB? | Dev | Open |
| 2 | What is the actual P95 generation time? (need data to calibrate 30s/60s thresholds) | Dev | Open |
| 3 | Do we need a "generation queued" state for when AI service is under heavy load? | PM | Open |
| 4 | Should hover preview be interactive (scrollable) or static screenshot? | PM | Decided: interactive iframe |
