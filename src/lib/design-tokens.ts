/**
 * Design Tokens — Closed token layer for block-level design quality.
 *
 * All spacing, radius, shadow, icon sizing, and container widths MUST flow
 * through this module. Block components are forbidden from hardcoding pixel
 * values or raw Tailwind utility classes for these dimensions.
 *
 * Reference: plans/260412-2300-design-quality-rules/plan.md (Plan B)
 * Standards: docs/standards/DESIGN_TOKENS.md
 */

// ── Spacing (8px base grid — industry standard) ─────────────────────────────
export const SPACING = {
    xs: '4px',    // 0.25rem — tight internal
    sm: '8px',    // 0.5rem  — internal padding
    md: '16px',   // 1rem    — card padding
    lg: '24px',   // 1.5rem  — section internal
    xl: '32px',   // 2rem    — component gap
    '2xl': '48px', // 3rem    — section gap
    '3xl': '64px', // 4rem    — section padding desktop
    '4xl': '80px', // 5rem    — large section padding
    '5xl': '96px', // 6rem    — hero padding
    '6xl': '120px', // 7.5rem  — max section padding
} as const

export type SpacingToken = keyof typeof SPACING

// ── Border Radius ────────────────────────────────────────────────────────────
export const RADIUS = {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
} as const

export type RadiusToken = keyof typeof RADIUS

// ── Shadow Presets (Tailwind arbitrary value classes) ──────────────────────
// Consumed via className for consistency with ICON_SIZE / SECTION_PADDING.
export const SHADOW = {
    none: 'shadow-none',
    subtle: 'shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
    medium: 'shadow-[0_4px_12px_rgba(0,0,0,0.1)]',
    strong: 'shadow-[0_8px_24px_rgba(0,0,0,0.12)]',
    dramatic: 'shadow-[0_16px_48px_rgba(0,0,0,0.16)]',
} as const

export type ShadowToken = keyof typeof SHADOW

// ── Icon Sizes (Tailwind class names) ───────────────────────────────────────
export const ICON_SIZE = {
    sm: 'w-5 h-5',    // 20px — inline
    md: 'w-8 h-8',    // 32px — feature cards
    lg: 'w-12 h-12',  // 48px — hero icons
    xl: 'w-16 h-16',  // 64px — standalone
} as const

export type IconSizeToken = keyof typeof ICON_SIZE

// ── Section Padding (responsive Tailwind classes) ───────────────────────────
export const SECTION_PADDING = {
    compact: 'py-12 md:py-16',          // 48-64px  — tight sections
    default: 'py-16 md:py-24',          // 64-96px  — standard sections
    relaxed: 'py-20 md:py-32',          // 80-128px — breathing room
    hero: 'py-24 md:py-32 lg:py-40',    // 96-160px — hero only
} as const

export type SectionPaddingToken = keyof typeof SECTION_PADDING

// ── Container Widths ────────────────────────────────────────────────────────
export const CONTAINER = {
    narrow: 'max-w-3xl',    // 768px  — blog, text-heavy
    default: 'max-w-6xl',   // 1152px — standard
    wide: 'max-w-7xl',      // 1280px — full layouts
    full: 'max-w-full',     // edge-to-edge
} as const

export type ContainerToken = keyof typeof CONTAINER

// ── Card Padding (always less than section spacing) ─────────────────────────
export const CARD_PADDING = {
    sm: 'p-4',     // 16px
    md: 'p-6',     // 24px
    lg: 'p-8',     // 32px
} as const

export type CardPaddingToken = keyof typeof CARD_PADDING

// ── Section Background Variants ─────────────────────────────────────────────
// Consumes semantic surface vars from Phase 03 (--surface-primary/secondary/card).
// globals.css provides dark-baseline fallbacks; generateThemeCSS() overrides
// per site with light/dark-mode palette from generatePalette(). Blocks only
// reference the token class and never touch raw CSS var names.
export const SECTION_BACKGROUND = {
    default: 'bg-[var(--surface-primary)]',
    alternate: 'bg-[var(--surface-secondary)]',
    accent: 'bg-[var(--surface-card)]',
    transparent: 'bg-transparent',
} as const

export type SectionBackgroundToken = keyof typeof SECTION_BACKGROUND

// ── Inner Padding (responsive horizontal gutter) ────────────────────────────
// Container inner padding — scales with viewport for comfortable reading.
export const INNER_PADDING = 'px-6 md:px-8 lg:px-12'

// ── Touch Target Minimum (CRO + a11y) ───────────────────────────────────────
// CTA buttons MUST have min-height 44px per WCAG 2.5.5 + iOS HIG.
export const TOUCH_TARGET = {
    min: 'min-h-[44px]',  // 44px × 44px minimum
    comfortable: 'min-h-[48px]',
    large: 'min-h-[56px]',
} as const

export type TouchTargetToken = keyof typeof TOUCH_TARGET

// ── Typography Scale (Phase 02) ─────────────────────────────────────────────
// Modular scale ratio 1.25 (minor third). Body text is NEVER smaller than 16px
// to respect mobile zoom behavior and reading comfort.
export const TYPE_SCALE = {
    // Display — hero headlines only
    display: 'text-4xl md:text-5xl lg:text-6xl',    // 36 → 60px
    // H1 — page titles
    h1: 'text-3xl md:text-4xl lg:text-5xl',          // 30 → 48px
    // H2 — section titles
    h2: 'text-2xl md:text-3xl',                       // 24 → 30px
    // H3 — card titles, sub-sections
    h3: 'text-xl md:text-2xl',                        // 20 → 24px
    // H4 — small titles
    h4: 'text-lg md:text-xl',                         // 18 → 20px
    // Body — paragraphs (MIN 16px, never below)
    body: 'text-base',                                // 16px
    // Body large — emphasis paragraphs
    bodyLg: 'text-lg md:text-xl',                     // 18 → 20px
    // Small — captions, meta
    small: 'text-sm',                                 // 14px
} as const

export type TypeScaleToken = keyof typeof TYPE_SCALE

// ── Line Height (per type level) ────────────────────────────────────────────
export const LINE_HEIGHT = {
    display: 'leading-[1.1]',
    heading: 'leading-[1.2]',
    body: 'leading-[1.6]',
    small: 'leading-[1.4]',
} as const

export type LineHeightToken = keyof typeof LINE_HEIGHT

// ── Font Weight ─────────────────────────────────────────────────────────────
export const FONT_WEIGHT = {
    heading: 'font-bold',       // 700 — main headings
    subheading: 'font-semibold', // 600 — sub-titles
    body: 'font-normal',         // 400 — body copy
    emphasis: 'font-medium',     // 500 — inline emphasis
} as const

export type FontWeightToken = keyof typeof FONT_WEIGHT

// ── Max Prose Width (readability) ───────────────────────────────────────────
// ~65ch — optimal measure for body reading (45-75 chars per line).
export const MAX_PROSE = 'max-w-prose'

// ── Navigation Z-Index Stacking ─────────────────────────────────────────────
// Tiered hierarchy prevents z-50 collisions between nav bar, dropdowns,
// mobile backdrop, and mobile sidebar.
export const NAV_Z_INDEX = {
    base: 50,           // nav bar itself (sticky/fixed)
    dropdown: 51,       // desktop link dropdowns, mega-menu panel
    mobileBackdrop: 52, // mobile menu backdrop overlay
    mobileSidebar: 53,  // mobile sidebar drawer (topmost)
} as const

export const NAV_Z_CLASS = {
    base: 'z-[50]',
    dropdown: 'z-[51]',
    mobileBackdrop: 'z-[52]',
    mobileSidebar: 'z-[53]',
} as const

export type NavZIndexToken = keyof typeof NAV_Z_INDEX

// ── Navigation Height ───────────────────────────────────────────────────────
// Single source of truth for nav bar height. Consumed by ensure-navigation
// injector (adds NAV_HEIGHT_PT_CLASS to first block under fixed/sticky nav).
// Keep in sync with --nav-height in src/app/globals.css.
export const NAV_HEIGHT = 64
export const NAV_HEIGHT_PX = '64px'
export const NAV_HEIGHT_CLASS = 'h-16'      // Tailwind — nav bar itself
export const NAV_HEIGHT_PT_CLASS = 'pt-16'  // Tailwind — first-block offset
export const NAV_HEIGHT_VAR = 'var(--nav-height, 64px)'
