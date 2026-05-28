import { describe, it, expect } from 'vitest'
import { mapCustomer, toCsv } from '../../../app/(dashboard)/customers/_lib/shop-customer-record'
import type { ShopCustomerRecord } from '../../../app/(dashboard)/customers/_lib/shop-customer-record'

describe('Shop Customer Record Utils (TC-F25-011..014)', () => {
    describe('TC-F25-011: mapCustomer — full doc maps all fields correctly', () => {
        it('TC-F25-011: Should map Payload doc to ShopCustomerRecord with all fields', () => {
            // Arrange: mock Payload customer doc with all fields
            const doc = {
                id: 42,
                email: 'alice@example.com',
                name: 'Alice Smith',
                phone: '+60123456789',
                rank: 'gold',
                notes: 'VIP customer',
                addresses: [
                    {
                        id: 'addr-1',
                        label: 'Home',
                        line1: 'No. 12 Jalan ABC',
                        line2: 'Apt 5',
                        city: 'Kuala Lumpur',
                        state: 'WP',
                        postcode: '50000',
                        country: 'Malaysia',
                        isDefault: true,
                    },
                    {
                        id: 'addr-2',
                        label: 'Office',
                        line1: 'No. 100 Jalan XYZ',
                        line2: null,
                        city: 'Petaling Jaya',
                        state: 'Selangor',
                        postcode: '46000',
                        country: 'Malaysia',
                        isDefault: false,
                    },
                ],
                firstOrderAt: '2026-01-15T10:00:00Z',
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-05-20T14:30:00Z',
            }

            // Act: map customer with order stats
            const result = mapCustomer(doc, 5, 450.0, 80, 20)

            // Assert: all fields mapped correctly
            expect(result.id).toBe(42)
            expect(result.email).toBe('alice@example.com')
            expect(result.name).toBe('Alice Smith')
            expect(result.phone).toBe('+60123456789')
            expect(result.rank).toBe('gold')
            expect(result.notes).toBe('VIP customer')
            expect(result.firstOrderAt).toBe('2026-01-15T10:00:00Z')
            expect(result.orderCount).toBe(5)
            expect(result.lifetime).toBe(450.0)
            expect(result.completedRate).toBe(80)
            expect(result.failedRate).toBe(20)
            expect(result.createdAt).toBe('2026-01-01T00:00:00Z')
            expect(result.updatedAt).toBe('2026-05-20T14:30:00Z')

            // Assert: addresses array mapped correctly
            expect(result.addresses).toHaveLength(2)
            expect(result.addresses[0]).toEqual({
                id: 'addr-1',
                label: 'Home',
                line1: 'No. 12 Jalan ABC',
                line2: 'Apt 5',
                city: 'Kuala Lumpur',
                state: 'WP',
                postcode: '50000',
                country: 'Malaysia',
                isDefault: true,
            })
            expect(result.addresses[1].isDefault).toBe(false)
        })
    })

    describe('TC-F25-012: mapCustomer — null fields preserved', () => {
        it('TC-F25-012: Should preserve null fields and empty addresses array', () => {
            // Arrange: doc with null fields
            const doc = {
                id: 99,
                email: 'bob@example.com',
                name: 'Bob Jones',
                phone: null,
                rank: null,
                notes: null,
                addresses: [],
                firstOrderAt: null,
                createdAt: '2026-02-01T00:00:00Z',
                updatedAt: '2026-05-20T00:00:00Z',
            }

            // Act
            const result = mapCustomer(doc, 0, 0, 0, 0)

            // Assert: nulls preserved
            expect(result.phone).toBeNull()
            expect(result.rank).toBeNull()
            expect(result.notes).toBeNull()
            expect(result.firstOrderAt).toBeNull()
            expect(result.addresses).toEqual([])
            expect(result.orderCount).toBe(0)
            expect(result.lifetime).toBe(0)
        })
    })

    describe('TC-F25-013: toCsv — headers and rows format', () => {
        it('TC-F25-013: Should generate valid CSV with BOM, header row, and data rows', () => {
            // Arrange: 2 customer records
            const records: ShopCustomerRecord[] = [
                {
                    id: 1,
                    email: 'alice@example.com',
                    name: 'Alice',
                    phone: '+60111',
                    rank: 'gold',
                    notes: 'Note 1',
                    addresses: [],
                    firstOrderAt: '2026-01-01T00:00:00Z',
                    orderCount: 5,
                    lifetime: 450.0,
                    completedRate: 80,
                    failedRate: 20,
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-05-20T00:00:00Z',
                },
                {
                    id: 2,
                    email: 'bob@example.com',
                    name: 'Bob',
                    phone: null,
                    rank: 'silver',
                    notes: null,
                    addresses: [],
                    firstOrderAt: '2026-02-01T00:00:00Z',
                    orderCount: 2,
                    lifetime: 100.5,
                    completedRate: 50,
                    failedRate: 50,
                    createdAt: '2026-02-01T00:00:00Z',
                    updatedAt: '2026-05-20T00:00:00Z',
                },
            ]

            // Act
            const csv = toCsv(records)

            // Assert: CSV format
            expect(csv).toContain('﻿') // BOM prefix at start
            // RFC 4180: rows separated by \r\n
            const lines = csv.split('\r\n')
            expect(lines.length).toBe(3) // header + 2 rows (BOM is part of header line)

            // Header line should contain quoted column names
            const headerLine = lines[0]
            expect(headerLine).toContain('"ID"')
            expect(headerLine).toContain('"Email"')
            expect(headerLine).toContain('"Name"')
            expect(headerLine).toContain('"Phone"')
            expect(headerLine).toContain('"Rank"')
            expect(headerLine).toContain('"Order Count"')
            expect(headerLine).toContain('"Lifetime (MYR)"')
            expect(headerLine).toContain('"Created At"')
            expect(headerLine).toContain('"Last Order At"')

            // Count commas: 9 columns = 8 commas per line
            const headerCommaCount = (headerLine.match(/,/g) || []).length
            expect(headerCommaCount).toBe(8)
        })
    })

    describe('TC-F25-014: toCsv — escapes commas and quotes', () => {
        it('TC-F25-014: Should escape commas and quotes in field values', () => {
            // Arrange: customer with comma and quote in name
            const records: ShopCustomerRecord[] = [
                {
                    id: 3,
                    email: 'charlie@example.com',
                    name: 'Smith, John "The Boss"',
                    phone: null,
                    rank: 'bronze',
                    notes: null,
                    addresses: [],
                    firstOrderAt: null,
                    orderCount: 1,
                    lifetime: 50.0,
                    completedRate: 100,
                    failedRate: 0,
                    createdAt: '2026-03-01T00:00:00Z',
                    updatedAt: '2026-05-20T00:00:00Z',
                },
            ]

            // Act
            const csv = toCsv(records)
            const lines = csv.split('\r\n')
            const dataLine = lines[1] // First data row (after header)

            // Assert: name field properly escaped
            // "Smith, John ""The Boss""" — quotes doubled, wrapped in quotes
            expect(dataLine).toContain('"Smith, John ""The Boss"""')
        })

        it('TC-F25-014: Should escape formula injection prefix characters', () => {
            // Arrange: customer name with formula-injection prefix
            const records: ShopCustomerRecord[] = [
                {
                    id: 4,
                    email: 'danger@example.com',
                    name: '=SUM(A1:A10)',
                    phone: '+60222',
                    rank: null,
                    notes: null,
                    addresses: [],
                    firstOrderAt: null,
                    orderCount: 0,
                    lifetime: 0,
                    completedRate: 0,
                    failedRate: 0,
                    createdAt: '2026-04-01T00:00:00Z',
                    updatedAt: '2026-05-20T00:00:00Z',
                },
            ]

            // Act
            const csv = toCsv(records)
            const lines = csv.split('\r\n')
            const dataLine = lines[1]

            // Assert: leading '=' replaced with ''
            // Function sanitizeCell prepends single quote, then outer quotes wrap it
            expect(dataLine).toContain("\"'=SUM(A1:A10)\"")
        })
    })
})
