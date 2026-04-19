/**
 * Studio Dashboard — Phase 01 KPI stub (2×2 grid).
 * Real metrics wired in later phases once collection queries are ready.
 */
import { FileText, Activity, Zap, Bug } from 'lucide-react'

const KPI_CARDS = [
    { label: 'Total templates', value: '48', icon: FileText, color: '#2563EB' },
    { label: 'User generations', value: '—', icon: Activity, color: '#059669' },
    { label: 'Avg quality score', value: '—', icon: Zap, color: '#D97706' },
    { label: 'Open issues', value: '8', icon: Bug, color: '#DC2626' },
]

export const metadata = { title: 'Dashboard' }

export default function StudioDashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                    Overview
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                    Live metrics coming in Phase 05 — 07.
                </p>
            </div>

            {/* 2×2 KPI grid */}
            <div className="grid grid-cols-2 gap-[var(--gap)] max-w-lg">
                {KPI_CARDS.map(({ label, value, icon: Icon, color }) => (
                    <div
                        key={label}
                        className="rounded-xl border p-5 flex flex-col gap-3"
                        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                                {label}
                            </span>
                            <Icon size={16} style={{ color }} />
                        </div>
                        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                            {value}
                        </span>
                    </div>
                ))}
            </div>

            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Phase 01 scaffold — sidebar, topbar, RBAC, and token system are live.
            </p>
        </div>
    )
}
