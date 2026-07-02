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
        total,
        shippingServiceId,
        shippingCourier,
        weightGrams,
        collectionDate,
        codAmountRm,
        dimensionsCm,
    } = input

    const senderPhone = splitPhone(warehouse.phone ?? '')
    const receiverPhone = splitPhone(customerPhone || '600000000')
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
            phone_number_country_code: senderPhone.countryCode,
            phone_number: senderPhone.number || '0000000',
            address_1: warehouse.address1 ?? '',
            address_2: warehouse.address2,
            postcode: warehouse.postcode ?? '',
            city: warehouse.city ?? '',
            subdivision_code: mapSubdivisionCode(warehouse.state ?? ''),
            country_code: 'MY',
        },
        receiver: {
            name: customerName || 'Receiver',
            phone_number_country_code: receiverPhone.countryCode,
            phone_number: receiverPhone.number || '0000000',
            address_1: shippingAddress.line1 ?? '',
            address_2: shippingAddress.line2,
            postcode: shippingAddress.postcode ?? '',
            city: shippingAddress.city ?? '',
            subdivision_code: mapSubdivisionCode(shippingAddress.state ?? ''),
            country_code: 'MY',
        },
        feature: {
            sms_tracking: false,
            email_tracking: true,
            whatsapp_tracking: false,
            awb_branding: false,
        },
    }

    if (codAmountRm != null && codAmountRm > 0) {
        params.cod_amount = codAmountRm
    }

    return params
}
