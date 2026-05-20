// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }))

vi.mock('drizzle-orm', () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}))

import { repairStaleProductImageRefs } from '@/app/(dashboard)/actions/media-repair'

const mockPayload = { db: { drizzle: { execute: mockExecute } } } as never

describe('repairStaleProductImageRefs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F08-04-16] oldId !== newId → execute called once, sql contains both ids', async () => {
        // Arrange
        mockExecute.mockResolvedValue(undefined)

        // Act
        await repairStaleProductImageRefs(mockPayload, 5, 99)

        // Assert
        expect(mockExecute).toHaveBeenCalledOnce()
        const sqlArg = mockExecute.mock.calls[0][0] as { values: unknown[] }
        expect(sqlArg.values).toContain(5)
        expect(sqlArg.values).toContain(99)
    })

    it('[TC-F08-04-17] oldId === newId → guard fires, execute NOT called', async () => {
        // Act
        await repairStaleProductImageRefs(mockPayload, 5, 5)

        // Assert
        expect(mockExecute).not.toHaveBeenCalled()
    })

    it('[TC-F08-04-18] drizzle.execute throws → warns and returns normally, does not rethrow', async () => {
        // Arrange
        mockExecute.mockRejectedValue(new Error('DB connection lost'))
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        try {
            // Act — must resolve (not reject)
            await expect(repairStaleProductImageRefs(mockPayload, 5, 99)).resolves.toBeUndefined()

            // Assert
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('[repairStaleProductImageRefs]'),
                expect.any(Error),
            )
        } finally {
            warnSpy.mockRestore()
        }
    })
})
