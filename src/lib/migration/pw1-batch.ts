import { scanPw1Carousels, type CarouselScan } from './pw1-carousel-scan'
import { publishMigratedStore, publishOrigin } from './pw1-publish'
import { prepareSourceLinks } from './pw1-source-link-check'
import { applyCarouselEvidence } from './pw1-carousel-evidence'
import { verifyMigrationDestination } from './pw1-destination'
import { analyzePw1Brand } from './pw1-brand-analysis'
import { selectPw1TenantSlug } from './pw1-tenant-slug'
import { scanPw1Brand } from './pw1-brand-scan'
import { configureMigrationTransactions } from './pw1-transactions'
import { MigrationMutex, runStorePool } from './pw1-concurrency'
import { acquireMediaCreateLock } from '@/lib/ai/media-create-lock'
import { cleanupFailedStoreMedia } from './pw1-media-cleanup'
import { withPw1MediaTracking } from './pw1-media-tracking'
import { BatchControls, type BatchLimits } from './pw1-batch-controls'
import { checkBeReadiness } from './pw1-readiness'
import { readBatchReport } from './pw1-batch-report'
import { classifyStoreAttemptError, classifyMigrationError, MigrationBatchIncompleteError, MigrationError, retryDelayMs, shouldRetry } from './pw1-errors'
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
export async function provisionMigrationStore(payload:Payload, entry:BatchEntry):Promise<void> {
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
            if (entry.destination) {
                user = await verifyMigrationDestination(payload, entry.destination, entry.owner.email, req)
                await tx.execute(sql`INSERT INTO pw1_migration_accounts(source_user_id,email,user_id) VALUES(${entry.sourceUserId},${entry.owner.email},${user.id}) ON CONFLICT(source_user_id) DO NOTHING`)
                await tx.execute(sql`INSERT INTO pw1_migration_stores(source_store_id,source_user_id,tenant_id,site_id) VALUES(${entry.sourceStoreId},${entry.sourceUserId},${entry.destination.tenantId},${entry.destination.siteId})`)
                return
            }
            const slug = await selectPw1TenantSlug(entry.source.websiteUrl, entry.sourceStoreId, async candidate => {
                const tenants = await payload.find({ collection: 'tenants', where: { or: [{ slug: { equals: candidate } }, { 'previousSlugs.slug': { equals: candidate } }] }, limit: 1, req })
                return tenants.totalDocs > 0
            })
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
    const concurrency = options.concurrency ?? 5
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
    const publishBaseUrl = publishOrigin(process.env.NEXT_PUBLIC_SERVER_URL)
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
        await client.query('INSERT INTO pw1_migration_batches(id,results,limits) VALUES($1,$2::jsonb,$3::jsonb)', [batchId, JSON.stringify(invalid), JSON.stringify({ ...controls.limits, requireBeData: Boolean(options.requireBeData), publish: true, concurrency })])
        const results: Array<Record<string, unknown>> = [...invalid]
        console.log(`Batch ${batchId}: ${entries.length} valid, ${invalid.length} invalid stores; prepare concurrency=${concurrency}, writes serialized, up to ${maxAttempts} attempts/store.`)
        await runStorePool(entries, concurrency, entry => entry.sourceUserId, async entry => {
            const storeStartedAt = Date.now()
            const createdMedia = new Set<number>()
            const failedAttemptIds: string[] = []
            const failedMedia = new Set<number>()
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
                        if (options.requireBeData && !entry.destination && entry.website.pages.some(p => p.components.some(c => c.enabled !== false && c.binding))) {
                            throw new MigrationError('BE_DATA_MISSING', 'Unmapped store has no verified destination for BE data; establish destination mapping before strict migration')
                        }
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            controller.signal.throwIfAborted()
                            try { const release = await acquireMediaCreateLock(); try { await provisionMigrationStore(activePayload, entry) } finally { release() }; break }
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
                    if (entry.destination) {
                        if (entry.destination.siteId !== mapping.site_id || entry.destination.tenantId !== mapping.tenant_id) throw new MigrationError('BE_MAPPING_INVALID', 'Declared destination conflicts with existing store mapping')
                        await verifyMigrationDestination(activePayload, entry.destination, entry.owner.email)
                    }
                    const readiness = await checkBeReadiness(activePayload, entry, mapping)
                    if (options.requireBeData && readiness.status === 'missing-data') throw new MigrationError('BE_DATA_MISSING', readiness.warnings.join('; '))
                    const { adapted, sourceLinkChecks } = await prepareSourceLinks(compactInput(entry), entry.destination?.productCategories, controller.signal)
                    controls.checkTime(storeStartedAt)
                    const blueprint = createNativeBlueprint(adapted.contract)
                    const inputReport = options.inputReports?.find(r => r.sourceStoreId === entry.sourceStoreId)
                    const warnings = [...new Set([...readiness.warnings, ...(inputReport?.warnings ?? []).filter(w => !w.includes('category CTA retains source URL')), ...adapted.report.warnings, ...adapted.report.pending.map(p => `${p.sourceId}: ${p.reason}`)])]
                    if (entry.website.pages.some(p => p.components.some(c => c.binding))) warnings.push('Product/blog data is provided by the separate BE import; database bindings were not imported by this batch')
                    await client.query('UPDATE pw1_migration_stores SET warning_count=$2 WHERE source_store_id=$1', [entry.sourceStoreId, warnings.length])
                    let carouselScan: CarouselScan | undefined
                    let carouselEvidence: ReturnType<typeof applyCarouselEvidence> | undefined
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
                        await client.query("INSERT INTO pw1_migration_attempts(id,source_store_id,input_hash,status,batch_id,attempt_number) VALUES($1,$2,$3,'running',$4,$5)", [attemptId, entry.sourceStoreId, hash, batchId, attempt])
                        await client.query("UPDATE pw1_migration_stores SET status='running',input_hash=$2,updated_at=now() WHERE source_store_id=$1", [entry.sourceStoreId, hash])
                        const heartbeat = setInterval(() => { void client.query('UPDATE pw1_migration_attempts SET heartbeat_at=now() WHERE id=$1', [attemptId]).catch(stop) }, 15000)
                        const save = async (name: string, data: unknown) => { await client.query('UPDATE pw1_migration_attempts SET artifacts=artifacts || jsonb_build_object($2::text,$3::jsonb),heartbeat_at=now() WHERE id=$1', [attemptId, name, JSON.stringify(data)]) }
                        const onStage = async (stage: string) => { controller.signal.throwIfAborted(); controls.checkTime(storeStartedAt); await client.query('UPDATE pw1_migration_attempts SET stage=$2,heartbeat_at=now() WHERE id=$1', [attemptId, stage]) }
                        let retry = false
                        try {
                            await onStage('brand-scan')
                            let brand = blueprint.nativeContract.site.brandEvidence
                            if (!brand) {
                                const scanned = await scanPw1Brand(entry.source.websiteUrl, controller.signal, blueprint.nativeContract.site.settings?.branding.logo)
                                await onStage('brand-analysis')
                                brand = await analyzePw1Brand(scanned, controller.signal)
                                blueprint.nativeContract.site.brandEvidence = brand
                                await save('brand-evidence.json', brand)
                                controls.recordDesignTokens(brand.analysisTokens ?? 0)
                            }
                            blueprint.nativeContract.site.brandEvidence = brand
                            await onStage('carousel-scan')
                            if (!carouselEvidence) {
                                const targets = entry.website.pages.filter(page => blueprint.nativeContract.pages.some(native => native.sourceId === page.sourceId && native.components.some(component => component.kind === 'banner' && (component.block.sourceLayout as {size?:string})?.size === 'small'))).map(page => ({pageId:page.sourceId,path:page.path}))
                                carouselScan = await scanPw1Carousels(entry.source.websiteUrl, targets, controller.signal)
                                carouselEvidence = applyCarouselEvidence(blueprint, carouselScan.frames)
                            }
                            await save('carousel-scan.json', carouselScan)

                            await save('carousel-evidence.json', carouselEvidence)
                            for (const record of carouselEvidence) {
                                const warning = `page:${record.pageId}/component:${record.sourceId}: PW1 carousel layout not verified; PW2 default presentation used. Image dimensions are not used to infer layout.`
                                if (record.status === 'unverified' && !warnings.includes(warning)) warnings.push(warning)
                                for (const image of record.images) if ((image.upscale ?? 0) > 2) {
                                    const qualityWarning = `page:${record.pageId}/component:${record.sourceId}: source carousel image is enlarged ${image.upscale!.toFixed(1)}x; verified image resolution remains insufficient for the observed frame (${image.selectedUrl}).`
                                    if (!warnings.includes(qualityWarning)) warnings.push(qualityWarning)
                                }
                            }
                            if (brand.warning && !warnings.includes(brand.warning)) warnings.push(brand.warning)
                            await save('brand-evidence.json', brand)
                            await client.query('UPDATE pw1_migration_stores SET warning_count=$2 WHERE source_store_id=$1', [entry.sourceStoreId, warnings.length])
                            await save('be-readiness.json', readiness)
                            if (entry.destination) await save('be-mapping.json', { status: 'verified-declared-mappings', ...entry.destination, verifiedAt: new Date().toISOString() })
                            await save('input-adaptation.json', adapted.report)
                            await save('source-link-checks.json', { sourceStoreId: entry.sourceStoreId, checks: sourceLinkChecks, findings: adapted.report.linkFindings })
                            await save('collection-input-report.json', inputReport ?? null)
                            await save('warnings.json', warnings)
                            await save('blueprint.json', { sourceHash: hash, ...blueprint })
                            console.log(`[${entry.sourceStoreId}] attempt ${attempt}/${maxAttempts} → site ${mapping.site_id}`)
                            const applied = await withPw1MediaTracking(createdMedia, () => applyPw1Website({ destination: entry.destination, payload: activePayload, blueprint, account: entry.owner.email, siteId: mapping.site_id, sourceHash: hash, save, attemptId, onStage, acquireWrite: acquireMediaCreateLock, signal: controller.signal, onDesignUsage: usage => { controls.recordDesignTokens(usage.totalTokens ?? 0) } }))
                            await client.query("UPDATE pw1_migration_attempts SET status='completed',stage='completed',finished_at=now() WHERE id=$1", [attemptId])
                            await client.query("UPDATE pw1_migration_stores SET status='completed',updated_at=now() WHERE source_store_id=$1", [entry.sourceStoreId])
                            completed = { sourceStoreId: entry.sourceStoreId, status: warnings.length ? 'completed_with_warnings' : 'completed', siteId: mapping.site_id, previewUrl: applied.previewUrl, warnings, readiness, sourceLinkChecks, linkFindings: adapted.report.linkFindings, beMapping: entry.destination ? { status: 'verified-declared-mappings', productCategories: entry.destination.productCategories.length, tenantId: entry.destination.tenantId, siteId: entry.destination.siteId } : undefined, attemptId, brand: { status: blueprint.nativeContract.site.brandEvidence?.status, colors: blueprint.nativeContract.site.brandEvidence?.colors } }
                        } catch (error) {
                            // If commit succeeded but ledger update failed, leave running for receipt-based recovery.
                            const committed = await client.query('SELECT 1 FROM pw1_migration_commits WHERE attempt_id=$1', [attemptId])
                            if (committed.rowCount) throw error
                            failedAttemptIds.push(attemptId)
                            for (const id of createdMedia) failedMedia.add(id)
                            const failure = classifyStoreAttemptError(error)
                            await client.query("UPDATE pw1_migration_attempts SET status='failed',error=$2,error_code=$3,retryable=$4,finished_at=now() WHERE id=$1", [attemptId, failure.message, failure.code, failure.retryable])
                            await client.query("UPDATE pw1_migration_stores SET status='failed',updated_at=now() WHERE source_store_id=$1", [entry.sourceStoreId])
                            retry = !controller.signal.aborted && shouldRetry(failure, attempt, maxAttempts)
                            console.error(`[${entry.sourceStoreId}] attempt ${attempt}/${maxAttempts}: ${failure.code}: ${failure.message}; ${retry ? 'retrying automatically' : 'failed; continuing with other stores'}`)
                            if (!retry) throw new MigrationError(failure.code, failure.message, failure.retryable)
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
            if ((result.status === 'failed' || failedAttemptIds.length > 0) && !controller.signal.aborted) {
                result.mediaCleanup = { status: 'queued' }
                cleanupQueue.push({ result, mediaIds: [...failedMedia], attemptIds: failedAttemptIds })
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
        for (const [index, result] of results.entries()) {
            if (!String(result.status).startsWith('completed') && result.status !== 'skipped') continue
            const entry = entries.find(entry => entry.sourceStoreId === result.sourceStoreId)
            if (!entry) continue
            result.publish = await publishMigratedStore(activePayload, client, entry, publishBaseUrl, maxAttempts, controller.signal)
            await client.query('UPDATE pw1_migration_batches SET results=jsonb_set(results,ARRAY[$2::text],$3::jsonb) WHERE id=$1', [batchId, String(index), JSON.stringify(result)])
            console.log(JSON.stringify({sourceStoreId:entry.sourceStoreId,publish:result.publish}))
        }
        await client.query('UPDATE pw1_migration_batches SET results=$2::jsonb WHERE id=$1', [batchId, JSON.stringify(results)])
        const publishFailures = results.filter(r => ['failed','deferred'].includes((r.publish as {status?:string}|undefined)?.status ?? ''))
        const failures = results.filter(r => r.error)
        await client.query('UPDATE pw1_migration_batches SET status=$2,finished_at=now() WHERE id=$1', [batchId, failures.length || publishFailures.length ? 'failed' : 'completed'])
        console.log(JSON.stringify(await readBatchReport(client, batchId), null, 2))
        if (failures.length || publishFailures.length) {
            const deferred = failures.filter(r => r.status === 'deferred').length
            throw new MigrationBatchIncompleteError(`${failures.length - deferred} store(s) failed, ${deferred} deferred, ${publishFailures.length} publish failure(s); inspect status/logs and retry the same input`, !controller.signal.aborted)
        }
    } finally {
        options.signal?.removeEventListener('abort', stop)
        try { if (payload) await payload.destroy() } finally { await client.end() }
    }
}
