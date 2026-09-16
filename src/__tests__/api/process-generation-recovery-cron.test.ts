import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getPayload, execute, runGenerationRecoveryJob, newRecoveryLeaseToken } = vi.hoisted(() => ({
    getPayload: vi.fn(), execute: vi.fn(), runGenerationRecoveryJob: vi.fn(), newRecoveryLeaseToken: vi.fn(() => 'lease-1'),
}))

vi.mock('payload', () => ({ getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/ai/generation-recovery-worker', () => ({ runGenerationRecoveryJob, newRecoveryLeaseToken }))

import { GET } from '@/app/api/cron/process-generation-recovery/route'

function request(token?: string) {
    return new NextRequest('https://prime.test/api/cron/process-generation-recovery', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
    })
}

describe('[TC-F41-11–12] GET /api/cron/process-generation-recovery', () => {
    it('TC-F41-11: rejects an unauthenticated caller before it can claim a recovery job', async () => {
        // Arrange
        process.env.CRON_SECRET = 'test-cron-secret'
        getPayload.mockClear()

        // Act
        const response = await GET(request('wrong-secret'))

        // Assert
        expect(response.status).toBe(401)
        expect(getPayload).not.toHaveBeenCalled()
    })

    it('TC-F41-12: executes only the single job atomically claimed by the database worker', async () => {
        // Arrange
        process.env.CRON_SECRET = 'test-cron-secret'
        getPayload.mockResolvedValue({ db: { drizzle: { execute } } })
        execute.mockResolvedValue({ rows: [{ id: 99 }] })
        runGenerationRecoveryJob.mockResolvedValue({ status: 'succeeded', siteId: '501' })

        // Act
        const response = await GET(request('test-cron-secret'))

        // Assert
        expect(response.status).toBe(200)
        expect(runGenerationRecoveryJob).toHaveBeenCalledWith(expect.anything(), { jobId: 99, leaseToken: 'lease-1' })
        expect(await response.json()).toMatchObject({ processed: 1, jobId: '99', status: 'succeeded', siteId: '501' })
        // First reconciles a child left without a durable job, second safely
        // terminalizes exhausted leases, third claims exactly one job.
        expect(execute).toHaveBeenCalledTimes(3)
    })
})
