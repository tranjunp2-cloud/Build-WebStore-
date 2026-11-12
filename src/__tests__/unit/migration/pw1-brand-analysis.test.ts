import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzePw1Brand } from '@/lib/migration/pw1-brand-analysis'
import { rankBrandColors, type BrandEvidence } from '@/lib/migration/pw1-brand-evidence'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'

// The visual palette is the AI platform task `migration.pw1-brand-palette`; the client is faked,
// the actor scope is real. TC-AIMV-07: no actor → CSS evidence kept with a warning.
const runTask = vi.hoisted(() => vi.fn())
vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask }) }))

const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const inScope = <T>(run: () => Promise<T>) => runWithAiActor(ACTOR, run)
const answer = (output: unknown, usage = { model: 'test', inputTokens: 100, outputTokens: 23 }) => ({ taskId: 'migration.pw1-brand-palette', output, usage })

beforeEach(() => {
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    runTask.mockReset()
})

describe('TC-F35.M39 isolated visual brand analysis', () => {
    const evidence: BrandEvidence = { status: 'observed', url: 'https://source.example', capturedAt: 'today', colors: [], logoScreenshot: 'logo-bytes' }

    it('[TC-AIMV-07] retains neutral palettes and analyzes a logo without a website', async () => {
        const palette = { usable: true, primaryColor: '#111111', secondaryColor: '#eeeeee', reason: 'Monochrome logo', confidence: 'high' }
        runTask.mockResolvedValue(answer(palette))

        const result = await inScope(() => analyzePw1Brand(evidence))

        expect(result.palette?.primaryColor).toBe('#111111')
        expect(result.analysisTokens).toBe(123)
        const [taskId, input] = runTask.mock.calls[0]! as [string, { images: string[]; hasWebsite: boolean; hasLogo: boolean }]
        expect(taskId).toBe('migration.pw1-brand-palette')
        expect(input).toMatchObject({ hasWebsite: false, hasLogo: true, images: ['logo-bytes'] })
        expect(rankBrandColors([{ color: 'rgb(0, 0, 0)', role: 'cta' }], true)[0].color).toBe('#000000')
    })

    it('records the platform model and token counts for the usage ledger', async () => {
        const palette = { usable: true, primaryColor: '#111111', secondaryColor: '#eeeeee', reason: 'Logo', confidence: 'high' }
        runTask.mockResolvedValue(answer(palette, { model: 'gpt-test', inputTokens: 300, outputTokens: 40 }))

        const result = await inScope(() => analyzePw1Brand(evidence))

        expect(result.analysisModel).toBe('gpt-test')
        expect(result.analysisTokens).toBe(340)
    })

    it('rejects error-page evidence and degrades gracefully if AI fails', async () => {
        runTask.mockResolvedValueOnce(answer({ usable: false, primaryColor: '#000000', secondaryColor: '#ffffff', reason: 'Parked domain', confidence: 'low' }))
        const rejected = await inScope(() => analyzePw1Brand(evidence))
        expect(rejected.status).toBe('unavailable')
        expect(rejected.warning).toContain('Parked domain')

        runTask.mockRejectedValueOnce(new Error('Timeout'))
        const failed = await inScope(() => analyzePw1Brand(evidence))
        expect(failed.warning).toContain('using CSS evidence')

        const controller = new AbortController()
        controller.abort()
        runTask.mockRejectedValueOnce(new Error('aborted'))
        await expect(inScope(() => analyzePw1Brand(evidence, controller.signal))).rejects.toThrow()
    })

    it('[TC-AIMV-07] without an AI actor keeps the CSS evidence with a warning and makes no call', async () => {
        const withColors: BrandEvidence = { ...evidence, colors: [{ color: '#335533', score: 5, roles: ['cta'] }] }

        const result = await analyzePw1Brand(withColors)

        expect(runTask).not.toHaveBeenCalled()
        expect(result.status).toBe('observed')
        expect(result.colors).toEqual(withColors.colors)
        expect(result.warning).toContain('AI platform not configured')
    })

    it('returns evidence without screenshots untouched, with no platform call', async () => {
        const cssOnly: BrandEvidence = { status: 'observed', url: 'https://source.example', capturedAt: 'today', colors: [{ color: '#335533', score: 5, roles: ['cta'] }] }

        const result = await inScope(() => analyzePw1Brand(cssOnly))

        expect(result).toBe(cssOnly)
        expect(runTask).not.toHaveBeenCalled()
    })
})
