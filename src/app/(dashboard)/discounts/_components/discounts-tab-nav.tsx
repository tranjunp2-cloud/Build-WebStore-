'use client'

/**
 * DiscountsTabNav — segmented tab strip linking the two Discounts list views
 * (Discount Codes ↔ Usage History). After the F18 sidebar flatten (#1138), Discounts
 * is a single flat nav item, so Usage History is surfaced here as an in-page tab
 * instead of a sidebar sub-item. Route-based (Link + usePathname) so each tab is a
 * real navigable URL and active state survives reloads/deep links.
 *
 * Each tab shows its own total count (codes vs usage-history). The sidebar Discounts
 * badge reflects tab 1 (codes) only; the per-tab totals live here. Counts are fetched
 * once with limit=1 (we only read totalDocs), independent of the active tab.
 */

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Ticket, History } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'
import { Tabs, TabsList, TabsTrigger, TabsCount } from '@/components/ui/tabs'

const TABS = [
    { key: 'codes', href: '/discounts', icon: Ticket },
    { key: 'history', href: '/discounts/usage-history', icon: History },
] as const

const fmtCount = (n: number) => (n > 999 ? '999+' : String(n))

export function DiscountsTabNav() {
    const pathname = usePathname()
    const router = useRouter()
    const { t } = useI18n()
    const tabLabels = t.dashboard.discounts.tabs
    const [counts, setCounts] = useState<{ codes: number | null; history: number | null }>({
        codes: null,
        history: null,
    })

    // bumped when the assistant applies / undoes a change, so the counts are read again
    const [reloadTick, setReloadTick] = useState(0)
    useAgentChanges({ kinds: ['store_discount'] }, () => setReloadTick((n) => n + 1))

    useEffect(() => {
        let alive = true
        const readTotal = (url: string) =>
            fetch(url, { credentials: 'include' })
                .then((r) => (r.ok ? r.json() : null))
                .then((j) => (typeof j?.totalDocs === 'number' ? j.totalDocs : null))
                .catch(() => null)

        Promise.all([
            readTotal('/api/v1/discounts?limit=1'),
            readTotal('/api/v1/discounts/usage-history?limit=1'),
        ]).then(([codes, history]) => {
            if (alive) setCounts({ codes, history })
        })
        return () => {
            alive = false
        }
    }, [reloadTick])

    // Usage History owns its subtree; Codes is the exact /discounts root only
    // (so /discounts/new and /discounts/[id] don't light up either tab).
    const activeKey = pathname === '/discounts' ? 'codes' : pathname.startsWith('/discounts/usage-history') ? 'history' : ''

    return (
        <Tabs value={activeKey} onValueChange={(v) => router.push(TABS.find((tab) => tab.key === v)?.href ?? '/discounts')}>
            <TabsList variant="underline">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    const count = counts[tab.key]
                    return (
                        <TabsTrigger key={tab.key} variant="underline" value={tab.key}>
                            <Icon className="h-4 w-4" />
                            {tabLabels[tab.key]}
                            {count != null && <TabsCount>{fmtCount(count)}</TabsCount>}
                        </TabsTrigger>
                    )
                })}
            </TabsList>
        </Tabs>
    )
}
