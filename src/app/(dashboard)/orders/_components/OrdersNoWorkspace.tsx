'use client'

import { useI18n } from '@/i18n'

/** Shown when an authenticated platform admin has no store membership. */
export function OrdersNoWorkspace() {
    const { t } = useI18n()
    const orders = t.dashboard.orders

    return (
        <section role="status" className="rounded-xl border border-dash-border bg-dash-surface p-6">
            <h1 className="text-xl font-semibold text-dash-text">{orders.noWorkspaceTitle}</h1>
            <p className="mt-2 text-sm text-dash-text-muted">{orders.noWorkspaceBody}</p>
        </section>
    )
}
