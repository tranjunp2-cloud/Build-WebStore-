export type GenerationErrorCode =
    | 'PAYMENT_REQUIRED'
    | 'FEATURE_LOCKED'
    | 'SUBSCRIPTION_EXPIRED'
    | 'RATE_LIMIT'
    | 'GENERATION_IN_PROGRESS'
    | 'SITE_ALREADY_EXISTS'
    | 'CONTENT_UNSAFE'
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'SERVER_ERROR'
    | 'SERVICE_UNAVAILABLE'
    | 'SSE_DISCONNECT'
    | 'GENERATION_FAILED'

export type GenerationErrorUIType = 'toast' | 'banner' | 'inline' | 'fullscreen'

export type GenerationError = {
    code: GenerationErrorCode
    messageEN: string
    messageMS: string
    action: { label: string; type: 'upgrade' | 'retry' | 'edit' | 'signin' | 'dashboard' }
    retryable: boolean
    retryAfterSeconds?: number
    uiType: GenerationErrorUIType
    maxRetries?: number
    retryIntervals?: number[]
}

const ERROR_MAP: Record<string, GenerationError> = {
    '403': {
        code: 'FEATURE_LOCKED',
        messageEN: 'Website builder is not available on your current plan. Please upgrade to continue.',
        messageMS: 'Pembina laman web tidak tersedia dalam pelan semasa anda. Sila naik taraf untuk meneruskan.',
        action: { label: 'Upgrade plan', type: 'upgrade' },
        retryable: false,
        uiType: 'fullscreen',
    },
    '403_SUBSCRIPTION_EXPIRED': {
        code: 'SUBSCRIPTION_EXPIRED',
        messageEN: 'Your subscription has expired. Please renew to continue creating websites.',
        messageMS: 'Langganan anda telah tamat tempoh. Sila perbaharui untuk terus membina laman web.',
        action: { label: 'Renew subscription', type: 'upgrade' },
        retryable: false,
        uiType: 'fullscreen',
    },
    '402': {
        code: 'PAYMENT_REQUIRED',
        messageEN: "You've used your free AI generation. Upgrade to Pro for unlimited creations.",
        messageMS: 'Anda telah menggunakan penjanaan AI percuma anda. Naik taraf ke Pro untuk penciptaan tanpa had.',
        action: { label: 'Upgrade to Pro', type: 'upgrade' },
        retryable: false,
        uiType: 'fullscreen',
    },
    '409': {
        code: 'GENERATION_IN_PROGRESS',
        messageEN: 'Your website is already being generated. Please wait for it to finish.',
        messageMS: 'Laman web anda sedang dijana. Sila tunggu sehingga selesai.',
        action: { label: 'Go to dashboard', type: 'dashboard' },
        retryable: false,
        uiType: 'banner',
    },
    '409_SITE_ALREADY_EXISTS': {
        code: 'SITE_ALREADY_EXISTS',
        messageEN: 'You already have a website. Open it from your dashboard instead of generating a new one.',
        messageMS: 'Anda sudah mempunyai laman web. Buka dari papan pemuka dan bukannya menjana yang baharu.',
        action: { label: 'Go to dashboard', type: 'dashboard' },
        retryable: false,
        uiType: 'banner',
    },
    '429': {
        code: 'RATE_LIMIT',
        messageEN: 'Too many requests. Please wait {seconds}s before trying again.',
        messageMS: 'Terlalu banyak permintaan. Sila tunggu {seconds}s sebelum mencuba lagi.',
        action: { label: 'Retry in {seconds}s', type: 'retry' },
        retryable: true,
        retryAfterSeconds: 30,
        uiType: 'toast',
    },
    '400_CONTENT_UNSAFE': {
        code: 'CONTENT_UNSAFE',
        messageEN: 'Your input contains content that cannot be processed. Please revise your business description.',
        messageMS: 'Input anda mengandungi kandungan yang tidak dapat diproses. Sila semak semula penerangan perniagaan anda.',
        action: { label: 'Edit description', type: 'edit' },
        retryable: false,
        uiType: 'inline',
    },
    '400': {
        code: 'VALIDATION_ERROR',
        messageEN: 'Some fields are invalid. Please check your input and try again.',
        messageMS: 'Beberapa medan tidak sah. Sila semak input anda dan cuba lagi.',
        action: { label: 'Fix & retry', type: 'edit' },
        retryable: false,
        uiType: 'inline',
    },
    '401': {
        code: 'UNAUTHORIZED',
        messageEN: 'Your session has expired. Please sign in again.',
        messageMS: 'Sesi anda telah tamat. Sila log masuk semula.',
        action: { label: 'Sign in', type: 'signin' },
        retryable: false,
        uiType: 'toast',
    },
    '408': {
        code: 'TIMEOUT',
        messageEN: 'Taking too long. Your input has been saved — please try again.',
        messageMS: 'Terlalu lama. Input anda telah disimpan — sila cuba lagi.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
        uiType: 'toast',
    },
    '500': {
        code: 'SERVER_ERROR',
        messageEN: 'Server error. Please try again later.',
        messageMS: 'Ralat pelayan. Sila cuba lagi kemudian.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
        uiType: 'toast',
    },
    '503': {
        code: 'SERVICE_UNAVAILABLE',
        messageEN: 'AI service is temporarily unavailable. Please try again in a few minutes.',
        messageMS: 'Perkhidmatan AI tidak tersedia buat sementara waktu. Sila cuba lagi dalam beberapa minit.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
        retryAfterSeconds: 60,
        uiType: 'toast',
    },
    SSE_DISCONNECT: {
        code: 'SSE_DISCONNECT',
        messageEN: 'Lost connection. Retrying...',
        messageMS: 'Sambungan terputus. Mencuba semula...',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
        uiType: 'banner',
        maxRetries: 3,
        retryIntervals: [2000, 5000, 10000],
    },
}

/** Error codes the generation stream sends in its `error` event. */
const STREAM_ERROR_MAP: Record<string, GenerationError> = {
    GENERATION_FAILED: {
        code: 'GENERATION_FAILED',
        messageEN: "We couldn't finish your website. Your details are saved — please try again.",
        messageMS: 'Kami belum dapat menyiapkan laman web anda. Maklumat anda telah disimpan — sila cuba lagi.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
        uiType: 'banner',
    },
}

const DEFAULT_ERROR: GenerationError = {
    code: 'SERVER_ERROR',
    messageEN: 'Something went wrong. Please try again.',
    messageMS: 'Sesuatu telah berlaku. Sila cuba lagi.',
    action: { label: 'Retry', type: 'retry' },
    retryable: true,
    uiType: 'toast',
}

/**
 * Resolve the appropriate GenerationError from an HTTP status and optional response body.
 *
 * For 400 responses, checks the body for a `code` field to distinguish
 * CONTENT_UNSAFE from generic VALIDATION_ERROR.
 */
export function getGenerationError(status: number, errorBody?: unknown): GenerationError {
    // SSE disconnect (status 0 or explicit string)
    if (status === 0 || errorBody === 'SSE_DISCONNECT') {
        return ERROR_MAP['SSE_DISCONNECT']
    }

    // For 400, check body for specific error codes
    if (status === 400 && typeof errorBody === 'object' && errorBody !== null) {
        const body = errorBody as Record<string, unknown>
        const code = body.code ?? (typeof body.error === 'object' && body.error !== null
            ? (body.error as Record<string, unknown>).code
            : undefined)

        if (code === 'CONTENT_UNSAFE' || code === 'content_unsafe') {
            return ERROR_MAP['400_CONTENT_UNSAFE']
        }
    }

    // For 409, the body code tells "already generating" from "already has a website"
    if (status === 409 && typeof errorBody === 'object' && errorBody !== null) {
        const body = errorBody as Record<string, unknown>
        const code = typeof body.error === 'object' && body.error !== null
            ? (body.error as Record<string, unknown>).code
            : body.code
        if (code === 'SITE_ALREADY_EXISTS') return ERROR_MAP['409_SITE_ALREADY_EXISTS']
    }

    // For 403, check body to distinguish subscription-expired from feature-locked
    if (status === 403 && typeof errorBody === 'object' && errorBody !== null) {
        const body = errorBody as Record<string, unknown>
        const code = body.code ?? (typeof body.error === 'object' && body.error !== null
            ? (body.error as Record<string, unknown>).code
            : undefined)

        if (code === 'SUBSCRIPTION_EXPIRED') {
            return ERROR_MAP['403_SUBSCRIPTION_EXPIRED']
        }
    }

    const mapped = ERROR_MAP[String(status)]
    return mapped ?? DEFAULT_ERROR
}

/**
 * Format an error message for the given locale, replacing `{key}` placeholders
 * with values from `params`.
 */
export function formatErrorMessage(
    error: GenerationError,
    locale: 'en' | 'ms',
    params?: Record<string, string>,
): string {
    const msg = locale === 'ms' ? error.messageMS : error.messageEN
    if (!params) return msg
    return Object.entries(params).reduce(
        (result, [key, value]) => result.replace(`{${key}}`, value),
        msg,
    )
}

/**
 * Resolve the error the generation stream reported by its `code`. The stream's own `message`
 * is never shown: the merchant always reads the copy for their UI language.
 */
export function getStreamGenerationError(code: unknown): GenerationError {
    if (typeof code !== 'string') return STREAM_ERROR_MAP.GENERATION_FAILED
    return STREAM_ERROR_MAP[code]
        ?? Object.values(ERROR_MAP).find((entry) => entry.code === code)
        ?? STREAM_ERROR_MAP.GENERATION_FAILED
}
