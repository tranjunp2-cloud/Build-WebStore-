/**
 * Unit Tests: sanitizeTheme() SELECT_FIELD_VALUES validation in save route
 * TC-ID: TC-F01-THEME-VAL — theme select field validation
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '@/app/api/sites/[siteId]/save/route'
import { NextRequest } from 'next/server'

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('@payload-config', () => ({ default: {} }))

let mockAuthUser: { id: string; email: string; tenants: Array<{ tenant: string }> } | null = {
    id: 'user-1',
    email: 'owner@example.com',
    tenants: [{ tenant: 'tenant-1' }],
}

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(() => mockAuthUser),
}))

const updateCalls: Array<Record<string, unknown>> = []

vi.mock('payload', () => ({
    getPayload: vi.fn().mockResolvedValue({
        findByID: vi.fn().mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
            status: 'draft',
        }),
        find: vi.fn().mockResolvedValue({
            docs: [{ id: 'page-1', site: 'site-1', isHomepage: true, layout: [] }],
        }),
        update: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
            updateCalls.push(args)
            return { id: 'site-1' }
        }),
    }),
}))

vi.mock('@/lib/rateLimit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
}))

vi.mock('@/lib/payload-retry', () => ({
    withPayloadRetry: vi.fn().mockImplementation(async (fn: () => unknown) => fn()),
    classifyTransientError: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/ai/media-injector', () => ({
    stripOrphanMediaRefs: vi.fn((blocks: unknown[]) => blocks),
    cleanupNonNumericImageFields: vi.fn((blocks: unknown[]) => blocks),
}))

vi.mock('@/lib/block-normalization', () => ({
    normalizeBlocksForPersistence: vi.fn((blocks: unknown[]) => blocks),
}))

vi.mock('@/lib/payload/tenant-row-lock', () => ({
    TenantSiteLockError: class TenantSiteLockError extends Error {},
    withTenantRowLock: vi.fn(async (
        _payload: unknown,
        _tenantId: unknown,
        operation: (req: { transactionID: string }) => Promise<unknown>,
    ) => operation({ transactionID: 'save-transaction' })),
    lockTenantSiteRows: vi.fn().mockResolvedValue(undefined),
    executeTenantTransaction: vi.fn().mockResolvedValue({ rows: [] }),
}))

vi.mock('@/lib/subscriptions/plan-subscription', () => ({
    getActivePlanSubscription: vi.fn().mockResolvedValue({
        id: 'mock-sub-1',
        plan: 'PROFESSIONAL_TM_USER',
        status: 'active',
        startDate: '2026-01-01T00:00:00.000Z',
    }),
    isSubscriptionActive: vi.fn().mockReturnValue(true),
    canUse: vi.fn().mockResolvedValue(true),
    canUseWithinLimit: vi.fn().mockResolvedValue(true),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    reduceUsage: vi.fn().mockResolvedValue(undefined),
    getConsumed: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

const makeReq = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost:3000/api/sites/1/save', {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    })

const makeParams = () => ({ params: Promise.resolve({ siteId: '1' }) })

/** Extract the sanitized theme from the sites collection update call */
function getSanitizedTheme(): Record<string, unknown> | undefined {
    const siteUpdate = updateCalls.find(c => c.collection === 'sites')
    const data = siteUpdate?.data as Record<string, unknown> | undefined
    return data?.theme as Record<string, unknown> | undefined
}

describe('[TC-F01-THEME-VAL] sanitizeTheme SELECT_FIELD_VALUES validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        updateCalls.length = 0
        mockAuthUser = {
            id: 'user-1',
            email: 'owner@example.com',
            tenants: [{ tenant: 'tenant-1' }],
        }
    })

    it('TC-F01-THEME-VAL-01 — valid enum values pass through', async () => {
        // Arrange
        const theme = {
            fontHeading: 'Outfit',
            fontBody: 'Inter',
            borderRadius: 'rounded',
            colorMode: 'dark',
            spacingPreset: 'default',
            shadowPreset: 'subtle',
            primaryColor: '#0ea5e9',
        }

        // Act
        const res = await PATCH(makeReq({ blocks: [], theme }), makeParams())

        // Assert
        expect(res.status).toBe(200)
        const sanitized = getSanitizedTheme()
        expect(sanitized?.fontHeading).toBe('Outfit')
        expect(sanitized?.fontBody).toBe('Inter')
        expect(sanitized?.borderRadius).toBe('rounded')
        expect(sanitized?.colorMode).toBe('dark')
        expect(sanitized?.spacingPreset).toBe('default')
        expect(sanitized?.shadowPreset).toBe('subtle')
    })

    it('TC-F01-THEME-VAL-02 — invalid fontHeading is stripped', async () => {
        // Arrange — AI might hallucinate a font name
        const theme = {
            fontHeading: 'Comic Sans',
            fontBody: 'Inter',
            primaryColor: '#ff0000',
        }

        // Act
        const res = await PATCH(makeReq({ blocks: [], theme }), makeParams())

        // Assert
        expect(res.status).toBe(200)
        const sanitized = getSanitizedTheme()
        expect(sanitized).not.toHaveProperty('fontHeading')
        expect(sanitized?.fontBody).toBe('Inter')
    })

    it('TC-F01-THEME-VAL-03 — invalid borderRadius is stripped', async () => {
        // Arrange — AI returns CSS value instead of preset name
        const theme = {
            borderRadius: '16px',
            primaryColor: '#ff0000',
        }

        // Act
        const res = await PATCH(makeReq({ blocks: [], theme }), makeParams())

        // Assert
        expect(res.status).toBe(200)
        const sanitized = getSanitizedTheme()
        expect(sanitized).not.toHaveProperty('borderRadius')
    })

    it('TC-F01-THEME-VAL-04 — invalid colorMode is stripped', async () => {
        // Arrange
        const theme = {
            colorMode: 'auto',
            primaryColor: '#ff0000',
        }

        // Act
        const res = await PATCH(makeReq({ blocks: [], theme }), makeParams())

        // Assert
        expect(res.status).toBe(200)
        const sanitized = getSanitizedTheme()
        expect(sanitized).not.toHaveProperty('colorMode')
    })

    it('TC-F01-THEME-VAL-05 — hex colors pass through (no enum validation)', async () => {
        // Arrange — colors are not in SELECT_FIELD_VALUES, should pass
        const theme = {
            primaryColor: '#ff00ff',
            secondaryColor: '#00ff00',
        }

        // Act
        const res = await PATCH(makeReq({ blocks: [], theme }), makeParams())

        // Assert
        expect(res.status).toBe(200)
        const sanitized = getSanitizedTheme()
        expect(sanitized?.primaryColor).toBe('#ff00ff')
        expect(sanitized?.secondaryColor).toBe('#00ff00')
    })

    it('TC-F01-THEME-VAL-06 — unknown theme keys are stripped', async () => {
        // Arrange
        const theme = {
            primaryColor: '#ff0000',
            unknownField: 'should-be-stripped',
            anotherRandom: 42,
        }

        // Act
        const res = await PATCH(makeReq({ blocks: [], theme }), makeParams())

        // Assert
        expect(res.status).toBe(200)
        const sanitized = getSanitizedTheme()
        expect(sanitized).not.toHaveProperty('unknownField')
        expect(sanitized).not.toHaveProperty('anotherRandom')
        expect(sanitized?.primaryColor).toBe('#ff0000')
    })
})
