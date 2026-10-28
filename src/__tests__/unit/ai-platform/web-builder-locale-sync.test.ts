/**
 * TC-AIWB-39 — a copilot page edit keeps the editor's base-language copy of the section in step
 * (locale_content[section][base]), so the editor canvas shows the edit like Preview does; undo puts it back.
 * Real: syncBaseLocaleSlots. Faked: nothing (the hero below is the dev-DB section that showed the bug).
 */

import { describe, expect, it } from 'vitest'
import { syncBaseLocaleSlots } from '@/lib/ai-platform/site/site-locale-sync'

const hero = (label: string, url = '') => ({
    id: 'hero_1',
    blockType: 'hero',
    headline: 'Bộ sưu tập mới',
    ctaButtons: [{ id: 'btn_1', url, label, style: 'primary' }],
})
const faq = { id: 'faq_1', blockType: 'faq', title: 'FAQ' }

describe('syncBaseLocaleSlots [TC-AIWB-39]', () => {
    it('gives the base-language slot the edited field value', () => {
        const content = { hero_1: { en: {}, ms: { ctaButtons: [{ url: '', label: 'New Button', style: 'primary' }] } } }

        const next = syncBaseLocaleSlots(content, 'ms', [hero('New Button'), faq], [hero('Mua ngay', '/products'), faq])

        expect(next?.hero_1?.ms).toEqual({ ctaButtons: [{ id: 'btn_1', url: '/products', label: 'Mua ngay', style: 'primary' }] })
        expect(next?.hero_1?.en).toEqual({})
    })

    it('leaves translations, fields the slot does not hold and unchanged sections alone', () => {
        const content = {
            hero_1: { en: { ctaButtons: [{ label: 'Shop now' }] }, ms: { headline: 'Bộ sưu tập mới' } },
            faq_1: { ms: { title: 'Soalan' } },
        }

        const next = syncBaseLocaleSlots(content, 'ms', [hero('New Button'), faq], [hero('Mua ngay'), faq])

        expect(next).toBeNull()
    })

    it('undo (the section back as it was) puts the slot back too', () => {
        const content = { hero_1: { ms: { ctaButtons: [{ label: 'New Button' }] } } }
        const applied = syncBaseLocaleSlots(content, 'ms', [hero('New Button')], [hero('Mua ngay')])!

        const undone = syncBaseLocaleSlots(applied, 'ms', [hero('Mua ngay')], [hero('New Button')])

        expect(undone?.hero_1?.ms).toEqual({ ctaButtons: [{ id: 'btn_1', url: '', label: 'New Button', style: 'primary' }] })
    })

    it('drops a slot field the section no longer has, and skips removed or new sections', () => {
        const content = { hero_1: { ms: { headline: 'Old' } }, gone_1: { ms: { title: 'x' } } }
        const { headline: _drop, ...noHeadline } = hero('New Button')

        const next = syncBaseLocaleSlots(content, 'ms', [hero('New Button'), { id: 'gone_1', blockType: 'faq', title: 'x' }], [noHeadline, faq])

        expect(next?.hero_1?.ms).toEqual({})
        expect(next?.gone_1).toEqual({ ms: { title: 'x' } })
    })
})
