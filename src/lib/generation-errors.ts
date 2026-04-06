export type GenerationErrorCode =
    | 'PAYMENT_REQUIRED'
    | 'RATE_LIMIT'
    | 'CONTENT_UNSAFE'
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'SERVER_ERROR'
    | 'SERVICE_UNAVAILABLE'
    | 'SSE_DISCONNECT'

export type GenerationError = {
    code: GenerationErrorCode
    messageEN: string
    messageMS: string
    action: { label: string; type: 'upgrade' | 'retry' | 'edit' | 'signin' | 'dashboard' }
    retryable: boolean
    retryAfterSeconds?: number
}

const ERROR_MAP: Record<string, GenerationError> = {
    '402': {
        code: 'PAYMENT_REQUIRED',
        messageEN: "You've used your free AI generation. Upgrade to Pro for unlimited creations.",
        messageMS: 'Anda telah menggunakan penjanaan AI percuma anda. Naik taraf ke Pro untuk penciptaan tanpa had.',
        action: { label: 'Upgrade to Pro', type: 'upgrade' },
        retryable: false,
    },
    '429': {
        code: 'RATE_LIMIT',
        messageEN: 'Too many requests. Please wait {seconds}s before trying again.',
        messageMS: 'Terlalu banyak permintaan. Sila tunggu {seconds}s sebelum mencuba lagi.',
        action: { label: 'Retry in {seconds}s', type: 'retry' },
        retryable: true,
        retryAfterSeconds: 30,
    },
    '400_CONTENT_UNSAFE': {
        code: 'CONTENT_UNSAFE',
        messageEN: 'Your input contains content that cannot be processed. Please revise your business description.',
        messageMS: 'Input anda mengandungi kandungan yang tidak dapat diproses. Sila semak semula penerangan perniagaan anda.',
        action: { label: 'Edit description', type: 'edit' },
        retryable: false,
    },
    '400': {
        code: 'VALIDATION_ERROR',
        messageEN: 'Some fields are invalid. Please check your input and try again.',
        messageMS: 'Beberapa medan tidak sah. Sila semak input anda dan cuba lagi.',
        action: { label: 'Fix & retry', type: 'edit' },
        retryable: false,
    },
    '401': {
        code: 'UNAUTHORIZED',
        messageEN: 'Your session has expired. Please sign in again.',
        messageMS: 'Sesi anda telah tamat. Sila log masuk semula.',
        action: { label: 'Sign in', type: 'signin' },
        retryable: false,
    },
    '408': {
        code: 'TIMEOUT',
        messageEN: 'Generation timed out. Please try again — your input has been saved.',
        messageMS: 'Penjanaan telah tamat masa. Sila cuba lagi — input anda telah disimpan.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
    },
    '500': {
        code: 'SERVER_ERROR',
        messageEN: 'Something went wrong on our end. Please try again in a moment.',
        messageMS: 'Sesuatu telah berlaku di pihak kami. Sila cuba lagi sebentar.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
    },
    '503': {
        code: 'SERVICE_UNAVAILABLE',
        messageEN: 'AI service is temporarily unavailable. Please try again in a few minutes.',
        messageMS: 'Perkhidmatan AI tidak tersedia buat sementara waktu. Sila cuba lagi dalam beberapa minit.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
        retryAfterSeconds: 60,
    },
    SSE_DISCONNECT: {
        code: 'SSE_DISCONNECT',
        messageEN: 'Connection lost during generation. Please try again.',
        messageMS: 'Sambungan terputus semasa penjanaan. Sila cuba lagi.',
        action: { label: 'Retry', type: 'retry' },
        retryable: true,
    },
}

const DEFAULT_ERROR: GenerationError = {
    code: 'SERVER_ERROR',
    messageEN: 'Something went wrong. Please try again.',
    messageMS: 'Sesuatu telah berlaku. Sila cuba lagi.',
    action: { label: 'Retry', type: 'retry' },
    retryable: true,
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
