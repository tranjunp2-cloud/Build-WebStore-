import { describe, expect, it, vi } from 'vitest'

// TC-AICP-55 — the copilot's read views of the shop's own content: blog posts read
// as the merchant and pinned to their workspace, article text without spacing the
// extractor made up. (Store products are read by store-product-tools.ts, tested in store-product-tools.test.ts.)

import { clipText, postPictures, postText, readPost, searchPosts } from '@/lib/ai-platform/agent-tools/content-tools'

const lexical = {
    root: {
        type: 'root',
        children: [
            { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Saving state' }] },
            {
                type: 'paragraph',
                children: [
                    { type: 'text', text: 'Keep it in ' },
                    { type: 'text', text: 'localStorage', format: 16 },
                    { type: 'text', text: '. See ' },
                    { type: 'link', children: [{ type: 'text', text: 'the guide' }] },
                    { type: 'text', text: ', then ship.' },
                ],
            },
        ],
    },
}

describe('content tools [TC-AICP-55]', () => {
    it('joins inline runs of a paragraph as written and marks headings', () => {
        const { text, headings } = postText(lexical)
        expect(clipText(text, 500)).toBe('## Saving state\nKeep it in localStorage. See the guide, then ship.')
        expect(headings).toEqual(['Saving state'])
    })

    it('reads HTML bodies without spaces before punctuation', () => {
        const { text, headings } = postText('<h2>Care</h2><p>Use <code>cold</code>, never <strong>hot</strong> water.</p>')
        expect(clipText(text, 500)).toBe('## Care\nUse cold, never hot water.')
        expect(headings).toEqual(['Care'])
    })

    it('searches posts as the merchant, inside their workspace only', async () => {
        const find = vi.fn(async () => ({ totalDocs: 1, docs: [{ id: 4, title: 'Batik care', slug: 'batik-care', status: 'draft' }] }))
        const user = { id: 1 }
        const result = await searchPosts({ find } as never, user, '7', { query: 'batik', status: 'draft', limit: 50 })

        expect(find).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'blogs',
                overrideAccess: false,
                user,
                limit: 10,
                where: { and: [{ tenant: { equals: 7 } }, { title: { like: 'batik' } }, { status: { equals: 'draft' } }] },
            }),
        )
        expect(result.items).toEqual([expect.objectContaining({ kind: 'blog_post', id: '4', title: 'Batik care', meta: '/blog/batik-care' })])
    })

    it('reads one post with SEO facts and returns null for another workspace’s id', async () => {
        const find = vi
            .fn()
            .mockResolvedValueOnce({
                docs: [{ id: 4, title: 'Batik care', status: 'draft', content: lexical, seo: { metaTitle: 'Batik care guide' }, thumbnail: { url: '/a.jpg', alt: '' } }],
            })
            .mockResolvedValueOnce({ docs: [] })

        const detail = await readPost({ find } as never, {}, '7', '4')
        expect(detail?.facts).toEqual(
            expect.arrayContaining([
                { label: 'Meta title', value: 'Batik care guide (16 chars)' },
                { label: 'Meta description', value: 'missing' },
                { label: 'Cover image', value: 'yes — no alt text' },
            ]),
        )
        expect(detail?.url).toBe('/blog/4')
        expect(detail?.media).toEqual([{ url: '/a.jpg', label: 'Cover' }])
        expect(await readPost({ find } as never, {}, '7', '99')).toBeNull()
    })

    it('finds pictures in a post body, same-origin or https only', () => {
        const body = {
            root: {
                children: [
                    { type: 'upload', value: { url: '/api/media/file/a.jpg', alt: 'Folded scarf' } },
                    { type: 'paragraph', children: [{ type: 'upload', value: { url: 'javascript:alert(1)' } }] },
                ],
            },
        }
        expect(postPictures(body)).toEqual([{ url: '/api/media/file/a.jpg', alt: 'Folded scarf' }])
        expect(postPictures('<p><img src="https://cdn.shop/b.webp" alt="B"><img src="//evil/x.png"></p>')).toEqual([{ url: 'https://cdn.shop/b.webp', alt: 'B' }])
    })
})
