import type { CSSProperties } from 'react'

/**
 * GH-1384: Tailwind Typography (`prose`) hardcodes its own gray text colors via
 * the `--tw-prose-*` variables, which override the storefront theme's
 * `var(--text)`. Storefront sites theme via CSS variables (not a `.dark` class),
 * so `prose-invert` / `dark:prose-invert` either fight the theme or never fire —
 * leaving rich-text unreadable when the active color mode doesn't match.
 *
 * Bind the prose color variables to the theme tokens so rich-text stays readable
 * in BOTH light and dark color modes (text follows `--text`, links follow the
 * brand primary). CSS custom properties inherit, so this object can be applied to
 * the `prose` element itself or any ancestor of it.
 */
export const proseThemeVars = {
    '--tw-prose-body': 'var(--text)',
    '--tw-prose-headings': 'var(--text)',
    '--tw-prose-lead': 'var(--text)',
    '--tw-prose-bold': 'var(--text)',
    '--tw-prose-counters': 'var(--text)',
    '--tw-prose-bullets': 'var(--text)',
    '--tw-prose-quotes': 'var(--text)',
    '--tw-prose-captions': 'var(--text)',
    '--tw-prose-code': 'var(--text)',
    '--tw-prose-links': 'var(--brand-primary)',
    // Borders/rules: a translucent tint of the text color so they read on either bg.
    '--tw-prose-hr': 'color-mix(in srgb, var(--text) 20%, transparent)',
    '--tw-prose-quote-borders': 'color-mix(in srgb, var(--text) 30%, transparent)',
    '--tw-prose-td-borders': 'color-mix(in srgb, var(--text) 20%, transparent)',
    '--tw-prose-th-borders': 'color-mix(in srgb, var(--text) 30%, transparent)',
} as CSSProperties
