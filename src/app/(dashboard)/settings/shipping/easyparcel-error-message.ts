interface EasyParcelErrorCopy {
    sessionExpired: string
    rateLimited: string
    forbidden: string
    invalidRequest: string
    invalidWarehousePayload: string
    addCompleteBeforeActivating: string
}

/** Convert API error codes to trusted localized copy; never display server messages directly. */
export function getEasyParcelErrorMessage(
    code: unknown,
    copy: EasyParcelErrorCopy,
    fallback: string,
): string {
    switch (code) {
        case 'EP_NOT_CONNECTED':
        case 'AUTH_EXPIRED':
            return copy.sessionExpired
        case 'RATE_LIMITED':
            return copy.rateLimited
        case 'FORBIDDEN':
            return copy.forbidden
        case 'INVALID_REQUEST':
            return copy.invalidRequest
        case 'INVALID_WAREHOUSE':
            return copy.invalidWarehousePayload
        case 'EP_NOT_READY':
            return copy.addCompleteBeforeActivating
        default:
            return fallback
    }
}
