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
 * with limit=1 (we only read totalDocs), independent of the active tab, and cached.
 */

import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Ticket, History } from 'lucide-react'
import { useI18n } from '@/i18n'
import { queryKeys } from '@/hooks/queries/query-keys'
import { useQueryScope } from '@/providers/query-provider'
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
    // Read once per workspace and cached (both tabs share it); a discount change from this screen
    // invalidates it with the rest of the discounts data.
    const scope = useQueryScope()
    const countsQuery = useQuery({
        queryKey: queryKeys.discounts.counts(scope),
        queryFn: async ({ signal }) => {
            const readTotal = (url: string) =>
                fetch(url, { credentials: 'include', signal })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((j) => (typeof j?.totalDocs === 'number' ? (j.totalDocs as number) : null))
                    .catch(() => null)
            const [codes, history] = await Promise.all([
                readTotal('/api/v1/discounts?limit=1'),
                readTotal('/api/v1/discounts/usage-history?limit=1'),
            ])
            return { codes, history }
        },
    })
    const counts = countsQuery.data ?? { codes: null, history: null }

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
