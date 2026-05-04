'use client'

/**
 * StatusDot — colored dot indicating generation status.
 * Running: amber pulsing animation
 * Success: green solid
 * Failed:  red solid
 */

type StatusDotProps = {
    status: 'running' | 'success' | 'failed'
    size?: number
}

const STATUS_CONFIG = {
    running: { color: 'var(--amber, #f59e0b)', pulse: true, label: 'Running' },
    success: { color: 'var(--green, #22c55e)', pulse: false, label: 'Success' },
    failed:  { color: 'var(--red, #ef4444)',   pulse: false, label: 'Failed' },
} as const

export function StatusDot({ status, size = 8 }: StatusDotProps) {
    const cfg = STATUS_CONFIG[status]

    return (
        <span
            title={cfg.label}
            aria-label={cfg.label}
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                borderRadius: '50%',
                background: cfg.color,
                flexShrink: 0,
                animation: cfg.pulse ? 'status-pulse 1.4s ease-in-out infinite' : undefined,
            }}
        />
    )
}
