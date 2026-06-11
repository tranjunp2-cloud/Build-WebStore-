/** Localized strings the resolver needs. Pass from `t.common.subscriptionErrors`. */
export interface SubscriptionErrorStrings {
    featureLocked: string
    subscriptionExpired: string
    genericLocked: string
}

/** Known coded subscription errors from withFeatureGuard + gated routes. */
const CODE_MAP: Record<string, keyof SubscriptionErrorStrings> = {
    FEATURE_LOCKED: 'featureLocked',
    SUBSCRIPTION_EXPIRED: 'subscriptionExpired',
}

/**
 * Resolve a server error (Pattern A coded OR Pattern B plain string) into a
 * localized, user-facing message.
 *
 * @param data     Parsed response body, a plain error string, or null.
 * @param fallback Localized generic fallback shown when no subscription match found.
 * @param t        Localized subscription strings (`t.common.subscriptionErrors`).
 */
export function resolveApiError(
    data: unknown,
    fallback: string,
    t: SubscriptionErrorStrings,
): string {
    const raw = data as { error?: unknown } | string | null | undefined
    const errObj =
        typeof raw === 'object' && raw !== null
            ? (raw as { error?: unknown }).error
            : undefined
    const code =
        errObj && typeof errObj === 'object'
            ? (errObj as { code?: string }).code
            : undefined

    // Pattern A: coded subscription error (withFeatureGuard, gated routes)
    if (code && code in CODE_MAP) return t[CODE_MAP[code]]

    // Collect candidate message string for Pattern B keyword match
    const message =
        (typeof raw === 'string' ? raw : undefined) ??
        (errObj && typeof errObj === 'object'
            ? (errObj as { message?: string }).message
            : undefined) ??
        (typeof errObj === 'string' ? errObj : undefined)

    if (message) {
        const lower = message.toLowerCase()
        // All Pattern B subscription action strings contain "current plan"
        // Pattern B: every subscription-gated server action string contains "current plan".
        // If you add a non-subscription error containing "current plan", use Pattern A (error.code) instead.
        if (lower.includes('current plan')) {
            if (lower.includes('subscription') && lower.includes('expired')) return t.subscriptionExpired
            return t.genericLocked
        }
        // Bare expiry string (e.g. domains action returns 'Subscription expired')
        if (lower.includes('subscription') && lower.includes('expired')) return t.subscriptionExpired
        // Non-subscription server message — pass through unchanged
        return message
    }

    return fallback
}
