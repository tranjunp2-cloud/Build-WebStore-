/**
 * TC-AIWB-38 — the editor copilot's context pin passes the agent's ContextPinSchema even when
 * Payload hands the editor numeric ids (the pages API), and carries the selected section.
 * Real: editorPin, ContextPinSchema. Faked: nothing.
 */

import { describe, expect, it } from 'vitest'
import { ContextPinSchema } from '@ech/agent-core'
import { editorPin } from '@/components/editor/agent/editor-agent-context'

describe('editorPin [TC-AIWB-38]', () => {
    it('turns a numeric page id into a string the pin schema accepts', () => {
        const pin = editorPin({ siteId: '7', pageId: 42 as unknown as string, pageTitle: 'Home' })

        expect(ContextPinSchema.safeParse(pin).success).toBe(true)
        expect(pin.entity).toEqual({ kind: 'site_page', id: '42', label: 'Home' })
        expect(pin.filters).toEqual({ site: '7' })
    })

    it('pins the selected section with its name', () => {
        const pin = editorPin({ siteId: '7', pageId: '42', blockId: 'blk_1', blockLabel: 'Hero' })

        expect(ContextPinSchema.safeParse(pin).success).toBe(true)
        expect(pin.filters).toEqual({ site: '7', section: 'blk_1', sectionName: 'Hero' })
    })

    it('has no entity without a page', () => {
        expect(editorPin({ siteId: '7', pageId: '' }).entity).toBeUndefined()
        expect(editorPin({ siteId: '7', pageId: null }).entity).toBeUndefined()
    })
})

// TC-AIWB-111 — the copilot knows the website's languages without a read: the pin carries them
// (primary first) and the language the pages are written in, within the 6 filters the Context line shows
describe('the pin carries the website languages [TC-AIWB-111]', () => {
    it('lists the languages, primary first, and the written-in language, still a valid pin', () => {
        const pin = editorPin({ siteId: '7', pageId: '42', language: 'ms', languages: ['en', 'ms'], writtenIn: 'en', blockId: 'blk_1', blockLabel: 'Hero' })

        expect(ContextPinSchema.safeParse(pin).success).toBe(true)
        expect(pin.filters).toEqual({ site: '7', editingLanguage: 'ms', siteLanguages: 'en (primary), ms', pagesWrittenIn: 'en', section: 'blk_1', sectionName: 'Hero' })
        expect(Object.keys(pin.filters)).toHaveLength(6)
    })
})
