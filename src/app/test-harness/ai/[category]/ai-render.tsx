import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'
import { getCategoryContent } from '@/lib/ai/content'
import type { GenerationResult, GeneratedPage } from '@/lib/ai/generate-blocks'
import {
    buildSystemPrompt,
    buildUserPrompt,
    type BusinessInfoInput,
} from '@/lib/ai/system-prompt'
import { scoreFixture } from '../../../../../scripts/test-harness/rubric/scorer-lib'
import type { HarnessBlock } from '../../../../../scripts/test-harness/types'
import { ScoreOverlay } from '../../_components/score-overlay'

/** Cache shape v2 — wraps input+output so harness UI can show prompts that went in. */
type CacheEntry = {
    input: BusinessInfoInput
    output: GenerationResult
    cachedAt: string
}

const CACHE_DIR = path.resolve(process.cwd(), '.harness-out/ai-cache')

function cachePathFor(category: string): string {
    return path.join(CACHE_DIR, `${category}.json`)
}

/** Build BusinessInfoInput from category content — pure, deterministic per category. */
function buildInputForCategory(category: string): BusinessInfoInput | null {
    const content = getCategoryContent(category)
    const biz = content?.businesses?.[0]
    if (!biz) return null
    return {
        businessName: biz.name,
        industry: category,
        shortDescription: biz.description,
        products: biz.products?.join?.(', ') ?? '',
        phone: biz.phone,
        email: biz.email,
        address: biz.address,
    }
}

function readCache(category: string): CacheEntry | null {
    const p = cachePathFor(category)
    if (!fs.existsSync(p)) return null
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as CacheEntry | GenerationResult
        // v2 wrapped shape — has `input` + `output`
        if (parsed && typeof parsed === 'object' && 'output' in parsed && 'input' in parsed) {
            return parsed as CacheEntry
        }
        // v1 legacy — file is just the GenerationResult. Rehydrate input from category.
        const input = buildInputForCategory(category)
        if (!input) return null
        return { input, output: parsed as GenerationResult, cachedAt: 'legacy-cache' }
    } catch {
        return null
    }
}

function writeCache(category: string, entry: CacheEntry): void {
    try {
        fs.mkdirSync(CACHE_DIR, { recursive: true })
        fs.writeFileSync(cachePathFor(category), JSON.stringify(entry, null, 2))
    } catch (err) {
        console.warn('[ai-harness] cache write failed:', (err as Error).message)
    }
}

async function genForCategory(category: string): Promise<CacheEntry | null> {
    const input = buildInputForCategory(category)
    if (!input) return null

    const prevMode = process.env.GEN_MODE
    process.env.GEN_MODE = 'ai-first'
    try {
        const { result } = await generateSiteWithAI(input, undefined, 'en')
        return { input, output: result, cachedAt: new Date().toISOString() }
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

    let entry: CacheEntry | null = refresh ? null : readCache(category)
    let cachedFrom: 'disk' | 'fresh' = 'disk'

    if (!entry) {
        cachedFrom = 'fresh'
        try {
            entry = await genForCategory(category)
            if (!entry) notFound()
            writeCache(category, entry)
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

    const result = entry.output
    const page = resolvePage(result, slug)
    if (!page) {
        // Fallback: no pages → use flat blocks
        if (!slug || slug === 'home') {
            const blocks = result.blocks ?? []
            return renderLayout(entry, category, 'home', blocks as unknown as Record<string, unknown>[], cachedFrom, [])
        }
        notFound()
    }

    const layout = page.blocks as unknown as Record<string, unknown>[]
    const availableSlugs = (result.pages ?? []).map((p) => ({
        slug: normalizeSlug(p.slug),
        title: p.title,
    }))

    return renderLayout(entry, category, normalizeSlug(page.slug), layout, cachedFrom, availableSlugs)
}

function layoutToHarnessBlocks(layout: Record<string, unknown>[]): HarnessBlock[] {
    return layout.map((b) => {
        const { blockType, variant, ...rest } = b
        return {
            blockType: (blockType as string) ?? 'unknown',
            variant: variant as string | undefined,
            data: rest,
        }
    })
}

function renderLayout(
    entry: CacheEntry,
    category: string,
    currentSlug: string,
    layout: Record<string, unknown>[],
    cachedFrom: 'disk' | 'fresh',
    slugs: Array<{ slug: string; title: string }>,
) {
    const result = entry.output
    const site = { theme: result.theme as Record<string, unknown> }
    const pageData = { layout }
    const prefix = `/test-harness/ai/${category}`
    const slugsJson = JSON.stringify(slugs.map((s) => s.slug))

    // Score current AI-gen result on-demand — rubric applies same to AI output
    const currentBlocks = layoutToHarnessBlocks(layout)
    const allBlocks = result.pages
        ? result.pages.flatMap((p) => layoutToHarnessBlocks(p.blocks as unknown as Record<string, unknown>[]))
        : currentBlocks
    const score = scoreFixture({
        fixtureId: `ai-${category}-${currentSlug}`,
        category,
        blocks: currentBlocks,
        theme: result.theme as Record<string, unknown>,
        allBlocks,
    })

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
            <ScoreOverlay score={score} />
            <DebugDrawer entry={entry} category={category} />
            <SiteRenderer site={site as never} page={pageData as never} />
        </div>
    )
}

/** Collapsible floating drawer — shows business input, reconstructed prompts, and
 * AI output summary. Re-builds prompts deterministically from saved input via
 * buildSystemPrompt() + buildUserPrompt() — so what you see is what WOULD be sent
 * on a fresh gen with the same input. */
function DebugDrawer({ entry, category }: { entry: CacheEntry; category: string }) {
    const { input, output, cachedAt } = entry
    const systemPrompt = buildSystemPrompt('en')
    const userPrompt = buildUserPrompt(input, undefined, 'en')

    const outputSummary = {
        siteName: output.siteName,
        siteType: output.siteType,
        language: output.language,
        seo: output.seo,
        theme: output.theme,
        topLevelBlocks: output.blocks.length,
        pages: (output.pages ?? []).map((p) => ({
            slug: p.slug,
            title: p.title,
            blocks: p.blocks.length,
        })),
    }

    const panelStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: 60,
        right: 10,
        zIndex: 99,
        width: 480,
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: 'calc(100vh - 140px)',
        background: '#0f0f0f',
        color: '#e5e5e5',
        border: '1px solid #3f3f46',
        borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
        overflow: 'hidden',
    }
    const summaryStyle: React.CSSProperties = {
        padding: '10px 14px',
        cursor: 'pointer',
        userSelect: 'none',
        background: '#1a1a1a',
        color: '#a78bfa',
        fontWeight: 600,
        listStyle: 'none',
    }
    const bodyStyle: React.CSSProperties = {
        padding: 0,
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
    }
    const sectionStyle: React.CSSProperties = {
        borderTop: '1px solid #262626',
        padding: '10px 14px',
    }
    const labelStyle: React.CSSProperties = {
        color: '#71717a',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    }
    const preStyle: React.CSSProperties = {
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.45,
        color: '#d4d4d8',
    }

    return (
        <details style={panelStyle}>
            <summary style={summaryStyle}>
                🔍 Inspect Prompts + Output — {category}
            </summary>
            <div style={bodyStyle}>
                <div style={sectionStyle}>
                    <div style={labelStyle}>Business Input (BusinessInfoInput)</div>
                    <pre style={preStyle}>{JSON.stringify(input, null, 2)}</pre>
                    <div style={{ ...labelStyle, marginTop: 8, color: '#52525b' }}>
                        cachedAt: {cachedAt}
                    </div>
                </div>
                <div style={sectionStyle}>
                    <div style={labelStyle}>
                        System Prompt ({systemPrompt.length.toLocaleString()} chars — reconstructed)
                    </div>
                    <pre style={preStyle}>{systemPrompt}</pre>
                </div>
                <div style={sectionStyle}>
                    <div style={labelStyle}>
                        User Prompt ({userPrompt.length.toLocaleString()} chars — reconstructed)
                    </div>
                    <pre style={preStyle}>{userPrompt}</pre>
                </div>
                <div style={sectionStyle}>
                    <div style={labelStyle}>AI Output Summary</div>
                    <pre style={preStyle}>{JSON.stringify(outputSummary, null, 2)}</pre>
                </div>
                <div style={sectionStyle}>
                    <div style={labelStyle}>
                        Full Output JSON ({JSON.stringify(output).length.toLocaleString()} bytes)
                    </div>
                    <pre style={preStyle}>{JSON.stringify(output, null, 2)}</pre>
                </div>
            </div>
        </details>
    )
}
