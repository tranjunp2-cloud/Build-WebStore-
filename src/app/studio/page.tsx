/**
 * Studio Dashboard — live KPI cards wired to real collections.
 *
 * Four metrics run in parallel (Promise.all), each guarded with catch so
 * a single query failure shows `—` instead of crashing the whole page.
 * Revalidates every 5 min to balance freshness vs DB load.
 */
import { FileText, Activity, Zap, Bug } from 'lucide-react'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { getAvgQualityScore } from '@/lib/admin/quality-metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 300
export const metadata = { title: 'Dashboard' }

async function fetchTotalTemplates(): Promise<number | null> {
    try {
        const payload = await getPayload({ config })
        const result = await payload.count({ collection: 'templates' })
        return result.totalDocs
    } catch {
        return null
    }
}

async function fetchGenerations24h(): Promise<number | null> {
    try {
        const payload = await getPayload({ config })
        const rs = (await payload.db.drizzle.execute(sql`
            SELECT COUNT(*)::int AS count
            FROM ai_generation_records
            WHERE created_at >= now() - interval '24 hours'
        `)) as unknown as { rows: Array<{ count: number }> }
        return rs.rows[0]?.count ?? 0
    } catch {
        return null
    }
}

async function fetchOpenIssues(): Promise<number | null> {
    try {
        const payload = await getPayload({ config })
        const result = await payload.count({
            collection: 'template-issues',
            where: { status: { in: ['open', 'in-review'] } },
        })
        return result.totalDocs
    } catch {
        return null
    }
}

async function fetchAvgQuality7d(): Promise<number | null> {
    try {
        const to = new Date()
        const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
        const res = await getAvgQualityScore({ from, to })
        return res.overall ?? null
    } catch {
        return null
    }
}

function fmt(n: number | null, suffix = ''): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—'
    if (suffix === '/10') return `${n.toFixed(1)}${suffix}`
    return `${n}${suffix}`
}

export default async function StudioDashboardPage() {
    await requireSuperAdmin()

    const [totalTemplates, generations24h, avgQuality7d, openIssues] = await Promise.all([
        fetchTotalTemplates(),
        fetchGenerations24h(),
        fetchAvgQuality7d(),
        fetchOpenIssues(),
    ])

    const cards = [
        { label: 'Total templates', value: fmt(totalTemplates), icon: FileText, color: '#2563EB' },
        { label: 'Gens in 24h', value: fmt(generations24h), icon: Activity, color: '#059669' },
        { label: 'Avg quality (7d)', value: fmt(avgQuality7d, '/10'), icon: Zap, color: '#D97706' },
        { label: 'Open issues', value: fmt(openIssues), icon: Bug, color: '#DC2626' },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                    Overview
                </h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                    Live metrics across templates, generations, quality, and issues.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-[var(--gap)] max-w-lg">
                {cards.map(({ label, value, icon: Icon, color }) => (
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
                Refreshed every 5 minutes · Follow phase detail pages for deeper metrics.
            </p>
        </div>
    )
}
