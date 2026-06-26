'use client'

/**
 * SEO health — gauge + score-history placeholder + category breakdown + issues.
 * "AI Fix All" and per-issue "Fix" open the existing AIFixModal (real fixes).
 * All text driven by t.dashboard.revamp.seo.*; gauge label via gaugeStatusKey helper.
 */
import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Sparkles, Check, PartyPopper, LineChart, Clock, Wand2, ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Gauge, MiniLinePlaceholder, gaugeStatusKey } from './charts'
import { SectionHead } from './atoms'
import { AIFixModal } from '@/components/dashboard/AIFixModal'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { SeoData, SeoIssue } from '@/lib/dashboard/dashboard-types'
import type { MissingSeoItem } from '@/components/dashboard/views/SEOView'

const fillClass = (pct: number) => (pct >= 80 ? 'fill-good' : pct >= 50 ? 'fill-warn' : 'fill-bad')

const PRODUCTS_HREF = '/products'

/** Maps fixType to the correct i18n plural-key object under t.dashboard.revamp.seo. */
function issueLabelKeys(
    fixType: 'title' | 'description' | 'alt',
    seoT: { issueAlt: { one: string; other: string }; issueDescription: { one: string; other: string }; issueTitle: { one: string; other: string } }
): { one: string; other: string } {
    if (fixType === 'alt') return seoT.issueAlt
    if (fixType === 'description') return seoT.issueDescription
    return seoT.issueTitle
}

const BREAKDOWN_KEY_MAP: Record<'meta' | 'content' | 'technical', 'breakdownMeta' | 'breakdownContent' | 'breakdownTechnical'> = {
    meta: 'breakdownMeta',
    content: 'breakdownContent',
    technical: 'breakdownTechnical',
}

export function SeoHealth({ data }: { data: SeoData }) {
    const { t, ti, tp } = useI18n()
    const seoT = t.dashboard.revamp.seo
    const comingSoon = t.dashboard.revamp.comingSoon

    const [fixItems, setFixItems] = useState<MissingSeoItem[] | null>(null)

    const itemsForField = (field: 'title' | 'description') =>
        data.missingSeoItems.filter(it => it.missingFields.includes(field))

    const canFixAll = Boolean(data.siteId) && data.missingSeoItems.length > 0
    const canFixField = (field: 'title' | 'description') => Boolean(data.siteId) && itemsForField(field).length > 0

    const openFixAll = () => setFixItems(data.missingSeoItems)
    const openFixField = (field: 'title' | 'description') => setFixItems(itemsForField(field))

    const renderIssueAction = (it: SeoIssue) => {
        if (it.fixType === 'alt') {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link href={PRODUCTS_HREF} className="issue-fix"><ArrowUpRight aria-hidden />{seoT.edit}</Link>
                    </TooltipTrigger>
                    <TooltipContent side="top">{seoT.altEditTip}</TooltipContent>
                </Tooltip>
            )
        }
        const field = it.fixType
        return (
            <button className="issue-fix" onClick={() => openFixField(field)} disabled={!canFixField(field)}>
                <Wand2 aria-hidden />{seoT.fix}
            </button>
        )
    }

    return (
        <div className="section">
            <SectionHead icon="search-check" title={seoT.title} sub={seoT.subtitle} />
            <div className="card seo-card">
                <div className="seo-grid">
                    <Gauge score={data.score} label={seoT[gaugeStatusKey(data.score)]} />
                    <div className="seo-right">
                        <div className="seo-hist cs-wrap locked">
                            <div className="cs-content">
                                <div className="hist-head">
                                    <span className="lbl">
                                        <LineChart style={{ width: 14, height: 14 }} aria-hidden />
                                        {seoT.scoreHistory}
                                    </span>
                                </div>
                                <MiniLinePlaceholder />
                            </div>
                            <div className="cs-corner" data-tip={seoT.scoreHistoryTip}>
                                <span className="cs-badge"><Clock aria-hidden />{comingSoon}</span>
                            </div>
                            <p className="hist-msg" style={{ position: 'relative', zIndex: 1 }}>{seoT.scoreHistoryMsg}</p>
                        </div>
                        <div className="progress-list">
                            {data.breakdown.map(b => (
                                <div className="pbar-row" key={b.key}>
                                    <span className="pname">{seoT[BREAKDOWN_KEY_MAP[b.key]]}</span>
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
                        <span className="warn-txt">
                            {ti(seoT.criticalIssue, {
                                count: data.topIssue.count,
                                text: tp(issueLabelKeys(data.topIssue.fixType, seoT), data.topIssue.count),
                            })}
                        </span>
                        <button className="btn btn-ai btn-sm" onClick={openFixAll} disabled={!canFixAll}>
                            <Sparkles aria-hidden />{seoT.fixAll}
                        </button>
                    </div>
                )}

                <div className="seo-issues">
                    <div className="sh-left" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
                        <h2 className="sh-title" style={{ fontSize: 15 }}>{seoT.issuesTitle}</h2>
                        {data.issues.length > 0
                            ? <span className="cs-badge" style={{ background: 'var(--dr-danger-bg)', color: 'var(--dr-danger-fg)', borderColor: 'var(--dr-danger-bd)' }}>
                                {ti(seoT.open, { count: data.issues.length })}
                              </span>
                            : <span className="cs-badge" style={{ background: 'var(--dr-success-bg)', color: 'var(--dr-success-fg)', borderColor: 'var(--dr-success-bd)' }}>
                                <Check aria-hidden />{seoT.allClear}
                              </span>}
                    </div>
                    {data.issues.length > 0 ? (
                        <div className="issues-list cols2">
                            {data.issues.map((it, i) => (
                                <div className="issue-row" key={i}>
                                    <span className={`issue-sev ${it.sev}`} />
                                    <span className="issue-txt">
                                        <span className="count">{it.count}</span>{' '}
                                        {tp(issueLabelKeys(it.fixType, seoT), it.count)}
                                    </span>
                                    {renderIssueAction(it)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-block" style={{ padding: '44px 16px' }}>
                            <span className="eb-ic" style={{ background: 'var(--dr-success-bg)', color: 'var(--dr-success-fg)' }}>
                                <PartyPopper aria-hidden />
                            </span>
                            <h5>{seoT.allResolvedTitle}</h5>
                            <p>{seoT.allResolvedDesc}</p>
                        </div>
                    )}
                </div>
            </div>

            <AIFixModal isOpen={fixItems !== null} onClose={() => setFixItems(null)} siteId={data.siteId} missingSeoItems={fixItems ?? []} />
        </div>
    )
}
