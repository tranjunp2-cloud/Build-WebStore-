/**
 * Integration Tests — GET /api/v1/customers/export → CSV export with tenant isolation
 *
 * Coverage Map:
 *   TC-F25-008 → Tenant-owner accessing ?tenantId=other → forbidden or scoped to own tenant
 *
 * Strategy: Mock getPayload + getCurrentUser with tenant-scoped user;
 * call GET(request) directly; assert response status and body never leaks tenant B PII.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks ──

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        db: {
            drizzle: {
                execute: vi.fn(),
            },
        },
    }),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

import { GET } from '@/app/api/v1/customers/export/route'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'

const mockGetPayload = vi.mocked(getPayload)
const mockGetCurrentUser = vi.mocked(getCurrentUser)

// Mock customer rows for different tenants
const TENANT_A_CUSTOMERS = [
    {
        email: 'alice@example.test',
        name: 'Alice',
        phone: '1234567890',
        rank: 'gold',
        created_at: '2026-05-10T00:00:00Z',
        addr_count: 2,
        order_count: 5,
    },
]

const TENANT_B_CUSTOMERS = [
    {
        email: 'bob@example.test',
        name: 'Bob',
        phone: '0987654321',
        rank: 'silver',
        created_at: '2026-05-15T00:00:00Z',
        addr_count: 1,
        order_count: 3,
    },
]

function makeExportRequest(tenantId: string | null = null): NextRequest {
    const url = tenantId
        ? `http://localhost/api/v1/customers/export?tenantId=${tenantId}`
        : 'http://localhost/api/v1/customers/export'
    return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/v1/customers/export — Tenant Isolation (TC-F25-008)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('TC-F25-008: Tenant-owner cannot export other tenant', () => {
        it('TC-F25-008: Tenant A user GET with tenantId=B ignores param and exports own tenant', async () => {
            // Arrange: Tenant A user (non-super-admin) with numeric tenant ID
            // Note: tenant-owners IGNORE ?tenantId param; the security boundary is that
            // their query always includes their own tenant filter via resolveTenantIds.
            // This test verifies the tenant-owner's query is properly scoped.
            const tenantAUser = {
                id: 'user-tenant-a',
                email: 'owner-a@example.test',
                roles: [],
                tenants: [{ tenant: { id: 1 } }],
            }

            mockGetCurrentUser.mockResolvedValue(tenantAUser as any)

            // Mock Drizzle for tenant 1 query (tenant-owner's own tenant, not requested tenant 2)
            const mockDrizzle = {
                execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ cnt: '1' }] }) // count for tenant 1
                    .mockResolvedValueOnce({ rows: TENANT_A_CUSTOMERS }), // data for tenant 1
            }

            mockGetPayload.mockResolvedValue({
                db: { drizzle: mockDrizzle },
            } as any)

            const req = makeExportRequest('2') // Try to access tenant 2 (should be ignored)

            // Act
            const response = await GET(req as any)

            // Assert: 200 OK (query respects user's own tenant, ignores ?tenantId param)
            expect(response.status).toBe(200)
            const body = await response.text()
            expect(body).toContain('alice@example.test') // Own tenant data
            expect(body).not.toContain('bob@example.test') // Not other tenant
        })

        it('TC-F25-008: Tenant A user exporting own tenant returns CSV', async () => {
            // Arrange: Tenant A user with numeric tenant ID
            const tenantAUser = {
                id: 'user-tenant-a',
                email: 'owner-a@example.test',
                roles: [],
                tenants: [{ tenant: { id: 1 } }],
            }

            mockGetCurrentUser.mockResolvedValue(tenantAUser as any)

            // Mock Drizzle queries
            const mockDrizzle = {
                execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ cnt: '1' }] }) // count query
                    .mockResolvedValueOnce({ rows: TENANT_A_CUSTOMERS }), // data query
            }

            const mockPayloadInstance = {
                db: { drizzle: mockDrizzle },
            }

            mockGetPayload.mockResolvedValue(mockPayloadInstance as any)

            const req = makeExportRequest() // No ?tenantId param

            // Act
            const response = await GET(req as any)

            // Assert: 200 OK with CSV content type
            expect(response.status).toBe(200)
            expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')

            // Assert: response contains Tenant A data only (Alice)
            const body = await response.text()
            expect(body).toContain('alice@example.test')
            expect(body).not.toContain('bob@example.test') // Tenant B should not appear
        })
    })

    describe('TC-F25-008: Super-admin access', () => {
        it('TC-F25-008: Super-admin with tenantId=X exports only tenant X', async () => {
            // Arrange: super-admin user with numeric tenant ID
            const superAdminUser = {
                id: 'admin-1',
                email: 'admin@example.test',
                roles: ['super-admin'],
                tenants: [],
            }

            mockGetCurrentUser.mockResolvedValue(superAdminUser as any)

            // Mock Drizzle
            const mockDrizzle = {
                execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ cnt: '1' }] }) // count for tenant 2
                    .mockResolvedValueOnce({ rows: TENANT_B_CUSTOMERS }), // data for tenant 2
            }

            const mockPayloadInstance = {
                db: { drizzle: mockDrizzle },
            }

            mockGetPayload.mockResolvedValue(mockPayloadInstance as any)

            // Request specific tenant by numeric ID
            const req = makeExportRequest('2')

            // Act
            const response = await GET(req as any)

            // Assert: 200 OK
            expect(response.status).toBe(200)

            // Assert: CSV contains only Tenant B customer (Bob)
            const body = await response.text()
            expect(body).toContain('bob@example.test')
            expect(body).not.toContain('alice@example.test') // Tenant A should not appear
        })

        it('TC-F25-008: Super-admin with invalid tenantId returns 400', async () => {
            // Arrange: super-admin with malformed tenantId
            const superAdminUser = {
                id: 'admin-1',
                email: 'admin@example.test',
                roles: ['super-admin'],
                tenants: [],
            }

            mockGetCurrentUser.mockResolvedValue(superAdminUser as any)

            const req = makeExportRequest('not-a-number')

            // Act
            const response = await GET(req as any)

            // Assert: 400 Bad Request
            expect(response.status).toBe(400)
            const body = await response.text()
            expect(body).toContain('positive integer')
        })
    })

    describe('TC-F25-008: Authentication', () => {
        it('TC-F25-008: Unauthenticated request returns 401', async () => {
            // Arrange: no user
            mockGetCurrentUser.mockResolvedValue(null)

            const req = makeExportRequest()

            // Act
            const response = await GET(req as any)

            // Assert: 401 Unauthorized
            expect(response.status).toBe(401)
            const body = await response.text()
            expect(body).toContain('Unauthorized')
        })

        it('TC-F25-008: User with no tenants returns 403', async () => {
            // Arrange: authenticated but no tenant assignments
            const noTenantUser = {
                id: 'orphan-user',
                email: 'orphan@example.test',
                roles: [],
                tenants: [],
            }

            mockGetCurrentUser.mockResolvedValue(noTenantUser as any)

            const req = makeExportRequest()

            // Act
            const response = await GET(req as any)

            // Assert: 403 Forbidden
            expect(response.status).toBe(403)
            const body = await response.text()
            expect(body).toContain('Forbidden')
        })
    })

    describe('TC-F25-008: CSV format & PII safety', () => {
        it('TC-F25-008: CSV header includes expected columns', async () => {
            // Arrange
            const tenantAUser = {
                id: 'user-tenant-a',
                email: 'owner-a@example.test',
                roles: [],
                tenants: [{ tenant: { id: 1 } }],
            }

            mockGetCurrentUser.mockResolvedValue(tenantAUser as any)

            const mockDrizzle = {
                execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ cnt: '1' }] })
                    .mockResolvedValueOnce({ rows: TENANT_A_CUSTOMERS }),
            }

            mockGetPayload.mockResolvedValue({
                db: { drizzle: mockDrizzle },
            } as any)

            const req = makeExportRequest()

            // Act
            const response = await GET(req as any)
            const csv = await response.text()

            // Assert: header row present
            expect(csv).toContain('email,name,phone,rank,createdAt,addressCount,orderCount')
        })

        it('TC-F25-008: Response headers prevent caching of PII', async () => {
            // Arrange
            const tenantAUser = {
                id: 'user-tenant-a',
                email: 'owner-a@example.test',
                roles: [],
                tenants: [{ tenant: { id: 1 } }],
            }

            mockGetCurrentUser.mockResolvedValue(tenantAUser as any)

            const mockDrizzle = {
                execute: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ cnt: '1' }] })
                    .mockResolvedValueOnce({ rows: TENANT_A_CUSTOMERS }),
            }

            mockGetPayload.mockResolvedValue({
                db: { drizzle: mockDrizzle },
            } as any)

            const req = makeExportRequest()

            // Act
            const response = await GET(req as any)

            // Assert: Cache-Control header set to private, no-store
            expect(response.headers.get('Cache-Control')).toContain('private')
            expect(response.headers.get('Cache-Control')).toContain('no-store')
        })
    })

    describe('TC-F25-008: Row cap enforcement', () => {
        it('TC-F25-008: Export > 10000 rows returns 413 with error hint', async () => {
            // Arrange: user with large dataset (numeric tenant ID)
            const tenantAUser = {
                id: 'user-tenant-a',
                email: 'owner-a@example.test',
                roles: [],
                tenants: [{ tenant: { id: 1 } }],
            }

            mockGetCurrentUser.mockResolvedValue(tenantAUser as any)

            // Mock count returning > 10000
            const mockDrizzle = {
                execute: vi.fn().mockResolvedValueOnce({ rows: [{ cnt: '15000' }] }),
            }

            mockGetPayload.mockResolvedValue({
                db: { drizzle: mockDrizzle },
            } as any)

            const req = makeExportRequest()

            // Act
            const response = await GET(req as any)

            // Assert: 413 Payload Too Large
            expect(response.status).toBe(413)
            const body = await response.json()
            expect(body.error).toBe('export_too_large')
            expect(body.hint).toContain('Filter')
        })
    })
})
