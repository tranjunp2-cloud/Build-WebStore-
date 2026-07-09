'use client'

/**
 * Traffic & performance — daily/hourly bar chart + "Top performing" tabs.
 * Products tab is a disabled "Soon". Ports the design TrafficPerformance.
 * All labels driven by t.dashboard.revamp.traffic.*; period prop maps to periodToday/7d/30d.
 */
import { useState } from 'react'
import { FileText, Newspaper, Share2, Package, BarChart3, List } from 'lucide-react'
import { useI18n } from '@/i18n'
import { BarChart } from './charts'
import { SectionHead } from './atoms'
import type { DashboardPeriodKey, TrafficData, TopPerfRow } from '@/lib/dashboard/dashboard-types'

const fmtNum = (n: number) => new Intl.NumberFormat('en-MY').format(Math.round(n))

type TabId = 'pages' | 'blogs' | 'referrers' | 'products'

export function TrafficPerformance({ data, period }: { data: TrafficData; period: DashboardPeriodKey }) {
    const { t, ti } = useI18n()
    const r = t.dashboard.revamp.traffic
    const soon = t.dashboard.revamp.soon

    const TABS: { id: TabId; label: string; Icon: typeof FileText; soon?: boolean }[] = [
        { id: 'pages', label: r.tabs.pages, Icon: FileText },
        { id: 'blogs', label: r.tabs.blogs, Icon: Newspaper },
        { id: 'referrers', label: r.tabs.referrers, Icon: Share2 },
        { id: 'products', label: r.tabs.products, Icon: Package, soon: true },
    ]

    const periodLabel = period === 'today' ? r.periodToday : period === '30d' ? r.period30d : r.period7d

    const [tab, setTab] = useState<TabId>('pages')
    const list: TopPerfRow[] = tab === 'pages' ? data.top.pages : tab === 'blogs' ? data.top.blogs : tab === 'referrers' ? data.top.referrers : []

    return (
        <div className="section">
            <SectionHead icon="bar-chart-3" title={r.title} sub={r.subtitle} />

            <div className="card chart-card" style={{ marginBottom: 'var(--dr-gap)' }}>
                <div className="chart-head">
                    <div className="chart-total">
                        <span className="big">{fmtNum(data.total)}</span>
                        <span className="lbl">{ti(r.totalPageviews, { period: periodLabel })}</span>
                    </div>
                </div>
                {data.hasData
                    ? <BarChart days={data.days} isHourly={data.isHourly} />
                    : <div className="empty-block"><span className="eb-ic"><BarChart3 aria-hidden /></span><h5>{r.emptyChartTitle}</h5><p>{r.emptyChartDesc}</p></div>}
            </div>

            <div className="card chart-card">
                <div className="chart-head" style={{ marginBottom: 14 }}>
                    <div className="sh-left">
                        <h2 className="sh-title">{r.topPerforming}</h2>
                    </div>
                    <div className="tp-tabs">
                        {TABS.map(({ id, label, Icon, soon: isSoon }) => (
                            <button
                                key={id}
                                className={tab === id ? 'active' : ''}
                                disabled={isSoon}
                                onClick={() => !isSoon && setTab(id)}
                                title={isSoon ? r.productsSoonTip : undefined}
                            >
                                <Icon aria-hidden />{label}
                                {isSoon && <span className="cs-badge" style={{ marginLeft: 2, padding: '1px 6px', fontSize: 9 }}>{soon}</span>}
                            </button>
                        ))}
                    </div>
                </div>
                {data.hasData ? (
                    <div className="tp-list">
                        {list.map((row, i) => (
                            <div className="tp-row" key={`${row.path}-${i}`}>
                                <span className={`tp-rank ${i < 3 ? 'top' + (i + 1) : ''}`}>{i + 1}</span>
                                <span className="tp-name">{row.name} <span className="tp-path">{row.path}</span></span>
                                <span className="tp-views">{fmtNum(row.views)}</span>
                                <span className="tp-share">
                                    <span className="bar"><span style={{ width: Math.min(row.share * 2.4, 100) + '%' }} /></span>
                                    <span className="pct">{row.share}%</span>
                                </span>
                            </div>
                        ))}
                        {list.length === 0 && (
                            <div className="empty-block"><span className="eb-ic"><List aria-hidden /></span><h5>{r.emptyListTitle}</h5><p>{r.emptyListDesc}</p></div>
                        )}
                    </div>
                ) : (
                    <div className="empty-block"><span className="eb-ic"><List aria-hidden /></span><h5>{r.emptyListTitle}</h5><p>{r.emptyListDesc}</p></div>
                )}
            </div>
        </div>
    )
}
