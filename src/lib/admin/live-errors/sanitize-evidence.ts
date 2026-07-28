import type {
    LiveError,
    LiveErrorFrame,
    LiveErrorSeverity,
    LiveErrorSource,
} from './contracts'
import { getGuidance } from './guidance'

const MAX_MESSAGE_LENGTH = 1_000
const MAX_SHORT_TEXT_LENGTH = 300
const MAX_PROVIDER_ID_LENGTH = 200
const MAX_FRAMES = 5

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
const IPV6_PATTERN = /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{0,4}\b/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi
const BASIC_AUTH_PATTERN = /\bBasic\s+[A-Za-z0-9+/=]{8,}\b/gi
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const PRIVATE_KEY_BLOCK_PATTERN =
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
const SECRET_ASSIGNMENT_PATTERN =
    /\b(authorization|api[_-]?key|token|access[_-]?token|auth[_-]?token|refresh[_-]?token|session(?:[_-]?id)?|client[_-]?secret|private[_-]?key|secret|password)\s*[:=]\s*["']?[^\s"',;]+/gi
const COOKIE_HEADER_PATTERN = /\b(set-cookie|cookie)\s*[:=]\s*[^\r\n]*/gi
const BODY_OR_PROMPT_PATTERN =
    /\b((?:request|response)\s+body|body|prompt)\s*[:=]\s*(?:\{[^}\r\n]*\}|\[[^\]\r\n]*\]|"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n;]*)/gi
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi
const PATH_QUERY_PATTERN = /(^|[\s([])(\/[^\s?#)\]]+)\?[^\s)\]]*/g

function stripUrlQuery(value: string): string {
    return value.replace(URL_PATTERN, (candidate) => {
        try {
            const url = new URL(candidate)
            return `${url.origin}${url.pathname}`
        } catch {
            return '[REDACTED_URL]'
        }
    }).replace(PATH_QUERY_PATTERN, '$1$2')
}

export type SanitizedLiveErrorInput = {
    source: LiveErrorSource
    providerId: unknown
    occurredAt: unknown
    severity: unknown
    message: unknown
    host?: unknown
    route?: unknown
    method?: unknown
    statusCode?: unknown
    release?: unknown
    deploymentId?: unknown
    requestId?: unknown
    traceId?: unknown
    frames?: unknown
    providerUrl?: unknown
}

export function sanitizeText(value: unknown, maxLength = MAX_SHORT_TEXT_LENGTH): string | null {
    if (typeof value !== 'string') return null

    const cleaned = stripUrlQuery(value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
        .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
        .replace(BASIC_AUTH_PATTERN, 'Basic [REDACTED]')
        .replace(JWT_PATTERN, '[REDACTED_TOKEN]')
        .replace(PRIVATE_KEY_BLOCK_PATTERN, '[REDACTED_PRIVATE_KEY]')
        .replace(COOKIE_HEADER_PATTERN, '$1=[REDACTED]')
        .replace(BODY_OR_PROMPT_PATTERN, '$1=[REDACTED]')
        .replace(SECRET_ASSIGNMENT_PATTERN, '$1=[REDACTED]')
        .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
        .replace(IPV4_PATTERN, '[REDACTED_IP]')
        .replace(IPV6_PATTERN, '[REDACTED_IP]')
        .replace(/\s+/g, ' ')
        .trim()

    if (!cleaned) return null
    return cleaned.slice(0, maxLength)
}

export function sanitizeProviderId(value: unknown): string | null {
    const id = sanitizeText(value, MAX_PROVIDER_ID_LENGTH)
    if (!id || !/^[A-Za-z0-9._:-]+$/.test(id)) return null
    return id
}

export function sanitizeHost(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null

    const candidate = value.trim()
    try {
        const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`)
        const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
        if (!hostname || hostname.length > 253 || hostname.includes('..')) return null
        return hostname
    } catch {
        return null
    }
}

export function sanitizeRoute(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null

    const candidate = value.trim()
    try {
        const url = new URL(candidate, 'https://sanitizer.invalid')
        const path = url.pathname || '/'
        return sanitizeText(path, MAX_SHORT_TEXT_LENGTH)
    } catch {
        const path = candidate.split(/[?#]/, 1)[0]
        if (!path) return null
        return sanitizeText(path.startsWith('/') ? path : `/${path}`, MAX_SHORT_TEXT_LENGTH)
    }
}

export function sanitizeMethod(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const method = value.trim().toUpperCase()
    return /^[A-Z]{3,12}$/.test(method) ? method : null
}

export function sanitizeStatusCode(value: unknown): number | null {
    const number = typeof value === 'string' && /^\d{3}$/.test(value)
        ? Number(value)
        : value
    return typeof number === 'number' && Number.isInteger(number) && number >= 100 && number <= 599
        ? number
        : null
}

export function sanitizeTimestamp(value: unknown): string | null {
    let date: Date
    if (typeof value === 'number' && Number.isFinite(value)) {
        date = new Date(value < 10_000_000_000 ? value * 1_000 : value)
    } else if (typeof value === 'string' && value.trim()) {
        date = new Date(value)
    } else {
        return null
    }

    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function sanitizeProviderUrl(value: unknown, source: LiveErrorSource): string | null {
    if (typeof value !== 'string') return null
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || url.username || url.password) return null
        const hostname = url.hostname.toLowerCase()
        const expectedHost = source === 'sentry' ? 'sentry.io' : 'vercel.com'
        if (hostname !== expectedHost && !hostname.endsWith(`.${expectedHost}`)) return null
        url.search = ''
        url.hash = ''
        return url.toString()
    } catch {
        return null
    }
}

function finiteLine(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10_000_000
        ? value
        : null
}

export function sanitizeFrames(value: unknown): LiveErrorFrame[] {
    if (!Array.isArray(value)) return []

    const frames: LiveErrorFrame[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const frame = item as Record<string, unknown>
        if (frame.inApp === false || frame.in_app === false) continue

        frames.push({
            function: sanitizeText(frame.function, MAX_SHORT_TEXT_LENGTH),
            module: sanitizeText(frame.module, MAX_SHORT_TEXT_LENGTH),
            filename: sanitizeText(frame.filename, MAX_SHORT_TEXT_LENGTH),
            line: finiteLine(frame.line ?? frame.lineNo ?? frame.line_no),
        })

        if (frames.length === MAX_FRAMES) break
    }
    return frames
}

function sanitizeSeverity(value: unknown): LiveErrorSeverity {
    if (typeof value !== 'string') return 'medium'
    switch (value.toLowerCase()) {
        case 'fatal':
        case 'critical':
            return 'critical'
        case 'error':
        case 'high':
            return 'high'
        case 'warning':
        case 'warn':
        case 'medium':
            return 'medium'
        default:
            return 'low'
    }
}

export function sanitizeLiveError(input: SanitizedLiveErrorInput): LiveError | null {
    const providerId = sanitizeProviderId(input.providerId)
    const occurredAt = sanitizeTimestamp(input.occurredAt)
    const message = sanitizeText(input.message, MAX_MESSAGE_LENGTH)
    if (!providerId || !occurredAt || !message) return null

    const host = sanitizeHost(input.host)
    const route = sanitizeRoute(input.route)
    const method = sanitizeMethod(input.method)
    const statusCode = sanitizeStatusCode(input.statusCode)
    const frames = sanitizeFrames(input.frames)

    return {
        source: input.source,
        providerId,
        occurredAt,
        severity: sanitizeSeverity(input.severity),
        message,
        host,
        tenantMatch: null,
        route,
        method,
        statusCode,
        release: sanitizeText(input.release, MAX_SHORT_TEXT_LENGTH),
        deploymentId: sanitizeText(input.deploymentId, MAX_SHORT_TEXT_LENGTH),
        requestId: sanitizeText(input.requestId, MAX_SHORT_TEXT_LENGTH),
        traceId: sanitizeText(input.traceId, MAX_SHORT_TEXT_LENGTH),
        frames,
        providerUrl: sanitizeProviderUrl(input.providerUrl, input.source),
        guidance: getGuidance({
            source: input.source,
            statusCode,
            message,
            hasApplicationFrames: frames.length > 0,
        }),
    }
}
