import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { pw1DesignDirection } from '@/lib/migration/pw1-design-direction'
import { NavigationConfigSchema } from '@/blocks/navigation/config'
import { FooterConfigSchema } from '@/blocks/footer/config'
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
    it('[TC-F35.M25] binds categories to native cards and portfolio layouts with ordered items', () => {
        const { source, design } = fixture()
        source.pages[0].components[1].kind = 'category_listing'
        source.pages[0].components[1].block.variant = 'categories'
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'carousel', variant: 'cards' }
        expect(bindNativeDesign(source, design).pages![0].blocks[2]).toMatchObject({
            blockType: 'carousel', variant: 'cards', autoplay: false,
            items: [{ title: 'Green tea', linkUrl: 'https://source.example/8' }],
        })
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'portfolio-grid', variant: 'grid' }
        expect(bindNativeDesign(source, design).pages![0].blocks[2]).toMatchObject({blockType:'portfolio-grid',variant:'grid',projects:[{title:'Green tea',linkUrl:'https://source.example/8',image:{url:'https://source.example/tea.jpg'},description:'Original copy\nRM 8'}]})
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
        const brandEvidence = { status: 'observed', url: source.source.url, capturedAt: '2026-09-16', colors: [{ color: '#335533', score: 5, roles: ['cta'] }], screenshot: 'test-jpeg' }
        const output = await generateNativePw1WithAI(client, { ...source, site: { ...source.site, brandEvidence } })
        expect(create).toHaveBeenCalledOnce()
        const request = create.mock.calls[0][0]
        const context = JSON.parse(request.messages[1].content)
        expect(context.brandEvidence.colors).toEqual(brandEvidence.colors)
        expect(context.brandEvidence.screenshot).toBeUndefined()
        expect(request.messages).toHaveLength(2)
        expect(context.designDirection).toEqual(pw1DesignDirection(source.source.storeId))
        expect(context.footer).toEqual(source.site.footer)
        expect(context.navigation).toEqual(source.site.navigation)
        expect(context.allowedFooterVariants).toEqual(FooterConfigSchema.shape.variant.removeDefault().options)
        expect(output.effectiveGenMode).toBe('ai-first')
        create.mockRejectedValueOnce(new Error('AI unavailable'))
        await expect(generateNativePw1WithAI(client, source)).rejects.toThrow('AI unavailable')
    })
})

it('[TC-F35.M18] binds distinct homepage records without dropping a duplicate URL', () => {
    const {source, design} = fixture()
    source.pages.push({...source.pages[0], sourceId:'20', components:[]})
    design.pages.push({sourceId:'20', sections:[]})
    const result = bindNativeDesign(source, design)
    expect(result.pages).toHaveLength(2)
    expect(result.pages!.map(p => p.slug)).toEqual(['home','home'])
    expect(result.pages!.every(p => p.isHomepage)).toBe(true)
})

it.each(FooterConfigSchema.shape.variant.removeDefault().options)('[TC-F35.M18] binds native footer variant %s and preserves source content on every page', variant => {
    const {source, design} = fixture()
    const footer = {...source.site.footer, tagline:'Source tagline', copyrightText:'Source copyright', columns:[{title:'Links',links:[{label:'Contact',url:'/contact'}]}]}
    const result = bindNativeDesign({...source,site:{...source.site,footer}}, {...design,footerVariant:variant})
    for (const page of result.pages!) expect(page.blocks.at(-1)).toMatchObject({...footer,variant})
})

it.each(NavigationConfigSchema.shape.variant.removeDefault().options)('[TC-F35.M18] preserves navigation content with native %s variant', variant => {
    const {source, design} = fixture()
    const result = bindNativeDesign(source, {...design,navigationVariant:variant})
    expect(result.pages![0].blocks[0]).toMatchObject({...source.site.navigation,variant})
})
it('[TC-F35.M18] uses stable, varied store directions with native preferences', () => {
    const directions = Array.from({length:100}, (_, i) => pw1DesignDirection(String(i)))
    expect(new Set(directions.map(d => d.name)).size).toBe(6)
    expect(pw1DesignDirection('253')).toEqual(pw1DesignDirection('253'))
    for (const d of directions) {
        expect(d.allowedNavigationVariants).toContain(d.navigation)
        expect(d.allowedFooterVariants).toContain(d.footer)
    }
})

it.each(['magazine','cards-overlay','parallax'])('[TC-F35.M22] preserves single banner content using %s', variant => {
    const {source,design}=fixture()
    source.pages[0].components[0].block.sourceLayout!.size='hero'
    source.pages[0].components[0].block.slides!.pop()
    design.pages[0].sections[0]={sourceId:'11',blockType:'hero',variant}
    expect(bindNativeDesign(source,design).pages![0].blocks[1]).toMatchObject({variant,headline:'One',image:{url:'https://source.example/1.jpg'},ctaButtons:[{label:'Buy',url:'/products'}]})
})
it.each(['grid','masonry','showcase'])('[TC-F35.M25] category %s retains every source item', variant => {
    const {source,design}=fixture()
    source.pages[0].components[1].kind='category_listing'
    const items=source.pages[0].components[1].block.sourceContent!.items
    items.push({...items[0],sourceId:'9',title:'Second'})
    design.pages[0].sections[1]={sourceId:'12',blockType:'portfolio-grid',variant}
    const block=bindNativeDesign(source,design).pages![0].blocks[2]
    expect(block).toMatchObject({variant,projects:[{title:'Green tea'},{title:'Second'}]})
})

it('[TC-F35.M39] corrects one invalid AI layout without weakening binder validation', async () => {
    const { source, design } = fixture()
    const invalid = { ...design, pages: [] }
    const response = (value: unknown) => ({ model: 'test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] })
    const create = vi.fn().mockResolvedValueOnce(response(invalid)).mockResolvedValueOnce(response(design))
    const client = { chat: { completions: { create } } } as unknown as OpenAI
    const output = await generateNativePw1WithAI(client, source)
    expect(create).toHaveBeenCalledTimes(2)
    expect(JSON.parse(create.mock.calls[1][0].messages[1].content).validationCorrection).toContain('AI page count mismatch')
    expect(output.result.pages).toHaveLength(1)
    create.mockReset().mockResolvedValue(response(invalid))
    await expect(generateNativePw1WithAI(client, source)).rejects.toThrow('AI page count mismatch')
    expect(create).toHaveBeenCalledTimes(2)
})
