import { validateMigrationBatch } from '@/lib/migration/pw1-batch-validation'
import { compactInput } from '@/lib/migration/pw1-batch-input'
import { adaptWebsiteInput } from '@/lib/migration/pw2-website-input'
import { describe, expect, it } from 'vitest'
import { parseMigrationInput } from '@/lib/migration/pw1-collection-input'
function fixture() {
    const component = (id: string, status: string, html: string) => ({ id, page_id: '10', status, position: id, frontend_component: { name: 'rich_text', default_config_values: '{}' }, model_settings: [{key:'content',value:html,status:'1',store_id:'205'}] })
    return [{
        tenants: [{_ref:'@tenants:stores:205',metaData:{pw1StoreId:'205'}}],
        users: [{_ref:'@users:users:517',email:'owner@example.com',firstName:'Owner',tenants:[{tenant:'@tenants:stores:205',role:'owner',status:'active'}]}],
        sites: [{tenant:'@tenants:stores:205',name:'Shop',domain:'shop.example',locale:'ms',branding:{logo:'https://shop.example/logo.jpg'},menus:[{id:'1',type:'1',status:'1',menu_items:[{id:'1',name:'Deleted',model_type:'App\\Models\\Page',model_id:'11',menu_lines:[{id:'2',model_settings:[{key:'name',value:'Home'},{key:'model_type',value:'App\\Models\\Page'},{key:'model_id',value:'10'}]}]}]}]}],
        pages: [
            {id:'10',store_id:'205',name:'Home',name_ms:'Laman',type:'1',slug:'home',status:'1',components:[component('1','1','<p>Keep</p>'),component('2','0','<p>Disabled</p>'),component('3','1','<p>&nbsp;</p>')]},
            {id:'11',store_id:'205',name:'Deleted',type:'7',slug:'old',status:'1',deleted_at:'2025-01-01',components:[]},
        ],
        orders:[{secretSentinel:'do-not-project'}],
    }]
}
describe('[TC-F35.M27] BE collection input', () => {
    it('projects source content and locale, excludes disabled/empty/deleted data and promotes valid child links', () => {
        const input = fixture(), original = JSON.stringify(input)
        const {entries,reports} = parseMigrationInput(input)
        expect(entries[0].website.locale).toBe('en')
        expect(entries[0].website.pages).toHaveLength(1)
        expect(entries[0].website.pages[0].components.map(c=>c.sourceId)).toEqual(['1'])
        expect(entries[0].website.navigation).toEqual([{label:'Home',pageId:'10'}])
        expect(reports[0].excluded).toEqual(expect.arrayContaining([
            {id:'11',kind:'page',reason:'disabled-or-deleted'},
            {id:'2',kind:'component',reason:'disabled-or-deleted'},
            {id:'3',kind:'component',reason:'empty-rich-text'},
        ]))
        expect(JSON.stringify(entries)).not.toContain('do-not-project')
        expect(JSON.stringify(input)).toBe(original)
    })
    it('rejects ambiguous owners and cross-store settings before any generation', () => {
        const input = fixture()
        input[0].users.push({...input[0].users[0],_ref:'@users:users:518'})
        expect(()=>parseMigrationInput(input)).toThrow('exactly one active owner')
        input[0].users.pop()
        input[0].pages[0].components[0].model_settings[0].store_id='999'
        expect(()=>parseMigrationInput(input)).toThrow('another store')
    })
})

it('preserves branding, resolved SEO media and contact settings through the native contract', () => {
    const input = fixture()
    const site = input[0].sites[0]
    const enhanced = [{ ...input[0], sites: [{ ...site,
        branding: { ...site.branding, favicon: 'https://shop.example/favicon.png' },
        contactInfo: { phone: '123', email: 'shop@example.com', address: '' },
        socialLinks: { facebook: 'https://facebook.com/shop' },
        seo: { metaTitle: 'Source title', metaDescription: 'Source description', ogImage: '@media:stores:205:logo' },
    }], media: [{ _ref: '@media:stores:205:logo', sourceUrl: site.branding.logo }] }]
    const entry = parseMigrationInput(enhanced).entries[0]
    const { contract } = adaptWebsiteInput(compactInput(entry))
    expect(contract.site.settings).toEqual({
        branding: { logo: site.branding.logo, favicon: 'https://shop.example/favicon.png' },
        contactInfo: { phone: '123', email: 'shop@example.com', address: '' },
        socialLinks: { facebook: 'https://facebook.com/shop' },
        seo: { metaTitle: 'Source title', metaDescription: 'Source description', ogImage: site.branding.logo },
    })
    expect(() => parseMigrationInput([{ ...enhanced[0], media: [] }])).toThrow('unresolved site media')
})

it('[TC-F35.M27] preserves different source URLs even when legacy slugs match', () => {
    const input = fixture()
    input[0].pages.push(...['about-us','recruitment','contact'].map((path, index) => ({
        id: String(953 + index), store_id:'205', name:path, type:'7', slug:'new-page-1', url:`/${path}`, status:'1', components:[],
    })))
    const {entries} = parseMigrationInput(input)
    expect(entries[0].website.pages.slice(1).map(p => p.path)).toEqual(['/about-us','/recruitment','/contact'])
})

it('[TC-F35.M27] ignores disabled legacy CTA configuration while retaining its banner', () => {
    const input = fixture()
    const banner = {
        id:'118',page_id:'10',status:'1',position:'0',
        frontend_component:{name:'banner',default_config_values:{}},
        banners:[{id:'51',page_component_id:'118',store_id:'205',status:'1',image:'https://source.example/banner.png',
            button:{status:'0',mode:{default:[],hover:[]}},url:'javascript:unused',header:{status:'1',text:'Keep banner'},subheader:{status:'0'}}],
    }
    const data = [{...input[0],pages:[{...input[0].pages[0],components:[banner]}]}]
    const {entries} = parseMigrationInput(data)
    const {contract} = adaptWebsiteInput(compactInput(entries[0]))
    expect(contract.pages[0].components[0].block.slides).toMatchObject([{headline:'Keep banner',image:{url:'https://source.example/banner.png'},ctaButtons:[]}])
})

describe('[TC-F35.M27] legacy banner URL schemes', () => {
    it.each([
        ['cdn.example.com/banner.png', 'https://cdn.example.com/banner.png'],
        ['https://cdn.example.com/Banner 1.png', 'https://cdn.example.com/Banner%201.png'],
        ['//cdn.example.com/banner.png', 'https://cdn.example.com/banner.png'],
        ['https://cdn.example.com/banner.png', 'https://cdn.example.com/banner.png'],
        ['http://cdn.example.com/banner.png', 'http://cdn.example.com/banner.png'],
    ])('normalizes %s without changing source input', (image, expected) => {
        const input = fixture()
        const data = [{ ...input[0], pages: [{ ...input[0].pages[0], components: [{
            id: '20', page_id: '10', status: '1',
            frontend_component: { name: 'banner', default_config_values: {} },
            banners: [{ id: '30', page_component_id: '20', store_id: '205', status: '1', image }],
        }] }] }]
        const original = JSON.stringify(data)

        const { entries } = parseMigrationInput(data)

        expect(entries[0].website.pages[0].components[0]).toMatchObject({ content: { slides: [{ imageUrl: expected }] } })
        expect(JSON.stringify(data)).toBe(original)
    })
    it.each(['javascript:alert(1)', '/banner.png'])('rejects invalid image %s instead of inventing a host', (image) => {
        const input = fixture()
        const data = [{ ...input[0], pages: [{ ...input[0].pages[0], components: [{
            id: '20', page_id: '10', status: '1',
            frontend_component: { name: 'banner', default_config_values: {} },
            banners: [{ id: '30', page_component_id: '20', store_id: '205', status: '1', image }],
        }] }] }]

        expect(() => parseMigrationInput(data)).toThrow()
    })
})

it.each(['', 'undefined', 'not-a-url', 'javascript:alert(1)', '@media:missing:logo'])('[TC-F35.M27] migrates without invalid logo %s', (logo) => {
    const input = fixture()
    input[0].sites[0].branding.logo = logo

    const { entries, reports } = parseMigrationInput(input)
    const { contract } = adaptWebsiteInput(compactInput(entries[0]))

    expect(contract.site.navigation.logo).toBeUndefined()
    expect(contract.site.navigation.logoText).toBe('Shop')
    expect(contract.site.settings?.branding.logo).toBeUndefined()
    expect(reports[0].warnings.join(' ')).toContain('without logo')
})

it.each(['', 'undefined', 'not-a-url', 'javascript:alert(1)', '@media:missing:favicon'])('[TC-F35.M27] migrates without invalid favicon %s', (favicon) => {
    const input = fixture()
    input[0].sites[0].branding.favicon = favicon

    const { entries, reports } = parseMigrationInput(input)
    const { contract } = adaptWebsiteInput(compactInput(entries[0]))

    expect(contract.site.settings?.branding.favicon).toBeUndefined()
    if (favicon === '@media:missing:favicon') {
        expect(reports[0].warnings.join(' ')).toContain('Favicon media reference could not be resolved')
    }
})

it('[TC-F35.M27] maps legacy cart page to the PW2 cart feature', () => {
    const input = fixture()
    const cart = { id:'20', store_id:'205', name:'Cart', type:'7', slug:'cart', url:'/cart', status:'1',
        components:[{id:'30',page_id:'20',status:'1',frontend_component:{name:'cart'}}] }
    const data = [{...input[0], pages:[...input[0].pages, cart]}]

    const {entries, reports} = parseMigrationInput(data)
    const {contract} = adaptWebsiteInput(compactInput(entries[0]))

    expect(contract.site.features?.cart).toBe(true)
    expect(contract.pages.some(p => p.sourceId === '20')).toBe(false)
    expect(reports[0].excluded).toContainEqual({id:'20',kind:'page',reason:'native-commerce-runtime'})
})

it('[TC-F35.M27] skips stores without an owner or active pages', () => {
    const noOwner = fixture()
    noOwner[0].users = []
    const noPages = fixture()
    noPages[0].pages = []
    for (const input of [noOwner, noPages]) {
        const result = validateMigrationBatch(input)
        expect(result.entries).toHaveLength(0)
        expect(result.errors).toHaveLength(0)
        expect(result.skipped).toHaveLength(1)
        expect(result.skipped[0].sourceStoreId).toBe('205')
    }
})
it('[TC-F35.M27] excludes undefined banner images and the resulting empty banner', () => {
    const input = fixture()
    const data = [{...input[0], pages:[{...input[0].pages[0], components:[{
        id:'20',page_id:'10',status:'1',frontend_component:{name:'banner'},
        banners:[{id:'30',page_component_id:'20',store_id:'205',status:'1',image:'undefined'}],
    }]}]}]
    const {entries,reports} = parseMigrationInput(data)
    expect(entries[0].website.pages[0].components).toHaveLength(0)
    expect(reports[0].excluded).toEqual(expect.arrayContaining([
        {id:'30',kind:'slide',reason:'missing-image'},
        {id:'20',kind:'component',reason:'empty-banner'},
    ]))
})

it('[TC-F35.M27] maps checkout to native PW2 checkout and preserves its navigation link', () => {
    const input = fixture()
    const checkout = { id:'20',store_id:'205',name:'Checkout',type:'7',slug:'checkout',url:'/checkout',status:'1',
        components:[{id:'30',page_id:'20',status:'1',frontend_component:{name:'checkout'}}] }
    const data = [{...input[0],pages:[...input[0].pages,checkout],sites:[{...input[0].sites[0],menus:[{
        id:'1',type:'1',status:'1',menu_items:[{id:'2',name:'Checkout',model_type:'App\\Models\\Page',model_id:'20'}],
    }]}]}]

    const {entries,reports} = parseMigrationInput(data)
    const {contract} = adaptWebsiteInput(compactInput(entries[0]))

    expect(contract.site.features?.cart).toBe(true)
    expect(contract.pages.some(p => p.sourceId === '20')).toBe(false)
    expect(contract.site.navigation.links).toContainEqual({label:'Checkout',url:'/checkout'})
    expect(reports[0].excluded).toContainEqual({id:'20',kind:'page',reason:'native-commerce-runtime'})
})

// The BE locale can represent the owner's dashboard preference.
it('[TC-F35.M27] uses public PW1 labels independently of owner locale', () => {
    const input = fixture()
    input[0].pages[0].name = 'Contact Us'
    input[0].pages[0].name_ms = 'Halaman Baharu 3'
    expect(parseMigrationInput(input).entries[0].website.pages[0].title).toBe('Contact Us')
    const malay = [{ ...input[0], sites: [{ ...input[0].sites[0], sourceLocale: 'ms' }] }]
    expect(parseMigrationInput(malay).entries[0].website.pages[0].title).toBe('Halaman Baharu 3')
})

it('[TC-F35.M27] rejects a lost rich-text value instead of publishing an empty page', () => {
    const input = fixture()
    const setting = input[0].pages[0].components[0].model_settings[0]
    Reflect.deleteProperty(setting, 'value')
    expect(() => parseMigrationInput(input)).toThrow('missing value; re-export source content')
    setting.value = ''
    expect(() => parseMigrationInput(input)).not.toThrow()
})

it('[TC-F35.M27] retains category cards without images using the migration placeholder', () => {
    const input = fixture()
    const source = [{ ...input[0], pages: [{ ...input[0].pages[0], components: [{
        id: '40', page_id: '10', status: '1', frontend_component: { name: 'category_listing' },
        shortlist_items: [{ id: '41', name: 'Category without image', image: '', page_component_id: '40', store_id: '205' }],
    }] }] }]
    const entry = parseMigrationInput(source).entries[0]
    const { contract } = adaptWebsiteInput(compactInput(entry))
    expect(JSON.stringify(contract)).toContain('Category without image')
    expect(JSON.stringify(contract)).toContain('https://pw1-migration.invalid/placeholder.png')
})

 it.each([['0', 1000], ['0.5', 1000], ['1', 1000], ['5', 5000]])('[TC-F35.M27] clamps banner timing %s to %s ms', (timing, expected) => {
    const input = fixture()
    const data = [{ ...input[0], pages: [{ ...input[0].pages[0], components: [{
        id: '20', page_id: '10', status: '1',
        frontend_component: { name: 'banner', default_config_values: { timing_animation: timing } },
        banners: [{ id: '30', page_component_id: '20', store_id: '205', status: '1', image: 'https://source.example/banner.png' }],
    }] }] }]
    const { entries } = parseMigrationInput(data)
    expect(entries[0].website.pages[0].components[0].config.intervalMs).toBe(expected)
    expect(() => adaptWebsiteInput(compactInput(entries[0]))).not.toThrow()
})

 it('[TC-F35.M27] uses only active source domains belonging to this store for rich text links', () => {
    const input = fixture()
    input[0].pages[0].components[0].model_settings[0].value = '<a href="https://old.example/">Home</a><a href="https://other.example/">Other</a>'
    const data = [{...input[0], store_domains:[
        {store_id:'205',domain:'old.example',status:'1'},
        {store_id:'999',domain:'other.example',status:'1'},
        {store_id:'205',domain:'deleted.example',status:'1',deleted_at:'2020-01-01'},
    ]}]
    const {entries} = parseMigrationInput(data)
    expect(entries[0].source.websiteUrl).toBe('https://shop.example')
    expect(entries[0].source.origins).not.toContain('https://other.example')
    const {contract} = adaptWebsiteInput(compactInput(entries[0]))
    expect(contract.pages[0].components[0].block.html).toContain('href="/"')
    expect(contract.pages[0].components[0].block.html).toContain('href="https://other.example/"')
 })

it('[TC-F35.M27] disabled commerce pages override stale header cart settings', () => {
    const input = fixture()
    const data = [{...input[0], sites:[{...input[0].sites[0],menus:[{...input[0].sites[0].menus[0],config:'{"cart_status":1}'}]}],pages:[...input[0].pages,
        {id:'20',store_id:'205',name:'Cart',type:'4',slug:'cart',status:'0',components:[{id:'30',status:'1',frontend_component:{name:'cart'}}]},
        {id:'21',store_id:'205',name:'Tracking',type:'6',slug:'order-tracking',status:'0',components:[]},
    ]}]
    const {entries} = parseMigrationInput(data)
    expect(entries[0].website.features).toEqual({cart:false,orderTracking:false})
})
