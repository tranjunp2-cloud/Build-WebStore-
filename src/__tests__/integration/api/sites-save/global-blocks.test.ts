/**
 * Integration Tests — PATCH /api/sites/[siteId]/save → globalBlocks partial-update semantics
 * Coverage Map:
 *   TC-F10-GBL-030 → PATCH { globalBlocks: { cartWidget: {...} } } → payload.update called with merged data
 *   TC-F10-GBL-031 → PATCH { globalBlocks: { cartWidget: null } } → cartWidget removed from result
 *   TC-F10-GBL-032 → PATCH with globalBlocks omitted → globalBlocks key absent from update data
 *   TC-F10-GBL-033 → PATCH with invalid globalBlocks shape → 400 from zod validation
 *
 * Strategy: mock getPayload + getCurrentUser + checkRateLimit; call PATCH() directly;
 * assert payload.update call args. No real DB required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Top-level mocks — vi.fn() created inside factory to avoid hoisting issues ──

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: vi.fn(),
        find: vi.fn().mockResolvedValue({ docs: [] }),
        update: vi.fn().mockResolvedValue({}),
    }),
}))

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000 }),
}))

vi.mock('@/lib/ai/media-injector', () => ({
    stripOrphanMediaRefs: vi.fn().mockResolvedValue({ stripped: 0, checked: 0 }),
    cleanupNonNumericImageFields: vi.fn(),
}))

vi.mock('@/lib/payload-retry', () => ({
    withPayloadRetry: vi.fn((fn: () => unknown) => fn()),
    classifyTransientError: vi.fn(() => null),
}))

vi.mock('@/lib/theme/enums', () => ({
    buildEnumSets: vi.fn(() => ({})),
}))

vi.mock('@/lib/block-normalization', () => ({
    normalizeBlocksForPersistence: vi.fn((b: unknown) => b),
}))

import { PATCH } from '@/app/api/sites/[siteId]/save/route'
import { getCurrentUser } from '@/lib/auth'
import { getPayload } from 'payload'
import { checkRateLimit } from '@/lib/rateLimit'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockGetPayload = vi.mocked(getPayload)

const MOCK_USER = {
    id: 'user-1',
    email: 'owner@example.com',
    tenants: [{ tenant: { id: 'tenant-1' } }],
}

const CART_ENTRY = { blockType: 'cartWidget', variant: 'floating', showCount: true }

function makeRequest(body: unknown, siteId = '42'): NextRequest {
    return new NextRequest(`http://localhost/api/sites/${siteId}/save`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('PATCH /api/sites/[siteId]/save — globalBlocks', () => {
    let mockPayloadInstance: {
        findByID: ReturnType<typeof vi.fn>
        find: ReturnType<typeof vi.fn>
        update: ReturnType<typeof vi.fn>
    }

    beforeEach(async () => {
        vi.clearAllMocks()
        mockGetCurrentUser.mockResolvedValue(MOCK_USER as never)
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000 })

        mockPayloadInstance = {
            findByID: vi.fn().mockResolvedValue({
                id: '42',
                name: 'Test Site',
                tenant: { id: 'tenant-1' },
                globalBlocks: null,
                theme: {},
            }),
            find: vi.fn().mockResolvedValue({ docs: [] }),
            update: vi.fn().mockResolvedValue({}),
        }
        mockGetPayload.mockResolvedValue(mockPayloadInstance as never)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── TC-F10-GBL-030 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-030] PATCH with cartWidget entry → payload.update receives globalBlocks with cartWidget', async () => {
        // Arrange
        const req = makeRequest({ globalBlocks: { cartWidget: CART_ENTRY } })

        // Act
        const res = await PATCH(req, { params: Promise.resolve({ siteId: '42' }) })
        const body = await res.json()

        // Assert
        expect(res.status).toBe(200)
        expect(body.success).toBe(true)
        const sitesUpdateCall = mockPayloadInstance.update.mock.calls.find(
            (c: unknown[]) => (c[0] as Record<string, unknown>).collection === 'sites',
        )
        expect(sitesUpdateCall).toBeDefined()
        const updateData = (sitesUpdateCall![0] as Record<string, unknown>).data as Record<string, unknown>
        expect(updateData.globalBlocks).toBeDefined()
        expect((updateData.globalBlocks as Record<string, unknown>).cartWidget).toEqual(CART_ENTRY)
    })

    // ── TC-F10-GBL-031 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-031] PATCH { cartWidget: null } after existing cart → cartWidget absent from merged result', async () => {
        // Arrange — site already has cartWidget
        mockPayloadInstance.findByID.mockResolvedValue({
            id: '42',
            name: 'Test Site',
            tenant: { id: 'tenant-1' },
            globalBlocks: { cartWidget: CART_ENTRY, whatsappButton: null, socialWidget: null },
            theme: {},
        })
        const req = makeRequest({ globalBlocks: { cartWidget: null } })

        // Act
        const res = await PATCH(req, { params: Promise.resolve({ siteId: '42' }) })

        // Assert
        expect(res.status).toBe(200)
        const sitesUpdateCall = mockPayloadInstance.update.mock.calls.find(
            (c: unknown[]) => (c[0] as Record<string, unknown>).collection === 'sites',
        )
        expect(sitesUpdateCall).toBeDefined()
        const gb = ((sitesUpdateCall![0] as Record<string, unknown>).data as Record<string, unknown>).globalBlocks as Record<string, unknown> | null
        // mergeGlobalBlocks removes the null-patched key; other null-value keys remain in the object
        expect(gb).not.toBeNull()
        expect(gb).not.toHaveProperty('cartWidget')
    })

    // ── TC-F10-GBL-032 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-032] PATCH with globalBlocks omitted → sites update data has no globalBlocks key', async () => {
        // Arrange
        const req = makeRequest({ theme: { primaryColor: '#ff0000' } })

        // Act
        const res = await PATCH(req, { params: Promise.resolve({ siteId: '42' }) })

        // Assert
        expect(res.status).toBe(200)
        const sitesUpdateCall = mockPayloadInstance.update.mock.calls.find(
            (c: unknown[]) => (c[0] as Record<string, unknown>).collection === 'sites',
        )
        if (sitesUpdateCall) {
            const data = (sitesUpdateCall[0] as Record<string, unknown>).data as Record<string, unknown>
            expect(data).not.toHaveProperty('globalBlocks')
        }
    })

    // ── TC-F10-GBL-033 ─────────────────────────────────────────────────
    it('[TC-F10-GBL-033] PATCH with malformed globalBlocks (string instead of object) → 400', async () => {
        // Arrange
        const req = makeRequest({ globalBlocks: 'invalid-string' })

        // Act
        const res = await PATCH(req, { params: Promise.resolve({ siteId: '42' }) })

        // Assert
        expect(res.status).toBe(400)
    })
})
