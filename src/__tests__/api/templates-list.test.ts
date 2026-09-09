import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const find = vi.fn()

vi.mock('payload', () => ({
    getPayload: vi.fn(async () => ({ find })),
}))

vi.mock('@payload-config', () => ({ default: {} }))

import { GET } from '@/app/api/templates/list/route'

describe('GET /api/templates/list', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        find.mockResolvedValue({ docs: [], totalDocs: 0 })
    })

    it('only requests live templates and caps the page size', async () => {
        const response = await GET(new NextRequest('http://localhost/api/templates/list?limit=999'))

        expect(response.status).toBe(200)
        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'templates',
            limit: 100,
            where: { status: { equals: 'live' } },
        }))
    })

    it('uses a positive page size for invalid or negative limits', async () => {
        await GET(new NextRequest('http://localhost/api/templates/list?limit=-5'))
        await GET(new NextRequest('http://localhost/api/templates/list?limit=invalid'))

        expect(find).toHaveBeenNthCalledWith(1, expect.objectContaining({ limit: 1 }))
        expect(find).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 100 }))
    })
})
