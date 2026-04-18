import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import type { MatrixReport } from '../../../scripts/test-harness/types'

export const dynamic = 'force-dynamic'

function loadMatrix(): MatrixReport | null {
    const matrixPath = path.resolve(process.cwd(), '.harness-out/matrix.json')
    if (!fs.existsSync(matrixPath)) return null
    try {
        return JSON.parse(fs.readFileSync(matrixPath, 'utf8')) as MatrixReport
    } catch {
        return null
    }
}

export default function HarnessIndex() {
    const matrix = loadMatrix()
    if (!matrix) {
        return (
            <div style={{ background: '#fff', color: '#111', minHeight: '100vh' }} className="p-10 font-mono">
                <h1 className="text-2xl font-bold mb-4">Harness matrix not found</h1>
                <p>Run <code style={{ background: '#f3f4f6' }} className="px-2 py-1 rounded">npm run harness:gen</code> to generate fixtures.</p>
            </div>
        )
    }

    const byCategory: Record<string, Array<{ id: string; source: string; variant: string }>> = {}
    for (const result of matrix.results) {
        const { fixture } = result
        const cat = fixture.category
        if (!byCategory[cat]) byCategory[cat] = []
        byCategory[cat].push({ id: fixture.id, source: fixture.source, variant: fixture.variant })
    }

    const categories = Object.keys(byCategory).sort()
    const totalFixtures = matrix.results.length
    const blueprintCount = matrix.results.filter((r) => r.fixture.source === 'blueprint').length
    const legacyCount = totalFixtures - blueprintCount

    // Inline styles — force light theme trên index page để không bị ảnh hưởng
    // bởi dark theme của các block/template fixture render ở route con.
    const pageStyle: React.CSSProperties = {
        background: '#fff',
        color: '#111',
        minHeight: '100vh',
    }
    const cardStyle: React.CSSProperties = {
        background: '#fff',
        border: '1px solid #e5e7eb',
        color: '#111',
    }
    const aiButtonStyle: React.CSSProperties = {
        background: '#fff',
        color: '#4c1d95',
        border: '1px solid #c4b5fd',
    }
    const tplButtonStyle: React.CSSProperties = {
        background: '#f9fafb',
        color: '#111',
        border: '1px solid transparent',
    }

    return (
        <div style={pageStyle}>
            <div className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2" style={{ color: '#111' }}>AI Gen Test Harness — Index</h1>
                    <p style={{ color: '#4b5563' }}>
                        {totalFixtures} fixtures · {blueprintCount} blueprint · {legacyCount} legacy · {categories.length} categories
                    </p>
                    <p className="text-sm mt-2" style={{ color: '#6b7280' }}>
                        Click any fixture to render. Images are SVG placeholders (media-injector disabled in harness).
                    </p>
                </div>

                {/* AI-first section */}
                <section
                    className="rounded-lg p-5 mb-8"
                    style={{ background: '#faf5ff', border: '2px solid #d8b4fe' }}
                >
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h2 className="text-xl font-semibold" style={{ color: '#581c87' }}>
                                AI-First · Real OpenAI Gen
                            </h2>
                            <p className="text-sm mt-1" style={{ color: '#6b21a8' }}>
                                Calls GPT-4o với <code style={{ background: '#ede9fe', padding: '0 4px' }}>GEN_MODE=ai-first</code>.
                                First load: ~5-15s (AI call + cache). Refresh với <code style={{ background: '#ede9fe', padding: '0 4px' }}>?refresh=1</code> to regen.
                            </p>
                        </div>
                        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#7c3aed', color: '#fff' }}>
                            COSTS $
                        </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {categories.map((cat) => (
                            <Link
                                key={`ai-${cat}`}
                                href={`/test-harness/ai/${cat}`}
                                className="block px-3 py-2 text-sm font-mono rounded transition-colors text-center capitalize"
                                style={aiButtonStyle}
                            >
                                {cat}
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Template-first section */}
                <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-2xl font-semibold" style={{ color: '#111' }}>Template-First</h2>
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#059669', color: '#fff' }}>
                        FREE · INSTANT
                    </span>
                    <span className="text-sm" style={{ color: '#6b7280' }}>— precomposed matrix.json, no AI calls</span>
                </div>

                <div className="space-y-6">
                    {categories.map((cat) => {
                        const fixtures = byCategory[cat]!
                        const blueprints = fixtures.filter((f) => f.source === 'blueprint')
                        const seen = new Set<string>()
                        const uniqueBlueprints = blueprints.filter((f) => {
                            const base = f.id.replace(/-seed\d+$/, '')
                            if (seen.has(base)) return false
                            seen.add(base)
                            return true
                        })

                        return (
                            <section key={cat} className="rounded-lg p-5" style={cardStyle}>
                                <h2 className="text-xl font-semibold mb-3 capitalize" style={{ color: '#111' }}>
                                    {cat}{' '}
                                    <span className="text-sm font-normal" style={{ color: '#6b7280' }}>
                                        ({uniqueBlueprints.length} presets · {fixtures.length} fixtures)
                                    </span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {uniqueBlueprints.map((f) => (
                                        <Link
                                            key={f.id}
                                            href={`/test-harness/${f.id}`}
                                            className="block px-3 py-2 text-sm font-mono rounded transition-colors truncate"
                                            style={tplButtonStyle}
                                            title={f.id}
                                        >
                                            {f.id.replace(`${cat}-blueprint-`, '').replace(/-seed\d+$/, '')}
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
