/**
 * Studio Dashboard — matches design bundle pages.jsx DashboardPage layout.
 *
 * Layout (top → bottom):
 *   page-head: title + subtitle + actions
 *   stats strip (4 cards): total templates, live count, gens 24h, review queue
 *   2-col row: top-templates table (2fr) | recent activity feed (1fr)
 *   publishing queue card (full width)
 *
 * All data fetched server-side via payload.find / raw SQL.
 * Each fetch is individually guarded; a single failure shows "—" not a crash.
 *
 * Intentional deviations from bundle pages.jsx:
 *   - Bundle uses window.__DATA__.TEMPLATES (static mock); we use real DB queries.
 *   - Bundle shows Spark mini-charts; we omit (client-only SVG, requires hydration).
 *     Stat delta text provides the trend signal instead.
 *   - "Usage (30d)" is actual gens count (from ai_generation_records) not a mock string.
 */
import Link from 'next/link'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { getAvgQualityScore } from '@/lib/admin/quality-metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 300
export const metadata = { title: 'Dashboard' }

// ── Types ──────────────────────────────────────────────────────────────────────
type TopTemplate = {
    id: string | number
    name: string
    slug: string
    status: string
    usageCount: number
    category: string
}

type ActivityItem = {
    who: string
    action: string
    target: string
    time: string
    initials: string
}

type QueueItem = {
    id: string | number
    name: string
    slug: string
    status: string
    author: string
    updatedAt: string
}

// ── Safe fetch helpers ─────────────────────────────────────────────────────────
async function fetchStats() {
    try {
        const payload = await getPayload({ config })
        const [total, live, reviewCount, gens24h] = await Promise.all([
            payload.count({ collection: 'templates' }).catch(() => ({ totalDocs: null })),
            payload.count({ collection: 'templates', where: { status: { equals: 'live' } } }).catch(() => ({ totalDocs: null })),
            payload.count({ collection: 'templates', where: { status: { equals: 'review' } } }).catch(() => ({ totalDocs: null })),
            payload.db.drizzle.execute(sql`
                SELECT COUNT(*)::int AS count
                FROM ai_generation_records
                WHERE created_at >= now() - interval '24 hours'
            `).then((r) => {
                const rows = (r as unknown as { rows: Array<{ count: number }> }).rows
                return { totalDocs: rows[0]?.count ?? 0 }
            }).catch(() => ({ totalDocs: null })),
        ])
        return {
            total: total.totalDocs,
            live: live.totalDocs,
            review: reviewCount.totalDocs,
            gens24h: gens24h.totalDocs,
        }
    } catch {
        return { total: null, live: null, review: null, gens24h: null }
    }
}

async function fetchTopTemplates(): Promise<TopTemplate[]> {
    try {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'templates',
            sort: '-usageCount',
            limit: 6,
            depth: 0,
        })
        return result.docs.map((t) => ({
            id: t.id,
            name: (t.name as string) || '—',
            slug: (t.slug as string) || '',
            status: (t.status as string) || 'draft',
            usageCount: (t.usageCount as number) || 0,
            category: (t.category as string) || '—',
        }))
    } catch {
        return []
    }
}

async function fetchRecentActivity(): Promise<ActivityItem[]> {
    try {
        const payload = await getPayload({ config })
        const [gens, issues] = await Promise.all([
            payload.find({
                collection: 'ai-generation-records',
                sort: '-createdAt',
                limit: 3,
                depth: 0,
            }).catch(() => ({ docs: [] })),
            payload.find({
                collection: 'template-issues',
                sort: '-createdAt',
                limit: 3,
                depth: 0,
            }).catch(() => ({ docs: [] })),
        ])

        const items: ActivityItem[] = []

        for (const g of gens.docs) {
            const who = (g.userEmail as string) || 'Anonymous'
            const words = who.split(/[@\s]/)
            const initials = words[0]?.charAt(0).toUpperCase() ?? 'A'
            items.push({
                who,
                action: 'generated a site with',
                target: (g.templateSlug as string) || 'unknown template',
                time: relativeTime(g.createdAt as string),
                initials,
            })
        }

        for (const i of issues.docs) {
            const who = 'System'
            items.push({
                who,
                action: 'flagged issue on',
                target: (i.templateName as string) || 'unknown template',
                time: relativeTime(i.createdAt as string),
                initials: 'SY',
            })
        }

        // Sort by most recent first (crude: rely on insertion order from sort above)
        return items.slice(0, 5)
    } catch {
        return []
    }
}

async function fetchPublishingQueue(): Promise<QueueItem[]> {
    try {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'templates',
            where: { status: { in: ['review', 'scheduled'] } },
            sort: '-updatedAt',
            limit: 10,
            depth: 0,
        })
        return result.docs.map((t) => ({
            id: t.id,
            name: (t.name as string) || '—',
            slug: (t.slug as string) || '',
            status: (t.status as string) || 'review',
            author: (t.author as string) || '—',
            updatedAt: relativeTime(t.updatedAt as string),
        }))
    } catch {
        return []
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—'
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
}

function relativeTime(iso: string | undefined): string {
    if (!iso) return '—'
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

function StatusBadge({ status }: { status: string }) {
    const cls: Record<string, string> = {
        live: 'b-live',
        draft: 'b-draft',
        review: 'b-review',
        scheduled: 'b-scheduled',
        archived: 'b-archived',
    }
    const label: Record<string, string> = {
        live: 'Live',
        draft: 'Draft',
        review: 'Review',
        scheduled: 'Scheduled',
        archived: 'Archived',
    }
    return (
        <span className={`badge ${cls[status] ?? ''}`}>
            {label[status] ?? status}
        </span>
    )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function StudioDashboardPage() {
    await requireSuperAdmin()

    const [stats, topTemplates, recentActivity, queue, qualityResult] = await Promise.all([
        fetchStats(),
        fetchTopTemplates(),
        fetchRecentActivity(),
        fetchPublishingQueue(),
        (async () => {
            try {
                const to = new Date()
                const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
                return await getAvgQualityScore({ from, to })
            } catch {
                return null
            }
        })(),
    ])

    const statCards = [
        {
            label: 'Tổng templates',
            value: fmt(stats.total),
            delta: stats.live !== null ? `${fmt(stats.live)} đang live` : '—',
            up: true,
        },
        {
            label: 'Live',
            value: fmt(stats.live),
            delta: 'đang published',
            up: true,
        },
        {
            label: 'Gens (24h)',
            value: fmt(stats.gens24h),
            delta: 'user generations hôm nay',
            up: (stats.gens24h ?? 0) > 0,
        },
        {
            label: 'Chờ review',
            value: fmt(stats.review),
            delta: stats.review === 0 ? 'queue trống' : 'cần action',
            up: false,
        },
    ]

    return (
        <div className="page">
            {/* Page head */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-sub">Tổng quan luồng template của Web Store</p>
                </div>
                <div className="page-actions">
                    <Link href="/studio/templates" className="btn btn-primary">
                        Xem tất cả templates
                    </Link>
                </div>
            </div>

            {/* Stats strip */}
            <div className="stats">
                {statCards.map((s) => (
                    <div key={s.label} className="stat">
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value">{s.value}</div>
                        <div className={`stat-delta${s.up ? ' up' : ''}`}>{s.delta}</div>
                    </div>
                ))}
            </div>

            {/* 2-col: top templates + recent activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--gap)' }}>
                {/* Top templates */}
                <div className="card">
                    <div className="card-head">
                        <span className="card-title">Top templates theo usage</span>
                        <span className="card-sub">All time</span>
                    </div>
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th style={{ width: 30 }}>#</th>
                                <th>Template</th>
                                <th style={{ textAlign: 'right' }}>Uses</th>
                                <th style={{ width: 90 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topTemplates.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 24 }}>
                                        Chưa có dữ liệu
                                    </td>
                                </tr>
                            ) : (
                                topTemplates.map((t, i) => (
                                    <tr key={t.id}>
                                        <td className="muted mono">{String(i + 1).padStart(2, '0')}</td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{t.name}</div>
                                            <div className="muted" style={{ fontSize: 11 }}>{t.category}</div>
                                        </td>
                                        <td className="num" style={{ textAlign: 'right' }}>
                                            {t.usageCount.toLocaleString()}
                                        </td>
                                        <td><StatusBadge status={t.status} /></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Recent activity */}
                <div className="card">
                    <div className="card-head">
                        <span className="card-title">Hoạt động gần đây</span>
                    </div>
                    <div style={{ padding: '4px 0' }}>
                        {recentActivity.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                                Chưa có hoạt động
                            </div>
                        ) : (
                            recentActivity.map((a, i) => (
                                <div
                                    key={i}
                                    className="row"
                                    style={{ padding: '10px 16px', borderBottom: '1px dashed var(--border)', gap: 10 }}
                                >
                                    <div
                                        className="avatar"
                                        style={{ width: 24, height: 24, fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                                    >
                                        {a.initials}
                                    </div>
                                    <div style={{ flex: 1, fontSize: 12 }}>
                                        <div>
                                            <b style={{ color: 'var(--text)' }}>{a.who}</b>{' '}
                                            <span className="muted">{a.action}</span>
                                        </div>
                                        <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {a.target}
                                        </div>
                                    </div>
                                    <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                        {a.time}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Publishing queue */}
            <div className="card" style={{ marginTop: 'var(--gap)' }}>
                <div className="card-head">
                    <span className="card-title">Publishing queue</span>
                    <span className="card-sub">
                        {queue.length > 0
                            ? `${queue.length} item${queue.length > 1 ? 's' : ''} need action`
                            : 'Queue trống'}
                    </span>
                </div>
                {queue.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                        Không có template nào đang chờ review hoặc scheduled.
                    </div>
                ) : (
                    <table className="tbl">
                        <tbody>
                            {queue.map((t) => (
                                <tr key={t.id}>
                                    <td style={{ width: 40 }}>
                                        <div
                                            className="ph"
                                            style={{ aspectRatio: '16/10', width: 40, padding: 0, fontSize: 7, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)' }}
                                        >
                                            {t.slug.slice(0, 3)}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{t.name}</div>
                                        <div className="muted" style={{ fontSize: 11 }}>
                                            {t.author} · {t.updatedAt}
                                        </div>
                                    </td>
                                    <td><StatusBadge status={t.status} /></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <Link
                                            href="/studio/review"
                                            className="btn btn-xs"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            Review
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer hint */}
            <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-3)' }}>
                Avg quality 7d:{' '}
                {qualityResult ? `${qualityResult.overall.toFixed(1)}/10` : '—'} ·
                Refreshed every 5 minutes
            </p>
        </div>
    )
}
