'use client'

import { useI18n } from '@/i18n'

/**
 * F16 — UnreadBadge component
 * Displays the red dot with unread count on the NotificationBell.
 * Renders nothing when count is 0.
 */

type UnreadBadgeProps = {
    count: number
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
    const { t } = useI18n()

    if (count === 0) return null

    const label = count > 99 ? '99+' : String(count)

    return (
        <span
            aria-label={(t.notifications.ariaUnread ?? '{count} unread notifications').replace('{count}', label)}
            style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                minWidth: count > 9 ? '20px' : '18px',
                height: '18px',
                borderRadius: '999px',
                background: '#EF4444',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                padding: '0 4px',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 10,
            }}
        >
            {label}
        </span>
    )
}
