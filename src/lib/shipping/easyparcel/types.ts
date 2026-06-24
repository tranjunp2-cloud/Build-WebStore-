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
    codMaxSen?: number    // max COD amount in sen (from API)
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

export interface EpSubmitOrderResponse {
    status_code: number
    data: {
        shipment: Array<{
            status: 'success' | 'error'
            shipment_id?: string
            reference?: string
            tracking_number?: string
            awb?: string
            errors?: string[]
        }>
    }
}

// --- Tracking ---
export interface EpTrackingEvent {
    status: string
    status_code?: string
    timestamp: string
    location?: string
    remark?: string
}

export interface EpTrackingResponse {
    status_code: number
    data: {
        tracking_number: string
        reference?: string
        status: string
        status_code?: string
        events?: EpTrackingEvent[]
    }
}

// --- Cancel ---
export interface EpCancelParams {
    tracking_number: string
    reference?: string
}

// --- Wallet ---
export interface EpWalletResponse {
    status_code: number
    data: {
        account_id: number
        currency_code: string
        current_balance: string    // RM string
        total_credit: string
        total_spent: string
        last_transaction?: string
    }
}
