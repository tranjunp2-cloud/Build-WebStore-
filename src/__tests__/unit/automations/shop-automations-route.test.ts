/**
 * TC-AICP-231 — GET /api/cron/shop-automations fails closed: no CRON_SECRET configured, no header, a wrong or
 * differently-cased secret → 401 and nothing runs. With the secret it runs the batch and reports its summary;
 * the optional cursor / tenant / force parameters are validated; an internal error is a 500 without detail.
 * TC-AICP-240 — vercel.json schedules the route (several passes a day so a run that ran out of time is
 * continued) and keeps git deployment disabled; db-setup registers the settings column and the new
 * notification type (the Notifications select lists it too).
 * TC-AICP-344 — the route follows the copilot switch (real lib/ai-platform/config): with the assistant off
 * (AI_AGENT_ENABLED=false, or production without "true") it answers success + skipped and runs nothing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), runAutomationBatch: vi.fn() }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/automations/automation-batch', () => ({ runAutomationBatch: mocks.runAutomationBatch }))

import { GET } from '@/app/api/cron/shop-automations/route'

const SECRET = 'cron-secret-for-tests-0123456789'
const call = (authorization?: string, query = '') =>
    GET(new Request(`https://shop.test/api/cron/shop-automations${query}`, { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = SECRET
    // the assistant is on: platform configured, outside production, no kill switch
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('AI_AGENT_ENABLED', '')
    vi.stubEnv('VERCEL_ENV', 'preview')
    delete process.env.NEXT_PUBLIC_SERVER_URL
    mocks.getPayload.mockResolvedValue({ marker: 'payload' })
    mocks.runAutomationBatch.mockResolvedValue({ day: '2026-10-27', scanned: 3, complete: true, nextCursor: null })
})
afterEach(() => {
    delete process.env.CRON_SECRET
    vi.unstubAllEnvs()
})

describe('GET /api/cron/shop-automations [TC-AICP-231]', () => {
    it('is unauthorized without a configured secret, even when the header is "Bearer undefined" or empty', async () => {
        delete process.env.CRON_SECRET

        expect((await call('Bearer undefined')).status).toBe(401)
        expect((await call('Bearer ')).status).toBe(401)
        expect((await call()).status).toBe(401)
        expect(mocks.getPayload).not.toHaveBeenCalled()
        expect(mocks.runAutomationBatch).not.toHaveBeenCalled()
    })

    it.each([
        ['no header', undefined],
        ['a wrong secret', 'Bearer nope'],
        ['a longer secret', `Bearer ${SECRET}x`],
        ['a shorter secret', `Bearer ${SECRET.slice(0, -1)}`],
        ['no Bearer prefix', SECRET],
        ['another case', `bearer ${SECRET}`],
    ])('answers 401 and runs nothing with %s', async (_label, header) => {
        const res = await call(header)

        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: 'Unauthorized' })
        expect(mocks.runAutomationBatch).not.toHaveBeenCalled()
    })

    it('runs the batch with the secret and returns its summary', async () => {
        const res = await call(`Bearer ${SECRET}`)

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true, day: '2026-10-27', scanned: 3, complete: true, nextCursor: null })
        expect(mocks.runAutomationBatch).toHaveBeenCalledWith({ marker: 'payload' }, expect.objectContaining({ now: expect.any(Date), baseUrl: 'https://shop.test', cursor: undefined, tenantId: undefined, force: false }))
    })

    it('uses the configured public URL for the links in emails, without a trailing slash', async () => {
        process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.primeweb.test/'

        await call(`Bearer ${SECRET}`)

        expect(mocks.runAutomationBatch.mock.calls[0]![1].baseUrl).toBe('https://app.primeweb.test')
    })

    it('passes a valid cursor, tenant and force, and ignores anything that is not a positive integer', async () => {
        await call(`Bearer ${SECRET}`, '?cursor=40&tenant=7&force=1')
        await call(`Bearer ${SECRET}`, '?cursor=-1&tenant=abc&force=true')
        await call(`Bearer ${SECRET}`, '?cursor=0&tenant=1;DROP')

        const [first, second, third] = mocks.runAutomationBatch.mock.calls.map(([, options]) => options)
        expect(first).toMatchObject({ cursor: 40, tenantId: 7, force: true })
        expect(second).toMatchObject({ cursor: undefined, tenantId: undefined, force: false })
        expect(third).toMatchObject({ cursor: undefined, tenantId: undefined })
    })

    it('answers 500 without the error detail when the run fails', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        mocks.runAutomationBatch.mockRejectedValue(new Error('password=hunter2 in connection string'))

        const res = await call(`Bearer ${SECRET}`)

        expect(res.status).toBe(500)
        expect(JSON.stringify(await res.json())).not.toContain('hunter2')
        log.mockRestore()
    })
})

describe('GET /api/cron/shop-automations follows the copilot switch [TC-AICP-344]', () => {
    it.each([
        ['the kill switch is set', { AI_AGENT_ENABLED: 'false', VERCEL_ENV: 'preview' }],
        ['production has no AI_AGENT_ENABLED=true', { AI_AGENT_ENABLED: '', VERCEL_ENV: 'production' }],
    ])('[TC-AICP-344] skips the run when %s', async (_label, env) => {
        // Arrange
        vi.stubEnv('AI_AGENT_ENABLED', env.AI_AGENT_ENABLED)
        vi.stubEnv('VERCEL_ENV', env.VERCEL_ENV)

        // Act
        const res = await call(`Bearer ${SECRET}`)

        // Assert
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ success: true, skipped: 'ai_agent_disabled' })
        expect(mocks.getPayload).not.toHaveBeenCalled()
        expect(mocks.runAutomationBatch).not.toHaveBeenCalled()
    })

    it('[TC-AICP-344] still answers 401 before the switch is read', async () => {
        // Arrange
        vi.stubEnv('AI_AGENT_ENABLED', 'false')

        // Act
        const res = await call('Bearer nope')

        // Assert
        expect(res.status).toBe(401)
    })

    it('[TC-AICP-344] runs on production when AI_AGENT_ENABLED=true', async () => {
        // Arrange
        vi.stubEnv('AI_AGENT_ENABLED', 'true')
        vi.stubEnv('VERCEL_ENV', 'production')

        // Act
        const res = await call(`Bearer ${SECRET}`)

        // Assert
        expect(res.status).toBe(200)
        expect(mocks.runAutomationBatch).toHaveBeenCalledTimes(1)
    })
})

describe('schema registration [TC-AICP-240]', () => {
    // db-setup.js is a CommonJS script
    const { MIGRATIONS } = require('../../../../scripts/db-setup.js') as { MIGRATIONS: Array<{ name: string; sql: string }> }

    it('adds the automations json column and extends the notification enum only when it exists', () => {
        const column = MIGRATIONS.find((m) => m.name === 'tenants.settings_automations')
        const type = MIGRATIONS.find((m) => m.name === 'notifications.type_automation_reminder')

        expect(column?.sql).toBe('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings_automations jsonb;')
        expect(type?.sql).toContain("typname = 'enum_notifications_type'")
        expect(type?.sql).toContain("ADD VALUE IF NOT EXISTS 'AUTOMATION_REMINDER'")
        expect(MIGRATIONS.filter((m) => m.name === column?.name)).toHaveLength(1)
    })

    it('lists the type in the Notifications select and the shared notification type', () => {
        const collection = readFileSync(join(__dirname, '../../../collections/Notifications.ts'), 'utf8')
        const types = readFileSync(join(__dirname, '../../../types/notification.ts'), 'utf8')

        expect(collection).toContain("value: 'AUTOMATION_REMINDER'")
        expect(types).toContain("'AUTOMATION_REMINDER'")
    })
})

describe('vercel.json [TC-AICP-240]', () => {
    const config = JSON.parse(readFileSync(join(__dirname, '../../../../vercel.json'), 'utf8'))

    it('schedules the automations in the early morning Malaysia time, in several passes', () => {
        const cron = config.crons.find((c: { path: string }) => c.path === '/api/cron/shop-automations')

        expect(cron).toBeTruthy()
        const [minute, hours] = cron.schedule.split(' ')
        expect(minute).toBe('0')
        const passes = hours.split(',').map(Number)
        expect(passes[0]).toBe(1) // 01:00 UTC = 09:00 in Kuala Lumpur
        expect(passes.length).toBeGreaterThanOrEqual(2)
    })

    it('keeps git deployment disabled (deploys go through CI)', () => {
        expect(config.git.deploymentEnabled).toBe(false)
    })
})
