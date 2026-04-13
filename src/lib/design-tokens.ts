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
// During migration (Phase 01 → Phase 03), tokens consume legacy `--surface-1/2/3`
// vars from globals.css. Phase 03 codemod will rename those to semantic names
// (`--surface-primary/secondary/card`). Block components never care — they just
// reference the token class.
export const SECTION_BACKGROUND = {
    default: 'bg-[var(--surface-1)]',
    alternate: 'bg-[var(--surface-2)]',
    accent: 'bg-[var(--surface-3)]',
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
