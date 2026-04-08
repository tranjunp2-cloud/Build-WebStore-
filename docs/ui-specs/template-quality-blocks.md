# UI Design Specs: Template Quality — 6 Block Upgrades

> **Feature:** Template System Quality — Fix Stubs + Polish Partials
> **PRD refs:** `docs/prd/F30-sprint2-variants.md`, `docs/prd/F30-sprint4-polish.md`
> **Plan:** `plans/260406-template-system-quality-audit/plan.md`
> **Created:** 2026-04-06
> **Stack:** Next.js 15 + Tailwind CSS + shadcn/ui + Framer Motion + Payload CMS
> **Design tokens:** ThemeConfig (6 colors, 20 fonts, 3 spacing, 5 radius, 4 shadow presets)

---

## 1. Screen List

| # | Screen | Route | Description | Ref |
|---|--------|-------|-------------|-----|
| 1 | Site Renderer (Public) | `/{domain}/*` | Renders all blocks for visitors | US-F30-01 |
| 2 | Visual Editor | `/dashboard/sites/{id}/editor` | Admin edits blocks + swaps variants | US-F30-02 |
| 3 | Template Picker Modal | (Editor overlay) | Browse + apply templates | Sprint 4 |
| 4 | Payload Admin — Subscribers | `/admin/collections/subscribers` | View email subscribers per site | New |

---

## 2. Shared Architecture

### 2.1 AnimatedSection Wrapper (upgrade existing)

**File:** `src/blocks/shared/animations.tsx`

```
AnimatedSection (upgraded)
├── Props:
│   ├── children: ReactNode
│   ├── animation: 'fadeInUp' | 'fadeIn' | 'scaleIn' | 'slideIn' (default: fadeInUp)
│   ├── delay?: number (default: 0)
│   ├── className?: string
│   └── once?: boolean (default: true)
├── Behavior:
│   ├── Uses useReducedMotion() from framer-motion
│   ├── If reduced → render children instantly, no animation
│   ├── If normal → whileInView with viewport once
│   └── Duration: 400ms, ease: [0.25, 0.46, 0.45, 0.94]
└── Stagger: StaggerGrid wraps children with 50ms delay per item
```

**Accessibility:**
- `prefers-reduced-motion: reduce` → skip all animations
- No `will-change` on more than 2 elements simultaneously
- Animate only `transform` + `opacity` (never width/height/top/left)

### 2.2 Design Token Usage (all blocks)

```css
/* Colors — auto-adapt dark/light via colorMode */
color: var(--text);
background: var(--surface);
border-color: var(--muted);
accent: var(--brand-primary);
/* Opacity via RGB tokens */
background: rgba(var(--brand-primary-rgb), 0.1);

/* Spacing */
padding: var(--space-lg) var(--space-xl);
gap: var(--space-md);
section-padding: var(--section-padding);

/* Shape */
border-radius: var(--radius-md);
box-shadow: var(--shadow-sm);

/* Typography */
font-family: var(--font-heading);
font-family: var(--font-body);
```

---

## 3. Block Component Specs

### 3.1 Stats Block

**File:** `src/blocks/stats/index.tsx` (23→150+ lines)
**Directive:** `'use client'` (MUST ADD)
**Config variants:** `row` | `grid` | `highlight`

#### Variant: `row`
```
┌─────────────────────────────────────────────────────┐
│  [Icon]  500+        [Icon]  99%        [Icon]  24/7 │
│          Clients              Uptime             Support │
└─────────────────────────────────────────────────────┘
Desktop: flex-row, 3-5 items equal width
Tablet:  flex-row, 2-3 items per row
Mobile:  flex-col or 2-col grid
```

#### Variant: `grid`
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│   500+   │  │   99%    │  │   24/7   │
│  Clients │  │  Uptime  │  │ Support  │
│  [icon]  │  │  [icon]  │  │  [icon]  │
└──────────┘  └──────────┘  └──────────┘
Desktop: 3-4 col grid, cards with shadow
Tablet:  2 col grid
Mobile:  1 col stack
```

#### Variant: `highlight`
```
┌─────────────────────────────────────────────┐
│        ████████████  80%                     │
│  Brand primary gradient bar, large number    │
│  Label below, accent background              │
└─────────────────────────────────────────────┘
Desktop: horizontal bars, full width
Mobile:  stacked vertical bars
```

**Props from config.ts:**
- `items[]: { value: string, label: string, icon?: string, suffix?: string }`
- `sectionLabel?: string`, `headline?: string`

**Interaction:**
- Framer Motion: AnimatedSection fadeInUp for container, StaggerGrid 50ms for items
- Number count-up: animate from 0 → value on scroll into view (useReducedMotion → show instantly)
- Hover (grid variant): subtle scale(1.02) + shadow elevation

**Accessibility:**
- `aria-label` on each stat item: "{value} {label}"
- Numbers use `tabular-nums` font variant for alignment

---

### 3.2 Team Block

**File:** `src/blocks/team/index.tsx` (24→150+ lines)
**Directive:** `'use client'` (MUST ADD)
**Config variants:** `grid` | `list`

#### Variant: `grid`
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  [Avatar]    │  │  [Avatar]    │  │  [Avatar]    │
│  Name        │  │  Name        │  │  Name        │
│  Role        │  │  Role        │  │  Role        │
│  [Social 🔗] │  │  [Social 🔗] │  │  [Social 🔗] │
└──────────────┘  └──────────────┘  └──────────────┘
Desktop: 3-4 col grid
Tablet:  2 col grid
Mobile:  1 col stack (centered)
```

#### Variant: `list`
```
┌─────────────────────────────────────────────────┐
│  [Avatar]  Name — Role                           │
│            Short bio text here...      [Social]  │
├─────────────────────────────────────────────────┤
│  [Avatar]  Name — Role                           │
│            Short bio text here...      [Social]  │
└─────────────────────────────────────────────────┘
Desktop: full width rows with avatar left
Mobile:  stack avatar above name
```

**Props:** `members[]: { name, role, bio?, image?, socialLinks?: { platform, url }[] }`

**Interaction:**
- AnimatedSection fadeInUp, StaggerGrid 50ms per member
- Hover (grid): HoverCard scale(1.03) + shadow-md
- Avatar: if no image → initials circle (first letter of name, brand-primary bg)

**Accessibility:**
- Each member card: `role="article"`, `aria-label="{name}, {role}"`
- Social links: `aria-label="Visit {name}'s {platform}"`, `rel="noopener noreferrer"`, `target="_blank"`

---

### 3.3 Newsletter Block

**File:** `src/blocks/newsletter/index.tsx` (18→120+ lines)
**Directive:** `'use client'` (MUST ADD)
**Config variants:** `inline` | `popup` | `banner`

#### Variant: `inline`
```
┌─────────────────────────────────────────────────────┐
│  Stay Updated    [email@input.com     ] [Subscribe] │
│  Get our latest news                                 │
└─────────────────────────────────────────────────────┘
Desktop: single row — text left, form right
Mobile:  stack vertical — text, then input + button
```

#### Variant: `popup` (card style)
```
┌─────────────────────────────────────────┐
│          📬 Stay Updated                │
│    Get the latest news & updates        │
│                                         │
│  ┌──────────────────────┐               │
│  │ your@email.com       │               │
│  └──────────────────────┘               │
│  ┌──────────────────────┐               │
│  │     Subscribe ➤      │               │
│  └──────────────────────┘               │
└─────────────────────────────────────────┘
Elevated card with brand-primary accent, centered
```

#### Variant: `banner`
```
┌══════════════════════════════════════════════════════┐
║  Brand-primary gradient background                   ║
║  [Headline]     [email input] [CTA button]          ║
║  [subtitle]                                          ║
└══════════════════════════════════════════════════════┘
Full-width banner, text white on brand gradient
```

**Props:** `headline, description, buttonText, placeholder, successMessage`

**Interaction:**
- Email validation: `z.string().email()` — inline error below input on blur
- Submit → POST /api/subscribe `{ email, siteId }` → loading spinner on button → success toast
- Rate limit: 5 req/min per IP
- States: default → typing → validating → submitting → success → error

**Accessibility:**
- `<label>` linked to input via `htmlFor`
- `aria-describedby` for error message
- `aria-live="polite"` on success/error message region
- Input `type="email"`, `autocomplete="email"`

---

### 3.4 About Block

**File:** `src/blocks/about/index.tsx` (78→200+ lines)
**Directive:** `'use client'` (already exists)
**Config variants:** `simple` | `split` | `story` (+ timeline upgrade)

#### Variant: `simple`
```
┌─────────────────────────────────────────┐
│          [Section Label]                 │
│          Headline                        │
│                                         │
│  Body text paragraph, multiple lines... │
│                                         │
│  [Optional stats row: 10+ years, etc.] │
└─────────────────────────────────────────┘
Centered text, max-w-3xl, no image
```

#### Variant: `split`
```
┌────────────────────┬────────────────────┐
│                    │  [Section Label]    │
│    [Image]         │  Headline           │
│                    │  Body text...       │
│                    │  [CTA button]       │
└────────────────────┴────────────────────┘
Desktop: 2 col (image left, text right). Alternates on odd/even
Tablet:  2 col, narrower image
Mobile:  stack image on top
```

#### Variant: `story` (timeline upgrade)
```
┌─────────────────────────────────────────────┐
│              Our Story                       │
│                                             │
│  2018 ●─── Founded in Kuala Lumpur          │
│            Description text...               │
│                                             │
│  2020 ●─── Expanded to 5 countries          │
│            Description text...               │
│                                             │
│  2024 ●─── Reached 10,000 customers         │
│            Description text...               │
└─────────────────────────────────────────────┘
Desktop: vertical timeline, alternating left/right
Tablet:  single column timeline
Mobile:  compact timeline, all left-aligned
```

**Schema additions for story variant:**
- `timelineItems[]: { year: string, title: string, description: string, icon?: string }`
- Falls back to regular `items[]` if `timelineItems` is empty

**Interaction:**
- AnimatedSection fadeInUp for each section
- Timeline: stagger reveal items on scroll (50ms delay each)
- Split: image parallax-light on scroll (5% translate, reduced-motion → static)

**Accessibility:**
- Timeline: `<ol>` ordered list semantics
- Each timeline item: `<li>` with `aria-label="{year}: {title}"`
- Image: meaningful `alt` text from CMS

---

### 3.5 FAQ Block

**File:** `src/blocks/faq/index.tsx` (54→140+ lines)
**Directive:** `'use client'` (already exists)
**Config variants:** `accordion` | `grid` | `simple`

#### Variant: `accordion`
```
┌─────────────────────────────────────────────┐
│  ▶ Question 1                          [+]  │
├─────────────────────────────────────────────┤
│  ▼ Question 2 (expanded)               [-]  │
│    Answer text with full content...          │
│    Can include links and formatting.         │
├─────────────────────────────────────────────┤
│  ▶ Question 3                          [+]  │
└─────────────────────────────────────────────┘
Full width, one open at a time (or multi)
```

#### Variant: `grid`
```
┌──────────────────┐  ┌──────────────────┐
│  Q: Question 1   │  │  Q: Question 2   │
│  A: Answer...    │  │  A: Answer...    │
└──────────────────┘  └──────────────────┘
Desktop: 2 col grid of Q&A cards
Mobile:  1 col stack
```

#### Variant: `simple`
```
┌─────────────────────────────────────────────┐
│  Q: Question 1                               │
│  A: Answer text...                           │
│                                             │
│  Q: Question 2                               │
│  A: Answer text...                           │
└─────────────────────────────────────────────┘
No collapse, all visible, dividers between
```

**Interaction (accordion):**
- Expand/collapse: Framer Motion `AnimatePresence` + height auto
- Duration: 200ms, easeOut
- Chevron icon rotates 180° on expand

**Accessibility (CRITICAL for accordion):**
- `<button>` trigger with `aria-expanded="true/false"`
- `aria-controls` linking button to answer panel
- Answer panel: `role="region"`, `aria-labelledby` → question button id
- **Keyboard:** Enter/Space toggles, Up/Down navigates between items
- `prefers-reduced-motion` → instant show/hide, no height animation

---

### 3.6 CTA Block

**File:** `src/blocks/cta/index.tsx` (55→140+ lines)
**Directive:** `'use client'` (already exists)
**Config variants:** `banner` | `inline` | `floating`

#### Variant: `banner`
```
┌══════════════════════════════════════════════════════┐
║  Brand gradient or solid background                  ║
║                                                      ║
║     Headline Text — Big and Bold                     ║
║     Supporting description text                      ║
║                                                      ║
║     [Primary CTA]    [Secondary CTA]                 ║
└══════════════════════════════════════════════════════┘
Full-width section, centered content, max-w-3xl
```

#### Variant: `inline`
```
┌─────────────────────────────────────────────────────┐
│  Headline text         [Primary CTA] [Secondary]    │
│  Description           aligned right on desktop      │
└─────────────────────────────────────────────────────┘
Desktop: text left, buttons right (flex-row)
Mobile:  stack all centered
```

#### Variant: `floating`
```
            ┌─────────────────────────────┐
            │  Elevated card, shadow-lg    │
            │                             │
            │  Headline                    │
            │  Description                 │
            │                             │
            │  [Primary CTA]              │
            └─────────────────────────────┘
Centered floating card on subtle bg, max-w-xl
```

**Props:** `headline, description, primaryButton: { text, url }, secondaryButton?: { text, url }`

**Interaction:**
- AnimatedSection fadeInUp
- Button hover: scale(1.02) + shadow elevation, 150ms
- Button press: scale(0.98), 80ms
- External links: `rel="noopener noreferrer"`

**Accessibility:**
- Buttons: sufficient contrast on gradient bg (test both light/dark)
- `<a>` for navigation CTAs, `<button>` for actions
- Focus ring: 2px offset, brand-primary color

---

## 4. New: Subscribers Collection

**File:** `src/collections/Subscribers.ts` (NEW)

```
Subscribers Collection (Payload CMS)
├── Fields:
│   ├── email: text, required, unique per site
│   ├── site: relationship → sites, required
│   ├── source: select ['newsletter', 'popup', 'footer'] (default: newsletter)
│   └── createdAt: date (auto)
├── Access:
│   ├── read: super-admin only
│   ├── create: public (via API)
│   └── delete: super-admin only
└── Admin:
    ├── List: email, site name, source, date
    ├── Filter: by site, by date range
    └── useAsTitle: email
```

**API:** `POST /api/subscribe`
```
Request:  { email: string, siteId: string }
Validate: z.object({ email: z.string().email(), siteId: z.string() })
Rate:     checkRateLimit(ip, 5, 60000) — 5/min per IP
Response: { success: true } | { error: 'Invalid email' | 'Rate limited' | 'Already subscribed' }
```

---

## 5. Warning Modal Update

**File:** `src/components/editor/EditorTemplateModal.tsx`

Current text (line ~310):
> "This will replace your current page layout and theme. This action cannot be undone."

Updated text (for multi-page):
> "Thay đổi template sẽ thay thế toàn bộ trang và giao diện hiện tại. Hành động này không thể hoàn tác."
> / "Changing template will replace all your pages and theme. This cannot be undone."

No structural change needed — modal already has AlertTriangle + Cancel/Apply buttons.

---

## 6. Responsive Strategy

| Breakpoint | Width | Layout Changes |
|-----------|-------|----------------|
| Mobile | < 640px (sm) | 1 col, stack vertical, compact spacing (--space-sm gaps) |
| Tablet | 640-1024px (md) | 2 col grids, medium spacing |
| Desktop | > 1024px (lg) | 3-4 col grids, full spacing (--section-padding) |

**Per-block responsive:**

| Block | Mobile | Tablet | Desktop |
|-------|--------|--------|---------|
| Stats row | 1 col stack | 2 col | 3-5 col flex |
| Stats grid | 1 col cards | 2 col | 3-4 col |
| Team grid | 1 col centered | 2 col | 3-4 col |
| Team list | Stack avatar+text | Side-by-side row | Full row |
| Newsletter inline | Stack form | 2 parts | Single row |
| About split | Stack img+text | 2 col narrow | 2 col 50/50 |
| About timeline | Left-aligned | Left-aligned | Alternating L/R |
| FAQ accordion | Full width | Full width | max-w-3xl centered |
| FAQ grid | 1 col | 2 col | 2 col |
| CTA banner | Stack centered | Stack centered | Centered, max-w-3xl |
| CTA inline | Stack centered | 2 part | text left, btn right |

---

## 7. Animation Specs

| Element | Animation | Duration | Easing | Reduced Motion |
|---------|-----------|----------|--------|----------------|
| Section enter | fadeInUp (y: 20→0, opacity 0→1) | 400ms | easeOut | Instant show |
| Grid items | StaggerGrid (50ms/item) | 300ms each | easeOut | All show at once |
| Stat number | Count 0→value | 1200ms | easeOut | Show final value |
| Hover card | scale(1.02) + shadow | 150ms | easeOut | No scale, shadow only |
| Button press | scale(0.98) | 80ms | easeIn | No animation |
| FAQ expand | height auto + opacity | 200ms | easeOut | Instant toggle |
| Timeline item | fadeInUp stagger | 400ms, +50ms | easeOut | Instant show |

**Rule:** Max 2 animated elements visible simultaneously per viewport.

---

## 8. Accessibility Summary

| Requirement | Blocks Affected | Implementation |
|-------------|----------------|----------------|
| `prefers-reduced-motion` | All 6 | AnimatedSection wrapper with useReducedMotion() |
| Keyboard nav (accordion) | FAQ | Enter/Space toggle, Up/Down navigate |
| `aria-expanded` | FAQ | On accordion trigger buttons |
| `aria-label` on stats | Stats | "{value} {label}" per item |
| `tabular-nums` | Stats | Font variant for number alignment |
| Form `<label>` | Newsletter | Linked via htmlFor to email input |
| `aria-live` errors | Newsletter | polite region for validation messages |
| Social link labels | Team | "Visit {name}'s {platform}" |
| Timeline semantics | About story | `<ol>` + `<li>` with aria-label |
| Focus ring | All buttons | 2px offset, brand-primary color |
| Color contrast | All | 4.5:1 text, 3:1 UI elements (both modes) |

---

## 9. Self-Check

```
📋 UI Specs Self-Check:
├── Gọi Skill tool ui-ux-pro-max? ✅
├── Số screens: 4
├── Số components: 6 blocks + 1 collection + 1 modal update + 1 wrapper
├── Screen Flows? ✅ (inherits from F30-sprint2-sprint3 specs)
├── Responsive Breakpoints? ✅ (Section 6)
├── Interaction States? ✅ (Section 7 + per-block)
├── Design Token refs? ✅ (Section 2.2)
├── Accessibility specs? ✅ (Section 8)
├── Map PRD user stories? ✅ (US-F30-01, US-F30-02, US-F30-03)
└── Component data/API refs? ✅ (Newsletter → /api/subscribe)
```
