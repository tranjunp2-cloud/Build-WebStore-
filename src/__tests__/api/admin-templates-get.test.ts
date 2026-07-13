/**
 * Regression Tests — Admin Templates GET by ID (TC-GH1535-05)
 *
 * Tests GET /api/admin/templates/[id] endpoint.
 *
 * Bug: Calling payload.findByID() without disableErrors throws NotFound exception
 * on missing id → uncaught exception → 500. Fix: disableErrors:true returns null
 * on not found → endpoint returns 404.
 *
 * Coverage:
 *   TC-GH1535-05a: GET with missing template id → 404
 *   TC-GH1535-05b: GET with valid id → 200 with template data
 *   TC-GH1535-05c: GET with invalid id format → 404 or 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from '@/app/api/admin/templates/[id]/route'
import { NextRequest } from 'next/server'

// ── Top-level mocks ──

vi.mock('payload', () => ({
    getPayload: vi.fn().mockImplementation(async () => ({
        findByID: vi.fn().mockImplementation(async ({ id, disableErrors }) => {
            if (id === '123' || id === 123) {
                return {
                    id: 123,
                    name: 'Test Template',
                    category: 'business',
                    isPremium: false,
                }
            }
            // If disableErrors is true, return null for missing id (not throw)
            if (disableErrors) {
                return null
            }
            // Otherwise throw NotFound (simulating old behavior)
            const err = new Error('Not Found')
            ;(err as any).name = 'NotFound'
            throw err
        }),
        update: vi.fn().mockImplementation(async ({ id, data }) => {
            return { id, ...data }
        }),
    })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// Mock admin auth guard
vi.mock('@/lib/admin/api-utils', () => ({
    withSuperAdmin: (handler: any) => async (req: any, ctx: any) => {
        return handler(req, ctx)
    },
    UpdateTemplateSchema: {
        safeParse: (data: any) => ({
            success: true,
            data,
        }),
    },
}))

function createRequest(url: string, method = 'GET', body?: unknown) {
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
            'Content-Type': 'application/json',
        },
    })
}

describe('GET /api/admin/templates/[id] — TC-GH1535-05', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('TC-GH1535-05a: GET with missing template id → 404', () => {
        it('returns 404 when template does not exist', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '999' }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/999'), ctx as any)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(404)
            expect(body.error).toBe('Not found')
        })

        it('returns 404 for non-numeric string id', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: 'invalid-id' }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/invalid-id'), ctx as any)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(404)
            expect(body.error).toBe('Not found')
        })

        it('returns 404 for empty id', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '' }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/'), ctx as any)

            // Assert
            expect(res.status).toBe(404)
        })
    })

    describe('TC-GH1535-05b: GET with valid id → 200 with template data', () => {
        it('returns 200 with template data for existing id', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '123' }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/123'), ctx as any)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.data).toBeDefined()
            expect(body.data.id).toBe(123)
            expect(body.data.name).toBe('Test Template')
            expect(body.data.category).toBe('business')
        })

        it('returns 200 with numeric id', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: 123 }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/123'), ctx as any)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.data.id).toBe(123)
        })

        it('includes full template object in response', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '123' }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/123'), ctx as any)
            const body = await res.json()

            // Assert
            expect(body.data).toHaveProperty('name')
            expect(body.data).toHaveProperty('category')
            expect(body.data).toHaveProperty('isPremium')
        })
    })

    describe('TC-GH1535-05c: Implementation details', () => {
        it('disableErrors:true flag prevents NotFound exception on missing id', async () => {
            // This test verifies the fix works: without disableErrors, a missing ID
            // throws NotFound → 500. With disableErrors, returns null → 404.
            // The implementation uses disableErrors:true, so missing id returns 404 not 500.
            //
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '999' }),
            }

            // Act
            const res = await GET(createRequest('/api/admin/templates/999'), ctx as any)

            // Assert: 404 response proves the endpoint handles missing IDs gracefully
            // (would be 500 if NotFound exception was thrown uncaught)
            expect(res.status).toBe(404)
        })
    })

    describe('PATCH /api/admin/templates/[id] — basic functionality', () => {
        it('returns 400 for invalid JSON body', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '123' }),
            }
            const req = new NextRequest(new URL('http://localhost:3000/api/admin/templates/123'), {
                method: 'PATCH',
                body: 'invalid json',
            })

            // Act
            const res = await PATCH(req, ctx as any)
            const body = await res.json()

            // Assert
            expect(res.status).toBe(400)
            expect(body.error).toBe('Invalid JSON body')
        })

        it('returns 200 for valid PATCH request', async () => {
            // Arrange
            const ctx = {
                params: Promise.resolve({ id: '123' }),
            }
            const updateData = { name: 'Updated Template' }

            // Act
            const res = await PATCH(
                createRequest('/api/admin/templates/123', 'PATCH', updateData),
                ctx as any
            )
            const body = await res.json()

            // Assert
            expect(res.status).toBe(200)
            expect(body.data).toBeDefined()
        })
    })
})
