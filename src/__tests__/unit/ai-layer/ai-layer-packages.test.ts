import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { AutonomyLevelSchema } from '@ech/agent-core'
import { AgentMascot } from '@ech/agent-ui'
import { AgentProvider } from '@ech/agent-react'
import { HttpGateway } from '@ech/agent-transport'
import { AI_TASK_IDS } from '@ech/ai-contracts'

// ─── TC-AIREL-20: vendored AI layer packages are importable ─────────────
// The release branch consumes packages/agent-* + packages/ai-contracts (synced from the
// monorepo, npm workspaces). They need zod 4 while the app stays on zod 3: this guards
// that every package resolves, and that the AI schemas run on their own nested zod 4.
describe('TC-AIREL-20: vendored AI layer packages', () => {
    it('resolves a runtime value from every vendored package', () => {
        expect(AutonomyLevelSchema).toBeDefined()
        expect(AgentMascot).toBeTypeOf('function')
        expect(AgentProvider).toBeTypeOf('function')
        expect(HttpGateway).toBeTypeOf('function')
        expect(AI_TASK_IDS.length).toBeGreaterThan(0)
    })

    it('keeps the app on zod 3 while the packages run their own zod 4', () => {
        // Arrange: zod 3 schemas carry `_def`, zod 4 schemas carry `_zod`
        const appSchema = z.string()

        // Act + Assert
        expect('_def' in appSchema).toBe(true)
        expect('_zod' in appSchema).toBe(false)
        expect('_zod' in AutonomyLevelSchema).toBe(true)
    })

    it('validates input with the package schema', () => {
        // Arrange + Act
        const ok = AutonomyLevelSchema.safeParse('stage')
        const bad = AutonomyLevelSchema.safeParse('root')

        // Assert
        expect(ok.success).toBe(true)
        expect(bad.success).toBe(false)
    })
})
