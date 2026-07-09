export const EP_API_BASE = 'https://api.easyparcel.com'
export const EP_OAUTH_BASE = 'https://api.easyparcel.com'

// --- Error ---
export class EasyParcelError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly raw?: unknown,
    ) {
        super(message)
        this.name = 'EasyParcelError'
    }
}

// --- Domain rate option returned to callers ---
export interface RateOption {
    courier: string       // courier_id
    serviceId: string
    courierName: string
    serviceName: string
    priceSen: number      // sen
    codAvailable: boolean
    codMinSen?: number    // min COD amount in sen (from API, R2 gate)
    codMaxSen?: number    // max COD amount in sen (from API, R1 gate)
    estDelivery: string
    degraded?: boolean    // true = fallback flat rate used
}

// --- OAuth ---
export interface EpOAuthTokenResponse {
    token_type: string
    expires_in: number
    expires_at: string
    access_token: string
    refresh_token: string
    refresh_token_expires_in: number
    refresh_token_expires_at: string
}

// --- Quotation (rate check) ---
export interface EpQuotationSender {
    postcode: string
    subdivision_code: string  // ISO 3166-2, e.g. "MY-10"
    country: string           // "MY"
}

export interface EpQuotationParams {
    sender: EpQuotationSender
    receiver: EpQuotationSender
    parcel_value: number       // RM float
    weight: number             // kg float
    width?: number
    length?: number
    height?: number
}

export interface EpQuotationCod {
    available: boolean
    min_cod_amount?: string
    max_cod_amount?: string
    charges_description?: string
}

export interface EpQuotationItem {
    courier: {
        service_id: string
        service_name: string
        courier_id: string
        courier_name: string
        delivery_duration?: string | null
        is_pickup: boolean
        is_dropoff: boolean
    }
    pricing: {
        currency: string
        total_amount: string   // RM as string, e.g. "12.50"
        shipment_price: string
    }
    features: Array<{ cod?: EpQuotationCod } & Record<string, unknown>>
}

export interface EpQuotationResponse {
    status_code: number
    data: Array<{
        status: 'success' | 'error'
        quotations?: EpQuotationItem[]
        errors?: string[]
    }>
}

// --- Submit order ---
export interface EpSubmitContact {
    name: string
    company?: string
    phone_number_country_code: string  // "60"
    phone_number: string               // digits only, no leading 0
    email?: string
    address_1: string
    address_2?: string
    postcode: string
    city: string
    subdivision_code: string
    country_code: string               // "MY"
    point_code?: string
}

export interface EpSubmitItem {
    content: string
    weight: number
    height?: number
    length?: number
    width?: number
    currency_code: string    // "MYR"
    value: number            // RM float
    quantity: number
}

export interface EpSubmitOrderParams {
    reference?: string
    service_id: string
    collection_date?: string   // "YYYY-MM-DD"
    weight: number
    height?: number
    length?: number
    width?: number
    item: EpSubmitItem[]
    sender: EpSubmitContact
    receiver: EpSubmitContact
    feature?: {
        sms_tracking?: boolean
        email_tracking?: boolean
        whatsapp_tracking?: boolean
        awb_branding?: boolean
    }
    cod_amount?: number   // RM float, omit for non-COD
}

// Live shape (verified against 2026-03 doc): data is an array of orders, each with a shipments[].
// awb_number can be null when the courier generates the AWB asynchronously — status:'success' still
// means the shipment was created (and the wallet charged), so idempotency must key on shipment_number.
export interface EpSubmitShipment {
    status: 'success' | 'error'
    shipment_number?: string
    courier?: string | null
    awb_number?: string | null
    awb_url?: string | null
    awb_urls_by_format?: { A4?: string; A5?: string; A6?: string }
    tracking_url?: string | null
    reference?: string
    // Verified sandbox 2026-07-09: submit errors arrive as a NESTED array of objects, e.g.
    // [[{message:"Insufficient Credit Balance", code:"InsufficientCreditBalance", data:{...}}]]
    // (EP docs imply flat strings — reality differs). Consumers must flatten recursively
    // (see create-label's flattenEpError). Union kept loose so every observed shape parses.
    errors?: Array<
        | string
        | { message?: string; code?: string; data?: unknown }
        | Array<string | { message?: string; code?: string; data?: unknown }>
    >
}

export interface EpSubmitOrderResponse {
    status_code: number
    data: Array<{
        order_details?: { order_number?: string; account_id?: number }
        shipments: EpSubmitShipment[]
    }>
}

// --- Tracking status (POST /open_api/{version}/shipment/tracking_status) ---
// Verified against EP OpenAPI docs source (github.com/easyparcel/OpenAPI, 2026-03 + 2026-06):
// request body is { awb_numbers: string[] } (max 100), NOT a GET with ?tracking_number=.
// status_log entries carry the numeric shipment_status_code; latest_tracking_status is
// courier FREE TEXT — display-only, never used for status mapping.
export interface EpTrackingStatusLogEntry {
    event_date: string
    shipment_status_code: number
    tracking_status: string
    location?: string | null
}

export interface EpTrackingStatusResult {
    status: 'success' | 'error'
    awb_number: string
    shipment_number?: string
    order_number?: string
    latest_shipment_status_code?: number
    latest_tracking_status?: string
    latest_event_date?: string
    status_log?: EpTrackingStatusLogEntry[]
    errors?: string[]
}

export interface EpTrackingStatusResponse {
    status_code: number
    message?: string
    data: {
        results: EpTrackingStatusResult[]
    }
}

// --- Cancel ---
export interface EpCancelParams {
    tracking_number: string
    reference?: string
}

// --- Wallet ---
// Live shape (verified): data.wallet[] holds one entry per currency. There is NO flat
// current_balance/currency_code at data root — that was an incorrect earlier assumption.
export interface EpWalletEntry {
    balance: number | string
    currency: string
}

export interface EpWalletResponse {
    status_code: number
    data: {
        wallet?: EpWalletEntry[]
        free_credit_wallet?: EpWalletEntry[]
    }
}

// --- Account info (GET /open_api/{version}/account/get_account_information) ---
// Email lives per-address (pickup/billing/delivery), NOT on the account object. The address
// objects are empty {} until the merchant configures them in EasyParcel.
export interface EpAccountAddress {
    name?: string | null
    phone_number?: string | null
    email?: string | null
    company_name?: string | null
    address1?: string | null
    address2?: string | null
    postcode?: string | null
    city?: string | null
    province_code?: string | null
    country_code?: string | null
}

// --- Courier list (GET /open_api/{version}/courier/list?country_code=MY) ---
export interface EpCourier {
    courier_id: string      // e.g. "EP-CR0AP" — same namespace as quotation courier.courier_id
    uuid?: string
    courier_name: string
    short_name?: string
    courier_logo?: string
    country?: string
}

export interface EpCourierListResponse {
    status_code: number
    message?: string
    data?: EpCourier[]
}

export interface EpAccountInfoResponse {
    status_code: number
    message?: string
    data: {
        account?: {
            name?: string | null
            account_type?: string | null
        }
        address?: {
            pickup_address?: EpAccountAddress
            billing_address?: EpAccountAddress
            delivery_address?: EpAccountAddress
        }
    }
}
