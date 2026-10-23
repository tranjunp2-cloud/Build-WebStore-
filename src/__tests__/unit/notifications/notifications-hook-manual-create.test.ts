import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── TC-F16.57: Notifications.afterChange for rows NOT created by notifyTenantOwners (#1972) ──

const callOrder: string[] = []
const mockSignal = vi.fn(async () => { callOrder.push('signal') })
const mockPush = vi.fn(async () => { callOrder.push('push'); return { sent: 0, failed: 0 } })
vi.mock('@/lib/notifications/signal-notification', () => ({ signalNotificationUsers: (...a: unknown[]) => mockSignal(...(a as [])) }))
vi.mock('@/lib/notifications/send-push', () => ({ sendPushToUser: (...a: unknown[]) => mockPush(...(a as [])) }))
vi.mock('@/lib/runtime/run-after-response', () => ({
    runAfterResponse: (_l: string, task: () => Promise<unknown>) => { void task() },
}))

import { Notifications } from '@/collections/Notifications'

const hook = Notifications.hooks!.afterChange![0]
const doc = { id: 9, user: 3, tenant: 4, title: 'T', message: 'M', type: 'SYSTEM_ALERT', actionUrl: '/x' }
const req = { payload: {} } as never

beforeEach(() => {
    vi.clearAllMocks()
    callOrder.length = 0
})

describe('[TC-F16.57] Notifications.afterChange', () => {
    it('manual create: rings the doorbell first, then pushes', async () => {
        await hook({ doc, operation: 'create', req, context: {} } as never)
        await vi.waitFor(() => expect(mockPush).toHaveBeenCalled())

        expect(callOrder).toEqual(['signal', 'push'])
        expect(mockSignal).toHaveBeenCalledWith([3])
    })

    it('rows created by notifyTenantOwners (skipPush) are left alone — it signals + pushes itself', async () => {
        await hook({ doc, operation: 'create', req, context: { skipPush: true } } as never)

        expect(mockSignal).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('ignores updates', async () => {
        await hook({ doc, operation: 'update', req, context: {} } as never)

        expect(mockPush).not.toHaveBeenCalled()
    })
})
