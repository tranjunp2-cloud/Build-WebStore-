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

    it('[TC-F07.039] returns full swap data for only the selected live template', async () => {
        // Arrange
        const template = { id: 42, defaultTheme: { fontHeading: 'Outfit' },
            defaultBlocks: [{ blockType: 'hero', headline: 'Template' }],
            templatePages: [{ isHomepage: true, layout: [{ blockType: 'hero' }] }] }
        find.mockResolvedValueOnce({ docs: [template], totalDocs: 1 })

        // Act
        const response = await GET(new NextRequest('http://localhost/api/templates/list?templateId=42&limit=99'))

        // Assert
        expect(await response.json()).toEqual({ docs: [template], totalDocs: 1 })
        expect(find).toHaveBeenCalledWith(expect.objectContaining({
            limit: 1,
            where: { and: [{ status: { equals: 'live' } }, { id: { equals: 42 } }] },
        }))
        expect(find.mock.calls[0][0]).not.toHaveProperty('select')
    })

    it.each(['', '0', '-1', '1.5', '9007199254740992', '42abc'])('[TC-F07.039] rejects invalid selected template ID %s', async (id) => {
        // Arrange
        const request = new NextRequest(`http://localhost/api/templates/list?templateId=${id}`)

        // Act
        const response = await GET(request)

        // Assert
        expect(response.status).toBe(400)
        expect(find).not.toHaveBeenCalled()
    })
})
