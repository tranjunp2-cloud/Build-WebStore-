import { ensureCartGlobalBlockWithPending } from '@/lib/ai/ensure-cart-global-block'
import { describe, expect, it } from 'vitest'
import { adaptWebsiteInput } from '@/lib/migration/pw2-website-input'
import { bindNativeDesign } from '@/lib/migration/pw1-native-ai'
function fixture() {
    return { format:'pw2-website-input', version:'1.0.0', source:{storeId:'1',websiteUrl:'https://source.example'},website:{name:'Shop',locale:'en',branding:{logoUrl:'https://source.example/logo.png'},navigation:[{label:'Home',pageId:'10'}],footer:{copyright:'Shop',columns:[]}}, pages:[{sourceId:'10',title:'Home',path:'/',components:[
        {sourceId:'1',type:'product_listing',content:{heading:'Products'},config:{limit:7},binding:{source:'pw2.database',collection:'products',scope:'site',emptyBehavior:'native-empty-state'}},
        {sourceId:'2',type:'article_listing',content:{heading:'Stories'},config:{limit:4},binding:{source:'pw2.database',collection:'blogs',scope:'tenant',emptyBehavior:'native-empty-state'}},
        {sourceId:'3',type:'product_filter',content:{heading:'Filter'},config:{criteria:{category:1}},mappingStatus:'pending'},
        {sourceId:'4',type:'rich_text',enabled:false,content:{html:'<p>Disabled</p>'},config:{}},
    ]}] }
}
describe('[TC-F35.M21] Compact website input adapter',()=>{
    it('uses only the supplied input, resolves navigation and reports pending/disabled components',()=>{
        const input=fixture(), original=JSON.stringify(input)
        const {contract,report}=adaptWebsiteInput(input)
        expect(contract.site.navigation.links).toEqual([{label:'Home',url:'/'}])
        expect(contract.pages[0].components.map(c=>c.sourceId)).toEqual(['1','2'])
        expect(report.pending).toMatchObject([{sourceId:'3',type:'product_filter'}])
        expect(report.excluded).toEqual(['4'])
        expect(JSON.stringify(input)).toBe(original)
        const result=bindNativeDesign(contract,{theme:{primaryColor:'#335533',secondaryColor:'#fafafa',fontHeading:'Inter',fontBody:'Inter'},navigationVariant:'centered',footerVariant:'simple',pages:[{sourceId:'10',sections:[{sourceId:'1',blockType:'products-grid',variant:'grid-4'},{sourceId:'2',blockType:'blog-list',variant:'cards'}]}]})
        expect(result.pages![0].blocks[1]).toMatchObject({blockType:'products-grid',limit:7})
        expect(result.pages![0].blocks[2]).toMatchObject({blockType:'blog-list',limit:4})
    })
    it('rejects invalid page links and duplicate identities',()=>{
        const input=fixture();input.website.navigation[0].pageId='99'
        expect(()=>adaptWebsiteInput(input)).toThrow('navigation target')
        input.website.navigation[0].pageId='10';input.pages.push({...input.pages[0],sourceId:'10',components:[]})
        expect(()=>adaptWebsiteInput(input)).toThrow('Duplicate page')
    })
    it('rejects unsupported binding rather than embedding source records',()=>{
        const input=fixture();input.pages[0].components[0].binding!.collection='blogs'
        expect(()=>adaptWebsiteInput(input)).toThrow('database binding')
    })
    it('preserves static HTML and banner slide content',()=>{
        const input=fixture()
        const payload={...input,pages:[{...input.pages[0],components:[{sourceId:'5',type:'rich_text',content:{html:'<h2>Exact copy</h2>'},config:{}},{sourceId:'6',type:'banner',content:{slides:[{imageUrl:'https://source.example/a.jpg',heading:'Tea',cta:{label:'Read',url:'/articles'}}]},config:{autoplay:false,intervalMs:3000,aspectRatio:2,imageFit:'contain',slidesPerView:2}}]}]}
        const {contract}=adaptWebsiteInput(payload)
        expect(contract.pages[0].components[0].block.html).toBe('<h2>Exact copy</h2>')
        expect(contract.pages[0].components[1].block.sourceLayout).toMatchObject({aspectRatio:2,imageFit:'contain',slidesPerView:2})
        expect(contract.pages[0].components[1].block.slides).toMatchObject([{headline:'Tea',ctaButtons:[{label:'Read',url:'/articles'}]}])
    })
})


describe('[TC-F35.M24] Native commerce features from legacy navigation', () => {
    it('converts same-origin system links to features and preserves external links', () => {
        const input = fixture()
        const links = [{label:'Cart',url:'/cart'}, {label:'Tracking',url:'https://source.example/order-tracking'}, {label:'External',url:'https://other.example/cart'}]
        const {contract} = adaptWebsiteInput({...input,website:{...input.website,navigation:links}})
        expect(contract.site.features).toEqual({cart:true,orderTracking:true})
        expect(contract.site.navigation.links).toEqual([links[2]])
    })
    it('enables native cart without product blocks, including a stale pending draft', () => {
        const input = fixture()
        const {contract} = adaptWebsiteInput({...input,website:{...input.website,features:{cart:true,orderTracking:true},navigation:[]}})
        const patch = ensureCartGlobalBlockWithPending(null,{cartWidget:null},[],undefined,contract.site.features?.cart)
        expect(patch.globalBlocks?.cartWidget).toMatchObject({blockType:'cartWidget'})
        expect(patch.pendingGlobalBlocks?.cartWidget).toMatchObject({blockType:'cartWidget'})
        expect(ensureCartGlobalBlockWithPending(null,null,[],undefined,false)).toEqual({})
    })
})

 it('[TC-F35.M27] retains distinct page identities sharing a homepage URL', () => {
    const input = fixture()
    input.pages.push({...input.pages[0], sourceId:'11', components:[]})
    const {contract, report} = adaptWebsiteInput(input)
    expect(contract.pages.map(p => p.sourceId)).toEqual(['10','11'])
    expect(contract.pages.map(p => p.isHomepage)).toEqual([true,false])
    expect(contract.pages.map(p => p.slug)).toEqual(['home','home-pw1-11'])
    expect(report.routeChanges).toEqual([{sourceId:'11',sourcePath:'/',destinationPath:'/home-pw1-11'}])
    expect(report.warnings.join(' ')).toContain('10, 11')
 })

it('[TC-F35.M27] temporary duplicate routes avoid reserved source URLs and update page-ID links', () => {
    const input = fixture()
    input.pages.push(
        {...input.pages[0],sourceId:'11',path:'/about',components:[]},
        {...input.pages[0],sourceId:'12',path:'/about',components:[]},
        {...input.pages[0],sourceId:'13',path:'/about-pw1-12',components:[]},
    )
    input.website.navigation[0].pageId = '12'
    const {contract} = adaptWebsiteInput(input)
    expect(contract.pages.map(p => p.slug)).toEqual(['home','about','about-pw1-12-2','about-pw1-12'])
    expect(contract.site.navigation.links[0].url).toBe('/about-pw1-12-2')
})

describe('[TC-F35.M42] page links across all source blocks', () => {
    it('maps explicit URLs and Page IDs without crossing store scope', () => {
        const input = fixture()
        const {contract} = adaptWebsiteInput({...input,
            website: {...input.website,
                navigation: [{label:'About',url:'http://source.example/about#team'}],
                footer: {copyright:'Shop',columns:[{title:'Pages',links:[{label:'About',url:'https://source.example/about'}]}]},
            },
            pages: [{sourceId:'10',title:'Home',path:'/',components:[
                {sourceId:'11',type:'banner',content:{slides:[{imageUrl:'https://source.example/a.jpg',cta:{label:'Go',url:'https://source.example/about'}}]},config:{}},
                {sourceId:'12',type:'rich_text',content:{html:'<a href="https://source.example/about">About</a>'},config:{}},
                {sourceId:'13',type:'category_listing',content:{heading:'Pages',items:[{sourceId:'1',title:'About',imageUrl:'https://source.example/a.jpg',pageId:'20'}]},config:{}},
            ]},{sourceId:'20',title:'About',path:'/about',components:[]}],
        })
        expect(contract.site.navigation.links).toMatchObject([{url:'/about#team'}])
        expect(contract.site.footer.columns).toMatchObject([{links:[{url:'/about'}]}])
        expect(contract.pages[0].components[0].block.slides).toMatchObject([{ctaButtons:[{url:'/about'}]}])
        expect(contract.pages[0].components[1].block.html).toBe('<a href="/about">About</a>')
        expect(contract.pages[0].components[2].block.sourceContent).toMatchObject({items:[{url:'/about'}]})
    })
})

describe('[TC-F35.M42] reviewed adapter routes',()=>{
    it('maps native checkout and validates reviewed destination page identity',()=>{
        const input=fixture()
        const website={...input.website,navigation:[{label:'Checkout',url:'https://source.example/checkout'}]}
        expect(adaptWebsiteInput({...input,website}).contract.site.navigation.links).toEqual([{label:'Checkout',url:'/checkout'}])
        expect(()=>adaptWebsiteInput({...input,linkCorrections:[{from:'/old',pageId:'999',reason:'reviewed'}]})).toThrow('missing page')
    })
})

describe('[TC-F35.M47] broken link presentation', () => {
    it('removes a broken menu item, retains its valid children and preserves CTA text without a link', () => {
        const input = fixture()
        const url = new URL('/missing', input.source.websiteUrl).href
        const adapted = adaptWebsiteInput({ ...input,
            website: { ...input.website, navigation: [{ label:'Missing', url, children:[{label:'Home',pageId:'10'}] }] },
            pages: [{ ...input.pages[0], components: [{ sourceId:'91',type:'banner',content:{ slides:[{heading:'Hello',description:'Text',imageUrl:'https://img.example/x.jpg',alt:'',cta:{label:'Read more',url}}] } }] }],
        }, [], [url])
        expect(adapted.contract.site.navigation.links).toEqual([{label:'Home',url:'/'}])
        expect(adapted.contract.pages[0].components[0].block.slides).toMatchObject([{subheadline:'Text\nRead more',ctaButtons:[]}])
        expect(adapted.report.linkFindings).toContainEqual({url,location:'page:10/component:91/slide:0',reason:'confirmed-broken',action:'disabled'})
    })
})
