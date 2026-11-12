import { describe, expect, it } from 'vitest'
import { restoreTemplateRenderMedia } from '@/lib/editor/template-render-media'

describe('restoreTemplateRenderMedia', () => {
    it('hydrates a committed snapshot by ID, including nested rows and canonical logos', () => {
        const photo = { id: 42, url: '/uploads/customer.jpg', alt: 'Customer' }
        const source = { blocks: [{ image: photo }] }
        const persisted = { site: { headerBlock: { logo: 42 }, footerBlock: { logo: 42 } },
            page: { layout: [{ id: 42, image: 42, items: [{ avatar: 42, count: 42 }],
                images: [{ image: 42, caption: 'New caption' }] }] } }
        const rendered = restoreTemplateRenderMedia(persisted, [source])
        expect(rendered.site.headerBlock.logo).toEqual(photo)
        expect(rendered.site.footerBlock.logo).toEqual(photo)
        expect(rendered.page.layout[0]).toEqual({ id: 42, image: photo,
            items: [{ avatar: photo, count: 42 }], images: [{ image: photo, caption: 'New caption' }] })
        expect(persisted.page.layout[0].image).toBe(42)
        expect(source.blocks[0].image).toEqual(photo)
    })

    it('does not resurrect cleared media or substitute an unrelated ID', () => {
        const result = restoreTemplateRenderMedia({ image: null, logo: 99, avatar: 42 },
            [{ image: { id: 42, url: '/uploads/customer.jpg' } }])
        expect(result.image).toBeNull()
        expect(result.logo).toBe(99)
        expect(result.avatar).toEqual({ id: 42, url: '/uploads/customer.jpg' })
    })
})
