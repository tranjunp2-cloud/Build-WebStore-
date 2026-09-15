import { randomUUID } from 'crypto'
import { resolveGenerationRecoveryPolicy } from './generation-recovery-policy'
import { hashGenerationSnapshot } from './generation-snapshot-hash'

type Relation = string | number | { id: string | number } | null | undefined

export type RecoveryParent = {
    id: string | number
    endpoint?: string | null
    lifecycle?: string | null
    recoveryStatus?: string | null
    inputSnapshot?: unknown
    inputSchemaVersion?: string | null
    inputHash?: string | null
    user?: Relation
    site?: Relation
    tenant?: Relation
    retryRootGeneration?: Relation
    retryAttempt?: number | null
}

type RecoveryJob = {
    id: string | number
    childGeneration: Relation
    status?: string | null
    idempotencyKey?: string | null
}

type RecoveryPayload = {
    findByID(args: Record<string, unknown>): Promise<RecoveryParent>
    find(args: Record<string, unknown>): Promise<{ docs: unknown[] }>
    create(args: Record<string, unknown>): Promise<{ id: string | number }>
    update(args: Record<string, unknown>): Promise<unknown>
}

export type QueueRecoveryResult =
    | { kind: 'accepted'; jobId: string; parentGenerationId: string; childGenerationId: string; idempotent: boolean }
    | { kind: 'conflict'; childGenerationId: string }
    | { kind: 'error'; code: 'NOT_FOUND' | 'NOT_RETRYABLE' | 'INVALID_SNAPSHOT' | 'RETRY_LIMIT_REACHED'; message: string }

function relationId(value: Relation): string | number | undefined {
    if (typeof value === 'string' || typeof value === 'number') return value
    if (value && typeof value === 'object' && ('id' in value)) return value.id
    return undefined
}

function hasValidSnapshot(parent: RecoveryParent) {
    if (!parent.inputSnapshot || parent.inputSchemaVersion !== 'f41.v1' || !parent.inputHash) return false
    return hashGenerationSnapshot(parent.inputSnapshot) === parent.inputHash
}

/**
 * Creates only durable retry state. It deliberately never invokes an AI route
 * or reconstructs user input from promptText; the cron worker owns execution.
 */
export async function queueGenerationRecovery(
    payload: RecoveryPayload,
    input: { parentGenerationId: number; requestedBy: string | number; idempotencyKey: string },
): Promise<QueueRecoveryResult> {
    let parent: RecoveryParent
    try {
        parent = await payload.findByID({ collection: 'ai-generation-records', id: input.parentGenerationId, depth: 0, overrideAccess: true })
    } catch {
        return { kind: 'error', code: 'NOT_FOUND', message: 'Không tìm thấy generation.' }
    }

    const existing = await payload.find({
        collection: 'generation_recovery_jobs',
        where: { and: [{ sourceGeneration: { equals: parent.id } }, { idempotencyKey: { equals: input.idempotencyKey } }] },
        limit: 1, depth: 0, overrideAccess: true,
    })
    const sameRequest = existing.docs[0] as RecoveryJob | undefined
    const sameChildId = sameRequest ? relationId(sameRequest.childGeneration) : undefined
    if (sameRequest && sameChildId !== undefined) {
        return { kind: 'accepted', jobId: String(sameRequest.id), parentGenerationId: String(parent.id), childGenerationId: String(sameChildId), idempotent: true }
    }

    const active = await payload.find({
        collection: 'generation_recovery_jobs',
        where: { and: [{ sourceGeneration: { equals: parent.id } }, { status: { in: ['queued', 'running'] } }] },
        limit: 1, depth: 0, overrideAccess: true,
    })
    const activeChildId = relationId((active.docs[0] as RecoveryJob | undefined)?.childGeneration)
    if (activeChildId !== undefined) return { kind: 'conflict', childGenerationId: String(activeChildId) }

    if (parent.lifecycle !== 'terminal' || resolveGenerationRecoveryPolicy(parent as Parameters<typeof resolveGenerationRecoveryPolicy>[0]).action !== 'retry_website') {
        return { kind: 'error', code: 'NOT_RETRYABLE', message: 'Generation này chưa đủ điều kiện gen lại.' }
    }
    if (!hasValidSnapshot(parent)) {
        return { kind: 'error', code: 'INVALID_SNAPSHOT', message: 'Dữ liệu form gốc không còn hợp lệ để gen lại an toàn.' }
    }
    const tenant = relationId(parent.tenant)
    if (tenant === undefined) {
        return { kind: 'error', code: 'INVALID_SNAPSHOT', message: 'Không xác định được tenant của form gốc để gen lại an toàn.' }
    }
    if ((parent.retryAttempt ?? 0) >= 1) {
        return { kind: 'error', code: 'RETRY_LIMIT_REACHED', message: 'Generation này đã dùng hết lượt gen lại.' }
    }

    const now = new Date().toISOString()
    const retryRootGeneration = relationId(parent.retryRootGeneration) ?? parent.id
    let child: { id: string | number }
    try {
        child = await payload.create({
            collection: 'ai-generation-records', overrideAccess: true,
            data: {
                endpoint: parent.endpoint ?? 'site-generator', user: relationId(parent.user), tenant, site: undefined,
                promptMode: 'hashed', status: 'running', lifecycle: 'queued', recoveryStatus: 'none',
                source: 'ops_retry', parentGeneration: parent.id, retryRootGeneration,
                retryAttempt: (parent.retryAttempt ?? 0) + 1, traceId: randomUUID(),
                inputSnapshot: parent.inputSnapshot, inputSchemaVersion: parent.inputSchemaVersion,
                inputHash: parent.inputHash, startedAt: now, lastHeartbeatAt: now,
                userSafeMessage: 'Đã xếp hàng gen lại website thành bản nháp mới.',
            },
        })
    } catch {
        // A partial unique index is the final concurrency guard. Do not expose
        // database details; re-read the canonical active child for Operations.
        // The child is inserted just before its job, so inspect lineage first:
        // this closes the small child→job window for simultaneous requests.
        const activeChild = await payload.find({
            collection: 'ai-generation-records',
            where: { and: [{ parentGeneration: { equals: parent.id } }, { lifecycle: { in: ['queued', 'running'] } }] },
            limit: 1, depth: 0, overrideAccess: true,
        })
        const activeChildRecord = activeChild.docs[0] as { id?: string | number } | undefined
        if (activeChildRecord?.id !== undefined) return { kind: 'conflict', childGenerationId: String(activeChildRecord.id) }
        const raced = await payload.find({ collection: 'generation_recovery_jobs', where: { and: [{ sourceGeneration: { equals: parent.id } }, { status: { in: ['queued', 'running'] } }] }, limit: 1, depth: 0, overrideAccess: true })
        const racedChildId = relationId((raced.docs[0] as RecoveryJob | undefined)?.childGeneration)
        return racedChildId === undefined
            ? { kind: 'error', code: 'NOT_RETRYABLE', message: 'Chưa thể xếp hàng gen lại. Vui lòng thử lại.' }
            : { kind: 'conflict', childGenerationId: String(racedChildId) }
    }

    try {
        const job = await payload.create({
            collection: 'generation_recovery_jobs', overrideAccess: true,
            data: { tenant, sourceGeneration: parent.id, childGeneration: child.id, requestedBy: input.requestedBy, idempotencyKey: input.idempotencyKey, retryAttempt: (parent.retryAttempt ?? 0) + 1, status: 'queued', queuedAt: now, attemptCount: 0 },
        })
        await payload.update({ collection: 'ai-generation-records', id: parent.id, overrideAccess: true, data: { recoveryStatus: 'retrying' } })
        return { kind: 'accepted', jobId: String(job.id), parentGenerationId: String(parent.id), childGenerationId: String(child.id), idempotent: false }
    } catch {
        // Never leave a false-success child if durable dispatch could not be recorded.
        await payload.update({ collection: 'ai-generation-records', id: child.id, overrideAccess: true, data: { lifecycle: 'terminal', outcome: 'cancelled', status: 'failed', recoveryStatus: 'ticket_required', terminalAt: now, userSafeMessage: 'Không thể xếp hàng gen lại. Cần tạo ticket để xử lý.' } }).catch(() => undefined)
        return { kind: 'error', code: 'NOT_RETRYABLE', message: 'Chưa thể xếp hàng gen lại. Vui lòng tạo ticket để xử lý.' }
    }
}
