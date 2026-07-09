import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks (top-level, before imports) ─────────────────────────────────

const mockUser = {
    id: 'user-1',
    roles: [] as string[],
    tenants: [{ tenant: 'tenant-1' }],
}

vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => handler(mockUser, req, ctx)),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({
        findByID: mockFindByID,
        update: mockUpdate,
    })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(() => (h: any) => h),
}))

import { POST as toggleAiCrawlers } from '@/app/api/seo/ai-crawlers-toggle/route'

// ─── Test Suite ────────────────────────────────────────────────────────

/**
 * TC-F37-03: AI Crawler Toggle API
 *
 * Tests the POST /api/seo/ai-crawlers-toggle endpoint for auth,
 * tenant validation, input validation, and update behavior.
 */
describe('[TC-F37-03] POST /api/seo/ai-crawlers-toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser.tenants = [{ tenant: 'tenant-1' }]
        mockUser.roles = []
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-27: Owner request succeeds (200, updates field)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-27: owner request returns 200 and calls payload.update', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',  // matches mockUser tenant
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'sites',
                id: 'site-1',
                data: { aiCrawlersEnabled: true },
            })
        )
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-28: Owner toggles from ON to OFF
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-28: correctly updates field when enabling (enabled=true)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        await toggleAiCrawlers(req, {} as any)

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { aiCrawlersEnabled: true },
            })
        )
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-29: Owner toggles from OFF to ON
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-29: correctly updates field when disabling (enabled=false)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: false,
            }),
        } as unknown as Request

        // Act
        await toggleAiCrawlers(req, {} as any)

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { aiCrawlersEnabled: false },
            })
        )
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-30: Truthy enabled values become true
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-30: coerces enabled to boolean (truthy → true)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: 1,  // truthy, not boolean
            }),
        } as unknown as Request

        // Act
        await toggleAiCrawlers(req, {} as any)

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { aiCrawlersEnabled: true },
            })
        )
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-31: Falsy enabled values become false
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-31: coerces enabled to boolean (falsy → false)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: 0,  // falsy, not boolean
            }),
        } as unknown as Request

        // Act
        await toggleAiCrawlers(req, {} as any)

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { aiCrawlersEnabled: false },
            })
        )
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-32: Cross-tenant request returns 403 (BR-01 IDOR)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-32: rejects cross-tenant request (403 Forbidden)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'other-tenant',  // differs from mockUser tenant-1
        })

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(403)
        expect(body.success).toBe(false)
        expect(body.error).toContain('Forbidden')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-33: Missing siteId returns 400
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-33: returns 400 when siteId missing', async () => {
        // Arrange
        const req = {
            json: () => Promise.resolve({
                // siteId intentionally omitted
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(body.success).toBe(false)
        expect(body.error).toContain('siteId required')
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-34: Empty siteId returns 400
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-34: returns 400 when siteId is empty string', async () => {
        // Arrange
        const req = {
            json: () => Promise.resolve({
                siteId: '',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(body.success).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-42: Rejects string "false" for enabled (would coerce to true)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-42: returns 400 when enabled is the string "false"', async () => {
        // Arrange
        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: 'false',
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(body.success).toBe(false)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-35: User with multiple tenants can toggle own site
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-35: allows update when siteId tenant matches one of user tenants', async () => {
        // Arrange
        mockUser.tenants = [
            { tenant: 'tenant-a' },
            { tenant: 'tenant-b' },
            { tenant: 'tenant-c' },
        ]
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-b',  // matches one of user's tenants
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalled()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-36: User with object tenant reference
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-36: handles tenant as object reference (tenant.id)', async () => {
        // Arrange — tenant can be string or object {id: string}
        mockUser.tenants = [
            { tenant: { id: 'tenant-1' } },  // object reference
        ]
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',  // string reference
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-37: Site tenant as object reference
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-37: handles site.tenant as object reference', async () => {
        // Arrange
        mockUser.tenants = [{ tenant: 'tenant-1' }]
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: { id: 'tenant-1' },  // object reference
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-38: Payload error returns 500
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-38: returns 500 when payload.update throws', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
        })
        mockUpdate.mockRejectedValue(new Error('Database connection failed'))

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(500)
        expect(body.success).toBe(false)
        expect(body.error).toBeDefined()
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-39: Site not found returns 500 (handled as error)
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-39: returns 500 when site not found (null)', async () => {
        // Arrange
        mockFindByID.mockResolvedValue(null)

        const req = {
            json: () => Promise.resolve({
                siteId: 'nonexistent',
                enabled: true,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(500)
        expect(body.success).toBe(false)
    })

    // ────────────────────────────────────────────────────────────────
    // TC-F37-03-40: Only siteId and enabled fields are used
    // ────────────────────────────────────────────────────────────────
    it('TC-F37-03-40: ignores extra fields in request body', async () => {
        // Arrange
        mockFindByID.mockResolvedValue({
            id: 'site-1',
            tenant: 'tenant-1',
        })
        mockUpdate.mockResolvedValue({})

        const req = {
            json: () => Promise.resolve({
                siteId: 'site-1',
                enabled: true,
                extraField: 'should-be-ignored',
                anotherField: 123,
            }),
        } as unknown as Request

        // Act
        const response = await toggleAiCrawlers(req, {} as any)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { aiCrawlersEnabled: true },
            })
        )
        // Verify extra fields are not passed to payload.update
        expect(mockUpdate).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    extraField: expect.anything(),
                }),
            })
        )
    })
})
