import 'server-only'
import { EP_API_BASE, EasyParcelError } from './types'
import type {
    EpQuotationParams,
    EpQuotationResponse,
    EpSubmitOrderParams,
    EpSubmitOrderResponse,
    EpTrackingStatusResponse,
    EpCancelParams,
    EpWalletResponse,
    EpAccountInfoResponse,
    EpCourierListResponse,
} from './types'

const TIMEOUT_MS = 10_000

// EP OpenAPI version segment (github.com/easyparcel/OpenAPI). 2026-06 is additive over
// 2026-03: BYOC pricing fields (byoc_charges/_tax, seller_payable_amount) + category/hscode
// list endpoints — no breaking changes to the request/response shapes we consume.
const EP_API_VERSION = '2026-06'
const API = `/open_api/${EP_API_VERSION}`

async function epFetch<T>(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: unknown,
): Promise<T> {
    const url = `${EP_API_BASE}${path}`

    const doFetch = async (): Promise<T> => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
        try {
            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            })
            if (!res.ok) {
                let epBody: unknown
                try { epBody = await res.json() } catch { /* non-JSON body */ }
                throw new EasyParcelError('HTTP_ERROR', `EP HTTP ${res.status}`, { status: res.status, body: epBody })
            }
            return (await res.json()) as T
        } finally {
            clearTimeout(timer)
        }
    }

    try {
        return await doFetch()
    } catch (err) {
        // Rethrow 4xx immediately — retry only on 5xx and network-level errors (DNS, timeout)
        if (err instanceof EasyParcelError && err.code === 'HTTP_ERROR') {
            const status = (err.raw as { status?: number })?.status
            if (!status || status < 500) throw err
        }
        return await doFetch()
    }
}

/** Get shipping quotations for a parcel. */
export async function quotations(
    token: string,
    params: EpQuotationParams,
): Promise<EpQuotationResponse> {
    return epFetch('POST', `${API}/shipment/quotations`, token, { shipment: [params] })
}

/**
 * Submit a shipment order. Auto-deducts EP wallet and returns tracking_number + awb.
 * No separate pay step required (New API).
 */
export async function submitOrder(
    token: string,
    params: EpSubmitOrderParams,
): Promise<EpSubmitOrderResponse> {
    return epFetch('POST', `${API}/shipment/submit_orders`, token, { shipment: [params] })
}

/**
 * Fetch tracking status for one or more AWB numbers (max 100 per call).
 * Documented endpoint (EP OpenAPI docs, identical in 2026-03 and 2026-06):
 * POST /shipment/tracking_status body { awb_numbers: string[] }.
 */
export async function trackingStatus(
    token: string,
    awbNumbers: string[],
): Promise<EpTrackingStatusResponse> {
    return epFetch(
        'POST',
        `${API}/shipment/tracking_status`,
        token,
        { awb_numbers: awbNumbers },
    )
}

/** Convenience wrapper: fetch tracking status for a single AWB number. */
export async function tracking(
    token: string,
    awbNumber: string,
): Promise<EpTrackingStatusResponse> {
    return trackingStatus(token, [awbNumber])
}

/** Cancel a shipment by tracking number. */
export async function cancelShipment(
    token: string,
    params: EpCancelParams,
): Promise<unknown> {
    return epFetch('POST', `${API}/shipment/cancel`, token, { shipment: [params] })
}

/** Get EP wallet balance for the authenticated account. */
export async function walletBalance(token: string): Promise<EpWalletResponse> {
    // Live path is /wallet (NOT /account/wallet — that 404s). Verified against the API.
    return epFetch('GET', `${API}/wallet`, token)
}

/**
 * Get the connected EP account info — name, account type, and per-address details.
 * Verified live: GET (NOT POST as the public spec states) at /account/get_account_information.
 * The sender email lives at data.address.pickup_address.email (empty until merchant configures it).
 */
export async function getAccountInfo(token: string): Promise<EpAccountInfoResponse> {
    return epFetch('GET', `${API}/account/get_account_information`, token)
}

/** List available couriers for a country. courier_id here matches quotation courier.courier_id. */
export async function courierList(token: string, countryCode = 'MY'): Promise<EpCourierListResponse> {
    return epFetch('GET', `${API}/courier/list?country_code=${encodeURIComponent(countryCode)}`, token)
}
