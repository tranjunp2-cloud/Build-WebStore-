/**
 * TC-AIREL-100 — the site editor layout turns the web builder copilot on only where the
 * assistant runs (`isAiAgentEnabled`): the provider the editor reads (`useEditorAgentEnabled`)
 * is true when the platform is configured and false otherwise, so a deployment without the
 * platform shows no AI chat tab, Ask AI button or AI wording (TC-AIWB-10/72).
 * Real: layout, EditorAgentProvider, isAiAgentEnabled. Faked: the permission guard only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/lib/permission-guard', () => ({ requirePermission: vi.fn().mockResolvedValue(undefined) }))

import SiteEditorLayout from '@/app/(editor)/editor/layout'
import { useEditorAgentEnabled } from '@/components/editor/agent/editor-agent-context'

function Probe() {
    return <span data-testid="agent">{String(useEditorAgentEnabled())}</span>
}

async function renderLayout() {
    const tree = await SiteEditorLayout({ children: <Probe /> })
    render(tree)
    return screen.getByTestId('agent').textContent
}

describe('editor layout copilot gate [TC-AIREL-100]', () => {
    const saved = { ...process.env }
    beforeEach(() => {
        vi.stubEnv('NODE_ENV', 'test')
        delete process.env.VERCEL_ENV
        delete process.env.AI_AGENT_ENABLED
    })
    afterEach(() => {
        process.env = { ...saved }
        vi.unstubAllEnvs()
    })

    it('platform not configured → the editor runs without the copilot', async () => {
        delete process.env.AI_PLATFORM_URL
        delete process.env.AI_PLATFORM_CONTEXT_SECRET
        expect(await renderLayout()).toBe('false')
    })

    it('platform configured outside production → the copilot is on', async () => {
        process.env.AI_PLATFORM_URL = 'https://ai.example.test'
        process.env.AI_PLATFORM_CONTEXT_SECRET = 'x'.repeat(32)
        expect(await renderLayout()).toBe('true')
    })

    it('production without AI_AGENT_ENABLED stays off even when configured', async () => {
        process.env.AI_PLATFORM_URL = 'https://ai.example.test'
        process.env.AI_PLATFORM_CONTEXT_SECRET = 'x'.repeat(32)
        vi.stubEnv('VERCEL_ENV', 'production')
        expect(await renderLayout()).toBe('false')
    })

    it('the context defaults to off outside the provider', () => {
        render(<Probe />)
        expect(screen.getByTestId('agent').textContent).toBe('false')
    })
})
