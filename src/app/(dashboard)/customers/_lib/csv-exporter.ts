import type { CustomerRecord } from './customer-record'

const HEADERS = ['ID', 'Source', 'Name', 'Email', 'Phone', 'Message', 'Status', 'Site ID', 'Created At']

function sanitizeCell(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value
}

function recordToCsvRow(record: CustomerRecord): string {
    return [
        record.id,
        record.source,
        record.name ?? '',
        record.email,
        record.phone ?? '',
        (record.message ?? '').replace(/[\n\r]/g, ' '),
        record.status,
        record.siteId?.toString() ?? '',
        record.createdAt,
    ]
        .map(sanitizeCell)
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
}

export function toCsv(records: CustomerRecord[]): string {
    const header = HEADERS.map(h => `"${h}"`).join(',')
    // BOM ensures Excel opens UTF-8 CSV correctly without encoding prompt
    return '\uFEFF' + [header, ...records.map(recordToCsvRow)].join('\n')
}
