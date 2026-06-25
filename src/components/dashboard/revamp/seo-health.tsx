'use client'

/**
 * SEO health — gauge + score-history placeholder + category breakdown + issues.
 * "AI Fix All" and per-issue "Fix" open the existing AIFixModal (real fixes).
 * Ports the design SeoHealth; wires real SeoData.
 */
import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Sparkles, Check, PartyPopper, LineChart, Clock, Wand2, ArrowUpRight } from 'lucide-react'
import { Gauge, MiniLinePlaceholder } from './charts'
import { SectionHead } from './atoms'
import { AIFixModal } from '@/components/dashboard/AIFixModal'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { SeoData, SeoIssue } from '@/lib/dashboard/dashboard-types'
import type { MissingSeoItem } from '@/components/dashboard/views/SEOView'

const fillClass = (pct: number) => (pct >= 80 ? 'fill-good' : pct >= 50 ? 'fill-warn' : 'fill-bad')

const PRODUCTS_HREF = '/products'
const ALT_FIX_TOOLTIP = 'Automatic AI alt-text editing is coming soon. For now, click to update image descriptions directly in your product manager.'

export function SeoHealth({ data }: { data: SeoData }) {
    // Items currently loaded into the fix modal (null = closed). Scoped per issue type.
    const [fixItems, setFixItems] = useState<MissingSeoItem[] | null>(null)

    // Items AI can fix for a given meta field (title / description)
    const itemsForField = (field: 'title' | 'description') =>
        data.missingSeoItems.filter(it => it.missingFields.includes(field))

    const canFixAll = Boolean(data.siteId) && data.missingSeoItems.length > 0
    const canFixField = (field: 'title' | 'description') => Boolean(data.siteId) && itemsForField(field).length > 0

    const openFixAll = () => setFixItems(data.missingSeoItems)
    const openFixField = (field: 'title' | 'description') => setFixItems(itemsForField(field))

    // Per-issue action: meta title/description → scoped "Fix"; alt-text → "Edit" link to products.
    const renderIssueAction = (it: SeoIssue) => {
        if (it.fixType === 'alt') {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link href={PRODUCTS_HREF} className="issue-fix"><ArrowUpRight aria-hidden />Edit</Link>
                    </TooltipTrigger>
                    <TooltipContent side="top">{ALT_FIX_TOOLTIP}</TooltipContent>
                </Tooltip>
            )
        }
        // Narrowed to 'title' | 'description'; capture in a const so the closure keeps the type.
        const field = it.fixType
        return (
            <button className="issue-fix" onClick={() => openFixField(field)} disabled={!canFixField(field)}><Wand2 aria-hidden />Fix</button>
        )
    }

    return (
        <div className="section">
            <SectionHead icon="search-check" title="SEO health" sub="How discoverable your store is on search engines" />
            <div className="card seo-card">
                <div className="seo-grid">
                    <Gauge score={data.score} />
                    <div className="seo-right">
                        <div className="seo-hist cs-wrap locked">
                            <div className="cs-content">
                                <div className="hist-head">
                                    <span className="lbl"><LineChart style={{ width: 14, height: 14 }} aria-hidden />SEO score history</span>
                                </div>
                                <MiniLinePlaceholder />
                            </div>
                            <div className="cs-corner" data-tip="We'll record your score weekly so you can track trends — coming soon.">
                                <span className="cs-badge"><Clock aria-hidden />Coming Soon</span>
                            </div>
                            <p className="hist-msg" style={{ position: 'relative', zIndex: 1 }}>In development — we'll log your score every week so you can watch it climb.</p>
                        </div>
                        <div className="progress-list">
                            {data.breakdown.map(b => (
                                <div className="pbar-row" key={b.name}>
                                    <span className="pname">{b.name}</span>
                                    <span className="pbar"><span className={fillClass(b.pct)} style={{ width: b.pct + '%' }} /></span>
                                    <span className="pval">{b.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {data.issues.length > 0 && data.topIssue && (
                    <div className="seo-footer">
                        <span className="warn-ic"><AlertTriangle aria-hidden /></span>
                        <span className="warn-txt">Most critical issue: <b>{data.topIssue.count} {data.topIssue.text}</b>. Fixing these will lift your score.</span>
                        <button className="btn btn-ai btn-sm" onClick={openFixAll} disabled={!canFixAll}><Sparkles aria-hidden />AI Fix All Issues</button>
                    </div>
                )}

                <div className="seo-issues">
                    <div className="sh-left" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
                        <h2 className="sh-title" style={{ fontSize: 15 }}>SEO issues</h2>
                        {data.issues.length > 0
                            ? <span className="cs-badge" style={{ background: 'var(--dr-danger-bg)', color: 'var(--dr-danger-fg)', borderColor: 'var(--dr-danger-bd)' }}>{data.issues.length} open</span>
                            : <span className="cs-badge" style={{ background: 'var(--dr-success-bg)', color: 'var(--dr-success-fg)', borderColor: 'var(--dr-success-bd)' }}><Check aria-hidden />All clear</span>}
                    </div>
                    {data.issues.length > 0 ? (
                        <div className="issues-list cols2">
                            {data.issues.map((it, i) => (
                                <div className="issue-row" key={i}>
                                    <span className={`issue-sev ${it.sev}`} />
                                    <span className="issue-txt"><span className="count">{it.count}</span> {it.text}</span>
                                    {renderIssueAction(it)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-block" style={{ padding: '44px 16px' }}>
                            <span className="eb-ic" style={{ background: 'var(--dr-success-bg)', color: 'var(--dr-success-fg)' }}><PartyPopper aria-hidden /></span>
                            <h5>All issues resolved</h5><p>No outstanding SEO issues — your store is fully optimised. We'll flag new ones here as they appear.</p>
                        </div>
                    )}
                </div>
            </div>

            <AIFixModal isOpen={fixItems !== null} onClose={() => setFixItems(null)} siteId={data.siteId} missingSeoItems={fixItems ?? []} />
        </div>
    )
}
