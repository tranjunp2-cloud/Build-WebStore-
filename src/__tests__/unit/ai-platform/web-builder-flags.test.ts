/**
 * TC-AIWB-10 — the editor's AI follows the assistant flag: the web builder copilot runs wherever
 * the agent runs (platform configured; on production AI_AGENT_ENABLED=true), and there is no
 * separate editor opt-in any more (the legacy chat panel it switched between is gone).
 * Real: config.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as config from '@/lib/ai-platform/config'

const savedVercelEnv = process.env.VERCEL_ENV

beforeEach(() => {
    delete process.env.VERCEL_ENV
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    vi.stubEnv('AI_AGENT_ENABLED', '')
})

afterEach(() => {
    vi.unstubAllEnvs()
    if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv
})

describe('the editor AI flag is the assistant flag [TC-AIWB-10]', () => {
    it('is off when the platform is not configured', () => {
        vi.stubEnv('AI_PLATFORM_URL', '')

        expect(config.isAiAgentEnabled()).toBe(false)
    })

    it('is on outside production when the platform is configured, without any flag', () => {
        vi.stubEnv('NODE_ENV', 'development')

        expect(config.isAiAgentEnabled()).toBe(true)
    })

    it('on production only with AI_AGENT_ENABLED=true (also when VERCEL_ENV says production)', () => {
        vi.stubEnv('NODE_ENV', 'production')
        expect(config.isAiAgentEnabled()).toBe(false)
        vi.stubEnv('AI_AGENT_ENABLED', 'true')
        expect(config.isAiAgentEnabled()).toBe(true)

        vi.stubEnv('NODE_ENV', 'development')
        process.env.VERCEL_ENV = 'production'
        vi.stubEnv('AI_AGENT_ENABLED', '')
        expect(config.isAiAgentEnabled()).toBe(false)
    })

    it('has no separate editor opt-in', () => {
        expect('isAiEditorAgentEnabled' in config).toBe(false)
    })
})
