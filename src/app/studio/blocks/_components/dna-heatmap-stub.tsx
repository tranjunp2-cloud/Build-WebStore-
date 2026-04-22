'use client'

/**
 * dna-heatmap-stub.tsx
 * Placeholder for Category DNA heatmap — real data arrives in Phase 08.
 * Renders an empty matrix with a clear "coming soon" message.
 */

const STUB_CATEGORIES = [
    'Restaurant', 'Beauty', 'Fitness', 'Medical', 'Real Estate',
    'Education', 'Retail', 'Travel', 'Tech', 'Creative',
]

export function DnaHeatmapStub({ blockSlug }: { blockSlug: string }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-6 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🧬</span>
                    <div>
                        <p className="text-sm font-semibold text-white/80">Category DNA Heatmap</p>
                        <p className="text-xs text-white/40">Arriving in Phase 08 — Category Intelligence</p>
                    </div>
                </div>

                {/* Stub matrix */}
                <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left text-white/30 font-normal pb-2 pr-4 whitespace-nowrap">
                                    Industry
                                </th>
                                <th className="text-center text-white/30 font-normal pb-2 px-2 whitespace-nowrap">
                                    Signature
                                </th>
                                <th className="text-center text-white/30 font-normal pb-2 px-2 whitespace-nowrap">
                                    Forbidden
                                </th>
                                <th className="text-center text-white/30 font-normal pb-2 px-2 whitespace-nowrap">
                                    Usage %
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {STUB_CATEGORIES.map((cat) => (
                                <tr key={cat} className="border-t border-white/5">
                                    <td className="py-1.5 pr-4 text-white/40 whitespace-nowrap">{cat}</td>
                                    <td className="py-1.5 px-2 text-center">
                                        <span className="inline-block w-3 h-3 rounded-sm bg-white/10" />
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                        <span className="inline-block w-3 h-3 rounded-sm bg-white/10" />
                                    </td>
                                    <td className="py-1.5 px-2 text-center text-white/20">—</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="text-xs text-white/30 italic">
                    Block: <code className="font-mono text-white/40">{blockSlug}</code> — data will populate
                    automatically once Phase 08 ships CATEGORY_DNA integration.
                </p>
            </div>
        </div>
    )
}
