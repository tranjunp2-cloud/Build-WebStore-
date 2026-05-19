// Rejects 1e3, abc, 1.2.3 — accepts 8.50, 8,50 (MY comma decimal).
// Allows leading "-" so the semantic negative check below returns errorNegative (not errorFormat)
// for values like "-5", which gives better UX than a generic format error.
const RATE_PATTERN = /^-?\d+([.,]\d+)?$/

// Shared across card components — allows in-progress numeric input with optional comma/dot decimal (max 2 places)
export const INPUT_FILTER = /^\d*[.,]?\d{0,2}$/

export type RateValidationMessages = {
    errorEmpty: string
    errorNegative: string
    errorTooHigh: string
    errorFormat: string
    warnFree?: string
}

export type RateValidationResult = {
    error: string
    warning?: string
}

export type CrossFieldMessages = { warnThresholdBelowRate: string }

export function validateRate(
    raw: string,
    opts: {
        maxSen: number
        minSen?: number
        required?: boolean
        messages: RateValidationMessages
    },
): RateValidationResult {
    const { maxSen, minSen = 0, required = false, messages } = opts
    const trimmed = raw.trim()

    if (trimmed === '') {
        return required ? { error: messages.errorEmpty } : { error: '' }
    }

    if (!RATE_PATTERN.test(trimmed)) {
        return { error: messages.errorFormat }
    }

    const normalized = trimmed.replace(',', '.')
    const num = parseFloat(normalized)

    if (isNaN(num)) {
        return { error: messages.errorFormat }
    }

    if (num < 0) {
        return { error: messages.errorNegative }
    }

    const senRounded = Math.round(num * 100)

    if (senRounded > maxSen) {
        return { error: messages.errorTooHigh }
    }

    if (senRounded < minSen) {
        return { error: messages.errorNegative }
    }

    const decimals = normalized.split('.')[1]?.length ?? 0
    if (decimals > 2) {
        return { error: messages.errorFormat }
    }

    if (senRounded === 0 && messages.warnFree) {
        return { error: '', warning: messages.warnFree }
    }

    return { error: '' }
}

/** Returns parsed RM float or null for empty / invalid / scientific notation. */
export function parseRateRm(raw: string): number | null {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    if (!RATE_PATTERN.test(trimmed)) return null
    const num = parseFloat(trimmed.replace(',', '.'))
    return isNaN(num) ? null : num
}

export function validateCrossField(
    westRateRm: string,
    eastRateRm: string,
    thresholdRm: string,
    freeEnabled: boolean,
    messages: CrossFieldMessages,
): { warning?: string } {
    if (!freeEnabled) return {}
    const west = parseRateRm(westRateRm)
    const east = parseRateRm(eastRateRm)
    const threshold = parseRateRm(thresholdRm)
    if (west === null || east === null || threshold === null) return {}
    if (threshold <= Math.max(west, east)) {
        return { warning: messages.warnThresholdBelowRate }
    }
    return {}
}
