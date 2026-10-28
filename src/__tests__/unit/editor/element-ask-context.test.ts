/**
 * TC-AIWB-61 — Ask AI on an element: what the chat carries for it — kind (a label inside a button
 * list is a button), the section id the server uses, the field path, a short label and what it
 * says now (tags dropped). A picture's path is its picture field, not its address.
 * Real: textElement, sectionElement, imageElement, plainLabel, blockTypeLabel. Faked: nothing.
 */

import { describe, expect, it } from 'vitest'
import { blockTypeLabel, imageElement, plainLabel, sectionElement, textElement } from '@/components/editor/agent/element-context'

const hero = { id: 'blk_hero', blockType: 'hero', headline: 'Bộ sưu tập mới', ctaButtons: [{ label: 'Mua ngay' }] }

describe('element context for Ask AI [TC-AIWB-61]', () => {
    it('a button label is a button; other text is text', () => {
        expect(textElement({ block: hero, blockIndex: 1, fieldPath: ['ctaButtons', 0, 'label'], value: 'Mua ngay', pageId: '7' })).toEqual({
            kind: 'button',
            label: 'Mua ngay',
            pageId: '7',
            blockId: 'blk_hero',
            path: 'ctaButtons.0.label',
            value: 'Mua ngay',
        })
        expect(textElement({ block: hero, blockIndex: 1, fieldPath: ['headline'], value: '<b>Bộ sưu tập</b>&nbsp;mới', pageId: null })).toMatchObject({
            kind: 'text',
            label: 'Bộ sưu tập mới',
            path: 'headline',
        })
    })

    it('a section without an id is addressed like the server does (index-N) and labelled by its type', () => {
        expect(sectionElement({ block: { blockType: 'products-featured', title: 'Được yêu thích nhất' }, blockIndex: 3, pageId: '7' })).toEqual({
            kind: 'section',
            label: 'Products featured',
            pageId: '7',
            blockId: 'index-3',
            value: 'Được yêu thích nhất',
        })
    })

    it('a picture: the picture field (not its url) and its file name when there is no alt', () => {
        const element = imageElement({ block: hero, blockIndex: 1, fieldPath: ['items', 2, 'image', 'url'], src: 'https://cdn.x/media/hijab%20blue.jpg', pageId: '7' })
        expect(element).toMatchObject({ kind: 'image', path: 'items.2.image', label: 'hijab blue.jpg', value: 'https://cdn.x/media/hijab%20blue.jpg' })
        expect(imageElement({ block: hero, blockIndex: 1, fieldPath: null, src: '/x.png', alt: 'Hero photo', pageId: null })).not.toHaveProperty('path')
    })

    it('a numeric Payload page id goes out as a string (the chat refused numbers)', () => {
        expect(sectionElement({ block: { id: 'blk_f', blockType: 'features' }, blockIndex: 2, pageId: 7 })).toMatchObject({ pageId: '7', blockId: 'blk_f' })
        expect(textElement({ block: hero, blockIndex: 1, fieldPath: ['headline'], value: 'x', pageId: '' })).not.toHaveProperty('pageId')
    })

    it('labels are short, one line', () => {
        expect(plainLabel('a'.repeat(60))).toHaveLength(40)
        expect(plainLabel('a'.repeat(60)).endsWith('…')).toBe(true)
        expect(blockTypeLabel('featureComparison')).toBe('Feature comparison')
    })
})
