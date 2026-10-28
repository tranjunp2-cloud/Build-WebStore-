/**
 * The editor's template text (add-section defaults) as a yardstick: is a block's text still the template's
 * (untouched filler, in any website language) or the merchant's own?
 *
 * Template text is generic copy, never a translation of what the merchant wrote. Two rules rest on it:
 * a saved section shows the merchant's own text in a language with no copy yet, except fields still holding
 * template text, which take the template of that language (`templatePatch`); and a language copy that is
 * template text counts as missing, not as a translation (`isTemplateCopy`).
 */
import { type AddSectionLocale, resolveBlockContent } from '@/lib/ai/add-section-content'

const LOCALES: readonly AddSectionLocale[] = ['en', 'ms']

/** The template of `blockType` in every website language, with the brand filled in (also the placeholder brand). */
function templates(blockType: string, brand: string): Array<Record<string, unknown>> {
    return LOCALES.flatMap((locale) => [...new Set([brand, 'Your Brand'])].map((name) => resolveBlockContent(blockType, locale, name).content))
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : value)

/** Fields of `block` that still hold template text, with the template text of `locale` for them. */
export function templatePatch(block: Record<string, unknown>, locale: AddSectionLocale, brand: string): Record<string, unknown> {
    const blockType = String(block.blockType ?? '')
    const target = resolveBlockContent(blockType, locale, brand).content
    const known = templates(blockType, brand)
    return Object.fromEntries(
        Object.entries(target).filter(([key]) => block[key] !== undefined && known.some((template) => sameValue(template[key], block[key]))),
    )
}

/**
 * Whether a language copy is template text: at least half of the top-level texts the template of `locale` and the
 * copy share are the template's own (a model rewording one of them still leaves the others). A real translation
 * matches only by coincidence, and redoing one costs a single call.
 */
export function isTemplateCopy(blockType: string, locale: AddSectionLocale, slot: Record<string, unknown>, brand: string): boolean {
    for (const name of new Set([brand, 'Your Brand'])) {
        const template = resolveBlockContent(blockType, locale, name).content
        const shared = Object.entries(template).filter(([key, value]) => typeof value === 'string' && value.trim() && typeof slot[key] === 'string')
        const same = shared.filter(([key, value]) => trimmed(slot[key]) === trimmed(value)).length
        if (shared.length > 0 && same >= Math.ceil(shared.length / 2)) return true
    }
    return false
}

/** The template language of a site written in `written`: the editor has templates for en and ms only (others use en). */
export const templateLocaleOf = (written: string | null | undefined): AddSectionLocale => (written === 'ms' ? 'ms' : 'en')

/** Whether `locale` is a language the editor has templates for (the only ones a template copy can be in). */
export const isTemplateLocale = (locale: string): locale is AddSectionLocale => (LOCALES as readonly string[]).includes(locale)

/**
 * Whether a language slot of a section is template filler and not a translation: the slot of `locale` matches the
 * template of `locale` (isTemplateCopy). Slots of languages without templates are never template copies.
 */
export function isTemplateSlot(blockType: unknown, locale: string, slot: unknown, brand: string): boolean {
    if (!isTemplateLocale(locale) || typeof blockType !== 'string' || !blockType) return false
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return false
    return isTemplateCopy(blockType, locale, slot as Record<string, unknown>, brand)
}

/**
 * What of a language copy is the merchant's own: the copy itself when it is a translation, and when it is mostly
 * template text (`isTemplateSlot`) only its texts that differ from the template (a hand edit of one headline in
 * a seeded copy). Lists and other fields of such a copy are template filler (their links were rewritten when the
 * section was added, so they no longer match the template). Undefined = nothing of it is the merchant's.
 */
export function realFields(blockType: unknown, locale: string, slot: unknown, brand: string): Record<string, unknown> | undefined {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot) || Object.keys(slot).length === 0) return undefined
    const copy = slot as Record<string, unknown>
    if (!isTemplateSlot(blockType, locale, copy, brand)) return copy
    const templates = [...new Set([brand, 'Your Brand'])].map((name) => resolveBlockContent(String(blockType), locale as AddSectionLocale, name).content)
    const own = Object.fromEntries(
        Object.entries(copy).filter(([key, value]) => typeof value === 'string' && value.trim() && !templates.some((template) => trimmed(template[key]) === value.trim())),
    )
    return Object.keys(own).length > 0 ? own : undefined
}

/** Whether a section's text is still the editor's template in some language (nothing the merchant wrote or translated). */
export function isTemplateText(blockType: string, content: Record<string, unknown>, brand: string): boolean {
    return LOCALES.some((locale) => isTemplateCopy(blockType, locale, content, brand))
}

/**
 * A page's translations (`section id → locale → fields`) without the template text, given each section's type
 * (`realFields`). What goes live: template text is never a translation, so visitors get the written language there.
 */
export function withoutTemplateCopies(
    slots: Record<string, Record<string, Record<string, unknown>>>,
    blockTypes: ReadonlyMap<string, string>,
    brand: string,
): Record<string, Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, Record<string, unknown>>> = {}
    for (const [id, locales] of Object.entries(slots)) {
        if (!locales || typeof locales !== 'object') continue
        const kept = Object.fromEntries(
            Object.entries(locales).flatMap(([locale, slot]) => {
                const own = realFields(blockTypes.get(id), locale, slot, brand)
                return own ? [[locale, own]] : []
            }),
        )
        if (Object.keys(kept).length > 0) out[id] = kept
    }
    return out
}
