import { configureMigrationTransactions } from './pw1-transactions'
import { MigrationMutex, runStorePool } from './pw1-concurrency'
import { acquireMediaCreateLock } from '@/lib/ai/media-create-lock'
import { cleanupFailedStoreMedia } from './pw1-media-cleanup'
import { withPw1MediaTracking } from './pw1-media-tracking'
import { BatchControls, type BatchLimits } from './pw1-batch-controls'
import { checkBeReadiness } from './pw1-readiness'
import { readBatchReport } from './pw1-batch-report'
import { classifyMigrationError, MigrationError, retryDelayMs, shouldRetry } from './pw1-errors'
import { recoverInterruptedBatches } from './pw1-operations'
import type { InvalidStore } from './pw1-batch-validation'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { sql } from 'drizzle-orm'
import type { Payload, PayloadRequest } from 'payload'
import { applyPw1Website } from './pw1-apply'
import { createNativeBlueprint } from './pw1-contract'
import { adaptWebsiteInput } from './pw2-website-input'
import { batchAction, batchEntryHash, compactInput, type BatchEntry } from './pw1-batch-input'

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
export type BatchOptions = {
    dryRun?: boolean; rerun?: boolean; retryOnly?: boolean; maxAttempts?: number; signal?: AbortSignal
    concurrency?: number
    limits?: BatchLimits; requireBeData?: boolean
    inputReports?: import('./pw1-collection-input').CollectionReport[]; invalidStores?: InvalidStore[]
}
export async function runPw1Batch(entries: BatchEntry[], options: BatchOptions = {}) {
    const concurrency = options.concurrency ?? 2
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error('concurrency must be 1–5')
    const starts = new MigrationMutex()
    const cleanupQueue: Array<{ result: Record<string, unknown>; mediaIds: number[]; attemptIds: string[] }> = []
    const controls = new BatchControls(options.limits ?? {})
    const invalid = options.invalidStores ?? []
    const maxAttempts = options.maxAttempts ?? 3
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error('max-attempts must be 1–5')
    if (options.dryRun) {
        console.log(JSON.stringify({ status: 'dry-run', concurrency, limits: controls.limits, requireBeData: Boolean(options.requireBeData), invalidStores: invalid, stores: entries.map(entry => {
            const { report } = adaptWebsiteInput(compactInput(entry))
            return { sourceStoreId: entry.sourceStoreId, pages: entry.website.pages.length, components: report.sourceComponents, pending: report.pending.length }
        }) }, null, 2))
        if (invalid.length) throw new Error(`${invalid.length} invalid store(s)`)
        return
    }
    const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connectionString || !process.env.PAYLOAD_SECRET || !process.env.OPENAI_API_KEY) throw new Error('Configure database, Payload secret and OpenAI credentials')
    process.env.PAYLOAD_PUSH_SCHEMA = 'false'
    const controller = new AbortController()
    const stop = () => controller.abort(new MigrationError('INTERRUPTED', 'Migration interrupted; safe to retry'))
    options.signal?.addEventListener('abort', stop, { once: true })
    if (options.signal?.aborted) stop()
    const client = new Client({ connectionString })
    client.on('error', stop) // Never continue writes after losing ownership of the batch lock.
    let payload: Payload | undefined
    let batchId: string | undefined
    await client.connect()
    try {
        const lock = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1,$2) AS locked', [351827, 0])
        if (!lock.rows[0]?.locked) throw new Error('Another PW1 batch is running against this database')
        await client.query(await readFile(new URL('../../../scripts/sql/pw1-migration-batch.sql', import.meta.url), 'utf8'))
        await recoverInterruptedBatches(client)
        await client.query('SELECT slides FROM pages_blocks_hero LIMIT 0')
        await client.query('SELECT slides FROM _pages_v_blocks_hero LIMIT 0')
        const { getPayload } = await import('payload'); const { default: config } = await import('@payload-config')
        payload = await getPayload({ config })
        configureMigrationTransactions(payload)
        const activePayload = payload
        batchId = randomUUID()
        await client.query('INSERT INTO pw1_migration_batches(id,results,limits) VALUES($1,$2::jsonb,$3::jsonb)', [batchId, JSON.stringify(invalid), JSON.stringify({ ...controls.limits, requireBeData: Boolean(options.requireBeData), concurrency })])
        const results: Array<Record<string, unknown>> = [...invalid]
        console.log(`Batch ${batchId}: ${entries.length} valid, ${invalid.length} invalid stores; prepare concurrency=${concurrency}, writes serialized, up to ${maxAttempts} attempts/store.`)
        await runStorePool(entries, concurrency, entry => entry.sourceUserId, async entry => {
            const storeStartedAt = Date.now()
            const createdMedia = new Set<number>()
            const storeAttemptIds: string[] = []
            let result: Record<string, unknown>
            try {
                controller.signal.throwIfAborted()
                controls.checkTime()
                const hash = batchEntryHash(entry)
                let mapping = (await client.query<Mapping>('SELECT * FROM pw1_migration_stores WHERE source_store_id=$1', [entry.sourceStoreId])).rows[0]
                const priorFailure = options.retryOnly && !mapping ? (await client.query(`SELECT 1 FROM pw1_migration_batches WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(results) r WHERE r->>'sourceStoreId'=$1 AND r ? 'error') LIMIT 1`, [entry.sourceStoreId])).rowCount : 0
                if (options.retryOnly && (mapping ? !['failed','pending'].includes(mapping.status) : !priorFailure)) {
                    result = { sourceStoreId: entry.sourceStoreId, status: 'skipped', reason: 'not failed or pending' }
                } else {
                    if (mapping && mapping.source_user_id !== entry.sourceUserId) throw new MigrationError('IDENTITY_CONFLICT', 'Source store owner mapping changed')
                    if (mapping) {
                        const account = (await client.query<{ email: string }>('SELECT email FROM pw1_migration_accounts WHERE source_user_id=$1', [entry.sourceUserId])).rows[0]
                        if (account?.email !== entry.owner.email) throw new MigrationError('IDENTITY_CONFLICT', 'Source account email mapping changed')
                        const site = await activePayload.findByID({ collection: 'sites', id: mapping.site_id, depth: 0 })
                        if (String(typeof site.tenant === 'object' ? site.tenant?.id : site.tenant) !== String(mapping.tenant_id)) throw new MigrationError('IDENTITY_CONFLICT', 'Mapped site tenant changed')
                        if (batchAction(mapping, hash, options.rerun) === 'skip') {
                            result = { sourceStoreId: entry.sourceStoreId, status: 'skipped', siteId: mapping.site_id }
                            results.push(result)
                            await client.query('UPDATE pw1_migration_batches SET results=results || $2::jsonb WHERE id=$1', [batchId, JSON.stringify([result])])
                            console.log(JSON.stringify(result)); return
                        }
                        if (site.status !== 'draft') throw new MigrationError('PUBLISHED_SITE', 'Mapped site is not a draft; automatic replacement refused')
                    } else {
                        controls.checkGenerationBudget()
                        if (options.requireBeData && entry.website.pages.some(p => p.components.some(c => c.enabled !== false && c.binding))) {
                            throw new MigrationError('BE_DATA_MISSING', 'Unmapped store has no verified destination for BE data; establish destination mapping before strict migration')
                        }
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            controller.signal.throwIfAborted()
                            try { const release = await acquireMediaCreateLock(); try { await provision(activePayload, entry) } finally { release() }; break }
                            catch (error) {
                                const failure = classifyMigrationError(error)
                                if (!shouldRetry(failure, attempt, maxAttempts)) throw error
                                // Resolve an uncertain commit before creating another tenant/account.
                                mapping = (await client.query<Mapping>('SELECT * FROM pw1_migration_stores WHERE source_store_id=$1', [entry.sourceStoreId])).rows[0]
                                if (mapping) break
                                console.error(`[${entry.sourceStoreId}] provision attempt ${attempt}: ${failure.code}; retrying`)
                                await delay(retryDelayMs(attempt), undefined, { signal: controller.signal })
                            }
                        }
                        mapping = (await client.query<Mapping>('SELECT * FROM pw1_migration_stores WHERE source_store_id=$1', [entry.sourceStoreId])).rows[0]
                        if (!mapping) throw new MigrationError('PROVISION_FAILED', 'Provisioning completed without a store mapping')
                    }
                    controls.checkGenerationBudget()
                    controls.checkTime(storeStartedAt)
                    const readiness = await checkBeReadiness(activePayload, entry, mapping)
                    if (options.requireBeData && readiness.status === 'missing-data') throw new MigrationError('BE_DATA_MISSING', readiness.warnings.join('; '))
                    const adapted = adaptWebsiteInput(compactInput(entry)), blueprint = createNativeBlueprint(adapted.contract)
                    const inputReport = options.inputReports?.find(r => r.sourceStoreId === entry.sourceStoreId)
                    const warnings = [...new Set([...readiness.warnings, ...(inputReport?.warnings ?? []), ...adapted.report.warnings, ...adapted.report.pending.map(p => `${p.sourceId}: ${p.reason}`)])]
                    if (entry.website.pages.some(p => p.components.some(c => c.binding))) warnings.push('Product/blog data is provided by the separate BE import; database bindings were not imported by this batch')
                    await client.query('UPDATE pw1_migration_stores SET warning_count=$2 WHERE source_store_id=$1', [entry.sourceStoreId, warnings.length])
                    let completed: Record<string, unknown> | undefined
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                        controller.signal.throwIfAborted()
                        await starts.run(async () => {
                            controller.signal.throwIfAborted()
                            controls.checkGenerationBudget()
                            const waitMs = controls.waitMs(storeStartedAt)
                            if (waitMs) await delay(waitMs, undefined, { signal: controller.signal })
                            controls.checkTime(storeStartedAt)
                            controls.beginGeneration()
                        })
                        const attemptId = randomUUID()
                        storeAttemptIds.push(attemptId)
                        await client.query("INSERT INTO pw1_migration_attempts(id,source_store_id,input_hash,status,batch_id,attempt_number) VALUES($1,$2,$3,'running',$4,$5)", [attemptId, entry.sourceStoreId, hash, batchId, attempt])
                        await client.query("UPDATE pw1_migration_stores SET status='running',input_hash=$2,updated_at=now() WHERE source_store_id=$1", [entry.sourceStoreId, hash])
                        const heartbeat = setInterval(() => { void client.query('UPDATE pw1_migration_attempts SET heartbeat_at=now() WHERE id=$1', [attemptId]).catch(stop) }, 15000)
                        const save = async (name: string, data: unknown) => { await client.query('UPDATE pw1_migration_attempts SET artifacts=artifacts || jsonb_build_object($2::text,$3::jsonb),heartbeat_at=now() WHERE id=$1', [attemptId, name, JSON.stringify(data)]) }
                        const onStage = async (stage: string) => { controller.signal.throwIfAborted(); controls.checkTime(storeStartedAt); await client.query('UPDATE pw1_migration_attempts SET stage=$2,heartbeat_at=now() WHERE id=$1', [attemptId, stage]) }
                        let retry = false
                        try {
                            await save('be-readiness.json', readiness)
                            await save('input-adaptation.json', adapted.report)
                            await save('collection-input-report.json', inputReport ?? null)
                            await save('warnings.json', warnings)
                            await save('blueprint.json', { sourceHash: hash, ...blueprint })
                            console.log(`[${entry.sourceStoreId}] attempt ${attempt}/${maxAttempts} → site ${mapping.site_id}`)
                            const applied = await withPw1MediaTracking(createdMedia, () => applyPw1Website({ payload: activePayload, blueprint, account: entry.owner.email, siteId: mapping.site_id, sourceHash: hash, save, attemptId, onStage, acquireWrite: acquireMediaCreateLock, signal: controller.signal, onDesignUsage: usage => { controls.recordDesignTokens(usage.totalTokens ?? 0) } }))
                            await client.query("UPDATE pw1_migration_attempts SET status='completed',stage='completed',finished_at=now() WHERE id=$1", [attemptId])
                            await client.query("UPDATE pw1_migration_stores SET status='completed',updated_at=now() WHERE source_store_id=$1", [entry.sourceStoreId])
                            completed = { sourceStoreId: entry.sourceStoreId, status: warnings.length ? 'completed_with_warnings' : 'completed', siteId: mapping.site_id, previewUrl: applied.previewUrl, warnings, readiness, attemptId }
                        } catch (error) {
                            // If commit succeeded but ledger update failed, leave running for receipt-based recovery.
                            const committed = await client.query('SELECT 1 FROM pw1_migration_commits WHERE attempt_id=$1', [attemptId])
                            if (committed.rowCount) throw error
                            const failure = classifyMigrationError(error)
                            await client.query("UPDATE pw1_migration_attempts SET status='failed',error=$2,error_code=$3,retryable=$4,finished_at=now() WHERE id=$1", [attemptId, failure.message, failure.code, failure.retryable])
                            await client.query("UPDATE pw1_migration_stores SET status='failed',updated_at=now() WHERE source_store_id=$1", [entry.sourceStoreId])
                            retry = !controller.signal.aborted && shouldRetry(failure, attempt, maxAttempts)
                            console.error(`[${entry.sourceStoreId}] ${failure.code}: ${failure.message}; retry=${retry}`)
                            if (!retry) throw error
                        } finally { clearInterval(heartbeat) }
                        if (completed) break
                        if (retry) await delay(retryDelayMs(attempt), undefined, { signal: controller.signal })
                    }
                    result = completed ?? { sourceStoreId: entry.sourceStoreId, error: 'Attempts exhausted' }
                }
            } catch (error) {
                const failure = classifyMigrationError(controller.signal.aborted ? controller.signal.reason : error)
                const deferred = ['BATCH_TIME_LIMIT','GENERATION_LIMIT','DESIGN_TOKEN_LIMIT','INTERRUPTED'].includes(failure.code)
                result = { sourceStoreId: entry.sourceStoreId, status: deferred ? 'deferred' : 'failed', ...failure, error: failure.message, durationSeconds: (Date.now() - storeStartedAt) / 1000 }
            }
            if (result.status === 'failed' && !controller.signal.aborted) {
                result.mediaCleanup = { status: 'queued' }
                cleanupQueue.push({ result, mediaIds: [...createdMedia], attemptIds: storeAttemptIds })
            }
            result.durationSeconds ??= (Date.now() - storeStartedAt) / 1000
            results.push(result)
            await client.query('UPDATE pw1_migration_batches SET results=results || $2::jsonb WHERE id=$1', [batchId, JSON.stringify([result])])
            console.log(JSON.stringify(result))
        })
        // All prepares and writes have drained before table-locking cleanup starts.
        for (const task of cleanupQueue) {
            try {
                task.result.mediaCleanup = await cleanupFailedStoreMedia(activePayload, client, task.mediaIds, task.attemptIds, controller.signal)
            } catch (error) {
                task.result.mediaCleanup = { status: 'error', error: error instanceof Error ? error.message : 'Cleanup failed' }
            }
        }
        await client.query('UPDATE pw1_migration_batches SET results=$2::jsonb WHERE id=$1', [batchId, JSON.stringify(results)])
        const failures = results.filter(r => r.error)
        await client.query('UPDATE pw1_migration_batches SET status=$2,finished_at=now() WHERE id=$1', [batchId, failures.length ? 'failed' : 'completed'])
        console.log(JSON.stringify(await readBatchReport(client, batchId), null, 2))
        if (failures.length) {
            const deferred = failures.filter(r => r.status === 'deferred').length
            throw new Error(`${failures.length - deferred} store(s) failed, ${deferred} deferred; inspect status/logs and retry the same input`)
        }
    } finally {
        options.signal?.removeEventListener('abort', stop)
        try { if (payload) await payload.destroy() } finally { await client.end() }
    }
}
