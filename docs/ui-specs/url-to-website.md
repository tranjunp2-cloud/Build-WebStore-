# UI Design Specs: URL-to-Website AI Redesign

**Feature:** F-URL-IMPORT
**PRD:** `docs/prd/url-to-website.md`
**Date:** 2026-04-05
**Design System:** Modern Dark (Cinema) — existing ECH Prime builder theme

---

## 1. Screen List

| # | Screen | Route | Description | US Ref |
|---|--------|-------|-------------|--------|
| 1 | Builder Step 1 — Manual Mode | `/builder/new` | Existing BusinessInfoForm (unchanged) | US-04 |
| 2 | Builder Step 1 — URL Mode | `/builder/new` | URL input + Extract button | US-01 |
| 3 | URL Extraction Loading | `/builder/new` | Loading state during scrape + AI extraction | US-01 |
| 4 | Auto-filled Form + Confidence | `/builder/new` | Form pre-filled from extraction, confidence badge | US-02 |
| 5 | Extraction Error State | `/builder/new` | Error message + manual fallback link | US-03 |
| 6 | Low Confidence Warning | `/builder/new` | Warning banner + partially filled form | US-02, US-03 |

**Note:** All screens are within the same route (`/builder/new`) using the existing `BuilderStepScreen` layout. No new routes needed.

---

## 2. Screen Flows

```
                    ┌──────────────────┐
                    │  /builder/new    │
                    │  Default: Manual │
                    └────────┬─────────┘
                             │
                ┌────────────┼────────────┐
                ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │  MANUAL MODE     │      │  URL MODE        │
    │  (Screen 1)      │      │  (Screen 2)      │
    │  [existing form] │      │  [URL input]     │
    └────────┬─────────┘      └────────┬─────────┘
             │                         │ Click "Extract"
             │                         ▼
             │                ┌──────────────────┐
             │                │  LOADING STATE   │
             │                │  (Screen 3)      │
             │                │  [skeleton/spin] │
             │                └────────┬─────────┘
             │                    ┌────┴────┐
             │                    ▼         ▼
             │          ┌─────────────┐  ┌──────────────┐
             │          │ SUCCESS     │  │ ERROR        │
             │          │ (Screen 4)  │  │ (Screen 5)   │
             │          │ [auto-fill] │  │ [error msg]  │
             │          └──────┬──────┘  └──────┬───────┘
             │                 │                │ Click "Try manual"
             │                 │                ▼
             │                 │        ┌──────────────┐
             │                 │        │ MANUAL MODE  │
             │                 │        │ (Screen 1)   │
             │                 │        └──────┬───────┘
             │                 │               │
             ├─────────────────┴───────────────┘
             ▼
    ┌──────────────────┐
    │  Click "Generate"│
    │  → Existing flow │
    │  (SSE streaming) │
    └──────────────────┘
```

---

## 3. Component Specs

### 3.1 InputModeToggle (NEW)

```
┌──────────────────────────────────────────────┐
│  [ ✏️ Describe Business ] [ 🔗 Import URL ]  │
└──────────────────────────────────────────────┘
```

- **Type:** Tab / Toggle Group
- **Location:** Top of form area, below `BuilderStepHeader`, above form fields
- **Props:**
  ```typescript
  {
    mode: 'manual' | 'url'
    onChange: (mode: 'manual' | 'url') => void
    disabled?: boolean // disable during extraction
  }
  ```
- **States:**
  | State | Visual |
  |-------|--------|
  | Manual active | Left tab: solid bg `rgba(59,130,246,0.15)`, blue text, border-bottom accent |
  | URL active | Right tab: solid bg `rgba(59,130,246,0.15)`, blue text, border-bottom accent |
  | Inactive tab | Transparent bg, `#94a3b8` text |
  | Disabled | Both tabs opacity 0.5, cursor-not-allowed |
- **Children:** None (self-contained)
- **Data:** Local state in BusinessInfoForm
- **Reuse:** Build with existing Tailwind classes, similar to shadcn Tabs but custom dark theme styling
- **Accessibility:**
  - `role="tablist"` on container
  - `role="tab"` + `aria-selected` on each tab
  - `aria-controls` pointing to respective panel
  - Arrow key navigation between tabs
  - Focus ring: `ring-2 ring-blue-500/50 ring-offset-2 ring-offset-[#0b1120]`

**Design tokens:**
```css
/* Active tab */
background: rgba(59, 130, 246, 0.15);
color: #60a5fa; /* blue-400 */
border-bottom: 2px solid #3b82f6;
font-weight: 600;

/* Inactive tab */
background: transparent;
color: #94a3b8; /* slate-400 */
border-bottom: 2px solid transparent;

/* Hover (inactive) */
background: rgba(255, 255, 255, 0.05);
color: #cbd5e1; /* slate-300 */

/* Container */
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
gap: 0;
height: 44px;
```

---

### 3.2 UrlExtractInput (NEW)

```
┌──────────────────────────────────────────────┐
│ 🔗 Website URL                               │
│ ┌────────────────────────────┐ ┌───────────┐ │
│ │ https://your-website.com   │ │ Extract → │ │
│ └────────────────────────────┘ └───────────┘ │
│ Paste your existing website URL              │
└──────────────────────────────────────────────┘
```

- **Type:** Form Field + Action Button
- **Props:**
  ```typescript
  {
    url: string
    onChange: (url: string) => void
    onExtract: () => void
    loading: boolean
    error?: string
    disabled?: boolean
  }
  ```
- **States:**
  | State | Visual |
  |-------|--------|
  | Default | Empty input, Extract button disabled (gray) |
  | Valid URL typed | Input normal, Extract button enabled (gradient) |
  | Invalid URL typed | Input red border, error text below |
  | Loading/Extracting | Input disabled, button shows spinner + "Extracting..." |
  | Error | Input normal, error banner below |
- **Children:** `BuilderField` (wrapper), `BuilderTextInput` (input), Extract button
- **Data:** `POST /api/ai/extract-from-url`
- **Reuse:** Extend `BuilderField` + `BuilderTextInput` pattern, new Extract button
- **Layout:** Input takes `flex-1`, button fixed width ~120px, horizontal flex on all breakpoints

**Input styling (matches existing):**
```css
/* Input — same as BuilderTextInput */
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 12px;
color: white;
height: 44px;
padding: 0 16px;
font-size: 14px;

/* Input focus */
border-color: #3b82f6;
box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);

/* Input error */
border-color: #f87171;

/* Input disabled (during loading) */
opacity: 0.5;
cursor: not-allowed;
```

**Extract button:**
```css
/* Enabled */
background: linear-gradient(90deg, #3b82f6, #2dd4bf);
color: white;
font-weight: 600;
font-size: 14px;
height: 44px;
padding: 0 20px;
border-radius: 12px;
min-width: 120px;
cursor: pointer;
transition: all 200ms ease;

/* Hover */
filter: brightness(1.1);

/* Disabled (no URL) */
opacity: 0.5;
cursor: not-allowed;

/* Loading */
/* Same as BuilderSubmitButton loading pattern */
```

---

### 3.3 ExtractionLoadingState (NEW)

```
┌──────────────────────────────────────────────┐
│ 🔗 Website URL                               │
│ ┌────────────────────────────┐ ┌───────────┐ │
│ │ https://kedai-kopi.com  ░░ │ │ ⟳ ...     │ │
│ └────────────────────────────┘ └───────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ⟳ Analyzing website...               │  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░           │  │
│  │  Extracting business information...   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ░░░░░░░░░░ (skeleton line)           │  │
│  │  ░░░░░░░░░░░░░░░ (skeleton line)      │  │
│  │  ░░░░░░░░ (skeleton line)             │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

- **Type:** Loading overlay / inline state
- **Props:**
  ```typescript
  {
    url: string
    step: 'scraping' | 'analyzing' | 'extracting'
  }
  ```
- **States:** Single loading state with animated progress
- **Children:** Progress text, skeleton placeholders for form fields
- **Reuse:** shadcn `Skeleton` component for field placeholders
- **Animation:**
  - Spinner: `animate-spin` (existing pattern from BuilderSubmitButton)
  - Skeleton: `animate-pulse` (shadcn default)
  - Step text: fade transition between steps (150ms)
  - Duration: respect `prefers-reduced-motion`

**Progress text (i18n):**
```typescript
const EXTRACTION_STEPS = {
  en: {
    scraping: 'Accessing website...',
    analyzing: 'Analyzing content...',
    extracting: 'Extracting business info...',
  },
  ms: {
    scraping: 'Mengakses laman web...',
    analyzing: 'Menganalisis kandungan...',
    extracting: 'Mengekstrak maklumat perniagaan...',
  },
}
```

---

### 3.4 ExtractionConfidenceBadge (NEW)

```
High:    ┌─────────────────────────────┐
         │ ✅ Extracted from URL  ●●●○ │
         └─────────────────────────────┘

Medium:  ┌──────────────────────────────────────┐
         │ ⚠️ Partially extracted  ●●○○          │
         │ Some fields may need manual editing  │
         └──────────────────────────────────────┘

Low:     ┌──────────────────────────────────────────────┐
         │ ⚠️ Limited info extracted  ●○○○               │
         │ We couldn't extract much. Please review and  │
         │ fill in the missing information.              │
         └──────────────────────────────────────────────┘
```

- **Type:** Banner / Alert
- **Props:**
  ```typescript
  {
    confidence: 'high' | 'medium' | 'low'
    warnings?: string[]
    sourceUrl: string
  }
  ```
- **Location:** Between InputModeToggle and form fields, after extraction succeeds
- **Reuse:** Custom component, similar visual to existing error banner in BusinessInfoForm

**Styling per confidence:**

| Level | BG | Border | Icon | Text Color | Dots |
|-------|-----|--------|------|------------|------|
| High | `rgba(34,197,94,0.1)` | `rgba(34,197,94,0.3)` | ✅ | `#86efac` (green-300) | 3 green, 1 gray |
| Medium | `rgba(234,179,8,0.1)` | `rgba(234,179,8,0.3)` | ⚠️ | `#fde047` (yellow-300) | 2 yellow, 2 gray |
| Low | `rgba(248,113,113,0.1)` | `rgba(248,113,113,0.3)` | ⚠️ | `#fca5a5` (red-300) | 1 red, 3 gray |

```css
/* Container */
border-radius: 16px;
padding: 12px 16px;
font-size: 14px;
line-height: 1.5;

/* Dots */
width: 8px;
height: 8px;
border-radius: 50%;
/* Active: confidence color */
/* Inactive: rgba(255,255,255,0.2) */
```

---

### 3.5 ExtractionErrorBanner (NEW)

```
┌──────────────────────────────────────────────┐
│ ❌ We couldn't access this website.          │
│ The site may be blocking automated access.   │
│                                              │
│ [Try manual entry →]                         │
└──────────────────────────────────────────────┘
```

- **Type:** Error Alert
- **Props:**
  ```typescript
  {
    message: string // i18n error message
    onSwitchToManual: () => void
  }
  ```
- **Reuse:** Same error banner pattern as existing `errorMessage` in BusinessInfoForm
- **Styling:** Same as existing error banner (`border-[rgba(248,113,113,0.35)]`, `bg-[rgba(127,29,29,0.18)]`)

**Error messages (i18n):**
```typescript
const EXTRACTION_ERRORS = {
  en: {
    timeout: "We couldn't access this website. It may be too slow or blocking our request.",
    blocked: "This website blocked our request. Please enter your business info manually.",
    invalid: "This doesn't appear to be a valid website URL.",
    unsafe: "This URL contains content that is not allowed.",
    rateLimit: "Too many requests. Please wait a moment and try again.",
    generic: "Something went wrong. Please try again or enter info manually.",
    fallbackLink: "Try manual entry",
  },
  ms: {
    timeout: "Kami tidak dapat mengakses laman web ini. Laman mungkin terlalu perlahan.",
    blocked: "Laman web ini menghalang permintaan kami. Sila masukkan maklumat secara manual.",
    invalid: "Ini bukan URL laman web yang sah.",
    unsafe: "URL ini mengandungi kandungan yang tidak dibenarkan.",
    rateLimit: "Terlalu banyak permintaan. Sila tunggu sebentar.",
    generic: "Sesuatu telah berlaku. Sila cuba lagi atau masukkan maklumat secara manual.",
    fallbackLink: "Cuba masukkan secara manual",
  },
}
```

---

### 3.6 ColorSuggestionSwatches (NEW — optional P2)

```
┌──────────────────────────────────────────────┐
│ 🎨 Suggested Colors (from your website)      │
│ ┌────┐ ┌────┐                                │
│ │ ██ │ │ ██ │  [Use these colors]            │
│ └────┘ └────┘                                │
│ #FF5722  #1976D2                             │
└──────────────────────────────────────────────┘
```

- **Type:** Inline suggestion card
- **Props:**
  ```typescript
  {
    primaryColor?: string
    secondaryColor?: string
    onApply: () => void
    onDismiss: () => void
  }
  ```
- **Visibility:** Only shown when extraction returns `suggestedTheme` with colors
- **Location:** Below confidence badge, above form fields

---

### 3.7 BusinessInfoForm (MODIFIED)

Changes to existing component:

```typescript
// NEW state
const [inputMode, setInputMode] = useState<'manual' | 'url'>('manual')
const [urlExtracting, setUrlExtracting] = useState(false)
const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
const [urlValue, setUrlValue] = useState('')

// NEW: After successful extraction
// → setInputMode('manual')
// → setForm({ ...extractedData })
// → Show ExtractionConfidenceBadge
```

**Component tree (modified):**
```
BusinessInfoForm
├── InputModeToggle [NEW]
│
├── (if mode === 'url' && !urlExtracting && !extractionResult)
│   └── UrlExtractInput [NEW]
│
├── (if urlExtracting)
│   └── ExtractionLoadingState [NEW]
│
├── (if extractionResult && mode === 'manual')
│   ├── ExtractionConfidenceBadge [NEW]
│   ├── ColorSuggestionSwatches [NEW, optional]
│   └── [Existing form fields — pre-filled]
│       ├── BuilderField (businessName)
│       ├── BuilderField (industry) + BuilderOptionGrid
│       ├── BuilderField (products)
│       └── BuilderField (shortDescription)
│
├── (if mode === 'manual' && !extractionResult)
│   └── [Existing form fields — empty]
│
├── (if extractionError)
│   └── ExtractionErrorBanner [NEW]
│
└── BuilderSubmitButton [existing]
```

---

## 4. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Mobile | < 768px | Single column, right promo pane hidden, full-width form, URL input + Extract button stack vertically if needed |
| Tablet | 768-1023px | Single column (right pane still hidden per existing), wider form |
| Desktop | ≥ 1024px | 2-column grid (left=form, right=promo), existing `BuilderOnboardingShell` layout |

### Mobile-specific adjustments
- `InputModeToggle`: Full width, tabs equal width (`flex-1` each)
- `UrlExtractInput`: Input and button stack vertically on very narrow screens (< 400px), else horizontal
- `ExtractionConfidenceBadge`: Full width, text wraps naturally
- Touch targets: All interactive elements ≥ 44px height (already enforced by existing components)
- URL input: `type="url"` triggers URL keyboard on mobile

### Existing responsive behavior (unchanged)
- `BuilderOnboardingShell`: `lg:grid-cols-2`, single column below lg
- `BuilderStepScreen`: Full height `h-[100dvh]`, scrollable body
- Right promo pane: `hidden lg:flex`

---

## 5. Interaction States

### InputModeToggle

| Interaction | Duration | Effect |
|-------------|----------|--------|
| Tab hover | 150ms | BG `rgba(255,255,255,0.05)`, text lighter |
| Tab click | 0ms | Instant switch, `aria-selected` updates |
| Tab focus | 0ms | Focus ring `ring-2 ring-blue-500/50` |
| Keyboard arrow | 0ms | Move focus between tabs |

### Extract Button

| Interaction | Duration | Effect |
|-------------|----------|--------|
| Hover | 200ms | `brightness(1.1)` |
| Click | 0ms → loading | Disable, show spinner |
| Loading | Until response | Spinner + "Extracting..." text |
| Success | 200ms | Fade out, form auto-fills |
| Error | 200ms | Error banner appears with slide-down |

### Auto-fill Animation

| Step | Duration | Effect |
|------|----------|--------|
| Extraction complete | 0ms | Switch to Manual view |
| Confidence badge | 200ms | Fade in from top |
| Form fields | 150ms stagger | Each field fades in (50ms delay between fields) |
| Scroll | 300ms | Auto-scroll to first field if needed |

### Error Banner

| Interaction | Duration | Effect |
|-------------|----------|--------|
| Appear | 200ms | Slide down + fade in |
| "Try manual" hover | 150ms | Underline, lighter color |
| "Try manual" click | 0ms | Switch to Manual tab, clear error |
| Dismiss (if auto) | 10s | Fade out (errors persist, not auto-dismiss) |

---

## 6. Design Token References

### Colors (existing dark theme)

| Token | Value | Usage |
|-------|-------|-------|
| `bg-page` | `#0b1120` | Page background |
| `bg-input` | `rgba(255,255,255,0.05)` | Input backgrounds |
| `bg-input-hover` | `rgba(255,255,255,0.08)` | Input hover |
| `border-input` | `rgba(255,255,255,0.1)` | Input borders |
| `border-input-focus` | `#3b82f6` | Input focus border |
| `border-error` | `rgba(248,113,113,0.35)` | Error borders |
| `bg-error` | `rgba(127,29,29,0.18)` | Error backgrounds |
| `text-primary` | `#ffffff` | Primary text |
| `text-secondary` | `#94a3b8` | Secondary/hint text |
| `text-error` | `#fecaca` | Error text |
| `text-success` | `#86efac` | Success text (green-300) |
| `text-warning` | `#fde047` | Warning text (yellow-300) |
| `gradient-primary` | `linear-gradient(90deg, #3b82f6, #2dd4bf)` | CTA buttons |
| `bg-tab-active` | `rgba(59,130,246,0.15)` | Active tab background |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `gap-form` | `24px` (gap-6) | Between form fields |
| `gap-toggle` | `0px` | Between toggle tabs |
| `padding-field` | `16px` (px-4) | Field internal padding |
| `padding-section` | `24px` (p-6) | Section padding |
| `radius-input` | `12px` (rounded-xl) | Input border radius |
| `radius-card` | `16px` (rounded-2xl) | Card/banner border radius |
| `radius-button` | `16px` (rounded-2xl) | Button border radius |

### Typography

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Step title | `24px` | 700 | Inter |
| Step subtitle | `14px` | 400 | Inter |
| Field label | `14px` | 600 | Inter |
| Input text | `14px` | 400 | Inter |
| Hint text | `12px` | 400 | Inter |
| Error text | `14px` | 400 | Inter |
| Button text | `14px` | 600 | Inter |
| Badge text | `12px` | 600 | Inter |
| Tab text | `14px` | 600 (active) / 400 (inactive) | Inter |

---

## 7. Accessibility Specs

### ARIA Labels

| Element | ARIA | Value |
|---------|------|-------|
| Toggle container | `role="tablist"`, `aria-label` | "Input method selection" |
| Manual tab | `role="tab"`, `aria-selected`, `aria-controls="panel-manual"` | Dynamic |
| URL tab | `role="tab"`, `aria-selected`, `aria-controls="panel-url"` | Dynamic |
| Manual panel | `role="tabpanel"`, `id="panel-manual"`, `aria-labelledby` | Dynamic |
| URL panel | `role="tabpanel"`, `id="panel-url"`, `aria-labelledby` | Dynamic |
| URL input | `aria-label` | "Website URL" |
| Extract button | `aria-label` | "Extract business info from URL" |
| Extract button (loading) | `aria-label`, `aria-busy="true"` | "Extracting, please wait" |
| Confidence badge | `role="status"`, `aria-live="polite"` | Dynamic status text |
| Error banner | `role="alert"`, `aria-live="assertive"` | Error message |
| "Try manual" link | `role="link"` | "Switch to manual entry" |

### Keyboard Navigation

```
Tab order:
1. Manual tab
2. URL tab (arrow key navigation between tabs)
3. (If URL mode) URL input → Extract button
4. (If Manual mode / after extraction) businessName → industry cards → products → shortDescription
5. Generate button (footer)

Special interactions:
- Arrow Left/Right: switch between tabs
- Enter/Space: activate tab, trigger Extract
- Escape: cancel extraction (if loading)
```

### Screen Reader Announcements

| Event | Announcement |
|-------|-------------|
| Tab switch | "Manual entry selected" / "Import from URL selected" |
| Extraction started | "Extracting business information from URL..." |
| Extraction success | "Business information extracted successfully. High/Medium/Low confidence. Review the form below." |
| Extraction error | Error message text (auto-announced via `role="alert"`) |
| Confidence badge | "Extraction confidence: high/medium/low" |

### Color Contrast (WCAG AA)

| Element | Foreground | Background | Ratio | Pass |
|---------|-----------|------------|-------|------|
| Primary text | `#ffffff` | `#0b1120` | 17.5:1 | AA |
| Secondary text | `#94a3b8` | `#0b1120` | 5.8:1 | AA |
| Error text | `#fecaca` | `rgba(127,29,29,0.18)` on `#0b1120` | 8.2:1 | AA |
| Success text | `#86efac` | `rgba(34,197,94,0.1)` on `#0b1120` | 7.6:1 | AA |
| Warning text | `#fde047` | `rgba(234,179,8,0.1)` on `#0b1120` | 12.1:1 | AAA |
| Active tab | `#60a5fa` | `rgba(59,130,246,0.15)` on `#0b1120` | 5.4:1 | AA |
| Inactive tab | `#94a3b8` | `#0b1120` | 5.8:1 | AA |

---

## 8. Complete Visual Mockup (ASCII)

### Desktop — URL Mode (before extract)

```
┌────────────────────────────────────────────────────┬─────────────────────────────┐
│  ← Back                                           │                             │
│                                                    │  ┌───────────────────────┐  │
│  Tell us about your business                       │  │  How it works         │  │
│  Step 1 of 3 — Describe your business              │  │                       │  │
│                                                    │  │  ● 1. Describe        │  │
│  ┌───────────────────┐┌────────────────────┐       │  │  ○ 2. Generate        │  │
│  │ ✏️ Describe       ││ 🔗 Import from URL │       │  │  ○ 3. Customize       │  │
│  └───────────────────┘└────────────────────┘       │  │                       │  │
│  ─────────────────────────────────────────         │  └───────────────────────┘  │
│                                                    │                             │
│  🔗 Website URL *                                  │                             │
│  ┌───────────────────────────────┐ ┌────────────┐  │                             │
│  │ https://your-website.com      │ │ Extract →  │  │                             │
│  └───────────────────────────────┘ └────────────┘  │                             │
│  Paste your existing website URL                   │                             │
│                                                    │                             │
│                                                    │                             │
│                                                    │                             │
│  ┌────────────────────────────────────────────┐    │                             │
│  │        🚀 Generate Website                 │    │                             │
│  └────────────────────────────────────────────┘    │                             │
└────────────────────────────────────────────────────┴─────────────────────────────┘
```

### Desktop — After Extraction (auto-filled)

```
┌────────────────────────────────────────────────────┬─────────────────────────────┐
│  ← Back                                           │                             │
│                                                    │  ┌───────────────────────┐  │
│  Tell us about your business                       │  │  How it works         │  │
│  Step 1 of 3 — Describe your business              │  │                       │  │
│                                                    │  │  ● 1. Describe        │  │
│  ┌───────────────────┐┌────────────────────┐       │  │  ○ 2. Generate        │  │
│  │ ✏️ Describe  ✓    ││ 🔗 Import from URL │       │  │  ○ 3. Customize       │  │
│  └───────────────────┘└────────────────────┘       │  │                       │  │
│  ─────────────────────────────────────────         │  └───────────────────────┘  │
│                                                    │                             │
│  ┌────────────────────────────────────────────┐    │                             │
│  │ ✅ Extracted from kedai-kopi.com  ●●●○    │    │                             │
│  └────────────────────────────────────────────┘    │                             │
│                                                    │                             │
│  📝 Business Name *                                │                             │
│  ┌────────────────────────────────────────────┐    │                             │
│  │ Kedai Kopi ABC                             │    │                             │
│  └────────────────────────────────────────────┘    │                             │
│                                                    │                             │
│  🏢 Industry *                                     │                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │                             │
│  │ 🍽️ F&B  │ │ 💻 Tech  │ │ 🏥 Health│          │                             │
│  │  [SEL]   │ │          │ │          │          │                             │
│  └──────────┘ └──────────┘ └──────────┘          │                             │
│                                                    │                             │
│  📦 Products *                                     │                             │
│  ┌────────────────────────────────────────────┐    │                             │
│  │ Kopi, Teh Tarik, Nasi Lemak, Roti Bakar   │    │                             │
│  └────────────────────────────────────────────┘    │                             │
│                                                    │                             │
│  ┌────────────────────────────────────────────┐    │                             │
│  │        🚀 Generate Website                 │    │                             │
│  └────────────────────────────────────────────┘    │                             │
└────────────────────────────────────────────────────┴─────────────────────────────┘
```

### Mobile — URL Mode

```
┌─────────────────────────┐
│  ← Back                 │
│                         │
│  Tell us about your     │
│  business               │
│  Step 1 of 3            │
│                         │
│  ┌──────────┐┌─────────┐│
│  │✏️ Manual ││🔗 URL   ││
│  └──────────┘└─────────┘│
│  ───────────────────────│
│                         │
│  🔗 Website URL *       │
│  ┌─────────────────────┐│
│  │ https://...         ││
│  └─────────────────────┘│
│  ┌─────────────────────┐│
│  │    Extract →        ││
│  └─────────────────────┘│
│                         │
│                         │
│  ┌─────────────────────┐│
│  │  🚀 Generate        ││
│  └─────────────────────┘│
└─────────────────────────┘
```

---

## 9. i18n Keys (NEW)

```typescript
// Add to existing i18n translations
const urlImport = {
  en: {
    tabManual: 'Describe Business',
    tabUrl: 'Import from URL',
    urlLabel: 'Website URL',
    urlPlaceholder: 'https://your-website.com',
    urlHint: 'Paste your existing website URL',
    extractButton: 'Extract',
    extracting: 'Extracting...',
    confidenceHigh: 'Extracted from URL',
    confidenceMedium: 'Partially extracted',
    confidenceLow: 'Limited info extracted',
    warningLow: "We couldn't extract much. Please review and fill in the missing information.",
    warningMedium: 'Some fields may need manual editing.',
    errorTimeout: "We couldn't access this website. It may be too slow or blocking our request.",
    errorBlocked: "This website blocked our request. Please enter your business info manually.",
    errorInvalid: "This doesn't appear to be a valid website URL.",
    errorUnsafe: "This URL contains content that is not allowed.",
    errorRateLimit: "Too many requests. Please wait a moment and try again.",
    errorGeneric: "Something went wrong. Please try again or enter info manually.",
    tryManual: 'Try manual entry',
  },
  ms: {
    tabManual: 'Huraikan Perniagaan',
    tabUrl: 'Import dari URL',
    urlLabel: 'URL Laman Web',
    urlPlaceholder: 'https://laman-web-anda.com',
    urlHint: 'Tampal URL laman web sedia ada anda',
    extractButton: 'Ekstrak',
    extracting: 'Mengekstrak...',
    confidenceHigh: 'Diekstrak dari URL',
    confidenceMedium: 'Sebahagian diekstrak',
    confidenceLow: 'Maklumat terhad diekstrak',
    warningLow: 'Kami tidak dapat mengekstrak banyak maklumat. Sila semak dan lengkapkan.',
    warningMedium: 'Sesetengah medan mungkin perlu pengeditan manual.',
    errorTimeout: 'Kami tidak dapat mengakses laman web ini.',
    errorBlocked: 'Laman web ini menghalang permintaan kami. Sila masukkan maklumat secara manual.',
    errorInvalid: 'Ini bukan URL laman web yang sah.',
    errorUnsafe: 'URL ini mengandungi kandungan yang tidak dibenarkan.',
    errorRateLimit: 'Terlalu banyak permintaan. Sila tunggu sebentar.',
    errorGeneric: 'Sesuatu telah berlaku. Sila cuba lagi atau masukkan maklumat secara manual.',
    tryManual: 'Cuba masukkan secara manual',
  },
}
```
