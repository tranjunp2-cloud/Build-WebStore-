import { createHash } from 'node:crypto'
import type { LiveError } from './contracts'

type VercelProviderKeyInput = Pick<
    LiveError,
    'host' | 'method' | 'route' | 'statusCode' | 'message'
>

export function createVercelProviderKey(input: VercelProviderKeyInput): string {
    const canonical = [
        input.host ?? '',
        input.method ?? '',
        input.route ?? '',
        input.statusCode === null ? '' : String(input.statusCode),
        input.message,
    ].join('\n')

    return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

export function getProviderKey(error: LiveError): string {
    return error.source === 'sentry'
        ? error.providerId
        : createVercelProviderKey(error)
}

export function getRuntimeRelatedId(error: LiveError): string {
    return `${error.source}:${getProviderKey(error)}`
}

export function getExactCorrelationId(left: LiveError, right: LiveError): string | null {
    if (left.requestId && left.requestId === right.requestId) return left.requestId
    if (left.traceId && left.traceId === right.traceId) return left.traceId
    return null
}
