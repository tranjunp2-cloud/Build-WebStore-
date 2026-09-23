'use client'

/**
 * IssueStatusBadge — colored badge for issue status.
 */

export type IssueStatus = 'backlog' | 'reopen' | 'in_progress' | 'dev_fixed' | 'testing' | 'done'

const STATUS_STYLES: Record<IssueStatus, { bg: string; text: string; label: string }> = {
    backlog:       { bg: '#f1f5f9', text: '#475569', label: 'Backlog' },
    reopen:        { bg: '#fdf2f8', text: '#be185d', label: 'Reopen' },
    in_progress:   { bg: '#f5f3ff', text: '#7c3aed', label: 'Dev đang xử lý' },
    dev_fixed:     { bg: '#eff6ff', text: '#2563eb', label: 'Dev đã sửa' },
    testing:       { bg: '#faf5ff', text: '#7e22ce', label: 'QA Testing' },
    done:          { bg: '#f0fdf4', text: '#15803d', label: 'Done · cần test lại' },
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.backlog
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
