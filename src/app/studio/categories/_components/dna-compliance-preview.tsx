'use client'
/**
 * DnaCompliancePreview — pick a template and see DNA compliance results.
 * Fetches templates for the category, runs client-side compliance check.
 */
import { useState, useEffect } from 'react'
import { checkCompliance, type CategoryDNA, type ComplianceResult } from '@/lib/admin/dna-compliance'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type TemplateSummary = {
    id: string
    name: string
    status: string
    personality?: string | null
    templatePages?: Array<{ layout?: unknown }> | null
    defaultBlocks?: unknown
}

type Props = {
    categoryId: string
    dna: CategoryDNA | null
}

function ViolationRow({ type, message, severity }: { type: string; message: string; severity: string }) {
    return (
        <li className="flex items-start gap-2 text-sm py-1.5 border-b last:border-0">
            <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${severity === 'error' ? 'bg-destructive' : 'bg-amber-400'}`} />
            <div>
                <span className="text-xs font-mono text-muted-foreground mr-2">{type}</span>
                {message}
            </div>
        </li>
    )
}

function ScoreBadge({ score, pass }: { score: number; pass: boolean }) {
    const color = pass ? 'bg-green-100 text-green-800' : score >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
            {pass ? '✓ Pass' : '✗ Fail'} — {score}/100
        </span>
    )
}

export function DnaCompliancePreview({ categoryId, dna }: Props) {
    const [templates, setTemplates] = useState<TemplateSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<TemplateSummary | null>(null)
    const [result, setResult] = useState<ComplianceResult | null>(null)

    useEffect(() => {
        setLoading(true)
        fetch(`/api/admin/templates?limit=100&status=all`)
            .then(r => r.json())
            .then(d => {
                const docs: TemplateSummary[] = (d.data ?? d.docs ?? []).map((t: Record<string, unknown>) => ({
                    id: String(t.id),
                    name: String(t.name ?? ''),
                    status: String(t.status ?? ''),
                    personality: (t.personality as string) ?? null,
                    templatePages: (t.templatePages as TemplateSummary['templatePages']) ?? null,
                    defaultBlocks: t.defaultBlocks ?? null,
                }))
                setTemplates(docs)
            })
            .catch(() => setTemplates([]))
            .finally(() => setLoading(false))
    }, [])

    const handleSelect = (tpl: TemplateSummary) => {
        setSelected(tpl)
        if (dna) {
            setResult(checkCompliance(tpl, dna as unknown as Record<string, unknown>))
        }
    }

    if (!dna) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Save the DNA configuration first, then preview compliance here.
            </div>
        )
    }

    return (
        <div className="p-6 space-y-4 max-w-2xl">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Select a template to check</label>
                {loading ? (
                    <div className="space-y-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-8 w-full" />
                        ))}
                    </div>
                ) : (
                    <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={selected?.id ?? ''}
                        onChange={e => {
                            const tpl = templates.find(t => t.id === e.target.value)
                            if (tpl) handleSelect(tpl)
                        }}
                    >
                        <option value="">— Select a template —</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.status})
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {result && selected && (
                <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{selected.name}</span>
                        <ScoreBadge score={result.score} pass={result.pass} />
                    </div>

                    {result.violations.length === 0 ? (
                        <p className="text-sm text-green-700">No violations — template fully complies with DNA.</p>
                    ) : (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                {result.violations.length} violation{result.violations.length !== 1 ? 's' : ''}
                            </p>
                            <ul className="divide-y rounded border px-3">
                                {result.violations.map((v, i) => (
                                    <ViolationRow key={i} {...v} />
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Checked at {new Date(result.checkedAt).toLocaleTimeString()}
                    </p>
                </div>
            )}
        </div>
    )
}
