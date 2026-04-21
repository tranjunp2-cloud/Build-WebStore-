import fs from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import type { MatrixReport, HarnessResult, HarnessPage, HarnessBlock } from '../../../../scripts/test-harness/types'
import { scoreFixture } from '../../../../scripts/test-harness/rubric/scorer-lib'
import { ScoreOverlay } from '../_components/score-overlay'

export const dynamic = 'force-dynamic'

let cachedMatrix: MatrixReport | null = null
let cachedMtimeMs = 0

function loadMatrix(): MatrixReport | null {
    const matrixPath = path.resolve(process.cwd(), '.harness-out/matrix.json')
    if (!fs.existsSync(matrixPath)) return null
    const stat = fs.statSync(matrixPath)
    if (cachedMatrix && stat.mtimeMs === cachedMtimeMs) return cachedMatrix
    try {
        cachedMatrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as MatrixReport
        cachedMtimeMs = stat.mtimeMs
        return cachedMatrix
    } catch {
        return null
    }
}

function findResult(matrix: MatrixReport, fixtureId: string): HarnessResult | null {
    return matrix.results.find((r) => r.fixture.id === fixtureId) ?? null
}

function normalizeSlug(slug: string): string {
    return slug.toLowerCase().replace(/^\/+|\/+$/g, '') || 'home'
}

function resolvePage(result: HarnessResult, slug: string | undefined): HarnessPage | null {
    if (!result.pages || result.pages.length === 0) {
        // Fallback to legacy single-page matrix.
        if (!slug || slug === 'home') {
            return { title: 'Home', slug: 'home', blocks: result.blocks }
        }
        return null
    }
    const target = normalizeSlug(slug ?? '')
    if (target === 'home') {
        return (
            result.pages.find((p) => /home/i.test(p.slug) || /home/i.test(p.title)) ??
            result.pages[0] ??
            null
        )
    }
    return (
        result.pages.find((p) => normalizeSlug(p.slug) === target) ??
        null
    )
}

function flattenBlocks(blocks: HarnessBlock[]): Record<string, unknown>[] {
    return blocks.map((b) => ({ ...b.data, blockType: b.blockType, variant: b.variant }))
}

export async function renderHarnessFixture(fixtureId: string, pageSlug?: string) {
    const matrix = loadMatrix()
    if (!matrix) {
        return (
            <div style={{ padding: 40, fontFamily: 'monospace' }}>
                <h1>harness matrix not found</h1>
                <p>Run <code>npm run harness:gen</code> to generate <code>.harness-out/matrix.json</code>.</p>
            </div>
        )
    }
    const result = findResult(matrix, fixtureId)
    if (!result) notFound()
    if (result.composerError) {
        return (
            <div style={{ padding: 40, fontFamily: 'monospace', color: '#b91c1c' }}>
                <h1>composer error for {fixtureId}</h1>
                <pre>{result.composerError}</pre>
            </div>
        )
    }

    const page = resolvePage(result, pageSlug)
    if (!page) notFound()

    const layout = flattenBlocks(page.blocks)
    const availableSlugs = (result.pages ?? []).map((p) => normalizeSlug(p.slug))

    const site = { theme: result.theme as Record<string, unknown> }
    const pageData = { layout }

    const prefix = `/test-harness/${fixtureId}`
    const slugsJson = JSON.stringify(availableSlugs)

    // Score current fixture on-demand — always fresh
    const allBlocks = result.pages ? result.pages.flatMap((p) => p.blocks) : result.blocks
    const score = scoreFixture({
        fixtureId,
        category: result.fixture.category,
        blocks: result.blocks,
        theme: result.theme,
        allBlocks,
    })

    return (
        <div data-harness-fixture={fixtureId} data-harness-page={normalizeSlug(page.slug)}>
            {/* Rewrite <a href> clicks within harness — map sub-page links to
                harness paths; block escape links to CMS routes. */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `(function(){var prefix=${JSON.stringify(prefix)};var slugs=${slugsJson};document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!h||h.startsWith('#')||h.startsWith('http')||h.startsWith(prefix))return;e.preventDefault();var raw=h.replace(/^\\/+|\\/+$/g,'').toLowerCase();var target=slugs.indexOf(raw)>=0?raw:(slugs.indexOf('home')>=0&&(raw===''||raw==='/')?'home':null);if(target){window.location.href=prefix+(target==='home'?'':'/'+target);}else{console.warn('[harness] no matching page for '+h+' (available: '+slugs.join(',')+')');}},true);})();`,
                }}
            />
            {/* Page nav badge — hiện page list + active */}
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
                {(result.pages ?? [{ title: 'Home', slug: 'home', blocks: [] }]).map((p) => {
                    const slug = normalizeSlug(p.slug)
                    const isActive = slug === normalizeSlug(page.slug)
                    const href = slug === 'home' ? prefix : `${prefix}/${slug}`
                    return (
                        <a
                            key={slug}
                            href={href}
                            style={{
                                color: isActive ? '#a78bfa' : '#fff',
                                textDecoration: isActive ? 'none' : 'underline',
                                textDecorationColor: 'rgba(255,255,255,0.3)',
                                fontWeight: isActive ? 600 : 400,
                            }}
                        >
                            {p.title || slug}
                        </a>
                    )
                })}
            </div>
            <ScoreOverlay score={score} />
            <SiteRenderer site={site as never} page={pageData as never} />
        </div>
    )
}
