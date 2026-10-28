import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { generateSiteWithAI } from './openai-generator'
import { sanitizeBlocksForPayload } from './pages-schema'
import { resolveSiteType } from './site-type'
import { resolveTheme } from '@/lib/theme/resolve'
import { contentBriefToReferencePrompt, type ContentBrief } from './content-brief'
import { normalizeGenerationIncident } from './generation-outcome'
import type { Payload } from 'payload'
import { resolveGenerationRecordActor } from './generation-actor'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'

type Id = string | number
type Relation = Id | { id: Id } | null | undefined
export type RecoveryWorkerPayloadLike = {
    findByID(args: Record<string, unknown>): Promise<Record<string, unknown>>
    find?(args: Record<string, unknown>): Promise<{ docs: Array<Record<string, unknown>> }>
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>
    db?: { drizzle?: DrizzleExecutor }
}
type DrizzleExecutor = { execute(query: ReturnType<typeof sql>): Promise<{ rows?: Array<{ id?: number | string }> }> }

function relationId(value: Relation): Id | undefined {
    if (typeof value === 'string' || typeof value === 'number') return value
    return value?.id
}

function safeErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (/timeout|timed out/i.test(message)) return 'RECOVERY_TIMEOUT'
    if (/validation|invalid/i.test(message)) return 'RECOVERY_INVALID_OUTPUT'
    return 'RECOVERY_GENERATION_FAILED'
}

function safeErrorMessage(code: string) {
    return code === 'RECOVERY_TIMEOUT'
        ? 'Quá trình gen lại mất quá lâu. Team sẽ kiểm tra thêm.'
        : 'Chưa thể hoàn tất gen lại website. Team sẽ kiểm tra thêm.'
}

function terminalRecoveryResult(child: Record<string, unknown>) {
    const siteId = relationId(child.recoveredSite as Relation) ?? relationId(child.site as Relation)
    if (child.outcome === 'succeeded' && siteId !== undefined) return { status: 'succeeded' as const, siteId: String(siteId) }
    if (child.outcome === 'partial_failed') return { status: 'partial_failed' as const }
    return { status: 'failed' as const, code: 'RECOVERY_PREVIOUSLY_TERMINAL' }
}

function snapshotBusinessInfo(snapshot: unknown) {
    const input = snapshot as { businessInfo?: Record<string, unknown>; extraInstructions?: unknown; language?: unknown; generationLocale?: unknown; contentBrief?: unknown } | null
    const business = input?.businessInfo
    if (!business || typeof business.businessName !== 'string' || typeof business.industry !== 'string' || typeof business.products !== 'string' || typeof business.shortDescription !== 'string') return null
    return {
        businessInfo: business as { businessName: string; industry: string; products: string; shortDescription: string },
        extraInstructions: typeof input.extraInstructions === 'string' ? input.extraInstructions : undefined,
        language: (input.language === 'en' || input.language === 'ms' || input.language === 'vi' || input.language === 'auto' ? input.language : 'auto') as 'en' | 'ms' | 'vi' | 'auto',
        generationLocale: typeof input.generationLocale === 'string' ? input.generationLocale : 'en',
        contentBrief: input.contentBrief,
    }
}

function referencePromptFromSnapshot(contentBrief: unknown): string | undefined {
    // A capture can deliberately truncate an oversized brief. Treat that as no
    // reference input instead of reconstructing or trusting arbitrary data.
    if (!contentBrief || typeof contentBrief !== 'object') return undefined
    const brief = contentBrief as Partial<ContentBrief>
    if (!brief.referenceContent || !brief.visualStyle) return undefined
    try {
        return contentBriefToReferencePrompt(brief as ContentBrief) || undefined
    } catch {
        return undefined
    }
}

class LeaseLostError extends Error {}

/** Executes a claimed job only. This function never loads or mutates the parent's site/pages. */
export async function runGenerationRecoveryJob(payload: RecoveryWorkerPayloadLike, input: { jobId: Id; leaseToken: string }) {
    const job = await payload.findByID({ collection: 'generation_recovery_jobs', id: input.jobId, depth: 0, overrideAccess: true })
    if (job.status !== 'running' || job.leaseToken !== input.leaseToken) return { status: 'skipped' as const }
    const childId = relationId(job.childGeneration as Relation)
    const parentId = relationId(job.sourceGeneration as Relation)
    const tenant = relationId(job.tenant as Relation)
    if (childId === undefined || parentId === undefined || tenant === undefined) return { status: 'skipped' as const }

    const now = new Date().toISOString()
    let leaseLost = false
    const assertOwnership = async () => {
        if (leaseLost) throw new LeaseLostError('recovery lease was lost')
        const drizzle = payload.db?.drizzle
        if (drizzle) {
            // This is an atomic compare-and-swap lease renewal. A cron claim
            // cannot replace this token between validation and an irreversible
            // site/page/final write, because this UPDATE holds the row lock and
            // extends the lease before that phase starts.
            const renewed = await drizzle.execute(sql`
                UPDATE generation_recovery_jobs
                SET lease_expires_at = now() + interval '90 seconds',
                    last_heartbeat_at = now(), updated_at = now()
                WHERE id = ${input.jobId}
                  AND status = 'running'
                  AND lease_token = ${input.leaseToken}
                  AND lease_expires_at >= now()
                RETURNING id
            `)
            if (renewed.rows?.length) return
            leaseLost = true
            throw new LeaseLostError('recovery lease was lost')
        }
        // Unit-level Payload doubles do not expose Drizzle. Production always
        // uses the CAS branch above; this fallback preserves deterministic unit
        // tests for the ownership state machine.
        const current = await payload.findByID({ collection: 'generation_recovery_jobs', id: input.jobId, depth: 0, overrideAccess: true })
        if (current.status !== 'running' || current.leaseToken !== input.leaseToken) {
            leaseLost = true
            throw new LeaseLostError('recovery lease was lost')
        }
    }
    const heartbeat = async () => {
        await assertOwnership()
        const at = new Date().toISOString()
        await payload.update({ collection: 'ai-generation-records', id: childId, overrideAccess: true, data: { lastHeartbeatAt: at } })
    }
    // Long provider calls must keep the lease alive. Each heartbeat rereads the
    // token first, so a reclaimed worker cannot renew or finalize another
    // worker's lease.
    const heartbeatTimer = setInterval(() => {
        heartbeat().catch((error) => {
            if (error instanceof LeaseLostError) leaseLost = true
        })
    }, 25_000)

    try {
        const child = await payload.findByID({ collection: 'ai-generation-records', id: childId, depth: 0, overrideAccess: true })
        // A function may crash after terminalizing the child but before it can
        // finish the job/parent writes. Never reset a terminal child to running
        // or invoke the provider again: reconcile the queue from child truth.
        if (child.lifecycle === 'terminal') {
            await assertOwnership()
            const result = terminalRecoveryResult(child)
            const terminalAt = new Date().toISOString()
            const succeeded = result.status === 'succeeded'
            await Promise.all([
                payload.update({ collection: 'generation_recovery_jobs', id: input.jobId, overrideAccess: true, data: { status: succeeded ? 'succeeded' : 'failed', finishedAt: terminalAt, lastHeartbeatAt: terminalAt, userSafeMessage: succeeded ? 'Đã tạo bản nháp recovery.' : 'Recovery đã kết thúc trước đó.' } }),
                payload.update({ collection: 'ai-generation-records', id: parentId, overrideAccess: true, data: { recoveryStatus: succeeded ? 'none' : 'ticket_required' } }),
            ])
            return result
        }
        const frozen = snapshotBusinessInfo(child.inputSnapshot)
        if (!frozen) throw new Error('invalid recovery snapshot')
        await assertOwnership()
        await payload.update({ collection: 'ai-generation-records', id: childId, overrideAccess: true, data: { lifecycle: 'running', status: 'running', startedAt: now, lastHeartbeatAt: now } })
        await heartbeat()

        // Runs as the merchant who made the request, billed to their workspace.
        const { actor, skipReason: aiSkipReason } = await resolveGenerationRecordActor(payload as unknown as Payload, child)
        const regenerate = () => generateSiteWithAI(frozen.businessInfo, frozen.extraInstructions, frozen.language, referencePromptFromSnapshot(frozen.contentBrief))
        const generated = actor ? await runWithAiActor(actor, regenerate) : await regenerate()
        const result = generated.result
        // A recovery that ran without AI says why (no user/workspace on the record, lapsed membership…)
        // instead of ending as an ordinary success.
        const generationMode = {
            requested: generated.requestedGenMode,
            effective: generated.effectiveGenMode,
            ...(generated.modeReason ? { reason: generated.modeReason } : {}),
            ...(aiSkipReason ? { aiSkipReason } : {}),
        }
        const priorSnapshot = child.outputSnapshot && typeof child.outputSnapshot === 'object' && !Array.isArray(child.outputSnapshot)
            ? child.outputSnapshot as Record<string, unknown>
            : {}
        await assertOwnership()
        // Save the isolated draft id immediately. If an invocation dies later,
        // a reclaimed lease resumes this child instead of creating a second site.
        const recoveryMarker = `recovery-generation:${childId}`
        const recordedSiteId = relationId(child.recoveredSite as Relation) ?? relationId(child.site as Relation)
        // `originalPrompt` is a server-owned field for this isolated recovery,
        // not user text. It is a deterministic durable marker: if a crash lands
        // after site create but before child checkpoint, a reclaimed worker can
        // find that draft rather than creating another one.
        const markedSites = recordedSiteId === undefined && payload.find
            ? await payload.find({
                collection: 'sites',
                where: { and: [{ tenant: { equals: tenant } }, { 'aiGenerationMetadata.originalPrompt': { equals: recoveryMarker } }] },
                limit: 1, depth: 0, overrideAccess: true,
            })
            : { docs: [] }
        const existingSiteId = recordedSiteId ?? relationId(markedSites.docs[0]?.id as Relation)
        const site = existingSiteId === undefined
            ? await payload.create({
                collection: 'sites', overrideAccess: true,
                data: {
                    tenant, name: result.siteName, status: 'draft', generationStatus: 'generating',
                    siteType: resolveSiteType(result.siteType), locale: result.language === 'ms' ? 'ms' : 'en', generationLocale: frozen.generationLocale,
                    theme: resolveTheme(result.theme), seo: { metaTitle: result.seo.title, metaDescription: result.seo.description },
                    aiGenerationMetadata: { generatedAt: now, originalPrompt: recoveryMarker, businessType: resolveSiteType(result.siteType) },
                },
            })
            : { id: existingSiteId }
        await assertOwnership()
        await payload.update({ collection: 'ai-generation-records', id: childId, overrideAccess: true, data: { site: site.id, recoveredSite: site.id } })
        const pages = result.pages?.length
            ? result.pages.map((page, index) => ({ title: page.title || `Page ${index + 1}`, slug: page.slug || (index === 0 ? '/' : `/page-${index + 1}`), isHomepage: index === 0, layout: page.blocks, seo: page.seo }))
            : [{ title: 'Home', slug: '/', isHomepage: true, layout: result.blocks, seo: result.seo }]
        const outcomes = Array.isArray(child.pageOutcomes) ? [...child.pageOutcomes as unknown as Array<Record<string, unknown>>] : []
        const persistedKeys = new Set(outcomes.filter((page) => page.status === 'persisted').map((page) => String(page.pageKey)))
        for (const page of pages) {
            await heartbeat()
            if (persistedKeys.has(page.slug)) continue
            // A previous invocation may have checkpointed a failed attempt for
            // this page. Replace that evidence with this attempt's result,
            // rather than counting one logical page as both failed and saved.
            for (let index = outcomes.length - 1; index >= 0; index--) {
                if (String(outcomes[index]?.pageKey) === page.slug && outcomes[index]?.status === 'failed') outcomes.splice(index, 1)
            }
            try {
                await assertOwnership()
                // Reconcile the narrow create→checkpoint crash window. A page
                // committed by an earlier invocation is durable evidence and is
                // checkpointed as persisted instead of being inserted again.
                const existingPages = payload.find
                    ? await payload.find({ collection: 'pages', where: { and: [{ site: { equals: site.id } }, { slug: { equals: page.slug } }] }, limit: 1, depth: 0, overrideAccess: true })
                    : { docs: [] }
                const created = existingPages.docs[0] ?? await payload.create({ collection: 'pages', overrideAccess: true, data: { title: page.title, slug: page.slug, site: site.id, isHomepage: page.isHomepage, _status: 'draft', layout: sanitizeBlocksForPayload(page.layout as unknown as Record<string, unknown>[]), seo: page.seo } })
                outcomes.push({ pageKey: page.slug, title: page.title, slug: page.slug, pageId: String(created.id), status: 'persisted', blockCount: page.layout.length })
            } catch (error) {
                if (error instanceof LeaseLostError) throw error
                outcomes.push({ pageKey: page.slug, title: page.title, slug: page.slug, status: 'failed', errorCode: 'PAGE_PERSISTENCE_FAILED', errorSummary: 'Không thể lưu trang recovery này.' })
            }
            // Make every completed page durable before attempting the next one.
            // A reclaimed job can skip persisted pages and retain failed evidence.
            await assertOwnership()
            const failedSoFar = outcomes.filter((item) => item.status === 'failed').length
            await payload.update({ collection: 'ai-generation-records', id: childId, overrideAccess: true, data: {
                site: site.id, recoveredSite: site.id, pageSummary: { expected: pages.length, persisted: outcomes.filter((item) => item.status === 'persisted').length, failed: failedSoFar }, pageOutcomes: outcomes,
            } })
        }
        const failed = outcomes.filter((page) => page.status === 'failed')
        const outcome = failed.length ? 'partial_failed' : 'succeeded'
        const terminalAt = new Date().toISOString()
        await assertOwnership()
        await Promise.all([
            payload.update({ collection: 'sites', id: site.id, overrideAccess: true, data: { generationStatus: failed.length ? 'failed' : 'completed' } }),
            payload.update({ collection: 'ai-generation-records', id: childId, overrideAccess: true, data: { site: site.id, recoveredSite: site.id, lifecycle: 'terminal', outcome, status: failed.length ? 'failed' : 'success', outputSnapshot: { ...priorSnapshot, generationMode }, recoveryStatus: failed.length ? 'ticket_required' : 'none', pageSummary: { expected: pages.length, persisted: outcomes.length - failed.length, failed: failed.length }, pageOutcomes: outcomes, terminalAt, lastHeartbeatAt: terminalAt, userSafeMessage: failed.length ? 'Một số trang recovery chưa thể lưu.' : 'Đã tạo website recovery dạng bản nháp.' } }),
            payload.update({ collection: 'generation_recovery_jobs', id: input.jobId, overrideAccess: true, data: { status: failed.length ? 'failed' : 'succeeded', finishedAt: terminalAt, lastHeartbeatAt: terminalAt, userSafeMessage: failed.length ? 'Một số trang chưa thể tạo.' : 'Đã tạo bản nháp recovery.' } }),
            payload.update({ collection: 'ai-generation-records', id: parentId, overrideAccess: true, data: { recoveryStatus: failed.length ? 'ticket_required' : 'none' } }),
        ])
        return { status: failed.length ? 'partial_failed' as const : 'succeeded' as const, siteId: String(site.id) }
    } catch (error) {
        if (error instanceof LeaseLostError) return { status: 'skipped' as const }
        // A provider/persistence error can arrive after another invocation has
        // reclaimed an expired lease. Re-acquire ownership before recording a
        // terminal failure; otherwise the old worker could overwrite the
        // newer worker's active recovery state.
        try {
            await assertOwnership()
        } catch (ownershipError) {
            if (ownershipError instanceof LeaseLostError) return { status: 'skipped' as const }
            throw ownershipError
        }
        const code = safeErrorCode(error)
        const terminalAt = new Date().toISOString()
        const recoveryIncident = normalizeGenerationIncident(undefined, {
            phase: 'recovery',
            locationType: 'site',
            locationLabel: 'Website recovery',
            code,
            category: code === 'RECOVERY_TIMEOUT' ? 'system' : 'composition',
            retryabilityReason: 'requires_operator_review',
            operatorMessage: safeErrorMessage(code),
            userSafeMessage: safeErrorMessage(code),
        })
        await Promise.all([
            payload.update({ collection: 'ai-generation-records', id: childId, overrideAccess: true, data: { lifecycle: 'terminal', outcome: 'failed', status: 'failed', recoveryStatus: 'ticket_required', terminalAt, lastHeartbeatAt: terminalAt, userSafeMessage: safeErrorMessage(code), generationErrors: [recoveryIncident] } }),
            payload.update({ collection: 'generation_recovery_jobs', id: input.jobId, overrideAccess: true, data: { status: 'failed', failureCode: code, userSafeMessage: safeErrorMessage(code), finishedAt: terminalAt, lastHeartbeatAt: terminalAt } }),
            payload.update({ collection: 'ai-generation-records', id: parentId, overrideAccess: true, data: { recoveryStatus: 'ticket_required' } }),
        ])
        return { status: 'failed' as const, code }
    } finally {
        clearInterval(heartbeatTimer)
    }
}

export function newRecoveryLeaseToken() { return randomUUID() }
