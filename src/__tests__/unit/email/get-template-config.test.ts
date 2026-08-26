// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Top-level mocks with vi.hoisted ──────────────────────────────────

const { mockRedisGet, mockRedisSet, mockRedisDel, mockFind } = vi.hoisted(() => ({
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisDel: vi.fn(),
    mockFind: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
    redis: {
        get: mockRedisGet,
        set: mockRedisSet,
        del: mockRedisDel,
    },
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() =>
        Promise.resolve({
            find: mockFind,
        }),
    ),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// ─── Import after mocks ───────────────────────────────────────────────

import { getTemplateConfig, invalidateTemplateConfigCache, templateConfigCacheKey } from '@/lib/email/get-template-config'
import type { EmailTemplateConfig } from '@/lib/email/types'

// ─── TC-F32: Email Template Config Lookup ─────────────────────────────

describe('getTemplateConfig [TC-F32]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-01] cache HIT: returns parsed config without DB query', async () => {
        // Arrange
        const tenantId = 'tenant-001'
        const type = 'welcome'
        const recipient = 'buyer'
        // cache key includes locale suffix — default locale is 'en'
        const cacheKey = `${templateConfigCacheKey(tenantId, type, recipient)}:en`

        const cachedConfig: EmailTemplateConfig = {
            enabled: true,
            subject: 'Welcome!',
            greeting: 'Hello {customerName}',
        }

        mockRedisGet.mockResolvedValue(JSON.stringify(cachedConfig))

        // Act
        const result = await getTemplateConfig(tenantId, type, recipient)

        // Assert
        expect(result).toEqual(cachedConfig)
        expect(mockRedisGet).toHaveBeenCalledWith(cacheKey)
        expect(mockFind).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-02] cache MISS: queries DB and sets cache with 60s TTL', async () => {
        // Arrange
        const tenantId = 'tenant-001'
        const type = 'otp-verification'
        const recipient = 'buyer'
        // cache key includes locale suffix — default locale is 'en'
        const cacheKey = `${templateConfigCacheKey(tenantId, type, recipient)}:en`

        mockRedisGet.mockResolvedValue(null)

        const dbRow = {
            id: 'row-1',
            enabled: true,
            contentEn: {
                subject: 'Your OTP Code',
                greeting: 'Hi {customerName}',
                ctaLabel: 'Verify',
            },
        }

        mockFind.mockResolvedValue({ docs: [dbRow] })
        mockRedisSet.mockResolvedValue('OK')

        // Act
        const result = await getTemplateConfig(tenantId, type, recipient)

        // Assert — overrideAccess:true required for server-side lookups (webhook/hook contexts)
        expect(mockFind).toHaveBeenCalledWith({
            collection: 'email-template-settings',
            where: {
                tenant: { equals: tenantId },
                templateType: { equals: type },
                recipient: { equals: recipient },
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })

        expect(result).toEqual({
            enabled: true,
            subject: 'Your OTP Code',
            greeting: 'Hi {customerName}',
            ctaLabel: 'Verify',
            closing: undefined,
        })

        expect(mockRedisSet).toHaveBeenCalledWith(
            cacheKey,
            JSON.stringify({
                enabled: true,
                subject: 'Your OTP Code',
                greeting: 'Hi {customerName}',
                ctaLabel: 'Verify',
                closing: undefined,
            }),
            { ex: 60 },
        )
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-03] DB miss (no row): returns null without setting cache', async () => {
        // Arrange
        const tenantId = 'tenant-002'
        const type = 'forgot-password'
        const recipient = 'buyer'

        mockRedisGet.mockResolvedValue(null)
        mockFind.mockResolvedValue({ docs: [] })

        // Act
        const result = await getTemplateConfig(tenantId, type, recipient)

        // Assert
        expect(result).toBeNull()
        expect(mockRedisSet).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-04] no-redis fallback: redis.get error is caught, queries DB directly', async () => {
        // Arrange
        const tenantId = 'tenant-003'
        const type = 'order-confirmation'
        const recipient = 'buyer'

        // Redis get throws error (network, etc)
        mockRedisGet.mockRejectedValue(new Error('Redis connection failed'))

        const dbRow = {
            id: 'row-2',
            enabled: true,
            contentEn: {
                subject: 'Order Confirmation',
            },
        }

        mockFind.mockResolvedValue({ docs: [dbRow] })

        // Act
        const result = await getTemplateConfig(tenantId, type, recipient)

        // Assert
        expect(result).toEqual({
            enabled: true,
            subject: 'Order Confirmation',
            greeting: undefined,
            ctaLabel: undefined,
            closing: undefined,
        })
        expect(mockFind).toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-05] invalidateTemplateConfigCache: deletes both locale cache keys', async () => {
        // Arrange
        const tenantId = 'tenant-001'
        const type = 'payment-confirmed'
        const recipient = 'buyer'
        const base = templateConfigCacheKey(tenantId, type, recipient)

        mockRedisDel.mockResolvedValue(1)

        // Act
        await invalidateTemplateConfigCache(tenantId, type, recipient)

        // Assert — both :en and :ms locale keys must be deleted atomically
        expect(mockRedisDel).toHaveBeenCalledWith(`${base}:en`)
        expect(mockRedisDel).toHaveBeenCalledWith(`${base}:ms`)
        expect(mockRedisDel).toHaveBeenCalledTimes(2)
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-06] cache key format: returns email_config:tenantId:type:recipient', () => {
        // Arrange
        const tenantId = 'tenant-abc'
        const type = 'order-completed'
        const recipient = 'buyer'

        // Act
        const key = templateConfigCacheKey(tenantId, type, recipient)

        // Assert
        expect(key).toBe('email_config:tenant-abc:order-completed:buyer')
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-02.1] handles contentEn with partial fields', async () => {
        // Arrange
        const tenantId = 'tenant-004'
        const type = 'order-cancelled'
        const recipient = 'buyer'

        mockRedisGet.mockResolvedValue(null)

        const dbRow = {
            id: 'row-3',
            enabled: false,
            contentEn: {
                subject: 'Order Update',
                // greeting, ctaLabel, closing are missing
            },
        }

        mockFind.mockResolvedValue({ docs: [dbRow] })

        // Act
        const result = await getTemplateConfig(tenantId, type, recipient)

        // Assert
        expect(result).toEqual({
            enabled: false,
            subject: 'Order Update',
            greeting: undefined,
            ctaLabel: undefined,
            closing: undefined,
        })
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-U-02.2] defaults enabled to true when not provided', async () => {
        // Arrange
        const tenantId = 'tenant-005'
        const type = 'welcome'
        const recipient = 'buyer'

        mockRedisGet.mockResolvedValue(null)

        const dbRow = {
            id: 'row-4',
            // enabled is not provided
            contentEn: {
                subject: 'Welcome Back!',
            },
        }

        mockFind.mockResolvedValue({ docs: [dbRow] })

        // Act
        const result = await getTemplateConfig(tenantId, type, recipient)

        // Assert
        expect(result?.enabled).toBe(true)
    })
})
