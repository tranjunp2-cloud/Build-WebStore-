/**
 * The body of an editor draft save (PATCH /api/sites/:id/save), built in ONE place.
 *
 * Autosave (after an edit, Undo/Redo, an assistant change) and the explicit save used to build their own
 * bodies, and only the explicit one carried the language copies. A save without them left the stored copy of
 * the old text behind, and the page showed it again after a reload (the copy wins on the canvas). Both paths
 * now send the same body.
 */

type BlockLike = { blockType: string; [key: string]: unknown }
type LocaleOverrides = Record<string, Record<string, Record<string, unknown>>>

export type SavePayloadState = {
    blocks: BlockLike[]
    theme: unknown
    headerBlock: BlockLike | null
    footerBlock: BlockLike | null
    globalBlocks: {
        cartWidget: BlockLike | null
        whatsappButton: BlockLike | null
        socialWidget: BlockLike | null
    } | null
    localeOverrides: LocaleOverrides
    activeLocale: string
    draftVersion: string | null
}

/** The draft revision to send with a save (`base`); none known → the save goes through unchecked. */
export function draftBase(state: { draftVersion: string | null }): { base?: string } {
    return state.draftVersion ? { base: state.draftVersion } : {}
}

export function buildSavePayload(state: SavePayloadState): Record<string, unknown> {
    return {
        // the sections as written in the base language — never the language on screen: each other language
        // lives in its own copy (localeContent, _localeContent)
        blocks: state.blocks,
        theme: state.theme,
        // header, footer and widgets as written too, their other languages inside (_localeContent)
        headerBlock: state.headerBlock ?? null,
        footerBlock: state.footerBlock ?? null,
        // omitting globalBlocks keeps the stored value for legacy sites that never set them (no accidental wipe)
        ...(state.globalBlocks !== null && {
            globalBlocks: {
                cartWidget: state.globalBlocks.cartWidget ?? null,
                whatsappButton: state.globalBlocks.whatsappButton ?? null,
                socialWidget: state.globalBlocks.socialWidget ?? null,
            },
        }),
        // F-26: the language copies travel with the sections they belong to
        ...(Object.keys(state.localeOverrides).length > 0 && { localeContent: state.localeOverrides }),
        // F-26: the language on screen, so a reload restores it (only en/ms are stored in Sites.locale)
        ...((state.activeLocale === 'en' || state.activeLocale === 'ms') && { locale: state.activeLocale }),
        isDraft: true,
        ...draftBase(state),
    }
}
