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

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Ticket, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

const TABS = [
    { key: 'codes', href: '/discounts', icon: Ticket },
    { key: 'history', href: '/discounts/usage-history', icon: History },
] as const

const fmtCount = (n: number) => (n > 999 ? '999+' : String(n))

export function DiscountsTabNav() {
    const pathname = usePathname()
    const { t } = useI18n()
    const tabLabels = t.dashboard.discounts.tabs
    const [counts, setCounts] = useState<{ codes: number | null; history: number | null }>({
        codes: null,
        history: null,
    })

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
    }, [])

    return (
        <div className="flex w-full gap-0" style={{ borderBottom: '1px solid var(--dash-divider)' }}>
            {TABS.map((tab) => {
                // Usage History owns its subtree; Codes is the exact /discounts root only
                // (so /discounts/new and /discounts/[id] don't light up either tab).
                const isActive =
                    tab.href === '/discounts'
                        ? pathname === '/discounts'
                        : pathname.startsWith('/discounts/usage-history')
                const Icon = tab.icon
                const count = counts[tab.key]

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'no-underline flex items-center gap-2 px-4 pb-2.5 text-sm font-medium transition-colors -mb-px',
                            isActive ? 'text-white' : 'text-slate-400 hover:text-white',
                        )}
                        style={{ borderBottom: isActive ? '2px solid var(--dash-accent)' : '2px solid transparent' }}
                    >
                        <Icon className="h-4 w-4" />
                        {tabLabels[tab.key]}
                        {count != null && (
                            <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-slate-300">
                                {fmtCount(count)}
                            </span>
                        )}
                    </Link>
                )
            })}
        </div>
    )
}
