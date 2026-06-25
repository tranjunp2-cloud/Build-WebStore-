'use client'

import { FileText, Package, PenLine } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export type PerformingItem = {
    id: string
    name: string
    url?: string
    value: number
}

type Props = {
    pages: PerformingItem[]
    // TODO: Require products when F10 is ready and uncomment
    products?: PerformingItem[]
    blogs: PerformingItem[]
    referrers?: PerformingItem[]
}

// Underline tab trigger — identical to Team & Account / Discounts (shared <Tabs>).
const TRIGGER_CLASS =
    'dash-tab-trigger flex items-center gap-2 px-4 pb-2.5 rounded-none text-sm font-medium transition-colors -mb-px cursor-pointer ' +
    'data-[state=active]:bg-transparent data-[state=active]:shadow-none ' +
    'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] data-[state=active]:text-[var(--dash-text)]'

function getRankClass(index: number) {
    switch (index) {
        case 0: return 'bg-amber-500/15 text-amber-500'  // r1
        case 1: return 'bg-blue-500/15 text-blue-500'    // r2
        case 2: return 'bg-emerald-500/15 text-emerald-500' // r3
        default: return 'bg-dash-secondary-bg text-dash-text-muted' // r4, r5
    }
}

function RankedList({ items, viewsLabel, noDataLabel }: { items: PerformingItem[]; viewsLabel: string; noDataLabel: string }) {
    const total = items.reduce((acc, curr) => acc + curr.value, 0)

    if (items.length === 0) {
        return <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))] italic">{noDataLabel}</div>
    }

    return (
        <div className="flex flex-col">
            {items.map((item, index) => {
                const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0
                return (
                    <div key={item.id || index} className="flex items-center py-2.5">
                        <div className={`min-w-[28px] h-[28px] rounded-full flex items-center justify-center text-[12px] font-bold mr-3 ${getRankClass(index)}`}>
                            {index + 1}
                        </div>
                        <div className="flex-1 text-[13px] font-medium text-dash-text truncate pr-4">{item.name}</div>
                        <div className="text-[13px] font-semibold text-dash-text mr-2 whitespace-nowrap">
                            {item.value.toLocaleString()} {viewsLabel}
                        </div>
                        <div className="text-[12px] text-dash-text-muted w-12 text-right">({percentage}%)</div>
                    </div>
                )
            })}
        </div>
    )
}

export function TopPerformingList({ pages, products, blogs }: Props) {
    const { t } = useI18n()
    const viewsLabel = t.dashboard.analytics.views.toLowerCase()
    const noDataLabel = t.dashboard.analytics.noData

    const TABS = [
        { id: 'pages', icon: FileText, name: t.dashboard.analytics.topPages, data: pages },
        // TODO: Re-enable unconditionally when F10 is ready
        ...(products ? [{ id: 'products', icon: Package, name: t.dashboard.analytics.topProducts, data: products }] : []),
        { id: 'blogs', icon: PenLine, name: t.dashboard.analytics.topBlogs, data: blogs },
    ]

    return (
        <div className="bg-dash-surface border border-dash-border rounded-xl p-6 shadow-sm">
            <Tabs defaultValue="pages" className="flex flex-col gap-4">
                <TabsList
                    className="flex w-full justify-start h-auto gap-0 rounded-none border-0 bg-transparent p-0"
                    style={{ borderBottom: '1px solid var(--dash-divider)' }}
                >
                    {TABS.map((tab) => (
                        <TabsTrigger key={tab.id} value={tab.id} className={TRIGGER_CLASS}>
                            <tab.icon className="w-4 h-4 shrink-0" aria-hidden />
                            {tab.name}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {TABS.map((tab) => (
                    <TabsContent key={tab.id} value={tab.id} className="mt-0">
                        <RankedList items={tab.data} viewsLabel={viewsLabel} noDataLabel={noDataLabel} />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
