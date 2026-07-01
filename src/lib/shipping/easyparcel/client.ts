import 'server-only'
import { EP_API_BASE, EasyParcelError } from './types'
import type {
    EpQuotationParams,
    EpQuotationResponse,
    EpSubmitOrderParams,
    EpSubmitOrderResponse,
    EpTrackingResponse,
    EpCancelParams,
    EpWalletResponse,
    EpAccountInfoResponse,
    EpCourierListResponse,
} from './types'

const TIMEOUT_MS = 10_000

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
    return epFetch('POST', '/open_api/2026-03/shipment/quotations', token, { shipment: [params] })
}

/**
 * Submit a shipment order. Auto-deducts EP wallet and returns tracking_number + awb.
 * No separate pay step required (New API).
 */
export async function submitOrder(
    token: string,
    params: EpSubmitOrderParams,
): Promise<EpSubmitOrderResponse> {
    return epFetch('POST', '/open_api/2026-03/shipment/submit_orders', token, { shipment: [params] })
}

/** Fetch tracking events by tracking number. */
export async function tracking(
    token: string,
    trackingNumber: string,
): Promise<EpTrackingResponse> {
    return epFetch(
        'GET',
        `/open_api/2026-03/shipment/tracking?tracking_number=${encodeURIComponent(trackingNumber)}`,
        token,
    )
}

/** Cancel a shipment by tracking number. */
export async function cancelShipment(
    token: string,
    params: EpCancelParams,
): Promise<unknown> {
    return epFetch('POST', '/open_api/2026-03/shipment/cancel', token, { shipment: [params] })
}

/** Get EP wallet balance for the authenticated account. */
export async function walletBalance(token: string): Promise<EpWalletResponse> {
    // Live path is /wallet (NOT /account/wallet — that 404s). Verified against the API.
    return epFetch('GET', '/open_api/2026-03/wallet', token)
}

/**
 * Get the connected EP account info — name, account type, and per-address details.
 * Verified live: GET (NOT POST as the public spec states) at /account/get_account_information.
 * The sender email lives at data.address.pickup_address.email (empty until merchant configures it).
 */
export async function getAccountInfo(token: string): Promise<EpAccountInfoResponse> {
    return epFetch('GET', '/open_api/2026-03/account/get_account_information', token)
}

/** List available couriers for a country. courier_id here matches quotation courier.courier_id. */
export async function courierList(token: string, countryCode = 'MY'): Promise<EpCourierListResponse> {
    return epFetch('GET', `/open_api/2026-03/courier/list?country_code=${encodeURIComponent(countryCode)}`, token)
}
