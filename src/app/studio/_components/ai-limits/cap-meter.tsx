import { meterTone } from '@/lib/admin/ai-usage/caps-display'
import './ai-limits.css'

interface Props {
    percent: number | null
    alertPercents: readonly number[]
    label: string
    small?: boolean
}

/** Progress bar of spend against a cap. Green below the first alert, amber from it, red from 100 %. */
export function CapMeter({ percent, alertPercents, label, small = false }: Props) {
    const value = percent === null ? 0 : Math.max(0, Math.min(100, percent))
    return (
        <div
            className={`acl-meter${small ? ' sm' : ''}`} role="progressbar" aria-label={label}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} data-tone={meterTone(percent, alertPercents)}
        >
            <b style={{ width: `${value}%` }} />
            {!small && alertPercents.filter((p) => p < 100).map((p) => <i key={p} aria-hidden style={{ left: `${p}%` }} />)}
        </div>
    )
}
