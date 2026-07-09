import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for bootstrapSeed() from scripts/bootstrap-seed.js
 *
 * TC-BOOT-01: Skip when email env var is empty
 * TC-BOOT-02: Existing user → log only, no role changes
 * TC-BOOT-03: New user → insert user + super-admin role
 * TC-BOOT-04: DB query error → log warning, continue
 * TC-BOOT-05: Idempotency — running twice produces same result
 */

const { bootstrapSeed } = require('../../../../scripts/bootstrap-seed') as {
    bootstrapSeed: (
        pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
        env: Record<string, string>,
    ) => Promise<{ label: string; action: string }[]>
}

describe('bootstrapSeed()', () => {
    let mockPool: { query: ReturnType<typeof vi.fn> }

    beforeEach(() => {
        mockPool = {
            query: vi.fn(),
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // TC-BOOT-01
    it('should skip when email env var is empty', async () => {
        const results = await bootstrapSeed(mockPool, {
            BOOTSTRAP_ADMIN_EMAIL: '',
            SSO_SERVICE_EMAIL: '',
        })

        expect(results).toEqual([
            { label: 'Admin', action: 'skipped' },
            { label: 'SSO Service', action: 'skipped' },
        ])
        expect(mockPool.query).not.toHaveBeenCalled()
    })

    // TC-BOOT-02
    it('should not change roles for existing users', async () => {
        mockPool.query.mockResolvedValueOnce({
            rows: [{ id: 8, email: 'admin@primeweb.app' }],
        })

        const results = await bootstrapSeed(mockPool, {
            BOOTSTRAP_ADMIN_EMAIL: 'admin@primeweb.app',
            SSO_SERVICE_EMAIL: '',
        })

        expect(results).toEqual([
            { label: 'Admin', action: 'exists' },
            { label: 'SSO Service', action: 'skipped' },
        ])
        // Only SELECT query, no INSERT for roles
        expect(mockPool.query).toHaveBeenCalledTimes(1)
        expect(mockPool.query).toHaveBeenCalledWith(
            'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
            ['admin@primeweb.app'],
        )
    })

    // TC-BOOT-03
    it('should create new user with super-admin role', async () => {
        // SELECT returns empty (user doesn't exist)
        mockPool.query.mockResolvedValueOnce({ rows: [] })
        // INSERT user returns new ID
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] })
        // INSERT role
        mockPool.query.mockResolvedValueOnce({ rows: [] })

        const results = await bootstrapSeed(mockPool, {
            BOOTSTRAP_ADMIN_EMAIL: 'new-admin@test.com',
            SSO_SERVICE_EMAIL: '',
        })

        expect(results).toEqual([
            { label: 'Admin', action: 'created' },
            { label: 'SSO Service', action: 'skipped' },
        ])
        expect(mockPool.query).toHaveBeenCalledTimes(3)
        // Verify INSERT user
        expect(mockPool.query).toHaveBeenNthCalledWith(2,
            expect.stringContaining('INSERT INTO users'),
            ['new-admin@test.com', 'Admin', 'Web Store'],
        )
        // Verify INSERT role with correct parent_id
        expect(mockPool.query).toHaveBeenNthCalledWith(3,
            expect.stringContaining('INSERT INTO users_roles'),
            [99],
        )
    })

    // TC-BOOT-04
    it('should log warning on DB query error and continue', async () => {
        // Admin: DB error
        mockPool.query.mockRejectedValueOnce(new Error('connection refused'))
        // SSO: normal flow — exists
        mockPool.query.mockResolvedValueOnce({
            rows: [{ id: 17, email: 'sso@test.com' }],
        })

        const results = await bootstrapSeed(mockPool, {
            BOOTSTRAP_ADMIN_EMAIL: 'admin@test.com',
            SSO_SERVICE_EMAIL: 'sso@test.com',
        })

        expect(results).toEqual([
            { label: 'Admin', action: 'error' },
            { label: 'SSO Service', action: 'exists' },
        ])
    })

    // TC-BOOT-05
    it('should be idempotent — same result on second run', async () => {
        // First run: user exists
        mockPool.query.mockResolvedValue({
            rows: [{ id: 8, email: 'admin@primeweb.app' }],
        })

        const run1 = await bootstrapSeed(mockPool, {
            BOOTSTRAP_ADMIN_EMAIL: 'admin@primeweb.app',
            SSO_SERVICE_EMAIL: '',
        })
        const run2 = await bootstrapSeed(mockPool, {
            BOOTSTRAP_ADMIN_EMAIL: 'admin@primeweb.app',
            SSO_SERVICE_EMAIL: '',
        })

        expect(run1).toEqual(run2)
    })
})
