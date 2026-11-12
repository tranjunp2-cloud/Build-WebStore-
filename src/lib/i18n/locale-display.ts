import { stripStructuralFields } from '@/lib/editor/structural-block-fields'
import { realFields } from '@/lib/i18n/template-content'

/**
 * One language of a site, from what is stored: the section as written in the
 * site's base language, then that language's copy over it. A page keeps its
 * copies in `pages.locale_content[sectionId][locale]`; the menu, footer and
 * widgets carry theirs inside the block (`_localeContent[locale]`). Structure
 * (variant, colours, language controls) always comes from the section itself.
 *
 * The editor canvas, the preview and the live site read a language through
 * this, so a language is never written into the section to be shown.
 */

/** `pages.locale_content`: section id → locale → that language's fields */
export type LocaleSlots = Record<string, Record<string, Record<string, unknown>>>

type Block = Record<string, unknown>

/** The brand the editor's template text is filled with (the site's name), to tell template filler from a translation. */
const DEFAULT_BRAND = 'Your Brand'

/** The brand to tell template filler by: the site's name. */
export const siteBrand = (site: { name?: unknown }): string => (typeof site.name === 'string' && site.name ? site.name : DEFAULT_BRAND)

/**
 * The block in `locale`, or null when it holds no copy in that language. Template filler in a copy
 * (`realFields`) is not a copy: it is generic text, never what the merchant wrote or a translation of it, so the
 * section keeps its own text there. `brand` is the site's name (the template is filled with it).
 */
export function localizedBlockOrNull<T extends object>(block: T, locale: string, slots?: LocaleSlots | null, brand: string = DEFAULT_BRAND): T | null {
    const raw = block as Block
    const id = raw.id === null || raw.id === undefined || raw.id === '' ? null : String(raw.id)
    const pageSlot = id ? realFields(raw.blockType, locale, slots?.[id]?.[locale], brand) : undefined
    if (pageSlot) return { ...block, ...stripStructuralFields(pageSlot) }
    const embedded = realFields(raw.blockType, locale, (raw._localeContent as Record<string, unknown> | undefined)?.[locale], brand)
    if (embedded) return { ...block, ...stripStructuralFields(embedded) }
    return null
}

/** The block in `locale`; as stored when it has no copy in that language. */
export function localizedBlock<T extends object>(block: T, locale: string, slots?: LocaleSlots | null, brand?: string): T {
    return localizedBlockOrNull(block, locale, slots, brand) ?? block
}

type Frame = { headerBlock?: unknown; footerBlock?: unknown; globalBlocks?: unknown }

const isBlock = (value: unknown): value is Block => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** A site and its page in one language: the page's sections, the menu, the footer and the widgets. */
export function localizedSiteAndPage<S extends Frame, P extends { layout?: unknown }>(
    site: S,
    page: P | null | undefined,
    locale: string,
    slots?: LocaleSlots | null,
    brand?: string,
): { site: S; page: P | null | undefined } {
    const globals = site.globalBlocks
    return {
        site: {
            ...site,
            ...(isBlock(site.headerBlock) ? { headerBlock: localizedBlock(site.headerBlock, locale, null, brand) } : {}),
            ...(isBlock(site.footerBlock) ? { footerBlock: localizedBlock(site.footerBlock, locale, null, brand) } : {}),
            ...(isBlock(globals)
                ? { globalBlocks: Object.fromEntries(Object.entries(globals).map(([key, value]) => [key, isBlock(value) ? localizedBlock(value, locale, null, brand) : value])) }
                : {}),
        },
        page:
            page && Array.isArray(page.layout)
                ? { ...page, layout: (page.layout as Block[]).map((block) => (block && typeof block === 'object' ? localizedBlock(block, locale, slots, brand) : block)) }
                : page,
    }
}

/** The menu, footer and widgets to save or publish: as written, each with its other languages inside. */
export function framesAsWritten<B extends object>(state: {
    headerBlock: B | null
    footerBlock: B | null
    globalBlocks: { cartWidget?: B | null; whatsappButton?: B | null; socialWidget?: B | null } | null
}): { headerBlock: B | null; footerBlock: B | null; globalBlocks: { cartWidget: B | null; whatsappButton: B | null; socialWidget: B | null } | null } {
    const g = state.globalBlocks
    return {
        headerBlock: state.headerBlock ?? null,
        footerBlock: state.footerBlock ?? null,
        globalBlocks: g ? { cartWidget: g.cartWidget ?? null, whatsappButton: g.whatsappButton ?? null, socialWidget: g.socialWidget ?? null } : null,
    }
}
