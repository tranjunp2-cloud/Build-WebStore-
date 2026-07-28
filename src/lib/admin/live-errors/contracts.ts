export type LiveErrorSource = 'sentry' | 'vercel'

export type LiveErrorSeverity = 'critical' | 'high' | 'medium' | 'low'

export type LiveErrorFrame = {
    function: string | null
    module: string | null
    filename: string | null
    line: number | null
}

export type LiveErrorTenantMatch = {
    id: string
    slug: string
    name: string
}

export type GuidanceCategory =
    | 'http-500-503'
    | 'timeout'
    | 'authentication'
    | 'not-found'
    | 'rate-limit'
    | 'application-exception'
    | 'unmatched'

export type LiveErrorGuidance = {
    category: GuidanceCategory
    investigationArea: string
    checks: [string, string]
    escalationCondition: string
    label: 'Suggested next checks'
}

/**
 * Browser-safe provider evidence. Provider-native objects must never cross this
 * boundary.
 */
export type LiveError = {
    source: LiveErrorSource
    providerId: string
    occurredAt: string
    severity: LiveErrorSeverity
    message: string
    host: string | null
    tenantMatch: LiveErrorTenantMatch | null
    route: string | null
    method: string | null
    statusCode: number | null
    release: string | null
    deploymentId: string | null
    requestId: string | null
    traceId: string | null
    frames: LiveErrorFrame[]
    providerUrl: string | null
    guidance: LiveErrorGuidance
}

export type ProviderFetchResult = {
    data: LiveError[]
    fetchedAt: string
}

export type ProviderErrorCode =
    | 'configuration'
    | 'unauthorized'
    | 'rate-limited'
    | 'not-found'
    | 'invalid-response'
    | 'unavailable'
    | 'timeout'

export class LiveErrorProviderError extends Error {
    readonly source: LiveErrorSource
    readonly code: ProviderErrorCode
    readonly status: 502 | 504

    constructor(source: LiveErrorSource, code: ProviderErrorCode) {
        super(`${source} provider ${code}`)
        this.name = 'LiveErrorProviderError'
        this.source = source
        this.code = code
        this.status = code === 'timeout' ? 504 : 502
    }
}
