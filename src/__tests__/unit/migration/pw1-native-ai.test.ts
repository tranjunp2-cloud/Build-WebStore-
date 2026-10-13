import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { pw1DesignDirection } from '@/lib/migration/pw1-design-direction'
import { NavigationConfigSchema } from '@/blocks/navigation/config'
import { FooterConfigSchema } from '@/blocks/footer/config'
import { bindNativeDesign, generateNativePw1WithAI, nativeDesignSchemaForSource, NATIVE_BLOCKS } from '@/lib/migration/pw1-native-ai'
vi.mock('@/lib/ai/log-usage', () => ({ logAiUsage: vi.fn() }))
function fixture() {
    const source = { format: 'pw2-reconstruction-contract', version: '1.0.0', source: { url: 'https://source.example', storeId: '1', capturedAt: '2026-09-10', dumpHash: 'abc' }, site: { name: 'Tea', navigation: { blockType: 'navigation', links: [] }, footer: { blockType: 'footer', columns: [] } }, reconciliation: [], pages: [{ sourceId: '10', title: 'Home', slug: 'home', isHomepage: true, components: [
        { sourceId: '11', position: 1, kind: 'banner', block: { blockType: 'hero', headline: '', sourceLayout: { size: 'small', autoplay: false, interval: 3000, sourceComponentId: '11' }, slides: [{ headline: 'One', image: { url: 'https://source.example/1.jpg' }, ctaButtons: [{ label: 'Buy', url: '/products' }] }, { headline: 'Two', ctaButtons: [] }] } },
        { sourceId: '12', position: 2, kind: 'product_listing', block: { blockType: 'content-cards', variant: 'products', headline: 'Tea', sourceContent: { capturedAt: 'now', bindingStatus: 'captured-public-content', items: [{ sourceId: '8', title: 'Green tea', image: { url: 'https://source.example/tea.jpg' }, url: 'https://source.example/8', price: 'RM 8', summary: 'Original copy' }] } } },
        { sourceId: '13', position: 3, kind: 'rich_text', block: { blockType: 'rich-text', html: '<p>Before</p><iframe src="https://www.youtube.com/embed/abc"></iframe><p>After</p>' } },
    ] }] }
    const design = { industry: { category: 'fnb', confidence: 'high', reason: 'Tea and green tea in source content' }, theme: { primaryColor: '#335533', secondaryColor: '#fafafa', fontHeading: 'Inter', fontBody: 'Inter' }, navigationVariant: 'centered', footerVariant: 'simple', pages: [{ sourceId: '10', sections: [{ sourceId: '11', blockType: 'carousel', variant: 'images' }, { sourceId: '12', blockType: 'products-grid', variant: 'grid-4' }, { sourceId: '13', blockType: 'custom-html', variant: 'default' }] }] }
    return { source, design }
}
describe('[TC-F35.M18] AI chooses only existing PW2 blocks', () => {
    it('uses the business classification and retains evidence in the migration result', () => {
        const { source, design } = fixture()
        design.industry = { category: 'health', confidence: 'high', reason: 'Dental clinic in source name' }
        source.site.name = 'Dental clinic'
        const result = bindNativeDesign(source, design)
        expect(result.siteType).toBe('health')
        expect(result).toHaveProperty('sourceMigration.industry', design.industry)
    })
    it('uses generic business when classification confidence is low', () => {
        const { source, design } = fixture()
        design.industry.confidence = 'low'
        const result = bindNativeDesign(source, design)
        expect(result.siteType).toBe('business')
        expect(result).toHaveProperty('sourceMigration.industry.category', 'business')
    })
    it('requires a supported industry in new structured AI responses', () => {
        const { source, design } = fixture()
        design.industry.category = 'invented-category'
        expect(nativeDesignSchemaForSource(source).safeParse(design).success).toBe(false)
    })

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
        design.pages[0].sections[0] = { sourceId:'11', blockType:'hero', variant:'centered' }
        expect(bindNativeDesign(source, design).pages![0].blocks[1]).toMatchObject({blockType:'hero',variant:'centered',headline:'One',image:{url:'https://source.example/1.jpg'},ctaButtons:[{label:'Buy',url:'/products'}]})
    })
    it('[TC-F35.M28] rejects the image-less fullscreen hero for a banner that has an image', () => {
        const { source, design } = fixture()
        source.pages[0].components[0].block.sourceLayout!.size = 'hero'
        source.pages[0].components[0].block.slides!.pop()
        expect(nativeBannerChoices(source.pages[0].components[0].block)).not.toContain('hero:fullscreen')
        design.pages[0].sections[0] = { sourceId:'11', blockType:'hero', variant:'fullscreen' }
        expect(() => bindNativeDesign(source, design)).toThrow('cannot render the source image')
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
    for (const page of result.pages!) expect(page.blocks.at(-1)).toMatchObject({...footer,variant: ['minimal', 'simple'].includes(variant) ? 'centered-stack' : variant})
})

it('[TC-F35.M18] does not pick the minimal footer when a single column carries source text', () => {
    // Arrange: minimal only mirrors header links, so a lone text column would be dropped.
    const {source, design} = fixture()
    const footer = {...source.site.footer, tagline:'', columns:[{title:'Contact',text:'Phone: 0123',links:[]}]}
    // Act
    const result = bindNativeDesign({...source,site:{...source.site,footer}}, {...design,footerVariant:'minimal'})
    // Assert
    expect(result.pages![0].blocks.at(-1)).toMatchObject({variant:'centered-stack',columns:footer.columns})
})

it.each([
    ['tagline', {tagline:'About us'}],
    ['contact info', {tagline:'', showContactInfo:true}],
])('[TC-F35.M32] uses dark-gradient for a footer with %s and three link columns whatever AI chose', (_name, extra) => {
    const {source, design} = fixture()
    const column = (title: string) => ({title, links:[{label:title,url:'/a'}]})
    const footer = {...source.site.footer, ...extra, columns:[column('A'), column('B'), column('C')]}
    for (const variant of ['simple', 'minimal', 'centered-stack', 'dark-gradient'] as const)
        expect(bindNativeDesign({...source,site:{...source.site,footer}}, {...design,footerVariant:variant}).pages![0].blocks.at(-1)).toMatchObject({variant:'dark-gradient'})
})

it('[TC-F35.M32] keeps the AI footer choice when there are fewer than three columns or no brand block', () => {
    const {source, design} = fixture()
    const column = (title: string) => ({title, links:[{label:title,url:'/a'}]})
    const twoColumns = {...source.site.footer, tagline:'About us', columns:[column('A'), column('B')]}
    expect(bindNativeDesign({...source,site:{...source.site,footer:twoColumns}}, {...design,footerVariant:'centered-stack'}).pages![0].blocks.at(-1)).toMatchObject({variant:'centered-stack'})
    const noBrand = {...source.site.footer, tagline:'', columns:[column('A'), column('B'), column('C')]}
    expect(bindNativeDesign({...source,site:{...source.site,footer:noBrand}}, {...design,footerVariant:'centered-stack'}).pages![0].blocks.at(-1)).toMatchObject({variant:'centered-stack'})
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
    const events: Array<{ event: string; data: Record<string, unknown> }> = []
    const output = await generateNativePw1WithAI(client, source, event => events.push(event as never))
    expect(create).toHaveBeenCalledTimes(2)
    // The paid re-generation is observable with its validation reason.
    expect(events.filter(e => e.data.step === 'ai-native-design-retry')).toEqual([expect.objectContaining({ data: expect.objectContaining({ attempt: 1, reason: 'AI page count mismatch' }) })])
    expect(JSON.parse(create.mock.calls[1][0].messages[1].content).validationCorrection).toContain('AI page count mismatch')
    expect(output.result.pages).toHaveLength(1)
    create.mockReset().mockResolvedValue(response(invalid))
    await expect(generateNativePw1WithAI(client, source)).rejects.toThrow('AI page count mismatch')
    expect(create).toHaveBeenCalledTimes(2)
})

describe('[TC-F35.M46] Source-constrained AI output', () => {
    it('rejects a product block for a category at the response schema boundary', () => {
        // Arrange
        const { source, design } = fixture()
        source.pages[0].components[1].kind = 'category_listing'
        const schema = nativeDesignSchemaForSource(source)
        // Act / Assert
        expect(schema.safeParse(design).success).toBe(false)
        design.pages[0].sections[1] = { sourceId: '12', blockType: 'carousel', variant: 'cards' }
        expect(schema.safeParse(design).success).toBe(true)
        expect(bindNativeDesign(source, design).pages![0].blocks[2].blockType).toBe('carousel')
        design.pages[0].sections[1].variant = 'images'
        expect(schema.safeParse(design).success).toBe(false)
    })
})

describe('[TC-F35.M49] verified carousel survives native binding',()=>{
    it('preserves measured layout and selected source image for either AI carousel presentation',()=>{
        for(const variant of ['images','cards']) {
            const {source,design}=fixture()
            Object.assign(source.pages[0].components[0].block.sourceLayout!,{aspectRatio:2.5,imageFit:'contain',slidesPerView:3})
            source.pages[0].components[0].block.slides![0].image!.url='https://source.example/verified-large.jpg'
            design.pages[0].sections[0].variant=variant
            const result=bindNativeDesign(source,design)
            expect(result.pages![0].blocks[1]).toMatchObject({blockType:'carousel',variant,aspectRatio:2.5,imageFit:'contain',slidesPerView:3,items:[{image:{url:'https://source.example/verified-large.jpg'}},{}]})
        }
    })
})

it('[TC-F35.M59] binds verified product settings without letting AI replace selected IDs', () => {
    const { source, design } = fixture()
    Object.assign(source.pages[0].components[1].block, { selectionMode: 'fixed', selectedProductIds: ['30', '10'], category: '7', includeOutOfStock: false, limit: 4 })
    const result = bindNativeDesign(source, design)
    expect(result.blocks.find(block => block.blockType === 'products-grid')).toMatchObject({ selectionMode: 'fixed', selectedProductIds: ['30', '10'], category: '7', includeOutOfStock: false, limit: 4 })
})

import { nativeBannerChoices } from '@/lib/migration/pw1-native-ai'
import { heroHeadlineForPersistence } from '@/lib/migration/pw1-hero-content'
it('[TC-F35.M22] restricts image-only heroes and retains an empty migration headline', () => {
    const banner={blockType:'hero',headline:'',slides:[{image:{url:'https://source.example/banner.png'},headline:'',subheadline:'',ctaButtons:[]}]}
    expect(nativeBannerChoices(banner)).toEqual(['hero:slideshow'])
    expect(nativeBannerChoices({...banner,slides:[{...banner.slides[0],headline:'Real source text'}]})).toContain('hero:split-right')
    expect(heroHeadlineForPersistence({headline:''},true)).toBe('')
    expect(heroHeadlineForPersistence({},true)).toBe('')
    expect(heroHeadlineForPersistence({headline:'Source'},true)).toBe('Source')
    expect(heroHeadlineForPersistence({},false)).toBe('Welcome')
});
it('[TC-F35.M22] binds an image-only banner to the existing slideshow renderer with contain and no overlay', () => {
    const {source,design}=fixture()
    const banner=source.pages[0].components[0].block
    banner.sourceLayout!.size='hero'
    banner.slides=[{...banner.slides![0],headline:'',ctaButtons:[]}]
    design.pages[0].sections[0]={sourceId:'11',blockType:'hero',variant:'slideshow'}
    const bound=bindNativeDesign(source,design).pages![0].blocks[1]
    expect(bound).toMatchObject({blockType:'hero',variant:'slideshow',headline:'',overlayOpacity:0,sourceLayout:{imageFit:'contain',autoplay:false}})
    design.pages[0].sections[0].variant='split-right'
    expect(()=>bindNativeDesign(source,design)).toThrow('Banner block must match')
});
