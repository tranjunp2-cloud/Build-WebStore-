import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── TC-F16.50: broadcast rings the shared doorbell once (#1972) ──

const mockSignalBroadcast = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/notifications/signal-notification', () => ({
    signalNotificationBroadcast: () => mockSignalBroadcast(),
}))

import { createBroadcastNotifications } from '@/lib/notifications/create-broadcast'

const mockExecute = vi.fn()
const payload = { db: { drizzle: { execute: mockExecute } } } as never
const params = { title: 'Maintenance', message: 'Tonight', payload }

beforeEach(() => {
    vi.clearAllMocks()
})

describe('[TC-F16.50] createBroadcastNotifications signal', () => {
    it('signals once after all batches are inserted', async () => {
        mockExecute
            .mockResolvedValueOnce({ rowCount: 500 })
            .mockResolvedValueOnce({ rowCount: 120 })

        const result = await createBroadcastNotifications(params)

        expect(result.notified).toBe(620)
        expect(mockSignalBroadcast).toHaveBeenCalledTimes(1)
    })

    it('does not make the admin request wait on Firebase (signal runs after the response)', async () => {
        mockExecute.mockResolvedValueOnce({ rowCount: 3 })
        mockSignalBroadcast.mockReturnValueOnce(new Promise(() => {})) // Firebase hangs

        const result = await createBroadcastNotifications(params)

        expect(result.notified).toBe(3)
        expect(mockSignalBroadcast).toHaveBeenCalledTimes(1)
    })

    it('does not signal when nobody was notified', async () => {
        mockExecute.mockResolvedValue({ rowCount: 0 })

        const result = await createBroadcastNotifications(params)

        expect(result.notified).toBe(0)
        expect(mockSignalBroadcast).not.toHaveBeenCalled()
    })

    it('still signals when a later batch fails (earlier batches are committed)', async () => {
        mockExecute
            .mockResolvedValueOnce({ rowCount: 500 })
            .mockRejectedValueOnce(new Error('db down'))

        await expect(createBroadcastNotifications(params)).rejects.toThrow('db down')

        expect(mockSignalBroadcast).toHaveBeenCalledTimes(1)
    })
})
