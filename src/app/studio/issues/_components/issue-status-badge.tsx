'use client'

/**
 * IssueStatusBadge — colored badge for issue status.
 */

export type IssueStatus = 'open' | 'in-review' | 'fixed' | 'wont-fix'

const STATUS_STYLES: Record<IssueStatus, { bg: string; text: string; label: string }> = {
    'open':      { bg: '#eff6ff', text: '#2563eb', label: 'Open' },
    'in-review': { bg: '#f5f3ff', text: '#7c3aed', label: 'In Review' },
    'fixed':     { bg: '#f0fdf4', text: '#16a34a', label: 'Fixed' },
    'wont-fix':  { bg: '#f8fafc', text: '#64748b', label: "Won't Fix" },
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.open
    return (
        <span
            style={{
                background: s.bg,
                color: s.text,
                border: `1px solid ${s.text}30`,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                padding: '1px 7px',
                display: 'inline-block',
                whiteSpace: 'nowrap',
            }}
        >
            {s.label}
        </span>
    )
}
