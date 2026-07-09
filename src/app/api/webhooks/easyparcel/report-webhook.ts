import * as Sentry from '@sentry/nextjs'

/**
 * EasyParcel webhook → Sentry observability.
 *
 * WHY: EP's real payload shape is undocumented, the sandbox never dispatches, and
 * the operator has no Vercel log access. Sentry is therefore the only window into
 * what EP actually sends when a real production order changes status.
 *
 * Two channels:
 *  - echoWebhookPayload() — mirrors EVERY parsed payload (level=info) so the real
 *    shape can be observed. Always-on during the go-live canary; REMOVE once the
 *    payload shape is confirmed (see the fn doc below).
 *  - reportWebhookAnomaly() — flags a payload we could not fully process
 *    (level=error), always on, so schema drift is caught long-term.
 *
 * PII SAFETY: EP's "Shipment Created" payload carries sender/receiver name, phone,
 * email, address, postcode, city. `sendDefaultPii` is false project-wide — every
 * value leaving this module passes through redact() first, which masks any key
 * matching PII_KEY_PATTERN (recursing one level into nested data/shipment objects).
 * The two subscribed topics (Shipment/Tracking Status Update) carry no PII, so in
 * practice nothing is masked — the guard exists for the other topics.
 */

// PII VALUE keys — any key whose name matches has its value masked. Broad on purpose:
// EP's real field names are unverified, so cover documented (sender_phone_number,
// sender_address1, sender_postcode) AND legacy/alternate shapes (send_mobile, addr1,
// zip, tel, street, line1, company).
const PII_KEY_PATTERN =
    /name|phone|mobile|tel\b|email|address|addr|street|line[_-]?\d|postcode|postal|zip|city|contact|company|consignee|recipient/i

// PII CONTAINER keys — the ENTIRE subtree is masked (covers any child field name we
// haven't anticipated, e.g. { sender: { hp: "...", street: "..." } }).
const PII_CONTAINER_PATTERN = /^(sender|receiver|recipient|consignee|buyer|customer|from|to)$/i

/** Deep-copy a webhook body with PII-keyed values (and PII container subtrees) masked. */
function redact(value: unknown, depth = 0): unknown {
    if (Array.isArray(value)) {
        return depth > 2 ? '[array]' : value.map((v) => redact(v, depth + 1))
    }
    if (value && typeof value === 'object') {
        if (depth > 2) return '[object]'
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (PII_CONTAINER_PATTERN.test(k)) out[k] = '[redacted]'
            else if (PII_KEY_PATTERN.test(k)) out[k] = '[redacted]'
            else out[k] = redact(v, depth + 1)
        }
        return out
    }
    return value
}

interface EchoMeta {
    topic?: string | null
    matched?: boolean
    reason?: string
}

/**
 * Mirror the full (PII-redacted) webhook payload to Sentry for observation.
 *
 * TEMPORARY: always-on during the EP go-live canary so the operator (no Vercel log
 * access) can see EP's real payload shape. REMOVE this echo — and its call in
 * route.ts — once the shape is confirmed, to avoid steady-state info-event noise.
 */
export function echoWebhookPayload(body: Record<string, unknown>, meta: EchoMeta = {}): void {
    Sentry.withScope((scope) => {
        scope.setLevel('info')
        scope.setTag('ep_webhook.topic', meta.topic ?? 'none')
        scope.setContext('ep_webhook_payload', {
            topic: meta.topic ?? null,
            matched: meta.matched ?? null,
            reason: meta.reason ?? null,
            payloadKeys: Object.keys(body),
            body: redact(body),
        })
        Sentry.captureMessage(
            `[ep-webhook] received${meta.topic ? `: ${meta.topic}` : ''}`,
            'info',
        )
    })
}

export type WebhookAnomaly =
    | 'missing_fields' // payload parsed but no awb/status could be extracted
    | 'unknown_status' // status code/string arrived but maps to internal 'unknown'
    | 'order_not_found' // awb present but no order matches it

interface AnomalyContext {
    keys?: string[]
    topic?: string | null
    awb?: string | null
    shipmentNo?: string | null
    statusRaw?: string | number | null
}

/** Flag an unprocessable webhook to Sentry (level=error). Always on. */
export function reportWebhookAnomaly(reason: WebhookAnomaly, ctx: AnomalyContext): void {
    Sentry.withScope((scope) => {
        scope.setLevel('error')
        scope.setTag('ep_webhook.reason', reason)
        scope.setContext('ep_webhook', {
            reason,
            topic: ctx.topic ?? null,
            awb: ctx.awb ?? null,
            shipmentNo: ctx.shipmentNo ?? null,
            statusRaw: ctx.statusRaw ?? null,
            payloadKeys: ctx.keys ?? [], // key names only — no values (PII-safe)
        })
        Sentry.captureMessage(`[ep-webhook] ${reason}`, 'error')
    })
}
