/** TC-F35.M44: real local DB + browser, isolated fixtures removed in finally. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import { Client } from 'pg'
import { chromium } from '@playwright/test'
import config from '@payload-config'
import { configureMigrationTransactions } from '../../src/lib/migration/pw1-transactions'
import { DestinationSchema, verifyMigrationDestination } from '../../src/lib/migration/pw1-destination'
import { provisionMigrationStore } from '../../src/lib/migration/pw1-batch'
import { parseBatchInput } from '../../src/lib/migration/pw1-batch-input'
import { createSourceLinkResolver } from '../../src/lib/migration/pw1-links'
async function main() {
    const uri=process.env.DATABASE_URI||process.env.DATABASE_URL
    if (!uri || !['localhost','127.0.0.1'].includes(new URL(uri).hostname)) throw Error('Local DB only')
    const payload=await getPayload({config}); configureMigrationTransactions(payload)
    const client=new Client({connectionString:uri}); await client.connect()
    const sourceId = `96${Date.now()}`
    const nonce=randomUUID(), slug=`mapping-qa-${nonce}`
    let tenantId:number|undefined,siteId:number|undefined,userId:number|undefined
    const categoryIds:number[]=[],productIds:number[]=[]
    const browser=await chromium.launch({headless:true})
    try {
        tenantId=Number((await payload.create({collection:'tenants',data:{name:'Mapping QA',slug,plan:'free'}})).id)
        const email=`mapping-${nonce}@example.test`
        userId=Number((await payload.create({collection:'users',data:{email,firstName:'QA',password:randomUUID(),roles:['tenant-owner'],tenants:[{tenant:tenantId,role:'owner',status:'active'}]}})).id)
        siteId=Number((await payload.create({collection:'sites',data:{tenant:tenantId,name:'Mapping QA',status:'draft',generationStatus:'none',siteType:'ecommerce',locale:'en'}})).id)
        for (const name of ['Juice','Other']) categoryIds.push(Number((await payload.create({collection:'categories',data:{tenant:tenantId,site:siteId,name}})).id))
        const destination=DestinationSchema.parse({tenantId,siteId,productCategories:[{sourceId:'32589',destinationId:categoryIds[0],listingPageId:'2'}]})
        await verifyMigrationDestination(payload,destination,email)
        const [entry] = parseBatchInput([{sourceUserId:sourceId,sourceStoreId:sourceId,owner:{email,firstName:'QA'},source:{websiteUrl:'https://old.example'},destination,website:{name:'Mapping QA',locale:'en',branding:{logoUrl:'https://old.example/logo.png'},navigation:[],footer:{copyright:'',columns:[]},pages:[{sourceId:'2',title:'Products',path:'/',components:[{sourceId:'1',type:'product_listing',content:{heading:'Products'},config:{},binding:{source:'pw2.database',collection:'products',scope:'site',emptyBehavior:'native-empty-state'}}]}]}}])
        const before = (await client.query('SELECT count(*)::int n FROM tenants')).rows[0].n
        await provisionMigrationStore(payload,entry)
        const mapping=(await client.query('SELECT tenant_id,site_id FROM pw1_migration_stores WHERE source_store_id=$1',[sourceId])).rows[0]
        assert.deepEqual(mapping,{tenant_id:tenantId,site_id:siteId})
        assert.equal((await client.query('SELECT count(*)::int n FROM tenants')).rows[0].n,before)
        await assert.rejects(verifyMigrationDestination(payload,{...destination,tenantId:tenantId+999999},email), /declared tenant/)
        await assert.rejects(verifyMigrationDestination(payload,{...destination,productCategories:[{...destination.productCategories[0],destinationId:categoryIds[0]+999999}]},email), /outside destination scope/)
        for (let i=0;i<2;i++) {
            const product=await payload.create({collection:'products',data:{tenant:tenantId,site:siteId,name:i===0?'Mapping Juice':'Mapping Other',slug:`mapping-${nonce}-${i}`,price:10,status:'draft',category:categoryIds[i]}})
            productIds.push(Number(product.id))
        }
        // Fixture activation only: avoid requiring unrelated product-media validation for this routing test.
        await client.query("UPDATE products SET status='active' WHERE id=ANY($1::int[])",[productIds])
        const resolve=createSourceLinkResolver('https://old.example',[],[],[{...destination.productCategories[0],destinationPath:'/catalog'}])
        const target=resolve('https://old.example/products?category=32589')
        await payload.create({collection:'pages',data:{site:siteId,title:'Home',slug:'home',isHomepage:true,_status:'published',layout:[{blockType:'custom-html',html:`<a href="${target}">Shop mapped category</a>`}]}})
        await payload.create({collection:'pages',data:{site:siteId,title:'Products',slug:'catalog',_status:'published',layout:[{blockType:'products-grid',headline:'Mapped products',variant:'grid-3',limit:12,showCategoryFilter:true}]}})
        await payload.update({collection:'sites',id:siteId,data:{status:'published'}})
        const page=await browser.newPage()
        await page.goto(`http://localhost:3000/sites/${slug}`)
        const response=page.waitForResponse(r=>r.url().includes('/api/storefront/products?') && new URL(r.url()).searchParams.get('categoryId')===String(categoryIds[0]))
        await page.getByRole('link',{name:'Shop mapped category'}).click()
        const result=await (await response).json()
        assert.equal(new URL(page.url()).searchParams.get('categoryId'),String(categoryIds[0]))
        assert.deepEqual(result.docs.map((p:{id:number})=>p.id),[productIds[0]])
        console.log('PASS: verified destination, rejected bad scope/IDs, clicked mapped category, native API returned only matching product')
    } finally {
        await browser.close()
        await client.query('DELETE FROM pw1_migration_stores WHERE source_store_id=$1',[sourceId])
        await client.query('DELETE FROM pw1_migration_accounts WHERE source_user_id=$1',[sourceId])
        for (const id of productIds) await payload.delete({collection:'products',id})
        for (const id of categoryIds) await payload.delete({collection:'categories',id})
        if(siteId){await payload.delete({collection:'pages',where:{site:{equals:siteId}}});await payload.delete({collection:'sites',id:siteId})}
        if(userId)await payload.delete({collection:'users',id:userId})
        if(tenantId)await payload.delete({collection:'tenants',id:tenantId})
        await payload.destroy();await client.end()
    }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
