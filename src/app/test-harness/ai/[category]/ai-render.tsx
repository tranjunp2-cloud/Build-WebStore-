import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'
import { getCategoryContent } from '@/lib/ai/content'
import type { GenerationResult, GeneratedPage } from '@/lib/ai/generate-blocks'

const CACHE_DIR = path.resolve(process.cwd(), '.harness-out/ai-cache')

function cachePathFor(category: string): string {
    return path.join(CACHE_DIR, `${category}.json`)
}

function readCache(category: string): GenerationResult | null {
    const p = cachePathFor(category)
    if (!fs.existsSync(p)) return null
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8')) as GenerationResult
    } catch {
        return null
    }
}

function writeCache(category: string, result: GenerationResult): void {
    try {
        fs.mkdirSync(CACHE_DIR, { recursive: true })
        fs.writeFileSync(cachePathFor(category), JSON.stringify(result, null, 2))
    } catch (err) {
        console.warn('[ai-harness] cache write failed:', (err as Error).message)
    }
}

async function genForCategory(category: string): Promise<GenerationResult | null> {
    const content = getCategoryContent(category)
    const biz = content?.businesses?.[0]
    if (!biz) return null

    const prevMode = process.env.GEN_MODE
    process.env.GEN_MODE = 'ai-first'
    try {
        const { result } = await generateSiteWithAI(
            {
                businessName: biz.name,
                industry: category,
                shortDescription: biz.description,
                products: biz.products?.join?.(', ') ?? '',
                phone: biz.phone,
                email: biz.email,
                address: biz.address,
            },
            undefined,
            'en',
        )
        return result
    } finally {
        if (prevMode === undefined) delete process.env.GEN_MODE
        else process.env.GEN_MODE = prevMode
    }
}

function normalizeSlug(slug: string): string {
    return slug.toLowerCase().replace(/^\/+|\/+$/g, '') || 'home'
}

function resolvePage(result: GenerationResult, slug?: string): GeneratedPage | null {
    const pages = result.pages ?? []
    if (pages.length === 0) return null
    const target = normalizeSlug(slug ?? '')
    if (target === 'home') {
        return pages.find((p) => p.isHomepage || /home/i.test(p.slug)) ?? pages[0] ?? null
    }
    return pages.find((p) => normalizeSlug(p.slug) === target) ?? null
}

export async function renderAIHarness(category: string, slug: string | undefined, refresh: boolean) {
    const content = getCategoryContent(category)
    if (!content) notFound()

    let result: GenerationResult | null = refresh ? null : readCache(category)
    let cachedFrom: 'disk' | 'fresh' = 'disk'

    if (!result) {
        cachedFrom = 'fresh'
        try {
            result = await genForCategory(category)
            if (!result) notFound()
            writeCache(category, result)
        } catch (err) {
            return (
                <div className="p-10 font-mono">
                    <div className="bg-red-50 border border-red-300 rounded-lg p-6">
                        <h1 className="text-2xl font-bold text-red-700 mb-2">AI gen failed for {category}</h1>
                        <pre className="text-sm text-red-600 whitespace-pre-wrap">{(err as Error).message}</pre>
                        <p className="mt-4 text-sm text-gray-700">Check: OPENAI_API_KEY in .env.local, OpenAI quota.</p>
                    </div>
                </div>
            )
        }
    }

    const page = resolvePage(result, slug)
    if (!page) {
        // Fallback: no pages → use flat blocks
        if (!slug || slug === 'home') {
            const blocks = result.blocks ?? []
            return renderLayout(result, category, 'home', blocks as unknown as Record<string, unknown>[], cachedFrom, [])
        }
        notFound()
    }

    const layout = page.blocks as unknown as Record<string, unknown>[]
    const availableSlugs = (result.pages ?? []).map((p) => ({
        slug: normalizeSlug(p.slug),
        title: p.title,
    }))

    return renderLayout(result, category, normalizeSlug(page.slug), layout, cachedFrom, availableSlugs)
}

function renderLayout(
    result: GenerationResult,
    category: string,
    currentSlug: string,
    layout: Record<string, unknown>[],
    cachedFrom: 'disk' | 'fresh',
    slugs: Array<{ slug: string; title: string }>,
) {
    const site = { theme: result.theme as Record<string, unknown> }
    const pageData = { layout }
    const prefix = `/test-harness/ai/${category}`
    const slugsJson = JSON.stringify(slugs.map((s) => s.slug))

    return (
        <div data-harness-ai-category={category} data-harness-page={currentSlug}>
            <script
                dangerouslySetInnerHTML={{
                    __html: `(function(){var prefix=${JSON.stringify(prefix)};var slugs=${slugsJson};document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!h||h.startsWith('#')||h.startsWith('http')||h.startsWith('/test-harness'))return;e.preventDefault();var raw=h.replace(/^\\/+|\\/+$/g,'').toLowerCase();var target=slugs.indexOf(raw)>=0?raw:(slugs.indexOf('home')>=0&&(raw===''||raw==='/')?'home':null);if(target){window.location.href=prefix+(target==='home'?'':'/'+target);}else{console.warn('[harness] no matching page for '+h+' (available: '+slugs.join(',')+')');}},true);})();`,
                }}
            />
            <div
                style={{
                    position: 'fixed',
                    top: 10,
                    right: 10,
                    zIndex: 100,
                    background: '#7c3aed',
                    color: '#fff',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: 12,
                    padding: '6px 12px',
                    borderRadius: 999,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}
            >
                AI-FIRST · {category} · {result.siteName} · <span style={{ opacity: 0.7 }}>{cachedFrom}</span>
            </div>
            {slugs.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 100,
                        background: 'rgba(17,17,17,0.92)',
                        color: '#fff',
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 999,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                >
                    <span style={{ opacity: 0.6 }}>harness:</span>
                    {slugs.map((s) => {
                        const isActive = s.slug === currentSlug
                        const href = s.slug === 'home' ? prefix : `${prefix}/${s.slug}`
                        return (
                            <a
                                key={s.slug}
                                href={href}
                                style={{
                                    color: isActive ? '#a78bfa' : '#fff',
                                    textDecoration: isActive ? 'none' : 'underline',
                                    textDecorationColor: 'rgba(255,255,255,0.3)',
                                    fontWeight: isActive ? 600 : 400,
                                }}
                            >
                                {s.title || s.slug}
                            </a>
                        )
                    })}
                </div>
            )}
            <SiteRenderer site={site as never} page={pageData as never} />
        </div>
    )
}
