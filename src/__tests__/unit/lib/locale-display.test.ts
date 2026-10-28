/**
 * TC-AIWB-108 — a language is read, never written into the section: the page keeps its sections
 * as written (base language) and each other language in its own copy; the editor canvas, the
 * preview and the live site show one language through lib/i18n/locale-display. What is saved and
 * published is as written (framesAsWritten), so viewing Malay can no longer replace the English page.
 * Real: localizedBlock, localizedBlockOrNull, localizedSiteAndPage, framesAsWritten. Faked: nothing.
 */

import { describe, expect, it } from 'vitest'
import { framesAsWritten, localizedBlock, localizedBlockOrNull, localizedSiteAndPage, type LocaleSlots } from '@/lib/i18n/locale-display'

const hero = { id: 'blk_hero', blockType: 'hero', variant: 'split', headline: 'Simple care. Beautiful skin.', subheadline: 'Gentle botanicals.' }
const slots: LocaleSlots = { blk_hero: { ms: { headline: 'Penjagaan mudah.', variant: 'centered' }, en: {} } }
const header = {
    blockType: 'navigation',
    links: [{ label: 'Home', url: '/' }],
    primaryLocale: 'en',
    _localeContent: { ms: { links: [{ label: 'Laman Utama', url: '/' }] } },
}

describe('one language of a page [TC-AIWB-108]', () => {
    it("puts the language's copy over the section and keeps its structure", () => {
        expect(localizedBlock(hero, 'ms', slots)).toEqual({ ...hero, headline: 'Penjagaan mudah.' })
        expect(localizedBlock(hero, 'en', slots)).toBe(hero)
        expect(localizedBlockOrNull(hero, 'en', slots)).toBeNull()
    })

    it('reads the menu and footer from the copy they carry', () => {
        expect(localizedBlock(header, 'ms').links).toEqual([{ label: 'Laman Utama', url: '/' }])
        expect(localizedBlock(header, 'en')).toBe(header)
    })

    it('localizes the page sections, the menu, the footer and the widgets together', () => {
        const site = { id: 1, headerBlock: header, footerBlock: null, globalBlocks: { cartWidget: { blockType: 'cartWidget', _localeContent: { ms: { label: 'Troli' } } } } }

        const { site: shownSite, page } = localizedSiteAndPage(site, { id: 5, layout: [hero] }, 'ms', slots)

        expect((page?.layout as Array<typeof hero>)[0]!.headline).toBe('Penjagaan mudah.')
        expect((shownSite.headerBlock as typeof header).links[0]!.label).toBe('Laman Utama')
        expect((shownSite.globalBlocks as { cartWidget: { label?: string } }).cartWidget.label).toBe('Troli')
        expect(site.headerBlock.links[0]!.label).toBe('Home')
    })

    it('saves and publishes the menu, footer and widgets as written, their languages inside', () => {
        const frames = framesAsWritten({ headerBlock: header, footerBlock: null, globalBlocks: { cartWidget: null } })

        expect(frames.headerBlock).toBe(header)
        expect(frames.globalBlocks).toEqual({ cartWidget: null, whatsappButton: null, socialWidget: null })
    })
})
