/**
 * TC-AICP-345 — Settings > Email templates shows only the templates: the Automations section was taken off the page
 * (#2176), so the page never hands the client an automations slot, with the copilot on or off.
 * Real: the server page, lib/ai-platform/config (env driven). Faked: Payload, auth, the client
 * list (a stub that records the props it receives), AgentRefresh.
 */
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ clientProps: [] as Array<Record<string, unknown>> }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: vi.fn(async () => ({ docs: [] })) })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ getCurrentTenantId: vi.fn(async () => 7) }))
vi.mock('@/lib/agent-changes/agent-refresh', () => ({ AgentRefresh: () => null }))
vi.mock('@/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient', () => ({
    EmailTemplatesClient: (props: Record<string, unknown>) => {
        mocks.clientProps.push(props)
        return <main>templates</main>
    },
}))

import EmailTemplatesPage from '@/app/(dashboard)/settings/email-templates/page'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.clientProps.length = 0
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('VERCEL_ENV', 'preview')
})
afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
})

describe('email templates page: no automations section [TC-AICP-345]', () => {
    it.each([
        ['the copilot is on', ''],
        ['the copilot is off', 'false'],
    ])('[TC-AICP-345] renders only the templates when %s', async (_label, flag) => {
        // Arrange
        vi.stubEnv('AI_AGENT_ENABLED', flag)

        // Act
        render(await EmailTemplatesPage())

        // Assert
        expect(screen.getByText('templates')).toBeTruthy()
        expect(mocks.clientProps.at(-1)).not.toHaveProperty('automationsSlot')
    })
})
