import type { OverrideMode } from '@/lib/admin/ai-usage/override-form'
import './ai-limits.css'

const MODE: Record<OverrideMode, { label: string; tone: string }> = {
    custom: { label: 'Custom', tone: 'acl-tone-info' },
    unlimited: { label: 'Unlimited', tone: 'acl-tone-ok' },
    blocked: { label: 'Blocked', tone: 'acl-tone-danger' },
}

/** Mode of a shop override; an expired one shows as "Expired" (the plan applies again). */
export function OverrideBadge({ mode, expired }: { mode: OverrideMode; expired: boolean }) {
    if (expired) return <span className="badge acl-tone-mute">Expired</span>
    return <span className={`badge ${MODE[mode].tone}`}>{MODE[mode].label}</span>
}
