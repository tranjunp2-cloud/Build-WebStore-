import { beforeEach, describe, expect, it, vi } from 'vitest'

const CURRENT_REVISION = 'a'.repeat(64)
const NEXT_REVISION = 'b'.repeat(64)
const PARTIAL_REVISION = 'c'.repeat(64)
const FINAL_REVISION = 'd'.repeat(64)
const EXPECTED_UPDATED_AT = '2026-08-05T02:00:00.000Z'

const mockUser = {
    id: 1,
    roles: [] as string[],
    tenants: [{ tenant: 'tenant-1', status: 'active' }],
}
vi.mock('@/lib/auth', () => ({
    withAuth: vi.fn(
        (handler: (user: typeof mockUser, request: Request) => unknown) =>
            (request: Request) =>
                handler(mockUser, request),
    ),
}))
vi.mock('@/lib/subscriptions/feature-guard', () => ({
    withFeatureGuard: vi.fn(
        () => (handler: (request: Request) => unknown) => handler,
    ),
}))

const mockFindByID = vi.fn()
const mockUpdate = vi.fn()
const mockGetPayload = vi.fn(() =>
    Promise.resolve({ findByID: mockFindByID, update: mockUpdate }),
)
vi.mock('payload', () => ({
    getPayload: (...args: unknown[]) => mockGetPayload(...args),
}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockEvaluateAuthoritativeLocalSeo = vi.fn()
const mockCheckTwoTierRateLimit = vi.fn()
vi.mock('@/lib/seo/local-seo-evaluation', () => ({
    evaluateAuthoritativeLocalSeo: (...args: unknown[]) =>
        mockEvaluateAuthoritativeLocalSeo(...args),
}))
vi.mock('@/lib/rateLimit', () => ({
    checkTwoTierRateLimit: (...args: unknown[]) => mockCheckTwoTierRateLimit(...args),
}))

import { maxDuration, POST } from '@/app/api/seo/apply-fixes/route'

interface FixInput {
    targetId: string
    collection: 'pages' | 'products' | 'blogs'
    seo: { title?: string; description?: string; [key: string]: unknown }
}

function request(fixes: FixInput[], overrides: Record<string, unknown> = {}) {
    return {
        json: () =>
            Promise.resolve({
                operation: 'apply',
                siteId: 'site-1',
                revisionToken: CURRENT_REVISION,
                fixes,
                ...overrides,
            }),
    } as unknown as Request
}

function productFix(targetId = 'product-1'): FixInput {
    return {
        targetId,
        collection: 'products',
        seo: { title: `Title for ${targetId}` },
    }
}

function setDefaultRecords() {
    mockFindByID.mockImplementation(
        ({ collection, id }: { collection: string; id: string }) => {
            if (collection === 'sites') {
                return Promise.resolve({ id: 'site-1', tenant: 'tenant-1' })
            }
            if (collection === 'pages') {
                return Promise.resolve({
                    id,
                    site: { id: 'site-1', tenant: 'tenant-1' },
                    updatedAt: EXPECTED_UPDATED_AT,
                    seo: { title: 'Old title', description: 'Old description' },
                })
            }
            return Promise.resolve({
                id,
                site: 'site-1',
                tenant: 'tenant-1',
                updatedAt: EXPECTED_UPDATED_AT,
                seo: { title: 'Old title', description: 'Old description' },
            })
        },
    )
}

function stableEvaluation(revisionToken = CURRENT_REVISION) {
    return {
        response: { revisionToken },
        metadataItems: [
            'product-1',
            'product-2',
            'allowed-product',
            ...Array.from({ length: 8 }, (_, index) => `product-${index}`),
        ].map((id) => ({
            collection: 'products',
            id,
            missingFields: ['title'],
        })),
    }
}

// ── TC-F37-04-16 / TC-F19.38: authorized revision-bound metadata writes ──
describe('POST /api/seo/apply-fixes security [TC-F37-04-16, TC-F19.38]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.PAYLOAD_SECRET = 'seo-undo-test-secret'
        mockUser.roles = []
        mockUser.tenants = [{ tenant: 'tenant-1', status: 'active' }]
        setDefaultRecords()
        mockCheckTwoTierRateLimit.mockResolvedValue({
            allowed: true,
            remaining: 1,
            resetAt: Date.now() + 60_000,
        })
        mockUpdate.mockResolvedValue({
            docs: [{ id: 'updated-target' }],
            errors: [],
        })
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(stableEvaluation())
    })

    it('rate-limits apply requests at the user level before site buckets', async () => {
        mockCheckTwoTierRateLimit.mockResolvedValueOnce({
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 30_000,
        })

        const response = await POST(request([productFix()]), {} as never)
        const body = await response.json()

        expect(response.status).toBe(429)
        expect(mockCheckTwoTierRateLimit).toHaveBeenCalledWith(
            'seo-apply-fixes:user:1',
            20,
            100,
        )
        expect(response.headers.get('Retry-After')).toBe('30')
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rate-limits apply requests before protected site reads', async () => {
        mockCheckTwoTierRateLimit
            .mockResolvedValueOnce({
                allowed: true,
                remaining: 1,
                resetAt: Date.now() + 60_000,
            })
            .mockResolvedValueOnce({
                allowed: false,
                remaining: 0,
                resetAt: Date.now() + 30_000,
            })

        const response = await POST(request([productFix()]), {} as never)
        const body = await response.json()

        expect(response.status).toBe(429)
        expect(mockCheckTwoTierRateLimit).toHaveBeenNthCalledWith(
            2,
            'seo-apply-fixes:1:site-1',
            2,
            10,
        )
        expect(response.headers.get('Retry-After')).toBe('30')
        expect(body.error.code).toBe('RATE_LIMITED')
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockFindByID).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('keeps the Vercel route duration within the Pro limit', () => {
        // Arrange — module export is the route configuration.

        // Act
        const configuredDuration = maxDuration

        // Assert
        expect(configuredDuration).toBeLessThanOrEqual(60)
    })

    it.each(['pending', 'suspended'])(
        'denies a %s-only membership before protected reads or writes',
        async (status) => {
            // Arrange
            mockUser.tenants = [{ tenant: 'tenant-1', status }]

            // Act
            const response = await POST(request([productFix()]), {} as never)

            // Assert
            expect(response.status).toBe(403)
            expect(mockGetPayload).not.toHaveBeenCalled()
            expect(mockFindByID).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
        },
    )

    it('returns 409 for a stale revision and performs zero writes', async () => {
        // Arrange
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue(
            stableEvaluation(NEXT_REVISION),
        )

        // Act
        const response = await POST(request([productFix()]), {} as never)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(body.error.code).toBe('STALE_REVISION')
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects a cross-tenant target and performs zero writes', async () => {
        // Arrange
        mockFindByID.mockImplementation(
            ({ collection, id }: { collection: string; id: string }) =>
                Promise.resolve(
                    collection === 'sites'
                        ? { id: 'site-1', tenant: 'tenant-1' }
                        : {
                              id,
                              site: 'site-1',
                              tenant: 'other-tenant',
                              seo: {},
                          },
                ),
        )

        // Act
        const response = await POST(request([productFix()]), {} as never)

        // Assert
        expect(response.status).toBe(403)
        expect(mockEvaluateAuthoritativeLocalSeo).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects a same-tenant page owned by another site', async () => {
        // Arrange
        mockFindByID.mockImplementation(
            ({ collection, id }: { collection: string; id: string }) =>
                Promise.resolve(
                    collection === 'sites'
                        ? { id: 'site-1', tenant: 'tenant-1' }
                        : {
                              id,
                              site: {
                                  id: 'site-2',
                                  tenant: 'tenant-1',
                              },
                              seo: {},
                          },
                ),
        )
        const fix: FixInput = {
            targetId: 'page-1',
            collection: 'pages',
            seo: { description: 'New description' },
        }

        // Act
        const response = await POST(request([fix]), {} as never)

        // Assert
        expect(response.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it.each(['products', 'blogs'] as const)(
        'rejects a same-tenant %s record owned by another site',
        async (collection) => {
            // Arrange
            mockFindByID.mockImplementation(
                ({
                    collection: requestedCollection,
                    id,
                }: {
                    collection: string
                    id: string
                }) =>
                    Promise.resolve(
                        requestedCollection === 'sites'
                            ? { id: 'site-1', tenant: 'tenant-1' }
                            : {
                                  id,
                                  site: 'site-2',
                                  tenant: 'tenant-1',
                                  seo: {},
                              },
                    ),
            )
            const fix: FixInput = {
                targetId: collection === 'products' ? 'product-1' : 'blog-1',
                collection,
                seo: { title: 'New title' },
            }

            // Act
            const response = await POST(request([fix]), {} as never)

            // Assert
            expect(response.status).toBe(403)
            expect(mockEvaluateAuthoritativeLocalSeo).not.toHaveBeenCalled()
            expect(mockUpdate).not.toHaveBeenCalled()
        },
    )

    it('preflights the whole batch before any write', async () => {
        // Arrange
        mockFindByID.mockImplementation(
            ({ collection, id }: { collection: string; id: string }) => {
                if (collection === 'sites') {
                    return Promise.resolve({ id: 'site-1', tenant: 'tenant-1' })
                }
                return Promise.resolve({
                    id,
                    site: 'site-1',
                    tenant:
                        id === 'forbidden-product'
                            ? 'other-tenant'
                            : 'tenant-1',
                    updatedAt: EXPECTED_UPDATED_AT,
                    seo: {},
                })
            },
        )

        // Act
        const response = await POST(
            request([
                productFix('allowed-product'),
                productFix('forbidden-product'),
            ]),
            {} as never,
        )

        // Assert
        expect(response.status).toBe(403)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects non-metadata fields before protected reads', async () => {
        // Arrange
        const fix = productFix()
        fix.seo.canonicalUrl = 'https://attacker.invalid'

        // Act
        const response = await POST(request([fix]), {} as never)

        // Assert
        expect(response.status).toBe(400)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects whitespace-only metadata before protected reads', async () => {
        const response = await POST(
            request([{ ...productFix(), seo: { title: '   ' } }]),
            {} as never,
        )

        expect(response.status).toBe(400)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects a target that is no longer authoritatively eligible', async () => {
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue({
            response: { revisionToken: CURRENT_REVISION },
            metadataItems: [],
        })

        const response = await POST(request([productFix()]), {} as never)

        expect(response.status).toBe(409)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects a field that is no longer authoritatively missing', async () => {
        mockEvaluateAuthoritativeLocalSeo.mockResolvedValue({
            response: { revisionToken: CURRENT_REVISION },
            metadataItems: [
                {
                    collection: 'products',
                    id: 'product-1',
                    missingFields: ['description'],
                },
            ],
        })

        const response = await POST(request([productFix()]), {} as never)

        expect(response.status).toBe(409)
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('rejects an unsigned undo before protected reads', async () => {
        const response = await POST(
            request([productFix()], {
                operation: 'undo',
                undoToken: `${Date.now() + 60_000}.${'c'.repeat(64)}`,
            }),
            {} as never,
        )

        expect(response.status).toBe(403)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns the new authoritative revision token after apply', async () => {
        // Arrange
        mockEvaluateAuthoritativeLocalSeo
            .mockResolvedValueOnce(stableEvaluation(CURRENT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(NEXT_REVISION))

        // Act
        const response = await POST(request([productFix()]), {} as never)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.revisionToken).toBe(NEXT_REVISION)
        expect(body.undoToken).toMatch(/^\d{13}\.[a-f0-9]{64}$/)
        expect(body.undoData).toHaveLength(1)
    })

    it('accepts only the exact server-signed undo payload', async () => {
        mockEvaluateAuthoritativeLocalSeo
            .mockResolvedValueOnce(stableEvaluation(CURRENT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(NEXT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(NEXT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(CURRENT_REVISION))

        const applyResponse = await POST(request([productFix()]), {} as never)
        const applyBody = await applyResponse.json()

        const undoResponse = await POST(
            request(applyBody.undoData as FixInput[], {
                operation: 'undo',
                revisionToken: NEXT_REVISION,
                undoToken: applyBody.undoToken,
            }),
            {} as never,
        )

        expect(applyResponse.status).toBe(200)
        expect(undoResponse.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(2)

        const replacement = applyBody.undoToken.endsWith('0') ? '1' : '0'
        const tamperedToken = `${applyBody.undoToken.slice(0, -1)}${replacement}`
        const tamperedResponse = await POST(
            request(applyBody.undoData as FixInput[], {
                operation: 'undo',
                revisionToken: NEXT_REVISION,
                undoToken: tamperedToken,
            }),
            {} as never,
        )
        expect(tamperedResponse.status).toBe(403)
        expect(mockUpdate).toHaveBeenCalledTimes(2)
    })

    it('returns a signed continuation for the targets left after a partial undo', async () => {
        mockEvaluateAuthoritativeLocalSeo
            .mockResolvedValueOnce(stableEvaluation(CURRENT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(NEXT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(NEXT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(PARTIAL_REVISION))
            .mockResolvedValueOnce(stableEvaluation(PARTIAL_REVISION))
            .mockResolvedValueOnce(stableEvaluation(FINAL_REVISION))
        mockUpdate
            .mockResolvedValueOnce({ docs: [{ id: 'product-1' }], errors: [] })
            .mockResolvedValueOnce({ docs: [{ id: 'product-2' }], errors: [] })
            .mockResolvedValueOnce({ docs: [{ id: 'product-1' }], errors: [] })
            .mockResolvedValueOnce({ docs: [], errors: [] })
            .mockResolvedValueOnce({ docs: [{ id: 'product-2' }], errors: [] })

        const applyResponse = await POST(
            request([productFix('product-1'), productFix('product-2')]),
            {} as never,
        )
        const applyBody = await applyResponse.json()
        const partialResponse = await POST(
            request(applyBody.undoData as FixInput[], {
                operation: 'undo',
                revisionToken: NEXT_REVISION,
                undoToken: applyBody.undoToken,
            }),
            {} as never,
        )
        const partialBody = await partialResponse.json()

        expect(partialResponse.status).toBe(200)
        expect(partialBody.failedCount).toBe(1)
        expect(partialBody.remainingUndoData).toHaveLength(1)
        expect(partialBody.revisionToken).toBe(PARTIAL_REVISION)
        expect(partialBody.undoToken).toMatch(/^\d{13}\.[a-f0-9]{64}$/)

        const retryResponse = await POST(
            request(partialBody.remainingUndoData as FixInput[], {
                operation: 'undo',
                revisionToken: PARTIAL_REVISION,
                undoToken: partialBody.undoToken,
            }),
            {} as never,
        )
        const retryBody = await retryResponse.json()

        expect(retryResponse.status).toBe(200)
        expect(retryBody.failedCount).toBe(0)
        expect(retryBody.remainingUndoData).toEqual([])
        expect(retryBody.undoToken).toBeNull()
        expect(mockUpdate).toHaveBeenCalledTimes(5)
    })

    it('rejects an expired server-signed undo before protected reads', async () => {
        mockEvaluateAuthoritativeLocalSeo
            .mockResolvedValueOnce(stableEvaluation(CURRENT_REVISION))
            .mockResolvedValueOnce(stableEvaluation(NEXT_REVISION))

        const applyResponse = await POST(request([productFix()]), {} as never)
        const applyBody = await applyResponse.json()
        const expiresAt = Number(String(applyBody.undoToken).split('.')[0])

        vi.clearAllMocks()
        const dateNow = vi.spyOn(Date, 'now').mockReturnValue(expiresAt + 1)
        const undoResponse = await POST(
            request(applyBody.undoData as FixInput[], {
                operation: 'undo',
                revisionToken: NEXT_REVISION,
                undoToken: applyBody.undoToken,
            }),
            {} as never,
        )
        dateNow.mockRestore()

        expect(undoResponse.status).toBe(403)
        expect(mockGetPayload).not.toHaveBeenCalled()
        expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('uses id, updatedAt, site, and tenant in the atomic update condition', async () => {
        // Arrange
        const fix = productFix()

        // Act
        const response = await POST(request([fix]), {} as never)

        // Assert
        expect(response.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: 'products',
                limit: 1,
                where: {
                    and: expect.arrayContaining([
                        { id: { equals: 'product-1' } },
                        {
                            updatedAt: {
                                equals: EXPECTED_UPDATED_AT,
                            },
                        },
                        { site: { equals: 'site-1' } },
                        { tenant: { equals: 'tenant-1' } },
                    ]),
                },
            }),
        )
        expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('id')
    })

    it('maps a CAS miss to stale revision without reporting an overwrite', async () => {
        // Arrange
        mockUpdate.mockResolvedValue({ docs: [], errors: [] })

        // Act
        const response = await POST(request([productFix()]), {} as never)
        const body = await response.json()

        // Assert
        expect(response.status).toBe(409)
        expect(body.error.code).toBe('STALE_REVISION')
        expect(mockUpdate).toHaveBeenCalledTimes(1)
        expect(mockEvaluateAuthoritativeLocalSeo).toHaveBeenCalledTimes(1)
    })

    it('keeps successful CAS writes when another target becomes stale', async () => {
        // Arrange
        mockUpdate
            .mockResolvedValueOnce({
                docs: [{ id: 'product-1' }],
                errors: [],
            })
            .mockResolvedValueOnce({ docs: [], errors: [] })

        // Act
        const response = await POST(
            request([productFix('product-1'), productFix('product-2')]),
            {} as never,
        )
        const body = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(body.undoData).toHaveLength(1)
        expect(body.failedCount).toBe(1)
        expect(body.staleCount).toBe(1)
    })

    it('reports a required refetch when post-write revision refresh fails', async () => {
        // Arrange
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        mockEvaluateAuthoritativeLocalSeo
            .mockResolvedValueOnce(stableEvaluation(CURRENT_REVISION))
            .mockRejectedValueOnce(new Error('snapshot changed'))

        // Act
        const response = await POST(request([productFix()]), {} as never)
        const body = await response.json()
        consoleError.mockRestore()

        // Assert
        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.revisionToken).toBeNull()
        expect(body.requiresRefresh).toBe(true)
        expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it('runs at most four metadata updates concurrently', async () => {
        // Arrange
        const fixes = Array.from({ length: 8 }, (_, index) =>
            productFix(`product-${index}`),
        )
        let active = 0
        let maximumActive = 0
        let releaseGate: (() => void) | undefined
        const gate = new Promise<void>((resolve) => {
            releaseGate = resolve
        })
        mockUpdate.mockImplementation(async () => {
            active += 1
            maximumActive = Math.max(maximumActive, active)
            await gate
            active -= 1
            return { docs: [{ id: 'updated-target' }], errors: [] }
        })

        // Act
        const responsePromise = POST(request(fixes), {} as never)
        await vi.waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledTimes(4)
        })
        releaseGate?.()
        const response = await responsePromise

        // Assert
        expect(response.status).toBe(200)
        expect(mockUpdate).toHaveBeenCalledTimes(8)
        expect(maximumActive).toBeLessThanOrEqual(4)
    })
})
