import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkKeywordRank } from '@/lib/seo/rank-tracker'

// ─── TC-F03.47: Keyword rank tracking ────────────────────────────────

describe('checkKeywordRank [TC-F03.47]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it('returns a number rank when domain is found in SERP', async () => {
        const mockHtml = `
            <a href="https://google.com/something">skip</a>
            <a href="https://other-site.com/page">Other</a>
            <a href="https://www.mycafe.com/home">My Cafe</a>
        `
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        } as Response)

        const rank = await checkKeywordRank('mycafe.com', 'best cafe KL')
        expect(rank).toBe(2) // other-site=1, mycafe=2
    })

    it('returns null when domain is not found in top results', async () => {
        const mockHtml = `
            <a href="https://competitor1.com/page">C1</a>
            <a href="https://competitor2.com/page">C2</a>
        `
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        } as Response)

        const rank = await checkKeywordRank('mycafe.com', 'nasi lemak')
        expect(rank).toBeNull()
    })

    it('returns mock rank when Google returns non-200 status', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: false,
            status: 429,
        } as Response)

        const rank = await checkKeywordRank('test.com', 'keyword')
        expect(typeof rank).toBe('number')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })

    it('returns mock rank when fetch throws error', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

        const rank = await checkKeywordRank('test.com', 'keyword')
        expect(typeof rank).toBe('number')
        expect(rank).toBeGreaterThanOrEqual(1)
        expect(rank).toBeLessThanOrEqual(50)
    })

    it('strips protocol and www from domain before matching', async () => {
        const mockHtml = `
            <a href="https://example.com/page">Example</a>
        `
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        } as Response)

        const rank = await checkKeywordRank('https://www.example.com', 'test')
        expect(rank).toBe(1)
    })

    it('counts unique domains only (deduplication)', async () => {
        const mockHtml = `
            <a href="https://site-a.com/page1">A1</a>
            <a href="https://site-a.com/page2">A2</a>
            <a href="https://site-b.com/page1">B1</a>
            <a href="https://target.com/home">Target</a>
        `
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        } as Response)

        const rank = await checkKeywordRank('target.com', 'query')
        // site-a = rank 1 (deduped), site-b = rank 2, target = rank 3
        expect(rank).toBe(3)
    })

    it('skips google.com and schema.org links', async () => {
        const mockHtml = `
            <a href="https://google.com/search">skip</a>
            <a href="https://schema.org/Thing">skip</a>
            <a href="https://real-result.com/page">Real</a>
            <a href="https://target.com/page">Target</a>
        `
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(mockHtml),
        } as Response)

        const rank = await checkKeywordRank('target.com', 'test')
        expect(rank).toBe(2) // real-result=1, target=2
    })

    it('returns consistent mock rank for same keyword (deterministic hash)', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'))

        const rank1 = await checkKeywordRank('x.com', 'best cafe penang')
        const rank2 = await checkKeywordRank('x.com', 'best cafe penang')
        expect(rank1).toBe(rank2)
    })
})
