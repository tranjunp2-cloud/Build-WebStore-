import { resolveCtaSlugFromLinks, resolvePricingPlanCta, type NavPageLike } from '@/lib/navigation-url'
import type { CTAConfig } from '@/blocks/cta/config'
import type { BlockData } from '@/store/editorStore'

/**
 * GH-1359 — Resolve a freshly-inserted block's hardcoded CTA placeholders
 * (`#contact`, `#about`, `#`) to canonical internal page slugs at manual
 * drag/add time, mirroring the AI-gen `patchPageCtaUrls` pass.
 *
 * - Navigation CTAs (hero `ctaButtons`): resolve to a matching page slug; drop
 *   the button when no page matches (per-button hide, never per-block).
 * - Action CTAs (pricing `plans[].ctaUrl`): fall back to `/contact` on no-match
 *   so the buy button is never lost (every seed template ships `/contact`).
 *
 * Pure & React-free. Returns a new object; non-CTA blocks pass through.
 */

function pagesToLinks(pages: NavPageLike[] | null | undefined): Array<{ url: string }> {
    if (!Array.isArray(pages)) return []
    return pages.flatMap(p => {
        if (p?.isHomepage) return [{ url: '/' }]
        const raw = (p?.slug ?? '').trim()
        if (!raw) return []
        return [{ url: raw.startsWith('/') ? raw : `/${raw}` }]
    })
}

/**
 * Detection is by field presence, not blockType, so this works on both the
 * base block (`blockType: 'hero'`) AND the locale-variant content seeded into
 * `__localeInit.en/ms` (which carries `ctaButtons`/`plans` but no `blockType`).
 * Only hero content carries `ctaButtons`; only pricing carries `plans`.
 */
export function patchBlockCtaUrls<T extends Record<string, unknown>>(
    block: T,
    pages: NavPageLike[] | null | undefined,
): T {
    const links = pagesToLinks(pages)
    const b = block as Record<string, unknown>

    // Hero (also cta/banner → normalized to hero blockType): navigation CTAs.
    if (Array.isArray(b.ctaButtons)) {
        return {
            ...block,
            ctaButtons: (b.ctaButtons as Array<Record<string, unknown>>).flatMap(btn => {
                const url = resolveCtaSlugFromLinks(btn.url, links)
                return url ? [{ ...btn, url }] : []
            }),
        }
    }

    // Pricing: action CTAs — keep the button, default to /contact, sync action
    // type. Shared with AI-gen via resolvePricingPlanCta (DRY).
    if (Array.isArray(b.plans)) {
        return {
            ...block,
            plans: (b.plans as Array<Record<string, unknown>>).map(p => resolvePricingPlanCta(p, links)),
        }
    }

    // GH-1412 — CTA block (`ctaUrl`/`secondaryCtaUrl` string fields): primary CTA
    // is the block's whole point → keep it, default to /contact on no-match
    // (like pricing). Optional secondary CTA → drop both label+url when unresolved.
    if (typeof b.ctaUrl === 'string' && !Array.isArray(b.ctaButtons) && !Array.isArray(b.plans)) {
        const next = { ...block } as Record<string, unknown>
        next.ctaUrl = resolveCtaSlugFromLinks(b.ctaUrl, links) || '/contact'
        if (typeof b.secondaryCtaUrl === 'string') {
            const secondary = resolveCtaSlugFromLinks(b.secondaryCtaUrl, links)
            if (secondary) {
                next.secondaryCtaUrl = secondary
            } else {
                delete next.secondaryCtaUrl
                delete (next as Partial<CTAConfig>).secondaryCtaLabel
            }
        }
        return next as T
    }

    return block
}

/**
 * Patch the `{ en, ms }` locale-variant slots produced by
 * `normalizeAddSectionBlock` (`__localeInit`). Each slot is block content
 * without `blockType`, so it relies on `patchBlockCtaUrls`' field detection.
 * Returns new slot objects — assign back before `initLocaleFromBlock`.
 */
export function patchLocaleInitCtaUrls(
    localeInit: { en: Record<string, unknown>; ms: Record<string, unknown> },
    pages: NavPageLike[] | null | undefined,
): { en: Record<string, unknown>; ms: Record<string, unknown> } {
    return {
        en: patchBlockCtaUrls(localeInit.en, pages),
        ms: patchBlockCtaUrls(localeInit.ms, pages),
    }
}
