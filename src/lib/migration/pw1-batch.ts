import { readFile } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'
import { applyPw1Website } from './pw1-apply'
import { createNativeBlueprint } from './pw1-contract'
import { adaptWebsiteInput } from './pw2-website-input'
import { batchAction, batchEntryHash, compactInput, processBatch, type BatchEntry } from './pw1-batch-input'

type Mapping = { source_store_id:string;source_user_id:string;tenant_id:number;site_id:number;input_hash:string|null;status:string }
type Tx = { execute(query:unknown):Promise<unknown> }
type TransactionDb = { drizzle:{transaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T>};sessions:Record<string,{db:Tx}> }
async function provision(payload:Payload, entry:BatchEntry):Promise<void> {
    const db=payload.db as unknown as TransactionDb
    await db.drizzle.transaction(async tx=>{
        const transactionID=randomUUID();db.sessions[transactionID]={db:tx}
        const req:Pick<PayloadRequest,'transactionID'>={transactionID}
        try {
            // Account, membership, site and source-ID mapping commit together; a crash cannot leave an untracked site.
            const users=await payload.find({collection:'users',where:{email:{equals:entry.owner.email}},depth:0,limit:2,req})
            if(users.docs.length>1)throw new Error('Ambiguous destination account')
            let user=users.docs[0]
            const accountRows=await tx.execute(sql`SELECT source_user_id,email,user_id FROM pw1_migration_accounts WHERE source_user_id=${entry.sourceUserId} OR email=${entry.owner.email}`) as {rows:Array<{source_user_id:string;email:string;user_id:number}>}
            if(accountRows.rows.some(a=>a.source_user_id!==entry.sourceUserId||a.email!==entry.owner.email||a.user_id!==user?.id))throw new Error('Source account mapping conflict')
            const slug=`pw1-${entry.sourceStoreId}`
            const tenants=await payload.find({collection:'tenants',where:{slug:{equals:slug}},limit:1,req})
            if(tenants.totalDocs)throw new Error('Unmapped destination tenant slug already exists; resolve mapping before retry')
            const tenant=await payload.create({collection:'tenants',data:{name:entry.website.name,slug,plan:'free'},req})
            const membership={tenant:tenant.id,role:'owner' as const,status:'active' as const}
            if(!user) {
                // Preassigned membership suppresses the welcome-email hook. Passwords are never copied from PW1 or printed.
                user=await payload.create({collection:'users',data:{email:entry.owner.email,firstName:entry.owner.firstName,lastName:entry.owner.lastName,password:randomBytes(32).toString('base64url'),roles:['tenant-owner'],tenants:[membership]},req})
            } else {
                user=await payload.update({collection:'users',id:user.id,data:{tenants:[...(user.tenants??[]),membership]},req})
            }
            await payload.create({collection:'plan-subscriptions',data:{tenant:tenant.id,name:'main',plan:'FREEMIUM',status:'active',startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+365*86400000).toISOString(),packCode:'FREEMIUM'},req})
            const site=await payload.create({collection:'sites',data:{tenant:tenant.id,name:entry.website.name,status:'draft',generationStatus:'none',siteType:'ecommerce',locale:entry.website.locale,generationLocale:entry.website.locale},req})
            await tx.execute(sql`INSERT INTO pw1_migration_accounts(source_user_id,email,user_id) VALUES(${entry.sourceUserId},${entry.owner.email},${user.id}) ON CONFLICT(source_user_id) DO NOTHING`)
            await tx.execute(sql`INSERT INTO pw1_migration_stores(source_store_id,source_user_id,tenant_id,site_id) VALUES(${entry.sourceStoreId},${entry.sourceUserId},${tenant.id},${site.id})`)
        } finally { delete db.sessions[transactionID] }
    })
}
export async function runPw1Batch(entries:BatchEntry[],options:{dryRun?:boolean;rerun?:boolean;inputReports?:import('./pw1-collection-input').CollectionReport[]}={}) {
    if(options.dryRun) {
        const stores=entries.map(entry=>{const {report}=adaptWebsiteInput(compactInput(entry));return {sourceStoreId:entry.sourceStoreId,owner:entry.owner.email,pages:entry.website.pages.length,components:report.sourceComponents,pending:report.pending.length}})
        console.log(JSON.stringify({status:'dry-run',stores},null,2));return
    }
    const connectionString=process.env.DATABASE_URI||process.env.DATABASE_URL
    if(!connectionString||!process.env.PAYLOAD_SECRET||!process.env.OPENAI_API_KEY)throw new Error('Configure DATABASE_URI, PAYLOAD_SECRET and OPENAI_API_KEY in the environment before migrating')
    process.env.PAYLOAD_PUSH_SCHEMA='false'
    const client=new Client({connectionString});let payload:Payload|undefined
    await client.connect()
    try {
        const lock=await client.query<{locked:boolean}>('SELECT pg_try_advisory_lock($1,$2) AS locked',[351827,0])
        if(!lock.rows[0]?.locked)throw new Error('Another PW1 batch is running against this database')
        await client.query(await readFile(new URL('../../../scripts/sql/pw1-migration-batch.sql',import.meta.url),'utf8'))
        // Fail before creating any destination entities when the shared generator schema is unavailable.
        await client.query('SELECT slides FROM pages_blocks_hero LIMIT 0')
        await client.query('SELECT slides FROM _pages_v_blocks_hero LIMIT 0')
        const {getPayload}=await import('payload');const {default:config}=await import('@payload-config')
        payload=await getPayload({config});const activePayload=payload
        const batchId=randomUUID()
        await client.query('INSERT INTO pw1_migration_batches(id) VALUES($1)',[batchId])
        console.log(`Batch: ${entries.length} stores → ${new URL(connectionString).hostname}; sequential processing.`)
        const results=await processBatch(entries,async entry=>{
            const hash=batchEntryHash(entry)
            let mapping=(await client.query<Mapping>('SELECT * FROM pw1_migration_stores WHERE source_store_id=$1',[entry.sourceStoreId])).rows[0]
            if(mapping&&mapping.source_user_id!==entry.sourceUserId)throw new Error('Source store owner mapping changed')
            if(mapping) {
                const account=(await client.query<{email:string}>('SELECT email FROM pw1_migration_accounts WHERE source_user_id=$1',[entry.sourceUserId])).rows[0]
                if(account?.email!==entry.owner.email)throw new Error('Source account email mapping changed')
                const site=await activePayload.findByID({collection:'sites',id:mapping.site_id,depth:0})
                if(String(typeof site.tenant==='object'?site.tenant?.id:site.tenant)!==String(mapping.tenant_id))throw new Error('Mapped site tenant changed')
                if(batchAction(mapping,hash,options.rerun)==='skip') {
                    console.log(`[${entry.sourceStoreId}] skipped (already completed); site ${mapping.site_id}`)
                    return {status:'skipped',siteId:mapping.site_id}
                }
                if(site.status!=='draft')throw new Error('Mapped site is no longer a draft; refusing automatic replacement')
            } else {
                await provision(activePayload,entry)
                mapping=(await client.query<Mapping>('SELECT * FROM pw1_migration_stores WHERE source_store_id=$1',[entry.sourceStoreId])).rows[0]
            }
            const attemptId=randomUUID()
            await client.query("INSERT INTO pw1_migration_attempts(id,source_store_id,input_hash,status) VALUES($1,$2,$3,'running')",[attemptId,entry.sourceStoreId,hash])
            await client.query("UPDATE pw1_migration_stores SET status='running',input_hash=$2,updated_at=now() WHERE source_store_id=$1",[entry.sourceStoreId,hash])
            const save=async(name:string,data:unknown)=>{
                await client.query('UPDATE pw1_migration_attempts SET artifacts=artifacts || jsonb_build_object($2::text,$3::jsonb) WHERE id=$1',[attemptId,name,JSON.stringify(data)])
            }
            try {
                const adapted=adaptWebsiteInput(compactInput(entry)), blueprint=createNativeBlueprint(adapted.contract)
                await save('input-adaptation.json',adapted.report)
                await save('collection-input-report.json', options.inputReports?.find(r => r.sourceStoreId === entry.sourceStoreId) ?? null)
                await save('blueprint.json',{sourceHash:hash,...blueprint})
                console.log(`[${entry.sourceStoreId}] generating → site ${mapping.site_id}`)
                const result=await applyPw1Website({payload:activePayload,blueprint,account:entry.owner.email,siteId:mapping.site_id,sourceHash:hash,save})
                await client.query("UPDATE pw1_migration_attempts SET status='completed',finished_at=now() WHERE id=$1",[attemptId])
                await client.query("UPDATE pw1_migration_stores SET status='completed',updated_at=now() WHERE source_store_id=$1",[entry.sourceStoreId])
                return {status:'completed',siteId:mapping.site_id,previewUrl:result.previewUrl}
            } catch(error) {
                const message=error instanceof Error?error.message:'Unknown generation error'
                await client.query("UPDATE pw1_migration_attempts SET status='failed',error=$2,finished_at=now() WHERE id=$1",[attemptId,message])
                await client.query("UPDATE pw1_migration_stores SET status='failed',updated_at=now() WHERE source_store_id=$1",[entry.sourceStoreId])
                console.error(`[${entry.sourceStoreId}] failed: ${message}`);throw error
            }
        },async result=>{
            await client.query('UPDATE pw1_migration_batches SET results=results || $2::jsonb WHERE id=$1',[batchId,JSON.stringify([result])])
            if(result.error)console.error(`[${result.sourceStoreId}] ${result.error}`)
        })
        const failures=results.filter(r=>r.error)
        await client.query('UPDATE pw1_migration_batches SET status=$2,finished_at=now() WHERE id=$1',[batchId,failures.length?'failed':'completed'])
        console.log(JSON.stringify({batchId,stores:entries.length,failed:failures.length,results},null,2))
        if(failures.length)throw new Error(`${failures.length} store(s) failed; fix the errors and rerun the same input to continue`)
    } finally {
        try {if(payload)await payload.destroy()} finally {await client.end()}
    }
}
