/**
 * TC-AISEC-02 — AI platform gates: isAiTasksEnabled / isAiAgentEnabled env matrix.
 *
 * isAiTasksEnabled: AI_PLATFORM_URL + AI_PLATFORM_CONTEXT_SECRET (>= 32 chars). The old
 * AI_TASKS_ENABLED production flag is gone and must have no effect.
 * isAiAgentEnabled: same platform requirement, plus AI_AGENT_ENABLED=true on production;
 * AI_AGENT_ENABLED=false turns it off everywhere (TC-AICP-341).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    AI_UNAVAILABLE_MESSAGE,
    getAiPlatformContextSecret,
    getAiPlatformUrl,
    isAiAgentEnabled,
    isAiTasksEnabled,
} from '@/lib/ai-platform/config'

const SECRET = 'test-context-secret-at-least-32-characters'
const savedVercelEnv = process.env.VERCEL_ENV

beforeEach(() => {
    // `VERCEL_ENV ?? NODE_ENV` decides "production", so an unset VERCEL_ENV must be absent, not empty.
    delete process.env.VERCEL_ENV
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', SECRET)
    vi.stubEnv('AI_AGENT_ENABLED', '')
    vi.stubEnv('AI_TASKS_ENABLED', '')
})

afterEach(() => {
    vi.unstubAllEnvs()
    if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv
})

describe('isAiTasksEnabled [TC-AISEC-02]', () => {
    it('is on in production with the platform configured and no AI_TASKS_ENABLED flag', () => {
        vi.stubEnv('NODE_ENV', 'production')

        expect(isAiTasksEnabled()).toBe(true)
    })

    it('ignores a legacy AI_TASKS_ENABLED=false on production (the production gate is gone)', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('AI_TASKS_ENABLED', 'false')

        expect(isAiTasksEnabled()).toBe(true)
    })

    it('is on outside production when the platform is configured', () => {
        vi.stubEnv('NODE_ENV', 'development')
        expect(isAiTasksEnabled()).toBe(true)

        vi.stubEnv('NODE_ENV', 'test')
        expect(isAiTasksEnabled()).toBe(true)
    })

    it('is off when AI_PLATFORM_URL is missing or blank', () => {
        vi.stubEnv('AI_PLATFORM_URL', '')
        expect(isAiTasksEnabled()).toBe(false)

        vi.stubEnv('AI_PLATFORM_URL', '   ')
        expect(isAiTasksEnabled()).toBe(false)
    })

    it('is off when the context secret is shorter than 32 characters', () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'x'.repeat(31))

        expect(isAiTasksEnabled()).toBe(false)
    })

    it('is on at exactly 32 characters', () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'x'.repeat(32))

        expect(isAiTasksEnabled()).toBe(true)
    })

    it('measures the secret after trimming surrounding whitespace', () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', `  ${'x'.repeat(31)}  `)

        expect(isAiTasksEnabled()).toBe(false)
    })

    it('is off when the context secret is missing', () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', '')

        expect(isAiTasksEnabled()).toBe(false)
    })
})

describe('isAiAgentEnabled [TC-AISEC-02]', () => {
    it('stays off on production unless AI_AGENT_ENABLED=true', () => {
        vi.stubEnv('NODE_ENV', 'production')

        expect(isAiAgentEnabled()).toBe(false)

        vi.stubEnv('AI_AGENT_ENABLED', 'false')
        expect(isAiAgentEnabled()).toBe(false)

        vi.stubEnv('AI_AGENT_ENABLED', 'true')
        expect(isAiAgentEnabled()).toBe(true)
    })

    it('is on outside production when the platform is configured, without the flag', () => {
        vi.stubEnv('NODE_ENV', 'development')

        expect(isAiAgentEnabled()).toBe(true)
    })

    it('stays off without the platform, even on production with the flag', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('AI_AGENT_ENABLED', 'true')
        vi.stubEnv('AI_PLATFORM_URL', '')

        expect(isAiAgentEnabled()).toBe(false)
    })

    it('treats VERCEL_ENV=production as production even when NODE_ENV is not', () => {
        vi.stubEnv('NODE_ENV', 'development')
        process.env.VERCEL_ENV = 'production'

        expect(isAiAgentEnabled()).toBe(false)
    })

    it('treats a VERCEL_ENV preview deploy as non-production even when NODE_ENV is production', () => {
        vi.stubEnv('NODE_ENV', 'production')
        process.env.VERCEL_ENV = 'preview'

        expect(isAiAgentEnabled()).toBe(true)
    })
})

describe('platform endpoint helpers and the unavailable message [TC-AISEC-02]', () => {
    it('strips trailing slashes from the platform URL', () => {
        vi.stubEnv('AI_PLATFORM_URL', ' http://ai.internal:8300/// ')

        expect(getAiPlatformUrl()).toBe('http://ai.internal:8300')
    })

    it('returns null for the context secret when it is too short', () => {
        vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'short')

        expect(getAiPlatformContextSecret()).toBeNull()
    })

    it('keeps the user-facing unavailable message free of configuration names', () => {
        expect(AI_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0)
        expect(AI_UNAVAILABLE_MESSAGE).not.toMatch(/OPENAI|API_KEY|AI_PLATFORM|SECRET/i)
    })
})

describe('isAiAgentEnabled kill switch [TC-AICP-341]', () => {
    it.each([
        ['preview + false → off', { NODE_ENV: 'production', VERCEL_ENV: 'preview', AI_AGENT_ENABLED: 'false' }, false],
        ['development + false → off', { NODE_ENV: 'development', AI_AGENT_ENABLED: 'false' }, false],
        ['development + " FALSE " → off', { NODE_ENV: 'development', AI_AGENT_ENABLED: ' FALSE ' }, false],
        ['non-production unset → on', { NODE_ENV: 'development' }, true],
        ['production unset → off', { NODE_ENV: 'production' }, false],
        ['production true → on', { NODE_ENV: 'production', AI_AGENT_ENABLED: 'true' }, true],
        ['production + VERCEL_ENV=production true → on', { NODE_ENV: 'production', VERCEL_ENV: 'production', AI_AGENT_ENABLED: 'true' }, true],
    ] as const)('[TC-AICP-341] %s', (_label, env, expected) => {
        // Arrange
        vi.stubEnv('NODE_ENV', env.NODE_ENV)
        if ('VERCEL_ENV' in env) process.env.VERCEL_ENV = env.VERCEL_ENV
        if ('AI_AGENT_ENABLED' in env) vi.stubEnv('AI_AGENT_ENABLED', env.AI_AGENT_ENABLED)
        else delete process.env.AI_AGENT_ENABLED

        // Act
        const enabled = isAiAgentEnabled()

        // Assert
        expect(enabled).toBe(expected)
    })
})
