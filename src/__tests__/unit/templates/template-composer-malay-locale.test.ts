/**
 * #2160 — template-first output for a Malay site must not keep English headings.
 * TC-TF-029a..d, TC-TF-030a..b (docs/qa/F01-template-first-gen.md)
 *
 * Runs the real composer (composeTemplateResult → composeFromBlueprint) with the
 * issue repro input. Pure function — no mocks.
 */
import { describe, it, expect } from 'vitest'
import { composeTemplateResult } from '@/lib/ai/fallback-adapter'

type Block = Record<string, unknown>
type Page = { title: string; slug: string; blocks: Block[] }

const BIZ = 'Kopi Ipoh UAT'
const info = {
    businessName: BIZ,
    industry: 'fnb',
    products: 'Kek lapis, roti canai, kopi tarik',
    shortDescription: 'Kedai kopi keluarga di Ipoh yang menyajikan kek lapis dan kopi tarik setiap hari.',
}
const SEEDS = [1, 2, 3]

function compose(language: 'en' | 'ms' | 'vi', seed: number): Page[] {
    const prompt = `${info.businessName} ${info.shortDescription} ${info.products}`
    const result = composeTemplateResult(prompt, seed, language, info)
    expect(result).not.toBeNull()
    return (result!.pages ?? []) as unknown as Page[]
}

const blocksOf = (pages: Page[], type: string) =>
    pages.flatMap((p) => p.blocks.filter((b) => b.blockType === type))

/** Every `url` string anywhere inside the page blocks (nav, footer, CTAs). */
function allUrls(value: unknown, out: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v) => allUrls(v, out))
    else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            if (k === 'url' && typeof v === 'string') out.push(v)
            else allUrls(v, out)
        }
    }
    return out
}

describe('[TC-TF-029] gallery heading + page title follow the site language (#2160)', () => {
    it.each(SEEDS)('[TC-TF-029a] ms seed %i → no English "Gallery" headline, /gallery page titled "Galeri"', (seed) => {
        // Act
        const pages = compose('ms', seed)

        // Assert
        const galleries = blocksOf(pages, 'gallery')
        expect(galleries.length).toBeGreaterThan(0)
        // Composer blocks read "Galeri — {biz}"; content-injection blocks already use "Galeri".
        for (const g of galleries) {
            expect(g.headline).toMatch(/^Galeri/)
            expect(String(g.headline)).not.toContain('Gallery')
        }
        expect(galleries.some((g) => g.headline === `Galeri — ${BIZ}`)).toBe(true)
        const galleryPage = pages.find((p) => p.slug === '/gallery')
        expect(galleryPage?.title).toBe('Galeri')
    })

    it.each(SEEDS)('[TC-TF-029b] ms seed %i → no link points to a title-derived "/galeri" URL', (seed) => {
        // Act
        const pages = compose('ms', seed)

        // Assert — enrichSubPages derives Blog-page nav URLs from titles; slug must stay /gallery
        const urls = pages.flatMap((p) => allUrls(p.blocks))
        expect(urls.some((u) => u.toLowerCase().includes('/galeri'))).toBe(false)
        expect(urls).toContain('/gallery')
    })

    it('[TC-TF-029c] en → gallery headline and page title unchanged (regression)', () => {
        // Act
        const pages = compose('en', 1)

        // Assert
        const galleries = blocksOf(pages, 'gallery')
        expect(galleries.length).toBeGreaterThan(0)
        for (const g of galleries) expect(g.headline).toBe(`Gallery — ${BIZ}`)
        expect(pages.find((p) => p.slug === '/gallery')?.title).toBe('Gallery')
    })

    it('[TC-TF-029d] vi → same fix applies: "Thư Viện Ảnh" headline + page title', () => {
        // Act
        const pages = compose('vi', 1)

        // Assert
        const galleries = blocksOf(pages, 'gallery')
        expect(galleries.length).toBeGreaterThan(0)
        for (const g of galleries) expect(String(g.headline)).not.toContain('Gallery')
        expect(galleries.some((g) => g.headline === `Thư Viện Ảnh — ${BIZ}`)).toBe(true)
        expect(pages.find((p) => p.slug === '/gallery')?.title).toBe('Thư Viện Ảnh')
    })
})

describe('[TC-TF-030] homepage newsletter heading follows the site language (#2160)', () => {
    it.each(SEEDS)('[TC-TF-030a] ms seed %i → homepage newsletter in Bahasa Melayu', (seed) => {
        // Act
        const home = compose('ms', seed)[0]!

        // Assert
        const newsletters = home.blocks.filter((b) => b.blockType === 'newsletter')
        expect(newsletters.length).toBeGreaterThan(0)
        for (const n of newsletters) {
            expect(n.headline).toBe(`Ikuti Perkembangan Terbaru ${BIZ}`)
            expect(n.subheadline).toBe('Langgan untuk berita dan tawaran.')
        }
    })

    it('[TC-TF-030b] en → homepage newsletter copy unchanged (regression)', () => {
        // Act
        const home = compose('en', 1)[0]!

        // Assert
        const newsletters = home.blocks.filter((b) => b.blockType === 'newsletter')
        expect(newsletters.length).toBeGreaterThan(0)
        for (const n of newsletters) {
            expect(n.headline).toBe(`Stay Updated with ${BIZ}`)
            expect(n.subheadline).toBe('Get the latest news, promotions, and updates delivered to your inbox.')
        }
    })
})
