import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// Mock NextResponse before importing
vi.mock('next/server', () => ({
    NextResponse: {
        json: vi.fn((body: unknown, init?: { status?: number }) => ({
            body,
            status: init?.status ?? 200,
        })),
    },
}))

import { parseRequest } from '@/lib/validations/helpers'

// ─── TC-F01.04: Request parsing and validation ───────────────────────

const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().optional(),
})

function createMockRequest(body: unknown): Request {
    return {
        json: () => Promise.resolve(body),
    } as unknown as Request
}

function createBadJsonRequest(): Request {
    return {
        json: () => Promise.reject(new Error('Invalid JSON')),
    } as unknown as Request
}

describe('parseRequest [TC-F01.04]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns data for valid JSON matching schema', async () => {
        const req = createMockRequest({ name: 'John', age: 30 })
        const result = await parseRequest(req, testSchema)

        expect(result.data).toEqual({ name: 'John', age: 30 })
        expect(result.errorResponse).toBeUndefined()
    })

    it('returns data without optional fields', async () => {
        const req = createMockRequest({ name: 'John' })
        const result = await parseRequest(req, testSchema)

        expect(result.data).toEqual({ name: 'John' })
        expect(result.errorResponse).toBeUndefined()
    })

    it('returns INVALID_JSON error for malformed JSON body', async () => {
        const req = createBadJsonRequest()
        const result = await parseRequest(req, testSchema)

        expect(result.data).toBeUndefined()
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse?.body).toMatchObject({
            success: false,
            error: { code: 'INVALID_JSON', details: 'Invalid JSON body' },
        })
        expect(result.errorResponse?.status).toBe(400)
    })

    it('returns VALIDATION_ERROR when JSON is valid but fails schema', async () => {
        const req = createMockRequest({ name: '' }) // min(1) fails
        const result = await parseRequest(req, testSchema)

        expect(result.data).toBeUndefined()
        expect(result.errorResponse).toBeDefined()
        expect(result.errorResponse?.body).toMatchObject({
            success: false,
            error: { code: 'VALIDATION_ERROR' },
        })
        expect(result.errorResponse?.status).toBe(400)
    })

    it('returns VALIDATION_ERROR for completely missing fields', async () => {
        const req = createMockRequest({})
        const result = await parseRequest(req, testSchema)

        expect(result.data).toBeUndefined()
        expect(result.errorResponse).toBeDefined()
    })

    it('returns flattened Zod errors in details', async () => {
        const req = createMockRequest({ age: 'not-a-number' })
        const result = await parseRequest(req, testSchema)

        expect(result.errorResponse?.body).toHaveProperty('error.details')
    })
})
