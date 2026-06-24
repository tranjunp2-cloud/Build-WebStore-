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
            if (!res.ok) throw new EasyParcelError('HTTP_ERROR', `EP HTTP ${res.status}`, { status: res.status })
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
    return epFetch('POST', '/shipment/submit_orders', token, { shipment: [params] })
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
    return epFetch('GET', '/open_api/2026-03/account/wallet', token)
}
