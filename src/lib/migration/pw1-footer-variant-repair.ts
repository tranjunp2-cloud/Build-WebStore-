import { isBrandWithColumns } from './pw1-footer-brand'

/** Destination-site facts the migration turned into footer brand info (PW1 SEO description and contact details). */
export type FooterRepairSite = {
    metaDescription?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
}

export type FooterRepair =
    | { changed: false; reason: 'no-footer' | 'rule-not-matched' | 'already-correct' }
    | { changed: true; footer: Record<string, unknown>; from: string; to: 'dark-gradient' }

const clean = (value?: string | null) => (typeof value === 'string' ? value.trim() : '')

/**
 * Re-applies the binder's footer rule to an already generated footer: brand info beside three or more
 * link columns uses dark-gradient. Source facts come from the destination site, so no PW1 input or AI
 * call is needed. Only the variant changes (dark-gradient shows the description and contact from the
 * site); a footer already on dark-gradient is never touched.
 */
export function repairFooterVariant(footer: unknown, site: FooterRepairSite): FooterRepair {
    if (!footer || typeof footer !== 'object' || (footer as { blockType?: unknown }).blockType !== 'footer') return { changed: false, reason: 'no-footer' }
    const current = footer as Record<string, unknown>
    const source = {
        tagline: clean(current.tagline as string | undefined),
        storeDescription: clean(site.metaDescription),
        showContactInfo: Boolean(clean(site.phone) || clean(site.email) || clean(site.address)),
        columns: current.columns,
    }
    // A footer already on dark-gradient is left exactly as it is
    if (current.variant === 'dark-gradient') return { changed: false, reason: 'already-correct' }
    if (!isBrandWithColumns(source)) return { changed: false, reason: 'rule-not-matched' }
    return { changed: true, footer: { ...current, variant: 'dark-gradient' }, from: String(current.variant ?? 'simple'), to: 'dark-gradient' }
}
