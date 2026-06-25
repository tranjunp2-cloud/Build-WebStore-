'use client'

/**
 * Traffic & performance — daily/hourly bar chart + "Top performing" tabs.
 * Products tab is a disabled "Soon" (F10). Ports the design TrafficPerformance.
 */
import { useState } from 'react'
import { FileText, Newspaper, Share2, Package, BarChart3, List } from 'lucide-react'
import { BarChart } from './charts'
import { SectionHead } from './atoms'
import type { TrafficData, TopPerfRow } from '@/lib/dashboard/dashboard-types'

const fmtNum = (n: number) => new Intl.NumberFormat('en-MY').format(Math.round(n))

type TabId = 'pages' | 'blogs' | 'referrers' | 'products'
const TABS: { id: TabId; label: string; Icon: typeof FileText; soon?: boolean }[] = [
    { id: 'pages', label: 'Pages', Icon: FileText },
    { id: 'blogs', label: 'Blogs', Icon: Newspaper },
    { id: 'referrers', label: 'Referrers', Icon: Share2 },
    { id: 'products', label: 'Products', Icon: Package, soon: true },
]

export function TrafficPerformance({ data }: { data: TrafficData }) {
    const [tab, setTab] = useState<TabId>('pages')
    const list: TopPerfRow[] = tab === 'pages' ? data.top.pages : tab === 'blogs' ? data.top.blogs : tab === 'referrers' ? data.top.referrers : []

    return (
        <div className="section">
            <SectionHead icon="bar-chart-3" title="Traffic & performance" sub="Daily pageviews and what's driving them" />

            <div className="card chart-card" style={{ marginBottom: 'var(--dr-gap)' }}>
                <div className="chart-head">
                    <div className="chart-total">
                        <span className="big">{fmtNum(data.total)}</span>
                        <span className="lbl">total pageviews · {data.period}</span>
                    </div>
                </div>
                {data.hasData
                    ? <BarChart days={data.days} isHourly={data.isHourly} />
                    : <div className="empty-block"><span className="eb-ic"><BarChart3 aria-hidden /></span><h5>No traffic in this period</h5><p>Once visitors land on your site, daily pageviews will show up here.</p></div>}
            </div>

            <div className="card chart-card">
                <div className="chart-head" style={{ marginBottom: 14 }}>
                    <div className="sh-left">
                        <h2 className="sh-title" style={{ fontSize: 15 }}>Top performing</h2>
                    </div>
                    <div className="tp-tabs">
                        {TABS.map(({ id, label, Icon, soon }) => (
                            <button
                                key={id}
                                className={tab === id ? 'active' : ''}
                                disabled={soon}
                                onClick={() => !soon && setTab(id)}
                                title={soon ? 'Product analytics — coming soon' : undefined}
                            >
                                <Icon aria-hidden />{label}
                                {soon && <span className="cs-badge" style={{ marginLeft: 2, padding: '1px 6px', fontSize: 9 }}>Soon</span>}
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
                            <div className="empty-block"><span className="eb-ic"><List aria-hidden /></span><h5>Nothing to rank yet</h5><p>Top {tab} appear once you have traffic.</p></div>
                        )}
                    </div>
                ) : (
                    <div className="empty-block"><span className="eb-ic"><List aria-hidden /></span><h5>Nothing to rank yet</h5><p>Top pages, blogs and referrers appear once you have traffic.</p></div>
                )}
            </div>
        </div>
    )
}
