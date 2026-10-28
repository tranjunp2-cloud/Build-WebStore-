import { beforeEach, describe, expect, it, vi } from 'vitest'

// TC-AICP-69 — applying an edit / status change of an existing blog post: refused when the post changed since
// the draft (nothing written), previous values saved as undo, the article keeps its pictures, and a trash the
// system ignored is never reported done. (Store-product edits: store-product-apply.test.ts.)

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn(async () => ({ plan: 'BUSINESS' })),
    canUse: vi.fn(async () => true),
}))

import { getPayload } from 'payload'
import { applyBlogStatus, applyBlogUpdate, keepPictures } from '@/lib/ai-platform/appliers/blog-edits'

const actor = { user: { id: 3 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never

describe('blog edits — apply [TC-AICP-69]', () => {
    it('keeps the article pictures when the new text has none', () => {
        const old = '<p>a</p><img src="/m/1.jpg" alt=""><p><em>Pixabay</em></p><p>b</p><p>c</p>'
        const next = keepPictures(old, '<p>one</p><p>two</p><p>three</p><p>four</p>')
        expect(next).toContain('<img src="/m/1.jpg" alt=""><p><em>Pixabay</em></p>')
        expect(next.indexOf('<img')).toBeGreaterThan(next.indexOf('one'))
        expect(keepPictures(old, '<p>x</p><img src="/n.jpg">')).toBe('<p>x</p><img src="/n.jpg">')
    })

    it('blog: refuses a stale edit, saves the old fields as undo, and never reports an ignored trash', async () => {
        const doc = { id: 4, title: 'Batik care', status: 'draft', content: '<p>old</p>', updatedAt: 't1', seo: { metaTitle: 'Old' }, thumbnail: null }
        const find = vi.fn(async () => ({ docs: [doc] }))
        const update = vi.fn(async () => ({ updatedAt: 't2' }))
        vi.mocked(getPayload).mockResolvedValue({ find, update } as never)

        await expect(applyBlogUpdate({ id: '4', base: 't0', changes: { seoTitle: 'New SEO title' } }, actor)).rejects.toMatchObject({ status: 409 })
        expect(update).not.toHaveBeenCalled()

        const result = await applyBlogUpdate({ id: '4', base: 't1', changes: { seoTitle: 'New SEO title' } }, actor)
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { seo: { metaTitle: 'New SEO title' } }, overrideAccess: false, user: { id: 3 } }))
        expect(result.undo).toMatchObject({ kind: 'blog.restore_fields', payload: { id: '4', base: 't2', data: { seo: { metaTitle: 'Old' } } } })

        // the CMS ignored deletedAt: the post is still there → error, not "done"
        await expect(applyBlogStatus({ id: '4', base: { status: 'draft', removed: false }, to: 'trash' }, actor)).rejects.toMatchObject({
            status: 409,
            message: 'The blog trash is not available right now. Nothing was removed.',
        })
    })
})
