import type { RevealTarget } from '@/lib/editor/reveal/reveal-target'

/**
 * A publish the server refused. Two kinds the editor treats differently:
 * - the page has a field to fill ("Home → Hero → CtaButton 1 → url: This field
 *   is required.") — the merchant fixes it: the toast says so and "Show" goes
 *   to that field (`target`); trying again would fail the same way.
 * - anything else (network, database) — worth a retry.
 */
export class PublishError extends Error {
    constructor(
        message: string,
        /** where the field to fix is; set only for content the merchant must fix */
        readonly target?: RevealTarget,
        readonly needsFix = false,
    ) {
        super(message)
        this.name = 'PublishError'
    }
}

export type PublishFailureBody = {
    error?: {
        message?: string
        failures?: Array<{
            pageId?: string | number
            pageTitle?: string
            errName?: string
            errMsg?: string
            pgColumn?: string
            pgTable?: string
            causeMsg?: string
            friendlyDetail?: string
            blockId?: string
            blockPath?: string
            validationErrors?: Array<{ path?: string; message?: string }>
        }>
    }
} | null

// Maps Payload field path segments → user-facing labels for publish error toasts.
const FIELD_LABELS: Record<string, string> = {
    phoneNumber: 'WhatsApp Phone Number',
    countryCode: 'WhatsApp Country Code',
}

function friendlyValidationDetail(path: string, message?: string): string {
    const field = path.split('.').pop() || path
    const label = FIELD_LABELS[field] || field
    return `${label}: ${message || 'invalid'}`
}

/** The toast's detail line for a refused publish. */
export function publishFailureDetail(body: PublishFailureBody, status: number): string {
    const firstFailure = body?.error?.failures?.[0]
    const firstValidation = firstFailure?.validationErrors?.[0]
    if (firstFailure?.friendlyDetail) {
        // GH-1621 P1: server already resolved the failing block/item, e.g.
        // "Portfolio Grid → Project 5 → Title: This field is required."
        return firstFailure.friendlyDetail
    }
    if (firstValidation?.path) {
        return friendlyValidationDetail(firstValidation.path, firstValidation.message)
    }
    if (firstFailure?.pgColumn && firstFailure?.pgTable) {
        return `${firstFailure.pgTable}.${firstFailure.pgColumn} missing — run \`npm run db:migrate\``
    }
    const isDev = process.env.NODE_ENV === 'development'
    return (isDev ? (firstFailure?.causeMsg || firstFailure?.errMsg) : undefined)
        || body?.error?.message
        || `Server returned ${status}`
}

/** The refused publish as an error the editor can act on (fix + "Show", or retry). */
export function publishFailure(body: PublishFailureBody, status: number): PublishError {
    const detail = publishFailureDetail(body, status)
    const first = body?.error?.failures?.[0]
    const needsFix = Boolean(first?.validationErrors?.length)
    if (!needsFix || !first) return new PublishError(detail)
    const pageId = first.pageId === undefined || first.pageId === null || first.pageId === '' ? undefined : String(first.pageId)
    const target: RevealTarget | undefined = first.blockId
        ? {
              surface: 'block',
              ...(pageId ? { pageId } : {}),
              blockId: first.blockId,
              ...(first.blockPath ? { path: first.blockPath } : {}),
              // "Home → Hero → CtaButton 1 → url: This field is required." → "Hero → CtaButton 1 → url"
              where: stripPage((first.friendlyDetail ?? detail).split(': ')[0]!, first.pageTitle),
          }
        : pageId
          ? { surface: 'page', pageId, where: first.pageTitle ?? detail }
          : undefined
    return new PublishError(detail, target, true)
}

const stripPage = (where: string, pageTitle?: string) => (pageTitle && where.startsWith(`${pageTitle} → `) ? where.slice(pageTitle.length + 3) : where)
