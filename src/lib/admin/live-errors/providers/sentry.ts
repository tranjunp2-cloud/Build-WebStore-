import 'server-only'

import type {
    LiveError,
    ProviderFetchResult,
} from '../contracts'
import { LiveErrorProviderError } from '../contracts'
import { sanitizeLiveError } from '../sanitize-evidence'
import {
    asString,
    errorForResponse,
    isRecord,
    nestedRecord,
    readBoundedJson,
} from './provider-utils'

const SENTRY_API_BASE = 'https://sentry.io/api/0'
const SENTRY_LIMIT = 25
const SENTRY_TIMEOUT_MS = 8_000

type FetchLike = typeof fetch

type SentryConfig = {
    token: string
    organization: string
    project: string
    environment: string
}

function getConfig(): SentryConfig {
    const token = process.env.SENTRY_READ_TOKEN
    const organization = process.env.SENTRY_ORG
    const project = process.env.SENTRY_PROJECT
    if (!token || !organization || !project) {
        throw new LiveErrorProviderError('sentry', 'configuration')
    }
    return {
        token,
        organization,
        project,
        environment: process.env.SENTRY_ENVIRONMENT || 'production',
    }
}

function getTag(record: Record<string, unknown>, key: string): string | null {
    if (!Array.isArray(record.tags)) return null
    for (const value of record.tags) {
        if (!isRecord(value) || value.key !== key) continue
        return asString(value.value)
    }
    return null
}

function getRequestEvidence(record: Record<string, unknown>): {
    url: string | null
    method: string | null
} {
    if (!Array.isArray(record.entries)) return { url: null, method: null }
    for (const entry of record.entries) {
        if (!isRecord(entry) || entry.type !== 'request') continue
        const data = nestedRecord(entry, 'data')
        return {
            url: data ? asString(data.url) : null,
            method: data ? asString(data.method) : null,
        }
    }
    return { url: null, method: null }
}

function getFrames(record: Record<string, unknown>): Array<Record<string, unknown>> {
    const frames: Array<Record<string, unknown>> = []
    if (!Array.isArray(record.entries)) return frames

    for (const entry of record.entries) {
        if (!isRecord(entry) || entry.type !== 'exception') continue
        const data = nestedRecord(entry, 'data')
        if (!data || !Array.isArray(data.values)) continue

        for (const exception of data.values) {
            if (!isRecord(exception)) continue
            const stacktrace = nestedRecord(exception, 'stacktrace')
            if (!stacktrace || !Array.isArray(stacktrace.frames)) continue

            for (const rawFrame of [...stacktrace.frames].reverse()) {
                if (!isRecord(rawFrame) || rawFrame.inApp !== true) continue
                frames.push({
                    function: rawFrame.function,
                    module: rawFrame.module,
                    filename: rawFrame.filename,
                    lineNo: rawFrame.lineNo,
                    inApp: true,
                })
                if (frames.length === 5) return frames
            }
        }
    }
    return frames
}

function sentryMessage(record: Record<string, unknown>): string | null {
    const metadata = nestedRecord(record, 'metadata')
    return asString(record.title)
        ?? asString(record.message)
        ?? (metadata ? asString(metadata.value) : null)
}

function releaseVersion(record: Record<string, unknown>): string | null {
    const release = nestedRecord(record, 'release')
    return (release ? asString(release.version) : null) ?? getTag(record, 'release')
}

function normalizeSentryIssue(
    raw: unknown,
    config: SentryConfig,
    forcedProviderId?: string,
): LiveError | null {
    if (!isRecord(raw)) return null
    const request = getRequestEvidence(raw)
    const providerId = forcedProviderId ?? raw.id ?? raw.groupID
    const providerUrl = asString(raw.permalink)
        ?? `https://sentry.io/organizations/${encodeURIComponent(config.organization)}/issues/${encodeURIComponent(String(providerId ?? ''))}/`

    return sanitizeLiveError({
        source: 'sentry',
        providerId,
        occurredAt: raw.lastSeen ?? raw.dateCreated,
        severity: raw.level ?? getTag(raw, 'level'),
        message: sentryMessage(raw),
        host: request.url,
        route: request.url ?? raw.culprit,
        method: request.method,
        statusCode: getTag(raw, 'http.status_code'),
        release: releaseVersion(raw),
        requestId: getTag(raw, 'request_id') ?? getTag(raw, 'requestId'),
        traceId: getTag(raw, 'trace') ?? getTag(raw, 'trace_id'),
        frames: getFrames(raw),
        providerUrl,
    })
}

async function sentryRequest(
    path: string,
    config: SentryConfig,
    fetchImpl: FetchLike,
): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SENTRY_TIMEOUT_MS)
    try {
        const response = await fetchImpl(`${SENTRY_API_BASE}${path}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${config.token}`,
            },
            cache: 'no-store',
            signal: controller.signal,
        })
        if (!response.ok) throw errorForResponse('sentry', response.status)
        return await readBoundedJson(response, 'sentry')
    } catch (error) {
        if (error instanceof LiveErrorProviderError) throw error
        if (controller.signal.aborted) {
            throw new LiveErrorProviderError('sentry', 'timeout')
        }
        throw new LiveErrorProviderError('sentry', 'unavailable')
    } finally {
        clearTimeout(timeout)
    }
}

export async function fetchSentryErrors(
    providerId?: string,
    fetchImpl: FetchLike = fetch,
): Promise<ProviderFetchResult> {
    const config = getConfig()
    const fetchedAt = new Date().toISOString()

    if (providerId) {
        const params = new URLSearchParams({ environment: config.environment })
        const raw = await sentryRequest(
            `/organizations/${encodeURIComponent(config.organization)}/issues/${encodeURIComponent(providerId)}/events/latest/?${params}`,
            config,
            fetchImpl,
        )
        const item = normalizeSentryIssue(raw, config, providerId)
        if (!item) throw new LiveErrorProviderError('sentry', 'invalid-response')
        return { data: [item], fetchedAt }
    }

    const params = new URLSearchParams({
        query: `is:unresolved environment:${config.environment}`,
        sort: 'date',
        limit: String(SENTRY_LIMIT),
        statsPeriod: '',
    })
    const raw = await sentryRequest(
        `/projects/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}/issues/?${params}`,
        config,
        fetchImpl,
    )
    if (!Array.isArray(raw)) throw new LiveErrorProviderError('sentry', 'invalid-response')

    const data = raw
        .slice(0, SENTRY_LIMIT)
        .map(issue => normalizeSentryIssue(issue, config))
        .filter((item): item is LiveError => item !== null)
    return { data, fetchedAt }
}
