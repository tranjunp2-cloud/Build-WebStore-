import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { bindNativeDesign, generateNativePw1WithAI, NATIVE_BLOCKS } from '@/lib/migration/pw1-native-ai'
vi.mock('@/lib/ai/log-usage', () => ({ logAiUsage: vi.fn() }))
function fixture() {
    const source = { format: 'pw2-reconstruction-contract', version: '1.0.0', source: { url: 'https://source.example', storeId: '1', capturedAt: '2026-09-10', dumpHash: 'abc' }, site: { name: 'Tea', navigation: { blockType: 'navigation', links: [] }, footer: { blockType: 'footer', columns: [] } }, reconciliation: [], pages: [{ sourceId: '10', title: 'Home', slug: 'home', isHomepage: true, components: [
        { sourceId: '11', position: 1, kind: 'banner', block: { blockType: 'hero', headline: '', sourceLayout: { size: 'small', autoplay: false, interval: 3000, sourceComponentId: '11' }, slides: [{ headline: 'One', image: { url: 'https://source.example/1.jpg' }, ctaButtons: [{ label: 'Buy', url: '/products' }] }, { headline: 'Two', ctaButtons: [] }] } },
        { sourceId: '12', position: 2, kind: 'product_listing', block: { blockType: 'content-cards', variant: 'products', headline: 'Tea', sourceContent: { capturedAt: 'now', bindingStatus: 'captured-public-content', items: [{ sourceId: '8', title: 'Green tea', image: { url: 'https://source.example/tea.jpg' }, url: 'https://source.example/8', price: 'RM 8', summary: 'Original copy' }] } } },
        { sourceId: '13', position: 3, kind: 'rich_text', block: { blockType: 'rich-text', html: '<p>Before</p><iframe src="https://www.youtube.com/embed/abc"></iframe><p>After</p>' } },
    ] }] }
    const design = { theme: { primaryColor: '#335533', secondaryColor: '#fafafa', fontHeading: 'Inter', fontBody: 'Inter' }, navigationVariant: 'centered', footerVariant: 'simple', pages: [{ sourceId: '10', sections: [{ sourceId: '11', blockType: 'carousel', variant: 'images' }, { sourceId: '12', blockType: 'products-grid', variant: 'grid-4' }, { sourceId: '13', blockType: 'custom-html', variant: 'default' }] }] }
    return { source, design }
}
describe('[TC-F35.M18] AI chooses only existing PW2 blocks', () => {
    it('binds every source slide, card and video without new block types or lost content', () => {
        const { source, design } = fixture()
        const original = JSON.stringify(source)
        const result = bindNativeDesign(source, design)
        const blocks = result.pages![0].blocks
        expect(blocks.map(b => b.blockType)).toEqual(['navigation','carousel','products-grid','custom-html','video','custom-html','footer'])
        expect(blocks.every(b => (NATIVE_BLOCKS as readonly string[]).includes(b.blockType))).toBe(true)
        expect(blocks[1].items).toMatchObject([{ title: 'One', linkUrl: '/products', description: 'Buy' }, { title: 'Two' }])
        expect(blocks[2]).toMatchObject({ blockType: 'products-grid', headline: 'Tea' })
        expect(JSON.stringify(blocks[2])).not.toMatch(/Green tea|RM 8|source.example|projects|items/)
        expect(blocks[3].html).toContain('<p>Before</p>')
        expect(blocks[4].videoUrl).toBe('https://www.youtube.com/embed/abc')
        expect(blocks[5].html).toContain('<p>After</p>')
        expect(JSON.stringify(source)).toBe(original)
    })
    it('removes only the obsolete media wrapper instead of leaving an empty aspect-ratio spacer', () => {
        const { source, design } = fixture()
        source.pages[0].components[2].block.html = '<h2>Video</h2><figure class="media"><div style="height:0;padding-bottom:56%"><iframe src="https://www.youtube.com/embed/abc"></iframe></div></figure><p>After</p>'
        const result = bindNativeDesign(source, design)
        const html = result.pages![0].blocks.filter(b => b.blockType === 'custom-html').map(b => b.html).join('')
        expect(html).toContain('<h2>Video</h2>')
        expect(html).toContain('<p>After</p>')
        expect(html).not.toContain('padding-bottom:56%')
        expect(result.pages![0].blocks.filter(b => b.blockType === 'video')).toHaveLength(1)
    })
    it('[TC-F35.M19] rejects a presentation block for product listings', () => {
        const { source, design } = fixture(); design.pages[0].sections[1] = { sourceId: '12', blockType: 'portfolio-grid', variant: 'grid' }
        expect(() => bindNativeDesign(source, design)).toThrow('database-backed product block')
    })
    it('[TC-F35.M20] binds articles to Blog List without source post snapshots', () => {
        const { source, design } = fixture()
        source.pages[0].components[1].kind = 'article_listing'
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'blog-list', variant: 'cards' }
        const block = bindNativeDesign(source, design).pages![0].blocks[2]
        expect(block).toMatchObject({ blockType: 'blog-list', headline: 'Tea', limit: 3 })
        expect(JSON.stringify(block)).not.toMatch(/Green tea|source.example|projects|items|sourceContent/)
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'portfolio-grid', variant: 'grid' }
        expect(() => bindNativeDesign(source, design)).toThrow('database-backed blog block')
    })
    it('[TC-F35.M22] keeps a multi-slide hero as one PW2 Hero and rejects carousel or a single-slide variant', () => {
        const { source, design } = fixture()
        source.pages[0].components[0].block.sourceLayout!.size = 'hero'
        design.pages[0].sections[0] = { sourceId: '11', blockType: 'hero', variant: 'slideshow' }
        const blocks = bindNativeDesign(source, design).pages![0].blocks
        expect(blocks[1]).toMatchObject({ blockType: 'hero', variant: 'slideshow', slides: [{ headline: 'One', ctaButtons: [{ label: 'Buy', url: '/products' }] }, { headline: 'Two' }] })
        expect(blocks[1].sourceLayout).toBeUndefined()
        expect(blocks.filter(b=>b.blockType==='hero')).toHaveLength(1)
        design.pages[0].sections[0].blockType = 'carousel'
        expect(()=>bindNativeDesign(source, design)).toThrow('hero/small role')
        design.pages[0].sections[0] = { sourceId:'11', blockType:'hero', variant:'centered' }
        expect(()=>bindNativeDesign(source, design)).toThrow('slide count')
    })
    it('[TC-F35.M22] uses a native single-image hero with its original copy and CTA', () => {
        const { source, design } = fixture()
        source.pages[0].components[0].block.sourceLayout!.size = 'hero'
        source.pages[0].components[0].block.slides!.pop()
        design.pages[0].sections[0] = { sourceId:'11', blockType:'hero', variant:'fullscreen' }
        expect(bindNativeDesign(source, design).pages![0].blocks[1]).toMatchObject({blockType:'hero',variant:'fullscreen',headline:'One',image:{url:'https://source.example/1.jpg'},ctaButtons:[{label:'Buy',url:'/products'}]})
    })
    it('[TC-F35.M25] binds categories only to Carousel cards and preserves ordered items', () => {
        const { source, design } = fixture()
        source.pages[0].components[1].kind = 'category_listing'
        source.pages[0].components[1].block.variant = 'categories'
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'carousel', variant: 'cards' }
        expect(bindNativeDesign(source, design).pages![0].blocks[2]).toMatchObject({
            blockType: 'carousel', variant: 'cards', autoplay: false,
            items: [{ title: 'Green tea', linkUrl: 'https://source.example/8' }],
        })
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'portfolio-grid', variant: 'grid' }
        expect(() => bindNativeDesign(source, design)).toThrow('Category listings require Carousel cards')
    })
    it('rejects invented or reordered component identities', () => {
        const { source, design } = fixture(); design.pages[0].sections.reverse()
        expect(() => bindNativeDesign(source, design)).toThrow('order')
    })
    it('rejects the newly added blocks in AI output', () => {
        const { source, design } = fixture(); design.pages[0].sections[0].blockType = 'rich-text'
        expect(() => bindNativeDesign(source, design)).toThrow()
    })
    it('actually calls AI before binding and does not fallback on failed AI', async () => {
        const { source, design } = fixture()
        const create = vi.fn().mockResolvedValue({ model: 'test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(design) } }] })
        const client = { chat: { completions: { create } } } as unknown as OpenAI
        const output = await generateNativePw1WithAI(client, source)
        expect(create).toHaveBeenCalledOnce()
        expect(output.effectiveGenMode).toBe('ai-first')
        create.mockRejectedValueOnce(new Error('AI unavailable'))
        await expect(generateNativePw1WithAI(client, source)).rejects.toThrow('AI unavailable')
    })
})
