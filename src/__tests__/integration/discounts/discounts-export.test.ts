/**
 * Integration Tests — GET /api/v1/discounts/export → CSV export tenant scoping
 *
 * Coverage Map:
 *   TC-F33-10-19 (Q8) → Super-admin export WITHOUT ?tenantId → ALL tenants (super power);
 *                       super-admin with non-numeric tenantId → 400; tenant-owner scoped;
 *                       unauthenticated → 401.
 *
 * Strategy: Mock getPayload + getCurrentUser; call GET(request) directly; the data query is
 * mocked to return rows from two tenants — when the handler does NOT scope (super-admin, no
 * tenantId) both rows stream through and the filename label is "all".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks ──

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        db: { drizzle: { execute: vi.fn() } },
    }),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

import { GET } from '@/app/api/v1/discounts/export/route'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'

const mockGetPayload = vi.mocked(getPayload)
const mockGetCurrentUser = vi.mocked(getCurrentUser)

// Discount rows from two different tenants (shape: snake_case columns from the raw SQL).
const TENANT_A_ROW = {
    code: 'TENANT_A_CODE', type: 'percentage', value: 10, status: 'active',
    usage_count: 1, usage_limit: 100, starts_at: null, expires_at: null, created_at: '2026-05-10T00:00:00Z',
}
const TENANT_B_ROW = {
    code: 'TENANT_B_CODE', type: 'fixed', value: 500, status: 'active',
    usage_count: 2, usage_limit: null, starts_at: null, expires_at: null, created_at: '2026-05-15T00:00:00Z',
}

function makeExportRequest(tenantId: string | null = null): NextRequest {
    const url = tenantId
        ? `http://localhost/api/v1/discounts/export?tenantId=${tenantId}`
        : 'http://localhost/api/v1/discounts/export'
    return new NextRequest(url, { method: 'GET' })
}

const SUPER_ADMIN = { id: 'admin-1', email: 'admin@example.test', roles: ['super-admin'], tenants: [] }

describe('GET /api/v1/discounts/export — Q8 tenant scoping (TC-F33-10-19)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F33-10-19 Q8] super-admin WITHOUT tenantId → ALL tenants (no scope filter)', async () => {
        // Arrange: super-admin, no ?tenantId → handler must NOT filter by tenant
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN as any)
        const mockDrizzle = {
            execute: vi.fn()
                .mockResolvedValueOnce({ rows: [{ cnt: '2' }] })            // count — all tenants
                .mockResolvedValueOnce({ rows: [TENANT_A_ROW, TENANT_B_ROW] }), // data — both tenants
        }
        mockGetPayload.mockResolvedValue({ db: { drizzle: mockDrizzle } } as any)

        // Act
        const res = await GET(makeExportRequest() as any)
        const csv = await res.text()

        // Assert: 200, both tenants' codes present (= unscoped / all-tenants export)
        expect(res.status).toBe(200)
        expect(csv).toContain('TENANT_A_CODE')
        expect(csv).toContain('TENANT_B_CODE')
        // Filename label "all" signals the all-tenants branch was taken
        expect(res.headers.get('Content-Disposition')).toContain('discounts-all-')
    })

    it('[TC-F33-10-19 Q8] super-admin WITH numeric tenantId → only that tenant', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN as any)
        const mockDrizzle = {
            execute: vi.fn()
                .mockResolvedValueOnce({ rows: [{ cnt: '1' }] })
                .mockResolvedValueOnce({ rows: [TENANT_B_ROW] }), // scoped to requested tenant
        }
        mockGetPayload.mockResolvedValue({ db: { drizzle: mockDrizzle } } as any)

        // Act
        const res = await GET(makeExportRequest('2') as any)
        const csv = await res.text()

        // Assert
        expect(res.status).toBe(200)
        expect(csv).toContain('TENANT_B_CODE')
        expect(csv).not.toContain('TENANT_A_CODE')
        expect(res.headers.get('Content-Disposition')).toContain('discounts-2-')
    })

    it('[TC-F33-10-19 Q8] super-admin with non-numeric tenantId → 400', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(SUPER_ADMIN as any)

        // Act
        const res = await GET(makeExportRequest('not-a-number') as any)
        const body = await res.text()

        // Assert
        expect(res.status).toBe(400)
        expect(body).toContain('positive integer')
    })

    it('[TC-F33-10-19 Q8] tenant-owner is scoped to own tenant, ignores ?tenantId param', async () => {
        // Arrange: non-super-admin owner of tenant 1, tries to request tenant 2
        const owner = { id: 'owner-a', email: 'owner@example.test', roles: [], tenants: [{ tenant: { id: 1 } }] }
        mockGetCurrentUser.mockResolvedValue(owner as any)
        const mockDrizzle = {
            execute: vi.fn()
                .mockResolvedValueOnce({ rows: [{ cnt: '1' }] })
                .mockResolvedValueOnce({ rows: [TENANT_A_ROW] }), // own tenant only
        }
        mockGetPayload.mockResolvedValue({ db: { drizzle: mockDrizzle } } as any)

        // Act
        const res = await GET(makeExportRequest('2') as any)
        const csv = await res.text()

        // Assert: own tenant data, not the requested one
        expect(res.status).toBe(200)
        expect(csv).toContain('TENANT_A_CODE')
        expect(csv).not.toContain('TENANT_B_CODE')
        expect(res.headers.get('Content-Disposition')).toContain('discounts-1-')
    })

    it('[TC-F33-10-19 Q8] unauthenticated request → 401', async () => {
        // Arrange
        mockGetCurrentUser.mockResolvedValue(null)

        // Act
        const res = await GET(makeExportRequest() as any)

        // Assert
        expect(res.status).toBe(401)
    })

    it('[TC-F33-10-19 Q8] non-super-admin with no tenants → 403', async () => {
        // Arrange
        const orphan = { id: 'orphan', email: 'orphan@example.test', roles: [], tenants: [] }
        mockGetCurrentUser.mockResolvedValue(orphan as any)

        // Act
        const res = await GET(makeExportRequest() as any)

        // Assert
        expect(res.status).toBe(403)
    })
})
