import 'server-only'
import { mapSubdivisionCode, splitPhone, aggregateWeightKg, earliestPickupDate } from '@/lib/shipping/easyparcel/normalize'
import type { EpSubmitOrderParams } from '@/lib/shipping/easyparcel/types'

interface Warehouse {
    name?: string
    label?: string
    phone?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
}

interface ShippingAddress {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
}

interface ParcelDimensionsCm {
    width: number
    length: number
    height: number
}

// EasyParcel requires parcel dimensions (height is mandatory on submit). We have no
// per-product dimension data, so fall back to a small sensible default parcel size (cm)
// unless the caller overrides it. Prevents "The item 0 height field is required" errors.
const DEFAULT_PARCEL_DIM_CM: ParcelDimensionsCm = { width: 10, length: 10, height: 10 }

interface BuildSubmitParamsInput {
    warehouse: Warehouse
    shippingAddress: ShippingAddress
    customerName: string
    customerPhone: string
    customerEmail?: string   // buyer email → receiver.email (checkout-required, omitted if absent)
    senderEmail?: string     // merchant EP account email → sender.email
    senderCompany?: string   // merchant EP account / store name → sender.company
    total: number           // RM float (order total)
    shippingServiceId: string
    shippingCourier?: string
    weightGrams: number
    collectionDate?: string
    codAmountRm?: number    // RM float; omit for non-COD
    dimensionsCm?: Partial<ParcelDimensionsCm>  // optional override; defaults to 10×10×10 cm
}

export function buildSubmitParams(input: BuildSubmitParamsInput): EpSubmitOrderParams {
    const {
        warehouse,
        shippingAddress,
        customerName,
        customerPhone,
        customerEmail,
        senderEmail,
        senderCompany,
        total,
        shippingServiceId,
        shippingCourier,
        weightGrams,
        collectionDate,
        codAmountRm,
        dimensionsCm,
    } = input

    // No placeholder fallbacks here: a fake number ('0000000') passes EP submit but the
    // courier's AWB issuance later rejects it, stranding the shipment at "Pending AWB"
    // with the wallet already charged (live 2026-07-13). The route guards both phones
    // (isWarehouseComplete + hasUsablePhone) before calling this builder.
    const senderPhone = splitPhone(warehouse.phone ?? '')
    const receiverPhone = splitPhone(customerPhone)
    const weightKg = aggregateWeightKg(weightGrams)

    // Merge any caller override onto the default parcel size; EP requires height/width/length.
    const dim: ParcelDimensionsCm = {
        width: dimensionsCm?.width ?? DEFAULT_PARCEL_DIM_CM.width,
        length: dimensionsCm?.length ?? DEFAULT_PARCEL_DIM_CM.length,
        height: dimensionsCm?.height ?? DEFAULT_PARCEL_DIM_CM.height,
    }

    const params: EpSubmitOrderParams = {
        service_id: shippingServiceId,
        collection_date: collectionDate ?? earliestPickupDate(shippingCourier ?? ''),
        weight: weightKg,
        width: dim.width,
        length: dim.length,
        height: dim.height,
        item: [{
            content: 'Parcel',
            weight: weightKg,
            width: dim.width,
            length: dim.length,
            height: dim.height,
            currency_code: 'MYR',
            value: total,
            quantity: 1,
        }],
        sender: {
            name: warehouse.name ?? warehouse.label ?? 'Sender',
            company: senderCompany || undefined,
            // EP wants the phone's ISO 3166-1 alpha-2 country code ("MY"), NOT the
            // dialing code — sending "60" leaves EP's country field empty and fails
            // AWB issuance with "missing a valid country calling code" (official spec
            // https://easyparcel.github.io/OpenAPI, verified live 2026-07-13).
            phone_number_country_code: 'MY',
            phone_number: senderPhone.number,
            email: senderEmail || undefined,
            address_1: warehouse.address1 ?? '',
            address_2: warehouse.address2,
            postcode: warehouse.postcode ?? '',
            city: warehouse.city ?? '',
            subdivision_code: mapSubdivisionCode(warehouse.state ?? ''),
            country_code: 'MY',
        },
        receiver: {
            name: customerName || 'Receiver',
            phone_number_country_code: 'MY',
            phone_number: receiverPhone.number,
            email: customerEmail || undefined,
            address_1: shippingAddress.line1 ?? '',
            address_2: shippingAddress.line2,
            postcode: shippingAddress.postcode ?? '',
            city: shippingAddress.city ?? '',
            subdivision_code: mapSubdivisionCode(shippingAddress.state ?? ''),
            country_code: 'MY',
        },
        feature: {
            // All EP tracking add-ons OFF: ECH sends its own order/tracking emails and
            // hosts its own tracking page, so EP's paid "Tracking Email" (RM0.05/order,
            // seen on the payment breakdown) is redundant. Keep contact `email` on
            // sender/receiver (free) — it does not trigger the paid add-on.
            sms_tracking: false,
            email_tracking: false,
            whatsapp_tracking: false,
            awb_branding: false,
            // COD is a feature.cod OBJECT per EP 2026-06 spec (cod_amount + cod_currency,
            // both required) — NOT a top-level cod_amount, which EP silently ignores,
            // creating a non-COD shipment where the courier collects nothing. Omit the
            // whole object for prepaid orders.
            ...(codAmountRm != null && codAmountRm > 0
                ? { cod: { cod_amount: codAmountRm, cod_currency: 'MYR' } }
                : {}),
        },
    }

    return params
}
