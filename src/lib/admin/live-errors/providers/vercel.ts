import 'server-only'

import type {
    LiveError,
    ProviderFetchResult,
} from '../contracts'
import { LiveErrorProviderError } from '../contracts'
import { createVercelProviderKey } from '../provider-key'
import { sanitizeLiveError } from '../sanitize-evidence'
import {
    asNumber,
    asString,
    errorForResponse,
    isRecord,
    nestedRecord,
    readBoundedJson,
} from './provider-utils'

const VERCEL_API_BASE = 'https://api.vercel.com'
const VERCEL_TIMEOUT_MS = 5_000
const VERCEL_LOG_LIMIT = 50
const VERCEL_MAX_STREAM_BYTES = 2_000_000

type FetchLike = typeof fetch

type VercelConfig = {
    token: string
    teamId: string
    projectId: string
}

function getConfig(): VercelConfig {
    const token = process.env.VERCEL_TOKEN
    const teamId = process.env.VERCEL_TEAM_ID
    const projectId = process.env.VERCEL_PROJECT_ID
    if (!token || !teamId || !projectId) {
        throw new LiveErrorProviderError('vercel', 'configuration')
    }
    return { token, teamId, projectId }
}

async function resolveProductionDeployment(
    config: VercelConfig,
    fetchImpl: FetchLike,
    signal: AbortSignal,
): Promise<string> {
    const params = new URLSearchParams({
        projectId: config.projectId,
        teamId: config.teamId,
        target: 'production',
        state: 'READY',
        limit: '1',
    })
    const response = await fetchImpl(`${VERCEL_API_BASE}/v6/deployments?${params}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${config.token}`,
        },
        cache: 'no-store',
        signal,
    })
    if (!response.ok) throw errorForResponse('vercel', response.status)
    const raw = await readBoundedJson(response, 'vercel')
    if (!isRecord(raw) || !Array.isArray(raw.deployments) || raw.deployments.length === 0) {
        throw new LiveErrorProviderError('vercel', 'not-found')
    }
    const deployment = raw.deployments[0]
    if (!isRecord(deployment)) throw new LiveErrorProviderError('vercel', 'invalid-response')
    const id = asString(deployment.uid) ?? asString(deployment.id)
    if (!id) throw new LiveErrorProviderError('vercel', 'invalid-response')
    return id
}

function firstString(...values: unknown[]): string | null {
    for (const value of values) {
        const candidate = asString(value)
        if (candidate) return candidate
    }
    return null
}

function firstNumber(...values: unknown[]): number | null {
    for (const value of values) {
        const candidate = asNumber(value)
        if (candidate !== null) return candidate
        if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
    }
    return null
}

function normalizeVercelLog(raw: unknown, deploymentId: string): LiveError | null {
    if (!isRecord(raw)) return null
    const payload = nestedRecord(raw, 'payload')
    const proxy = payload ? nestedRecord(payload, 'proxy') : null
    const statusCode = firstNumber(
        raw.responseStatusCode,
        raw.statusCode,
        raw.status,
        payload?.statusCode,
        proxy?.statusCode,
    )
    const level = firstString(raw.level, raw.type, payload?.level, raw.source)
    const qualifies =
        level?.toLowerCase() === 'error'
        || level?.toLowerCase() === 'fatal'
        || (statusCode !== null && statusCode >= 500 && statusCode <= 599)
    if (!qualifies) return null

    const provisional = sanitizeLiveError({
        source: 'vercel',
        providerId: 'pending',
        occurredAt: firstNumber(raw.timestampInMs, raw.timestamp, raw.created, payload?.created, proxy?.timestamp)
            ?? firstString(raw.timestamp, raw.created),
        severity: level ?? (statusCode !== null && statusCode >= 500 ? 'error' : 'warning'),
        message: firstString(raw.message, payload?.text, raw.text) ?? `HTTP ${statusCode ?? 'error'}`,
        host: firstString(raw.domain, raw.host, proxy?.host),
        route: firstString(raw.requestPath, raw.path, proxy?.path),
        method: firstString(raw.requestMethod, raw.method, proxy?.method),
        statusCode,
        deploymentId: firstString(raw.deploymentId, payload?.deploymentId) ?? deploymentId,
        requestId: firstString(raw.requestId, payload?.requestId),
        traceId: firstString(raw.traceId, raw['trace.id'], payload?.traceId),
        frames: [],
        providerUrl: 'https://vercel.com/dashboard',
    })
    if (!provisional) return null

    const providerId = createVercelProviderKey(provisional)
    return { ...provisional, providerId }
}

function parseLine(line: string): unknown[] {
    const trimmed = line.trim().replace(/^data:\s*/, '')
    if (!trimmed || trimmed === '[DONE]') return []
    try {
        const parsed: unknown = JSON.parse(trimmed)
        return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
        return []
    }
}

async function readRuntimeLogs(
    response: Response,
    deploymentId: string,
    controller: AbortController,
): Promise<LiveError[]> {
    if (!response.body) throw new LiveErrorProviderError('vercel', 'invalid-response')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const accepted = new Map<string, LiveError>()
    let buffer = ''
    let totalBytes = 0

    try {
        while (accepted.size < VERCEL_LOG_LIMIT) {
            let result: ReadableStreamReadResult<Uint8Array>
            try {
                result = await reader.read()
            } catch {
                if (controller.signal.aborted) break
                throw new LiveErrorProviderError('vercel', 'unavailable')
            }
            if (result.done) break

            totalBytes += result.value.byteLength
            if (totalBytes > VERCEL_MAX_STREAM_BYTES) {
                throw new LiveErrorProviderError('vercel', 'invalid-response')
            }

            buffer += decoder.decode(result.value, { stream: true })
            const lines = buffer.split(/\r?\n/)
            buffer = lines.pop() ?? ''
            for (const line of lines) {
                for (const raw of parseLine(line)) {
                    const item = normalizeVercelLog(raw, deploymentId)
                    if (item) accepted.set(item.providerId, item)
                    if (accepted.size === VERCEL_LOG_LIMIT) break
                }
            }
        }

        buffer += decoder.decode()
        if (buffer.trim() && accepted.size < VERCEL_LOG_LIMIT) {
            for (const raw of parseLine(buffer)) {
                const item = normalizeVercelLog(raw, deploymentId)
                if (item) accepted.set(item.providerId, item)
                if (accepted.size === VERCEL_LOG_LIMIT) break
            }
        }
    } finally {
        await reader.cancel().catch(() => undefined)
    }

    return [...accepted.values()]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, VERCEL_LOG_LIMIT)
}

export async function fetchVercelErrors(
    providerId?: string,
    fetchImpl: FetchLike = fetch,
): Promise<ProviderFetchResult> {
    const config = getConfig()
    const fetchedAt = new Date().toISOString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERCEL_TIMEOUT_MS)

    try {
        const deploymentId = await resolveProductionDeployment(config, fetchImpl, controller.signal)
        const params = new URLSearchParams({ teamId: config.teamId })
        const response = await fetchImpl(
            // Current official Vercel SDK operation `getRuntimeLogs` uses this
            // exact REST path and `application/stream+json` response contract.
            `${VERCEL_API_BASE}/v1/projects/${encodeURIComponent(config.projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs?${params}`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/stream+json',
                    Authorization: `Bearer ${config.token}`,
                },
                cache: 'no-store',
                signal: controller.signal,
            },
        )
        if (!response.ok) throw errorForResponse('vercel', response.status)

        const data = await readRuntimeLogs(response, deploymentId, controller)
        if (!providerId) return { data, fetchedAt }

        const item = data.find(error => error.providerId === providerId)
        if (!item) throw new LiveErrorProviderError('vercel', 'not-found')
        return { data: [item], fetchedAt }
    } catch (error) {
        if (error instanceof LiveErrorProviderError) throw error
        if (controller.signal.aborted) {
            throw new LiveErrorProviderError('vercel', 'timeout')
        }
        throw new LiveErrorProviderError('vercel', 'unavailable')
    } finally {
        clearTimeout(timeout)
    }
}
