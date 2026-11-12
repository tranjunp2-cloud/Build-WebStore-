import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Pool } from 'pg'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { autoLinkCustomer, isDbConnectionError } from '../../../collections/orders-hooks/auto-link-customer'

vi.mock('@/lib/runtime/run-after-response', () => ({ runAfterResponse: vi.fn() }))

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

/** Stand-in for a pg connection (no server needed); the pool logic around it is the real pg-pool. */
class ConnectedClient {
    on() { return this }
    removeListener() { return this }
    isConnected() { return true }
    connect(cb: (err?: Error) => void) { setImmediate(() => cb()) }
    end(cb?: () => void) { cb?.(); return Promise.resolve() }
    release() {}
}

/**
 * The real error pg-pool raises under exhaustion: the only connection is held (by the order
 * transaction), so a second acquire waits `connectionTimeoutMillis` and fails.
 */
async function realPoolAcquireTimeout(): Promise<Error> {
    const pool = new Pool({ max: 1, connectionTimeoutMillis: 20, Client: ConnectedClient as never })
    const held = await pool.connect()
    try {
        await pool.connect()
        throw new Error('expected a pool timeout')
    } catch (err) {
        return err as Error
    } finally {
        held.release()
        await pool.end().catch(() => null)
    }
}

function orderData() {
    return { customerPhone: '+60 12-345 6789', customerName: 'Aina', tenant: 7 } as Record<string, unknown>
}

describe('autoLinkCustomer under real transactions (TC-PERF-185)', () => {
    beforeEach(() => consoleErrorSpy.mockClear())

    it('TC-PERF-185: both customer lookups pass the order req (run on the order transaction connection)', async () => {
        // Arrange: create loses the unique race, retry lookup finds the winner
        const uniqueError = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
        const payload = {
            find: vi.fn().mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [{ id: 41 }] }),
            create: vi.fn().mockRejectedValue(uniqueError),
        }
        const req = { payload, transactionID: 'tx-order' }

        // Act
        const result = await autoLinkCustomer({ data: orderData(), req, operation: 'create', originalDoc: undefined } as never)

        // Assert
        expect(result.customer).toBe(41)
        expect(payload.find).toHaveBeenCalledTimes(2)
        for (const [args] of payload.find.mock.calls) expect(args.req).toBe(req)
        // the create stays off req: a unique violation inside the order transaction would abort it
        expect(payload.create.mock.calls[0][0]).not.toHaveProperty('req')
    })

    it('TC-PERF-185: customer create hits the real pg-pool acquire timeout → hook throws, order is not saved with customer=null', async () => {
        // Arrange: the real pg-pool error, raw and as drizzle wraps it
        const timeout = await realPoolAcquireTimeout()
        expect(timeout.message).toContain('timeout exceeded when trying to connect')
        const wrapped = new DrizzleQueryError('insert into "customers" …', [], timeout)

        for (const err of [timeout, wrapped]) {
            const payload = { find: vi.fn().mockResolvedValue({ docs: [] }), create: vi.fn().mockRejectedValue(err) }
            const data = orderData()

            // Act + Assert
            await expect(
                autoLinkCustomer({ data, req: { payload, transactionID: 'tx' }, operation: 'create', originalDoc: undefined } as never),
            ).rejects.toBe(err)
            expect(data).not.toHaveProperty('customer')
        }
    })

    it('TC-PERF-185: a failed lookup (Payload already rolled the order transaction back) is rethrown, not turned into customer=null', async () => {
        // Arrange
        const lookupError = new DrizzleQueryError('select … from "customers"', [], new Error('canceling statement due to statement timeout'))
        const payload = { find: vi.fn().mockRejectedValue(lookupError), create: vi.fn() }
        const data = orderData()

        // Act + Assert
        await expect(
            autoLinkCustomer({ data, req: { payload }, operation: 'create', originalDoc: undefined } as never),
        ).rejects.toBe(lookupError)
        expect(payload.create).not.toHaveBeenCalled()
        expect(data).not.toHaveProperty('customer')
    })

    it('TC-PERF-185: a create that fails on bad data (not a connection problem) still keeps the order with customer=null', async () => {
        // Arrange
        const badData = Object.assign(new Error('value too long for type character varying(255)'), { code: '22001' })
        const payload = { find: vi.fn().mockResolvedValue({ docs: [] }), create: vi.fn().mockRejectedValue(badData) }

        // Act
        const result = await autoLinkCustomer({ data: orderData(), req: { payload }, operation: 'create', originalDoc: undefined } as never)

        // Assert
        expect(result.customer).toBeNull()
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[Orders.autoLinkCustomer]'), badData)
    })

    it('TC-PERF-185: isDbConnectionError — connection classes yes, data/constraint errors no', async () => {
        expect(isDbConnectionError(await realPoolAcquireTimeout())).toBe(true)
        expect(isDbConnectionError(new DrizzleQueryError('q', [], new Error('Connection terminated unexpectedly')))).toBe(true)
        expect(isDbConnectionError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))).toBe(true)
        expect(isDbConnectionError(Object.assign(new Error('admin shutdown'), { code: '57P01' }))).toBe(true)
        expect(isDbConnectionError(Object.assign(new Error('conn failure'), { code: '08006' }))).toBe(true)
        expect(isDbConnectionError(Object.assign(new Error('dup'), { code: '23505' }))).toBe(false)
        expect(isDbConnectionError(new Error('The following field is invalid: phone'))).toBe(false)
    })
})
