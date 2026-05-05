/**
 * CSV Exporter — TC-CUST-11 through TC-CUST-15
 */
import { describe, it, expect } from 'vitest'
import { toCsv } from '@/app/(dashboard)/customers/_lib/csv-exporter'
import type { CustomerRecord } from '@/app/(dashboard)/customers/_lib/customer-record'

const makeRecord = (overrides: Partial<CustomerRecord> = {}): CustomerRecord => ({
    id: 'contact-form:1',
    rawId: 1,
    source: 'contact-form',
    name: 'Alice',
    email: 'alice@example.com',
    phone: '0123456789',
    message: 'Hello',
    status: 'new',
    siteId: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
})

describe('[TC-CUST-11..15] toCsv', () => {
    it('[TC-CUST-11] starts with UTF-8 BOM and header row', () => {
        const csv = toCsv([])
        expect(csv.charCodeAt(0)).toBe(0xFEFF)
        const firstLine = csv.split('\n')[0]!
        expect(firstLine).toContain('"ID"')
        expect(firstLine).toContain('"Email"')
        expect(firstLine).toContain('"Status"')
    })

    it('[TC-CUST-12] data row contains all record fields', () => {
        const record = makeRecord()
        const csv = toCsv([record])
        const dataLine = csv.split('\n')[1]!
        expect(dataLine).toContain('contact-form:1')
        expect(dataLine).toContain('alice@example.com')
        expect(dataLine).toContain('Alice')
        expect(dataLine).toContain('new')
    })

    it('[TC-CUST-13] prefixes formula-injection cells with a single quote', () => {
        const record = makeRecord({ email: '=cmd|/C calc!A1' })
        const csv = toCsv([record])
        // Injected cell becomes "'=cmd|/C calc!A1" — wrapped in quotes in CSV
        expect(csv).toContain("'=cmd|/C calc!A1")
    })

    it('[TC-CUST-14] strips \\n and \\r from message field', () => {
        const record = makeRecord({ message: 'line1\nline2\rline3' })
        const csv = toCsv([record])
        expect(csv).not.toMatch(/line1\n/)
        expect(csv).toContain('line1 line2 line3')
    })

    it('[TC-CUST-15] empty records array returns only the header', () => {
        const csv = toCsv([])
        expect(csv.split('\n')).toHaveLength(1)
    })
})
