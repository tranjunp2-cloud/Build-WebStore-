import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { analyzePw1Brand } from '@/lib/migration/pw1-brand-analysis'
import { rankBrandColors, type BrandEvidence } from '@/lib/migration/pw1-brand-evidence'
import { logAiUsage } from '@/lib/ai/log-usage'
vi.mock('@/lib/ai/log-usage', () => ({ logAiUsage: vi.fn() }))

describe('TC-F35.M39 isolated visual brand analysis', () => {
    const evidence: BrandEvidence = { status: 'observed', url: 'https://source.example', capturedAt: 'today', colors: [], logoScreenshot: 'logo-bytes' }
    it('retains neutral palettes and analyzes a logo without a website', async () => {
        const palette = { usable: true, primaryColor: '#111111', secondaryColor: '#eeeeee', reason: 'Monochrome logo', confidence: 'high' }
        const create = vi.fn().mockResolvedValue({ model: 'test', usage: { total_tokens: 123 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(palette) } }] })
        const result = await analyzePw1Brand(evidence, undefined, { chat: { completions: { create } } } as unknown as OpenAI)
        expect(result.palette?.primaryColor).toBe('#111111')
        expect(result.analysisTokens).toBe(123)
        expect(create.mock.calls[0][0].messages[1].content[1].image_url.url).toContain('logo-bytes')
        expect(rankBrandColors([{ color: 'rgb(0, 0, 0)', role: 'cta' }], true)[0].color).toBe('#000000')
    })
    it('logs brand-analysis usage with low-detail images for cost tracking', async () => {
        // Arrange
        vi.mocked(logAiUsage).mockClear()
        const palette = { usable: true, primaryColor: '#111111', secondaryColor: '#eeeeee', reason: 'Logo', confidence: 'high' }
        const create = vi.fn().mockResolvedValue({ model: 'gpt-test', usage: { prompt_tokens: 300, completion_tokens: 40, total_tokens: 340 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(palette) } }] })
        // Act
        await analyzePw1Brand(evidence, undefined, { chat: { completions: { create } } } as unknown as OpenAI)
        // Assert
        expect(create.mock.calls[0][0].messages[1].content[1].image_url.detail).toBe('low')
        expect(logAiUsage).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'brand-analysis', model: 'gpt-test', tokensIn: 300, tokensOut: 40, success: true }))
    })
    it('rejects error-page evidence and degrades gracefully if AI fails', async () => {
        const create = vi.fn().mockResolvedValue({ model: 'test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ usable: false, primaryColor: '#000000', secondaryColor: '#ffffff', reason: 'Parked domain', confidence: 'low' }) } }] })
        const client = { chat: { completions: { create } } } as unknown as OpenAI
        expect((await analyzePw1Brand(evidence, undefined, client)).status).toBe('unavailable')
        create.mockRejectedValue(new Error('Timeout'))
        expect((await analyzePw1Brand(evidence, undefined, client)).warning).toContain('using CSS evidence')
        const controller = new AbortController(); controller.abort()
        await expect(analyzePw1Brand(evidence, controller.signal, client)).rejects.toThrow()
    })
})
