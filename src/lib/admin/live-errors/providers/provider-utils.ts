import { LiveErrorProviderError, type LiveErrorSource } from '../contracts'

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

export function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function nestedRecord(
    record: Record<string, unknown>,
    key: string,
): Record<string, unknown> | null {
    return isRecord(record[key]) ? record[key] : null
}

export async function readBoundedJson(
    response: Response,
    source: LiveErrorSource,
    maxBytes = 2_000_000,
): Promise<unknown> {
    const contentLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new LiveErrorProviderError(source, 'invalid-response')
    }

    const text = await response.text()
    if (text.length > maxBytes) {
        throw new LiveErrorProviderError(source, 'invalid-response')
    }

    try {
        return JSON.parse(text)
    } catch {
        throw new LiveErrorProviderError(source, 'invalid-response')
    }
}

export function errorForResponse(
    source: LiveErrorSource,
    status: number,
): LiveErrorProviderError {
    if (status === 401 || status === 403) {
        return new LiveErrorProviderError(source, 'unauthorized')
    }
    if (status === 404) {
        return new LiveErrorProviderError(source, 'not-found')
    }
    if (status === 408 || status === 504) {
        return new LiveErrorProviderError(source, 'timeout')
    }
    if (status === 429) {
        return new LiveErrorProviderError(source, 'rate-limited')
    }
    return new LiveErrorProviderError(source, 'unavailable')
}
