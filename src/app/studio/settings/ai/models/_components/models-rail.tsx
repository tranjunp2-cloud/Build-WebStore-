'use client'

import { History, KeyRound, LayoutDashboard, ListTree, Route, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'providers', label: 'Providers', Icon: KeyRound },
    { key: 'routing', label: 'Routing', Icon: Route },
    { key: 'tasks', label: 'Tasks', Icon: ListTree },
    { key: 'runtime', label: 'Runtime', Icon: SlidersHorizontal },
    { key: 'history', label: 'History', Icon: History },
] as const

export interface RailBadges {
    providers: number
    routing: number
}

/** Left rail of Providers & models: one link per page, a red count where something needs the admin. */
export function ModelsRail({ badges }: { badges: RailBadges }) {
    const pathname = usePathname() ?? ''
    return (
        <nav className="pm-secnav" aria-label="Providers and models pages">
            {ITEMS.map(({ key, label, Icon }) => {
                const href = `/studio/settings/ai/models/${key}`
                const count = key === 'providers' ? badges.providers : key === 'routing' ? badges.routing : 0
                return (
                    <Link key={key} href={href} aria-current={pathname === href ? 'page' : undefined}>
                        <Icon className="pm-ic" aria-hidden="true" />{label}
                        {count > 0 && <span className="pm-count" aria-label={`${count} need you`}>{count}</span>}
                    </Link>
                )
            })}
        </nav>
    )
}
