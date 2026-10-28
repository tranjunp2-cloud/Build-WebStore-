/**
 * TC-AIWB-66 — a refused publish: a field to fill ("Home → Hero → CtaButton 1 → url: This field
 * is required.") is a fix, not a retry — it carries where the field is (page, section, path) for
 * "Show"; a server/database failure stays a retry. The server names the section and the path in it.
 * Real: publishFailure, failingBlockField. Faked: nothing.
 */

import { describe, expect, it } from 'vitest'
import { PublishError, publishFailure } from '@/lib/editor/publish-failure'
import { failingBlockField } from '@/lib/sites/publish-site'

describe('refused publish [TC-AIWB-66]', () => {
    it('a required field → needs a fix, with the place to show (no retry)', () => {
        const err = publishFailure({
            error: {
                message: 'Publish failed',
                failures: [{
                    pageId: 7,
                    pageTitle: 'Home',
                    friendlyDetail: 'Home → Hero → CtaButton 1 → url: This field is required.',
                    blockId: 'blk_hero',
                    blockPath: 'ctaButtons.0.url',
                    validationErrors: [{ path: 'layout.1.ctaButtons.0.url', message: 'This field is required.' }],
                }],
            },
        }, 400)

        expect(err).toBeInstanceOf(PublishError)
        expect(err.needsFix).toBe(true)
        expect(err.message).toBe('Home → Hero → CtaButton 1 → url: This field is required.')
        expect(err.target).toEqual({ surface: 'block', pageId: '7', blockId: 'blk_hero', path: 'ctaButtons.0.url', where: 'Hero → CtaButton 1 → url' })
    })

    it('a database or server failure stays a retry, without a place', () => {
        const err = publishFailure({ error: { message: 'Publish failed', failures: [{ pageId: '7', errName: 'Error', errMsg: 'connection reset' }] } }, 500)

        expect(err.needsFix).toBe(false)
        expect(err.target).toBeUndefined()
        expect(publishFailure(null, 502).message).toBe('Server returned 502')
    })

    it('the server resolves the failing section by id (index-N without one) and the path inside it', () => {
        const layout = [{ blockType: 'navigation' }, { id: 'blk_hero', blockType: 'hero' }]

        expect(failingBlockField('layout.1.ctaButtons.0.url', layout)).toEqual({ blockId: 'blk_hero', blockPath: 'ctaButtons.0.url' })
        expect(failingBlockField('layout.0.links', layout)).toEqual({ blockId: 'index-0', blockPath: 'links' })
        expect(failingBlockField('seoTitle', layout)).toBeNull()
        expect(failingBlockField('layout.9.title', layout)).toBeNull()
    })
})
