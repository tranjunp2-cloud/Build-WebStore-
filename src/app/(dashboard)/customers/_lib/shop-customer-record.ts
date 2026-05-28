export type AddressRecord = {
    id: string
    label: string | null
    line1: string
    line2: string | null
    city: string | null
    state: string | null
    postcode: string | null
    country: string
    isDefault: boolean
}

export type ShopCustomerRecord = {
    id: number
    email: string | null
    name: string
    phone: string | null
    rank: 'bronze' | 'silver' | 'gold' | 'vip' | null
    notes: string | null
    addresses: AddressRecord[]
    firstOrderAt: string | null
    /** Computed from orders — 0 on list until detail fetch */
    orderCount: number
    /** Computed from orders — MYR total spend */
    lifetime: number
    /** Computed from orders — 0-100 */
    completedRate: number
    /** Computed from orders — 0-100 */
    failedRate: number
    /** Computed from orders — most recent order date */
    latestOrderAt: string | null
    createdAt: string
    updatedAt: string
}

export type ShopCustomerFilters = {
    search?: string
    rank?: 'all' | 'none' | 'bronze' | 'silver' | 'gold' | 'vip'
    dateFrom?: string    // ISO date string
    dateTo?: string      // ISO date string
    page?: number
    limit?: number
}

export type UpdateCustomerData = {
    name?: string
    rank?: 'bronze' | 'silver' | 'gold' | 'vip' | null
    notes?: string | null
    addresses?: AddressRecord[]
}

function mapAddress(a: Record<string, unknown>): AddressRecord {
    return {
        id: String(a.id ?? ''),
        label: (a.label as string) || null,
        line1: (a.line1 as string) ?? '',
        line2: (a.line2 as string) || null,
        city: (a.city as string) || null,
        state: (a.state as string) || null,
        postcode: (a.postcode as string) || null,
        country: (a.country as string) || 'Malaysia',
        isDefault: Boolean(a.isDefault),
    }
}

export function mapCustomer(
    doc: Record<string, unknown>,
    orderCount = 0,
    lifetime = 0,
    completedRate = 0,
    failedRate = 0,
): ShopCustomerRecord {
    const addresses = Array.isArray(doc.addresses)
        ? (doc.addresses as Record<string, unknown>[]).map(mapAddress)
        : []
    return {
        id: doc.id as number,
        email: (doc.email as string) || null,
        name: doc.name as string,
        phone: (doc.phone as string) || null,
        rank: (doc.rank as ShopCustomerRecord['rank']) || null,
        notes: (doc.notes as string) || null,
        addresses,
        firstOrderAt: (doc.firstOrderAt as string) || null,
        latestOrderAt: (doc.latestOrderAt as string) || null,
        orderCount,
        lifetime,
        completedRate,
        failedRate,
        createdAt: doc.createdAt as string,
        updatedAt: doc.updatedAt as string,
    }
}

const CSV_HEADERS = ['ID', 'Email', 'Name', 'Phone', 'Rank', 'Order Count', 'Lifetime (MYR)', 'Created At', 'Last Order At']

function sanitizeCell(v: string): string {
    // Strip embedded newlines — preserved \r\n break RFC 4180 row structure in Excel/line-based parsers
    const clean = v.replace(/[\r\n]+/g, ' ')
    // Prevent CSV formula injection (Excel, LibreOffice)
    return /^[=+\-@]/.test(clean) ? `'${clean}` : clean
}

export function toCsv(records: ShopCustomerRecord[]): string {
    const header = CSV_HEADERS.map(h => `"${h}"`).join(',')
    const rows = records.map(r =>
        [
            String(r.id),
            r.email ?? '',
            r.name ?? '',
            r.phone ?? '',
            r.rank ?? '',
            String(r.orderCount),
            r.lifetime.toFixed(2),
            r.createdAt ?? '',
            r.latestOrderAt ?? '',
        ]
            .map(sanitizeCell)
            .map(v => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
    )
    // BOM ensures Excel opens UTF-8 CSV correctly without encoding prompt.
    // Use explicit ﻿ escape (avoids invisible-character ambiguity in source editors).
    // RFC 4180 requires \r\n row separators.
    return '﻿' + [header, ...rows].join('\r\n')
}
