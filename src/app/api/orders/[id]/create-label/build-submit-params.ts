import 'server-only'
import { normalizePhone, mapState, aggregateWeightKg, earliestPickupDate } from '@/lib/shipping/easyparcel/normalize'
import type { EpSubmitOrderParams } from '@/lib/shipping/easyparcel/types'

interface Warehouse {
    name?: string
    phone?: string
    addr1?: string
    addr2?: string
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

interface BuildSubmitParamsInput {
    warehouse: Warehouse
    shippingAddress: ShippingAddress
    customerName: string
    customerPhone: string
    total: number
    shippingServiceId: string
    shippingCourier?: string
    weightGrams: number
    collectionDate?: string
    codAmountRm?: number
}

export function buildSubmitParams(input: BuildSubmitParamsInput): EpSubmitOrderParams {
    const { warehouse, shippingAddress, customerName, customerPhone, total, shippingServiceId, shippingCourier, weightGrams, collectionDate, codAmountRm } = input
    const params: EpSubmitOrderParams = {
        pick_name: warehouse.name ?? 'Sender',
        pick_contact: normalizePhone(warehouse.phone ?? '600000000'),
        pick_addr1: warehouse.addr1 ?? '',
        pick_addr2: warehouse.addr2,
        pick_city: warehouse.city ?? '',
        pick_state: mapState(warehouse.state ?? ''),
        pick_code: warehouse.postcode ?? '',
        pick_country: warehouse.country ?? 'MY',
        send_name: customerName,
        send_contact: normalizePhone(customerPhone || '600000000'),
        send_addr1: shippingAddress.line1 ?? '',
        send_addr2: shippingAddress.line2,
        send_city: shippingAddress.city ?? '',
        send_state: mapState(shippingAddress.state ?? ''),
        send_code: shippingAddress.postcode ?? '',
        send_country: shippingAddress.country ?? 'MY',
        weight: aggregateWeightKg(weightGrams),
        content: 'Parcel',
        value: total,
        service_id: shippingServiceId,
        collection_date: collectionDate ?? earliestPickupDate(shippingCourier ?? ''),
    }
    if (codAmountRm != null && codAmountRm > 0) {
        params.cod = codAmountRm
    }
    return params
}
