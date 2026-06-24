// EP API base URL pattern: https://connect.easyparcel.my/?ac={Action}
export type EpEnv = 'production' | 'demo'

export const EP_BASE_URLS: Record<EpEnv, string> = {
    production: 'https://connect.easyparcel.my/',
    demo: 'https://demo.connect.easyparcel.my/',
}

export interface EasyParcelConfig {
    apiKey: string    // EP API key
    authKey: string   // EP auth key
    env: EpEnv        // 'production' | 'demo'
}

// --- Rate Check ---
export interface EpRateCheckItem {
    weight: number   // kg (float, min 0.1)
    width?: number   // cm
    height?: number  // cm
    length?: number  // cm
}

export interface EpRateCheckParams {
    pick_code: string   // sender postcode
    send_code: string   // receiver postcode
    send_state: string  // EP state code (e.g. 'Selangor')
    weight: number      // kg
    cod?: number        // COD amount in RM (float) — 0 = non-COD
}

export interface EpRateOption {
    courier_id: string
    courier_name: string
    service_id: string
    service_name: string
    price: number          // RM (float) from EP
    priceSen: number       // RM * 100 (sen) — our domain unit
    cod_available: boolean
    cod_service_max_cod_amount?: number  // RM — per-courier COD max from API
    est_delivery: string
}

export interface EpRateCheckResponse {
    status: string
    rates?: EpRateOption[]
}

// --- Submit Order ---
export interface EpSubmitOrderParams {
    pick_name: string
    pick_contact: string   // normalized "60XXXXXXXXX"
    pick_addr1: string
    pick_addr2?: string
    pick_city: string
    pick_state: string     // EP state code
    pick_code: string      // postcode
    pick_country: string   // 'MY'
    send_name: string
    send_contact: string
    send_addr1: string
    send_addr2?: string
    send_city: string
    send_state: string
    send_code: string
    send_country: string
    weight: number         // kg
    content: string        // parcel description
    value: number          // RM (declared value)
    service_id: string
    collection_date: string  // "YYYY-MM-DD"
    cod?: number             // RM — include only if COD order
}

export interface EpSubmitOrderResponse {
    status: string
    order_no?: string
    tracking_no?: string
}

// --- Pay Order ---
export interface EpPayOrderParams {
    order_no: string
}

export interface EpPayOrderResponse {
    status: string
    awb_no?: string
    label_url?: string
    tracking_no?: string
}

// --- Parcel Status ---
export interface EpParcelStatusParams {
    awb_no: string
}

export interface EpParcelStatusEvent {
    status: string
    description: string
    event_time: string
}

export interface EpParcelStatusResponse {
    status: string
    tracking_status?: string
    events?: EpParcelStatusEvent[]
}

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
