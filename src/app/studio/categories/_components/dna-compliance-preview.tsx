'use client'
/**
 * DnaCompliancePreview — pick a template and see DNA compliance results.
 * Fetches templates for the category, runs client-side compliance check.
 * Restyled to bundle .comp-* classes.
 */
import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { checkCompliance, type CategoryDNA, type ComplianceResult } from '@/lib/admin/dna-compliance'

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

function scoreBadgeClass(score: number, pass: boolean): string {
    if (pass) return 'comp-score-badge comp-score-pass'
    if (score >= 60) return 'comp-score-badge comp-score-warn'
    return 'comp-score-badge comp-score-fail'
}

export function DnaCompliancePreview({ categoryId, dna }: Props) {
    const [templates, setTemplates] = useState<TemplateSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<TemplateSummary | null>(null)
    const [result, setResult] = useState<ComplianceResult | null>(null)

    // categoryId unused in fetch (fetches all, filters client-side if needed)
    void categoryId

    useEffect(() => {
        setLoading(true)
        fetch('/api/admin/templates?limit=100&status=all')
            .then((r) => r.json())
            .then((d) => {
                const docs: TemplateSummary[] = (d.data ?? d.docs ?? []).map(
                    (t: Record<string, unknown>) => ({
                        id: String(t.id),
                        name: String(t.name ?? ''),
                        status: String(t.status ?? ''),
                        personality: (t.personality as string) ?? null,
                        templatePages: (t.templatePages as TemplateSummary['templatePages']) ?? null,
                        defaultBlocks: t.defaultBlocks ?? null,
                    })
                )
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
            <div className="comp-empty">
                Save the DNA configuration first, then preview compliance here.
            </div>
        )
    }

    return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Template selector */}
            <div className="comp-select-wrap">
                <label className="dna-form-label">Select a template to check</label>
                {loading ? (
                    <div style={{ height: 36, background: 'var(--bg-sunk)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                ) : (
                    <select
                        className="comp-select"
                        value={selected?.id ?? ''}
                        onChange={(e) => {
                            const tpl = templates.find((t) => t.id === e.target.value)
                            if (tpl) handleSelect(tpl)
                        }}
                    >
                        <option value="">— Select a template —</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.status})
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Result card */}
            {result && selected && (
                <div className="comp-result-card">
                    <div className="comp-result-head">
                        <span className="comp-result-name">{selected.name}</span>
                        <span
                            className={scoreBadgeClass(result.score, result.pass)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                            {result.pass
                                ? <Check className="h-3.5 w-3.5" aria-hidden />
                                : <X className="h-3.5 w-3.5" aria-hidden />}
                            {result.pass ? 'Pass' : 'Fail'} — {result.score}/100
                        </span>
                    </div>

                    {result.violations.length === 0 ? (
                        <div className="comp-pass-msg">
                            No violations — template fully complies with DNA.
                        </div>
                    ) : (
                        <>
                            <div className="comp-violations-label">
                                {result.violations.length} violation{result.violations.length !== 1 ? 's' : ''}
                            </div>
                            <ul className="comp-violations-list">
                                {result.violations.map((v, i) => (
                                    <li key={i} className="comp-violation-row">
                                        <span className={`comp-violation-dot ${v.severity}`} />
                                        <div>
                                            <span className="comp-violation-type">{v.type}</span>
                                            {v.message}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <div className="comp-checked-at">
                        Checked at {new Date(result.checkedAt).toLocaleTimeString()}
                    </div>
                </div>
            )}
        </div>
    )
}
