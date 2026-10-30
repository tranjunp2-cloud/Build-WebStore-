'use client'

import { fmtCapUsd } from '@/lib/admin/ai-usage/caps-display'
import type { CapsDraft, CapsProblems } from '@/lib/admin/ai-usage/caps-form'
import type { CapsView } from '@/lib/admin/ai-settings/types'
import { CapsFields } from '../../../_components/ai-limits/caps-fields'

interface Props {
    view: CapsView
    draft: CapsDraft
    problems: CapsProblems
    onChange: (next: CapsDraft) => void
}

const SOURCE: Record<CapsView['dailySource'], string> = { settings: 'saved here', env: 'from the environment', off: 'off' }

/** "Platform caps": what AI may cost across all shops, and what applies right now. */
export function CapsSection({ view, draft, problems, onChange }: Props) {
    const { effective } = view
    return (
        <section className="aiq-card" aria-labelledby="caps-title">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title" id="caps-title">Platform caps</div>
                    <div className="aiq-card-sub">The ceiling for all shops together, on top of each plan and shop limit. Malaysia time. Changes take effect within ~6 min.</div>
                </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'grid', gap: 16 }}>
                <p className="acl-effective" data-testid="caps-effective">
                    Applying now: daily <b>{fmtCapUsd(effective.dailyUsd)}</b> ({SOURCE[view.dailySource]}) · monthly <b>{fmtCapUsd(effective.monthlyUsd)}</b>
                    {' '}· alerts at <b>{effective.alertPercents.length ? effective.alertPercents.map((p) => `${p} %`).join(', ') : 'none'}</b>
                    {' '}· Free paused at <b>{effective.pauseFreeAtPercent === null ? 'off' : `${effective.pauseFreeAtPercent} %`}</b>
                </p>
                <CapsFields idPrefix="caps" draft={draft} view={view} problems={problems} onChange={onChange} />
            </div>
        </section>
    )
}
