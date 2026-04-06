'use client'

/**
 * F16 — UnreadBadge component
 * Displays the red dot with unread count on the NotificationBell.
 * Renders nothing when count is 0.
 */

type UnreadBadgeProps = {
    count: number
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
    if (count === 0) return null

    const label = count > 99 ? '99+' : String(count)

    return (
        <span
            aria-label={`${label} unread notifications`}
            style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: count > 9 ? '18px' : '16px',
                height: '16px',
                borderRadius: '999px',
                background: '#EF4444',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                lineHeight: '16px',
                textAlign: 'center',
                padding: '0 4px',
                border: '2px solid #1E293B',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 10,
            }}
        >
            {label}
        </span>
    )
}
