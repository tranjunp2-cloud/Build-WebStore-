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
            <div className="p-10 font-mono">
                <h1 className="text-2xl font-bold mb-4">Harness matrix not found</h1>
                <p>Run <code className="bg-gray-100 px-2 py-1 rounded">npm run harness:gen</code> to generate fixtures.</p>
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

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">AI Gen Test Harness — Index</h1>
                <p className="text-gray-600">
                    {totalFixtures} fixtures · {blueprintCount} blueprint · {legacyCount} legacy ·{' '}
                    {categories.length} categories
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    Click any fixture to render. Images are SVG placeholders (media-injector disabled in harness).
                </p>
            </div>

            {/* AI-first section — real OpenAI gen per category */}
            <section className="border-2 border-purple-300 bg-purple-50 rounded-lg p-5 mb-8">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h2 className="text-xl font-semibold text-purple-900">
                            AI-First · Real OpenAI Gen
                        </h2>
                        <p className="text-sm text-purple-700 mt-1">
                            Calls GPT-4o with <code className="bg-purple-100 px-1">GEN_MODE=ai-first</code>.
                            First load: ~5-15s (AI call + cache). Refresh with <code className="bg-purple-100 px-1">?refresh=1</code> to regen.
                        </p>
                    </div>
                    <span className="text-xs font-mono bg-purple-600 text-white px-2 py-1 rounded">
                        COSTS $
                    </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {categories.map((cat) => (
                        <Link
                            key={`ai-${cat}`}
                            href={`/test-harness/ai/${cat}`}
                            className="block px-3 py-2 text-sm font-mono bg-white hover:bg-purple-100 border border-purple-200 hover:border-purple-400 rounded transition-colors text-center capitalize"
                        >
                            {cat}
                        </Link>
                    ))}
                </div>
            </section>

            {/* Template-first section — precomposed offline matrix */}
            <div className="mb-4 flex items-center gap-3">
                <h2 className="text-2xl font-semibold">Template-First</h2>
                <span className="text-xs font-mono bg-emerald-600 text-white px-2 py-1 rounded">
                    FREE · INSTANT
                </span>
                <span className="text-sm text-gray-500">— precomposed matrix.json, no AI calls</span>
            </div>

            <div className="space-y-8">
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
                        <section key={cat} className="border border-gray-200 rounded-lg p-5">
                            <h2 className="text-xl font-semibold mb-3 capitalize">
                                {cat}{' '}
                                <span className="text-sm font-normal text-gray-500">
                                    ({uniqueBlueprints.length} presets · {fixtures.length} fixtures)
                                </span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {uniqueBlueprints.map((f) => (
                                    <Link
                                        key={f.id}
                                        href={`/test-harness/${f.id}`}
                                        className="block px-3 py-2 text-sm font-mono bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-transparent rounded transition-colors truncate"
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
    )
}
