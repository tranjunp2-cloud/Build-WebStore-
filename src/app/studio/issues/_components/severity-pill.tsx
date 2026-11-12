'use client'

/**
 * SeverityPill — colored pill for issue severity levels.
 * critical=red, high=orange, medium=amber, low=gray
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

const SEVERITY_STYLES: Record<IssueSeverity, { bg: string; text: string; label: string }> = {
    critical: { bg: '#fef2f2', text: '#dc2626', label: 'Khẩn cấp' },
    high:     { bg: '#fff7ed', text: '#ea580c', label: 'Cao' },
    medium:   { bg: '#fffbeb', text: '#d97706', label: 'Trung bình' },
    low:      { bg: '#f8fafc', text: '#64748b', label: 'Thấp' },
}

export function SeverityPill({ severity }: { severity: IssueSeverity }) {
    const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium
    return (
        <span
            style={{
                background: s.bg,
                color: s.text,
                border: `1px solid ${s.text}40`,
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 7px',
                display: 'inline-block',
                whiteSpace: 'nowrap',
            }}
        >
            {s.label}
        </span>
    )
}
