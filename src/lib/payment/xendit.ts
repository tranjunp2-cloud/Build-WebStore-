import { xenditFetch } from './xendit-client'
import type { XenditAccountStatus } from './types'

export interface XenditAccount {
    id: string
    status: string
    email?: string
    public_profile?: { business_name?: string }
    onboarding_url?: string
}

export interface CreateManagedAccountParams {
    email: string
    businessName: string
}

/** Xendit requires alphanumeric-only business names — strip diacritics + special chars. */
function sanitizeBusinessName(name: string): string {
    return (
        name
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')  // strip diacritics (à→a, ê→e, etc.)
            .replace(/[^a-zA-Z0-9 ]/g, '')    // remove non-alphanumeric non-space
            .replace(/\s+/g, ' ')
            .trim() || 'Business'
    )
}

/** POST /v2/accounts — create a MANAGED sub-account. */
export async function createManagedAccount(params: CreateManagedAccountParams): Promise<XenditAccount> {
    return xenditFetch<XenditAccount>('/v2/accounts', {
        method: 'POST',
        body: {
            email: params.email,
            type: 'MANAGED',
            public_profile: { business_name: sanitizeBusinessName(params.businessName) },
        },
    })
}

/** GET /v2/accounts/{id}. */
export async function getAccountById(accountId: string): Promise<XenditAccount> {
    return xenditFetch<XenditAccount>(`/v2/accounts/${accountId}`, { method: 'GET' })
}

/** GET /v2/accounts?types[]=MANAGED — list platform sub-accounts. Used to recover from 409 duplicate. */
export async function listManagedAccounts(): Promise<XenditAccount[]> {
    const result = await xenditFetch<{ data?: XenditAccount[] }>('/v2/accounts?types[]=MANAGED', { method: 'GET' })
    return result.data ?? []
}

/**
 * Return the hosted onboarding/KYB URL for a MANAGED account, or null if unavailable.
 * Calls POST /v2/accounts/{id}/hosted_activation — returns null in sandbox (endpoint doesn't exist).
 * In production Xendit sends an activation email automatically; the URL is bonus for direct redirect.
 */
export async function getOnboardingUrl(accountId: string): Promise<string | null> {
    try {
        const result = await xenditFetch<{ activation_url?: string }>(`/v2/accounts/${accountId}/hosted_activation`, {
            method: 'POST',
            body: {},
        })
        return result.activation_url ?? null
    } catch {
        return null
    }
}

export type XenditChannelCode = 'TOUCHNGO' | 'GRABPAY' | 'SHOPEEPAY' | 'BOOST' | 'MAE' | 'CARDS' | 'QR_CODE' | 'FPX'

export interface CreatePaymentRequestParams {
    // Model C: merchant's own Xendit key (mutually exclusive with forUserId)
    apiKey?: string
    // Model B (XenPlatform): ECH sub-account id header
    forUserId?: string
    referenceId: string         // String(order.id) — idempotent key
    amount: number              // RM major unit (e.g. 12.50). NOT sen. Order.total is already RM.
    channelCode: XenditChannelCode
    customerEmail: string
    successReturnUrl: string
    failureReturnUrl: string
}

export interface XenditPaymentRequest {
    id: string                  // pr-...
    status: string              // PENDING | REQUIRES_ACTION | SUCCEEDED | FAILED
    actions?: Array<{ action: string; url?: string; qr_code?: string }>
}

/** POST /v3/payment_requests — create payment with for-user-id header.
 * CRITICAL: amount is RM major unit. Xendit MYR ≠ sen. Do NOT multiply by 100. */
export async function createPaymentRequest(p: CreatePaymentRequestParams): Promise<XenditPaymentRequest> {
    const isQr = p.channelCode === 'QR_CODE'
    const body = {
        reference_id: p.referenceId,
        amount: Math.round(p.amount * 100) / 100, // 2dp RM — NOT *100 (RM major unit)
        currency: 'MYR',
        payment_method: buildPaymentMethod(p.channelCode, p.successReturnUrl, p.failureReturnUrl),
        channel_code: p.channelCode,
        ...(isQr ? {} : { success_return_url: p.successReturnUrl, failure_return_url: p.failureReturnUrl }),
    }
    return xenditFetch<XenditPaymentRequest>('/v3/payment_requests', {
        method: 'POST',
        body,
        forUserId: p.forUserId,
        apiKey: p.apiKey,
    })
}

/** GET /v3/payment_requests/{id} — used by reconcile cron + refund. */
export async function getPaymentRequest(id: string, forUserId: string): Promise<XenditPaymentRequest> {
    return xenditFetch<XenditPaymentRequest>(`/v3/payment_requests/${id}`, { method: 'GET', forUserId })
}

/** channelCode → Orders.paymentMethod enum value. */
export function mapChannelToPaymentMethod(code: string): 'ewallet' | 'fpx' | 'card' {
    switch (code?.toUpperCase()) {
        case 'CARDS': return 'card'
        case 'FPX': return 'fpx'
        default: return 'ewallet' // TOUCHNGO/GRABPAY/SHOPEEPAY/BOOST/MAE/QR_CODE
    }
}

/** Build nested payment_method object per Xendit v3 API shape.
 * TODO(sandbox): verify FPX shape against Xendit MY sandbox before going live. */
function buildPaymentMethod(
    channelCode: XenditChannelCode,
    successUrl: string,
    failureUrl: string,
): Record<string, unknown> {
    switch (channelCode) {
        case 'QR_CODE':
            return {
                type: 'QR_CODE',
                reusability: 'ONE_TIME_USE',
                qr_code: { channel_code: 'DUITNOW_QR' },
            }
        case 'FPX':
            // TODO(sandbox): verify exact shape for FPX in Xendit MY — may need additional fields
            return {
                type: 'DIRECT_DEBIT',
                reusability: 'ONE_TIME_USE',
                direct_debit: {
                    channel_code: 'FPX',
                    channel_properties: { success_return_url: successUrl, failure_return_url: failureUrl },
                },
            }
        case 'CARDS':
            return {
                type: 'CARD',
                reusability: 'ONE_TIME_USE',
                card: { channel_properties: { success_return_url: successUrl, failure_return_url: failureUrl } },
            }
        default:
            // TOUCHNGO | GRABPAY | SHOPEEPAY | BOOST | MAE
            return {
                type: 'EWALLET',
                reusability: 'ONE_TIME_USE',
                ewallet: {
                    channel_code: channelCode,
                    channel_properties: { success_return_url: successUrl, failure_return_url: failureUrl },
                },
            }
    }
}

export interface CreateInvoiceParams {
    apiKey: string
    externalId: string          // String(order.id)
    amount: number              // RM major unit — NOT sen
    payerEmail: string
    description: string
    successRedirectUrl: string
    failureRedirectUrl: string
}

export interface XenditInvoice {
    id: string                  // inv-...
    invoice_url: string         // hosted checkout page URL
    status: string              // PENDING | PAID | EXPIRED
}

/** POST /v2/invoices — create a hosted checkout page (Invoice API).
 * Customer picks their own payment method on Xendit's page.
 * Returns invoice_url to redirect the buyer to. */
export async function createInvoice(p: CreateInvoiceParams): Promise<XenditInvoice> {
    return xenditFetch<XenditInvoice>('/v2/invoices', {
        method: 'POST',
        apiKey: p.apiKey,
        body: {
            external_id: p.externalId,
            amount: Math.round(p.amount * 100) / 100,
            payer_email: p.payerEmail,
            description: p.description,
            currency: 'MYR',
            success_redirect_url: p.successRedirectUrl,
            failure_redirect_url: p.failureRedirectUrl,
        },
    })
}

export interface XenditInvoiceStatus {
    id: string
    status: string          // PENDING | PAID | SETTLED | EXPIRED
    payment_method?: string // EWALLET | BANK_TRANSFER | CREDIT_CARD | ...
    payment_channel?: string // TOUCHNGO | GRABPAY | ALIPAY | FPX | ...
}

/** GET /v2/invoices/{id} — fetch invoice status. Uses merchant's own API key (Model C). */
export async function getInvoice(invoiceId: string, apiKey: string): Promise<XenditInvoiceStatus> {
    return xenditFetch<XenditInvoiceStatus>(`/v2/invoices/${invoiceId}`, { method: 'GET', apiKey })
}

export interface CreateRefundParams {
    // Model C (Invoice API): merchant's own key
    apiKey?: string
    invoiceId?: string
    // Model B (Payment Request API): XenPlatform sub-account
    forUserId?: string
    paymentRequestId?: string
    amount: number      // RM major unit — full refund = order.total
    reason?: string
    // Prevents double-refund on retry (e.g. network timeout): Xendit returns cached result
    // for duplicate requests with the same key within 24h.
    idempotencyKey?: string
}
export interface XenditRefund { id: string; status: string }

/** POST /refunds — full/partial refund of a Xendit payment.
 * Invoice API (Model C): pass apiKey + invoiceId.
 * Payment Request API (Model B): pass forUserId + paymentRequestId.
 * CRITICAL: amount is RM major unit. Do NOT multiply by 100. */
export async function createRefund(p: CreateRefundParams): Promise<XenditRefund> {
    const body: Record<string, unknown> = {
        amount: Math.round(p.amount * 100) / 100,
        reason: p.reason ?? 'REQUESTED_BY_CUSTOMER',
    }
    if (p.invoiceId) body.invoice_id = p.invoiceId
    else if (p.paymentRequestId) body.payment_request_id = p.paymentRequestId

    return xenditFetch<XenditRefund>('/refunds', {
        method: 'POST',
        apiKey: p.apiKey,
        forUserId: p.forUserId,
        idempotencyKey: p.idempotencyKey,
        body,
    })
}

export interface XenditBalance { balance: number; currency: string }
/** GET /balance — merchant's current balance. Returns RM major unit. */
export async function getBalance(forUserId: string): Promise<XenditBalance> {
    return xenditFetch<XenditBalance>('/balance', { method: 'GET', forUserId })
}

export interface SetCallbackUrlResponse {
    status: string
    user_id: string
    url: string
    environment: string
    // Account-level webhook verification token — same value shown in Xendit Dashboard
    // and sent as X-CALLBACK-TOKEN header on every webhook event.
    callback_token: string
}

/** POST /callback_urls/:type — register a webhook URL for a specific event type.
 * Returns callback_token which equals the merchant's Webhook Verification Token.
 * Use to validate the token the merchant entered and auto-register ECH's webhook URL. */
export async function setCallbackUrl(
    type: string,
    url: string,
    apiKey: string,
): Promise<SetCallbackUrlResponse> {
    return xenditFetch<SetCallbackUrlResponse>(`/callback_urls/${type}`, {
        method: 'POST',
        apiKey,
        body: { url },
    })
}

export interface XenditPaymentChannel {
    channel_code: string       // e.g. TOUCHNGO, GRABPAY, ALIPAY
    channel_name: string       // e.g. "TNG eWallet"
    channel_category: string   // EWALLET | QR_CODE | VIRTUAL_ACCOUNT | DIRECT_DEBIT
    is_activated: boolean
    currency: string
    country: string
}

/** GET /payment_channels — list active payment channels for merchant (Model C, apiKey). */
export async function getPaymentChannels(apiKey: string): Promise<XenditPaymentChannel[]> {
    const result = await xenditFetch<{ data?: XenditPaymentChannel[] } | XenditPaymentChannel[]>(
        '/payment_channels',
        { method: 'GET', apiKey },
    )
    // Xendit may return array directly or wrapped in { data: [...] }
    return Array.isArray(result) ? result : (result.data ?? [])
}

/** Map raw Xendit account status string → internal XenditAccountStatus. */
export function mapXenditAccountStatus(raw: string): XenditAccountStatus {
    switch (raw?.toUpperCase()) {
        case 'INVITED': return 'INVITED'
        case 'REGISTERED': return 'REGISTERED'
        case 'AWAITING_DOCS':
        case 'AWAITING_DOCUMENTS': return 'AWAITING_DOCS'
        case 'PENDING_VERIFICATION':
        case 'PENDING': return 'PENDING_VERIFICATION'
        case 'LIVE':
        case 'ACTIVE': return 'LIVE'
        case 'SUSPENDED':
        case 'DEACTIVATED': return 'SUSPENDED'
        default: return 'REGISTERED'
    }
}
