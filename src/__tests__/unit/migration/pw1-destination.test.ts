import { describe, it, expect } from 'vitest'
import { DestinationSchema, assertDestinationOwnership, assertCategoryScope } from '@/lib/migration/pw1-destination'
import { createSourceLinkResolver } from '@/lib/migration/pw1-links'
import { adaptWebsiteInput } from '@/lib/migration/pw2-website-input'

const destination = DestinationSchema.parse({tenantId:4,siteId:9,productCategories:[{sourceId:'32589',destinationId:70,listingPageId:'2'}]})
describe('[TC-F35.M44] explicit BE mappings', () => {
    it('rejects invalid and duplicate input identities', () => {
        expect(() => DestinationSchema.parse({...destination,siteId:0})).toThrow()
        expect(() => DestinationSchema.parse({...destination,productCategories:[...destination.productCategories,...destination.productCategories]})).toThrow('Duplicate category')
    })
    it('requires active ownership and correct draft site', () => {
        const owner=[{tenant:4,role:'owner',status:'active'}]
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:4,status:'draft'},owner)).not.toThrow()
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:5,status:'draft'},owner)).toThrow('declared tenant')
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:4,status:'published'},owner)).toThrow('draft')
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:4,status:'published'},owner,true)).not.toThrow()
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:5,status:'published'},owner,true)).toThrow('declared tenant')
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:4,status:'published'},[{...owner[0],role:'editor'}],true)).toThrow('active owner')
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:4,status:'archived'},owner,true)).toThrow('draft')
        expect(() => assertDestinationOwnership(destination,{id:9,tenant:4,status:'draft'},[{...owner[0],role:'editor'}])).toThrow('active owner')
    })
    it('rejects missing, deleted and cross-site category IDs', () => {
        expect(() => assertCategoryScope(destination,[{id:70,tenant:4,site:9}])).not.toThrow()
        for (const docs of [[],[{id:70,tenant:5,site:9}],[{id:70,tenant:4,site:10}],[{id:70,tenant:4,site:9,deletedAt:'2026-01-01'}]]) expect(() => assertCategoryScope(destination,docs)).toThrow('outside destination scope')
    })
    it('translates only unambiguous verified category filters, preserving unrelated URL parts', () => {
        const resolve=createSourceLinkResolver('https://old.example',[],[],[{...destination.productCategories[0],destinationPath:'/catalog'}])
        expect(resolve('https://old.example/products?category=32589&utm_source=old#list')).toBe('/catalog?utm_source=old&categoryId=70#list')
        expect(resolve('http://old.example/products?category_id=32589')).toBe('/catalog?categoryId=70')
        for (const url of ['https://other.example/products?category=32589','https://old.example/products?category=123','https://old.example/products?category=32589&brand=2','https://old.example/products?category=32589&category=12']) expect(resolve(url)).toBe(url)
    })
    it('enables native filters on the mapped listing and rewrites source card links', () => {
        const input={format:'pw2-website-input',version:'1.0.0',source:{storeId:'1',websiteUrl:'https://old.example'},website:{name:'Store',locale:'en',branding:{logoUrl:'https://old.example/logo.png'},navigation:[],footer:{copyright:'',columns:[]}},pages:[
            {sourceId:'1',title:'Home',path:'/',components:[{sourceId:'11',type:'category_listing',content:{heading:'Categories',items:[{sourceId:'1',title:'Juice',imageUrl:'https://old.example/juice.jpg',url:'https://old.example/products?category=32589'}]},config:{}}]},
            {sourceId:'2',title:'Products',path:'/catalog',components:[{sourceId:'12',type:'product_listing',content:{heading:'Products'},config:{},binding:{source:'pw2.database',collection:'products',scope:'site',emptyBehavior:'native-empty-state'}}]},
        ]}
        const {contract}=adaptWebsiteInput(input,destination.productCategories)
        expect(contract.pages[0].components[0].block.sourceContent).toMatchObject({items:[{url:'/catalog?categoryId=70'}]})
        expect(contract.pages[1].components[0].block.showCategoryFilter).toBe(true)
        expect(() => adaptWebsiteInput(input,[{...destination.productCategories[0],listingPageId:'1'}])).toThrow('product listing')
        expect(adaptWebsiteInput(input).report.warnings.some(w=>w.includes('destination entity mapping required'))).toBe(true)
    })
})
