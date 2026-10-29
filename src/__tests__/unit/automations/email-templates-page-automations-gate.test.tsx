/**
 * TC-AICP-345 — Settings > Email templates shows the Automations section only where the assistant runs
 * (isAiAgentEnabled): the cron that sends the reminders skips while the copilot is off, so the switches would do
 * nothing. The templates themselves always open.
 * Real: the server page, lib/ai-platform/config (env driven). Faked: Payload, auth, the settings read, the client
 * list (a stub that shows whether it got the automations slot), AutomationsSection, AgentRefresh.
 */
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readAutomationSettings: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: vi.fn(async () => ({ docs: [] })) })) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/auth', () => ({ getCurrentTenantId: vi.fn(async () => 7), getCurrentUser: vi.fn(async () => ({ id: 1, tenants: [{ tenant: 7, roles: ['owner'] }] })) }))
vi.mock('@/lib/automations/automation-store', () => ({ readAutomationSettings: mocks.readAutomationSettings }))
vi.mock('@/lib/agent-changes/agent-refresh', () => ({ AgentRefresh: () => null }))
vi.mock('@/app/(dashboard)/settings/email-templates/_components/automations-section', () => ({ AutomationsSection: () => <p>automations section</p> }))
vi.mock('@/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient', () => ({
    EmailTemplatesClient: ({ automationsSlot }: { automationsSlot?: React.ReactNode }) => <main>templates{automationsSlot}</main>,
}))

import EmailTemplatesPage from '@/app/(dashboard)/settings/email-templates/page'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.readAutomationSettings.mockResolvedValue({})
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('VERCEL_ENV', 'preview')
})
afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
})

describe('email templates page: automations follow the copilot switch [TC-AICP-345]', () => {
    it('[TC-AICP-345] shows the automations where the assistant runs', async () => {
        // Arrange
        vi.stubEnv('AI_AGENT_ENABLED', '')

        // Act
        render(await EmailTemplatesPage())

        // Assert
        expect(screen.getByText('templates')).toBeTruthy()
        expect(screen.getByText('automations section')).toBeTruthy()
    })

    it.each([
        ['the kill switch is set', 'preview', 'false'],
        ['production has no AI_AGENT_ENABLED=true', 'production', ''],
    ])('[TC-AICP-345] hides them (and does not read their settings) when %s', async (_label, vercelEnv, flag) => {
        // Arrange
        vi.stubEnv('VERCEL_ENV', vercelEnv)
        vi.stubEnv('AI_AGENT_ENABLED', flag)

        // Act
        render(await EmailTemplatesPage())

        // Assert
        expect(screen.getByText('templates')).toBeTruthy()
        expect(screen.queryByText('automations section')).toBeNull()
        expect(mocks.readAutomationSettings).not.toHaveBeenCalled()
    })
})
