/**
 * #2160 — the builder sends `language: 'auto'` + the confirmed `generationLocale`. Template-first must
 * compose in that resolved locale; passing the raw 'auto' collapsed to 'en' and shipped English headings.
 * TC-TF-031a..b (docs/qa/F01-template-first-gen.md)
 *
 * Real: openai-generator.ts mode + template-first path, composer, i18n.
 * Faked: the AI platform (scripted double) — personalisation answers an empty object.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { scripted } from '@/__tests__/helpers/scripted-ai-platform'

vi.mock('@/lib/ai-platform/actor-scope', async (importOriginal) => {
    const { scriptedActorScope } = await import('@/__tests__/helpers/scripted-ai-platform')
    return scriptedActorScope(await importOriginal<any>())
})

import { generateSiteWithAI, resolveSiteGenerationMode } from '@/lib/ai/openai-generator'

// Issue #2160 repro input (UAT production 30/10/2026).
const BIZ = 'Kopi Ipoh UAT'
const businessInfo = {
    businessName: BIZ,
    industry: 'fnb',
    products: 'Kek lapis, roti canai, kopi tarik',
    shortDescription: 'Kedai kopi keluarga di Ipoh yang menyajikan kek lapis dan kopi tarik setiap hari.',
}

type Block = Record<string, unknown>
type Page = { slug: string; title: string; blocks: Block[] }

async function generate(language: 'auto' | 'en', targetLocale?: string): Promise<Page[]> {
    const modeDecision = await resolveSiteGenerationMode()
    const output = await generateSiteWithAI(
        businessInfo, undefined, language, undefined, undefined, undefined,
        { modeDecision, ...(targetLocale ? { targetLocale } : {}) },
    )
    expect(output.effectiveGenMode).toBe('template-first')
    return (output.result.pages ?? []) as unknown as Page[]
}

const galleryHeadlines = (pages: Page[]) =>
    pages.flatMap((p) => p.blocks.filter((b) => b.blockType === 'gallery').map((b) => String(b.headline)))

beforeEach(() => {
    scripted.taskIds = []
    // Arrange — an AI actor exists (prod template-first path); personalisation returns nothing usable.
    scripted.mockImplementation(() => ({
        chat: { completions: { create: vi.fn(async () => ({ choices: [{ message: { content: '{}' } }] })) } },
    }))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    scripted.create = null
    vi.restoreAllMocks()
    delete process.env.GEN_MODE
})

describe('[TC-TF-031] template-first composes in the resolved locale (#2160)', () => {
    it('[TC-TF-031a] language "auto" + targetLocale "ms" → Malay gallery headline + page title', async () => {
        // Act
        const pages = await generate('auto', 'ms')

        // Assert
        const headlines = galleryHeadlines(pages)
        expect(headlines.length).toBeGreaterThan(0)
        expect(headlines.some((h) => h.includes('Gallery'))).toBe(false)
        expect(headlines).toContain(`Galeri — ${BIZ}`)
        expect(pages.find((p) => p.slug === '/gallery')?.title).toBe('Galeri')
    })

    it('[TC-TF-031b] language "en" → English gallery headline unchanged (regression)', async () => {
        // Act
        const pages = await generate('en')

        // Assert
        const headlines = galleryHeadlines(pages)
        expect(headlines.length).toBeGreaterThan(0)
        for (const h of headlines) expect(h).toBe(`Gallery — ${BIZ}`)
    })
})
