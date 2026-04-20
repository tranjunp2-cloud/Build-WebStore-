'use client'
/**
 * PacksGrid — master-detail layout matching bundle page-packs.jsx.
 * Left: scrollable pack list cards. Right: detail panel (coverage, stats, sample content,
 * used-by templates, validation warnings). Inline search + category filter.
 * Phase 03: stats (strings/images/products) fetched from /api/admin/packs/[id]/stats.
 */
import { useState, useMemo, useEffect } from 'react'
import { Upload, Plus, Search, Eye, Copy, Edit, Link } from 'lucide-react'
import type { PackContentStats } from '@/app/api/admin/packs/[id]/stats/route'
import { PackDetailDrawer } from './pack-detail-drawer'
import { CreatePackModal } from '../../_components/modals/create-pack-modal'
import type { PackDoc } from '../page'

type Props = { initialPacks: PackDoc[] }

// Static validation warnings — same shape as bundle
const VALIDATION_WARNINGS = [
    { kind: 'missing',  field: 'footer.social.tiktok',    note: 'Dùng trong template t01, t11' },
    { kind: 'outdated', field: 'hero.subtitle',             note: 'Copy có thể đã lỗi thời (3 mo)' },
    { kind: 'quality',  field: 'products[5].description',  note: 'Copy quá ngắn (<20 chars)' },
    { kind: 'ai',       field: 'menu.categories[2].title', note: 'AI có thể generate tốt hơn' },
] as const

const KIND_META = {
    missing:  { color: 'var(--danger)',  bg: 'rgba(220,38,38,0.08)',  label: 'Missing' },
    outdated: { color: 'var(--warn)',    bg: 'rgba(217,119,6,0.08)', label: 'Outdated' },
    quality:  { color: 'var(--warn)',    bg: 'rgba(217,119,6,0.08)', label: 'Quality' },
    ai:       { color: 'var(--accent)',  bg: 'var(--accent-soft)',   label: 'AI suggest' },
} as const

const INDUSTRY_LABELS: Record<string, string> = {
    restaurant: 'F&B',
    ecommerce:  'Retail',
    beauty:     'Beauty',
    tech:       'Tech',
    education:  'Education',
    creative:   'Portfolio',
    health:     'Health',
    realestate: 'Real Estate',
    fitness:    'Fitness',
    business:   'Business',
    fnb:        'F&B',
    events:     'Events',
    blog:       'Blog',
    travel:     'Travel',
}

function hueFromId(id: string): number {
    return (id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) * 37) % 360
}

export function PacksGrid({ initialPacks }: Props) {
    const [packs, setPacks] = useState<PackDoc[]>(initialPacks)
    const [selectedId, setSelectedId] = useState<string>(packs[0]?.id ?? '')
    const [category, setCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showDrawer, setShowDrawer] = useState(false)

    const filtered = useMemo(
        () =>
            packs.filter(
                (p) =>
                    (category === 'all' || p.category === category) &&
                    (!search || p.name.toLowerCase().includes(search.toLowerCase())),
            ),
        [packs, category, search],
    )

    const selected = packs.find((p) => p.id === selectedId) ?? packs[0] ?? null

    const handleCreated = async () => {
        setShowCreate(false)
        try {
            const res = await fetch('/api/admin/packs?limit=100')
            const d = await res.json()
            setPacks(d.data ?? [])
        } catch { /* non-fatal */ }
    }

    const handleUpdated = (updated: PackDoc) => {
        setPacks((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setShowDrawer(false)
    }

    const handleDeleted = (id: string) => {
        setPacks((prev) => prev.filter((p) => p.id !== id))
        setSelectedId(packs.filter((p) => p.id !== id)[0]?.id ?? '')
        setShowDrawer(false)
    }

    return (
        <div className="page">
            {/* ── Page header ─────────────────────────── */}
            <div className="page-head">
                <div>
                    <h1 className="page-title">Content Packs</h1>
                    <p className="page-sub">
                        Bộ nội dung mẫu (copy, hình, products) gắn vào templates cho mỗi ngành — dùng khi AI auto-fill hoặc admin preview
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-ghost">
                        <Upload size={13} /> Import JSON
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={13} /> Tạo pack mới
                    </button>
                </div>
            </div>

            {/* ── Filters ─────────────────────────────── */}
            <div className="filters">
                <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
                    <Search size={13} />
                    <input
                        placeholder="Tìm pack..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="all">Tất cả ngành</option>
                    <option value="restaurant">F&amp;B / Nhà hàng</option>
                    <option value="ecommerce">Retail / Fashion</option>
                    <option value="beauty">Beauty / Spa</option>
                    <option value="tech">Tech / SaaS</option>
                    <option value="education">Education</option>
                    <option value="creative">Portfolio</option>
                    <option value="health">Health / Clinic</option>
                    <option value="realestate">Real Estate</option>
                    <option value="fitness">Fitness / Gym</option>
                    <option value="business">Business</option>
                    <option value="events">Events</option>
                    <option value="travel">Travel</option>
                    <option value="blog">Blog / Media</option>
                </select>
                <div style={{ flex: 1 }} />
                <span className="muted" style={{ fontSize: 12 }}>{filtered.length} packs</span>
            </div>

            {/* ── Master-detail grid ──────────────────── */}
            {packs.length === 0 ? (
                <div className="pk-empty">
                    <p>No packs yet — create your first content pack.</p>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={13} /> New Pack
                    </button>
                </div>
            ) : (
                <div className="pk-layout">
                    {/* LEFT: Pack list */}
                    <div className="pk-list">
                        {filtered.map((p) => {
                            const isSel = p.id === selectedId
                            const hue = hueFromId(p.id)
                            const industry = INDUSTRY_LABELS[p.category ?? ''] ?? p.category ?? '—'
                            const tmplCount = p.includedTemplates?.length ?? 0
                            return (
                                <div
                                    key={p.id}
                                    className={`pk-card${isSel ? ' pk-card-active' : ''}`}
                                    onClick={() => setSelectedId(p.id)}
                                >
                                    <div className="pk-card-top">
                                        <div
                                            className="pk-avatar"
                                            style={{
                                                background: `hsl(${hue},40%,90%)`,
                                                color: `hsl(${hue},50%,40%)`,
                                            }}
                                        >
                                            {(p.name.charAt(0) ?? '?').toUpperCase()}
                                        </div>
                                        <div className="pk-card-info">
                                            <div className="pk-card-name">{p.name}</div>
                                            <div className="pk-card-industry muted">{industry}</div>
                                        </div>
                                        <span className="mono pk-card-version">v1.0</span>
                                    </div>
                                    {p.description && (
                                        <p className="pk-card-desc">{p.description}</p>
                                    )}
                                    <div className="pk-card-stats">
                                        <span>{p.includedTemplates?.length ?? 0} templates</span>
                                    </div>
                                    <div className="pk-card-foot">
                                        {p.category && (
                                            <span className="chip chip-solid" style={{ fontSize: 10, padding: '2px 6px' }}>
                                                {industry}
                                            </span>
                                        )}
                                        <div style={{ flex: 1 }} />
                                        <span className="muted" style={{ fontSize: 11 }}>
                                            Used in {tmplCount}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* RIGHT: Pack detail */}
                    {selected && (
                        <PackDetailPanel
                            pack={selected}
                            onEdit={() => setShowDrawer(true)}
                        />
                    )}
                </div>
            )}

            {/* Modals */}
            {showDrawer && selected && (
                <PackDetailDrawer
                    pack={selected}
                    onClose={() => setShowDrawer(false)}
                    onUpdated={handleUpdated}
                    onDeleted={() => handleDeleted(selected.id)}
                />
            )}
            {showCreate && (
                <CreatePackModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    )
}

// ── Right-panel detail ────────────────────────────────────────────

function PackDetailPanel({
    pack,
    onEdit,
}: {
    pack: PackDoc
    onEdit: () => void
}) {
    const hue = hueFromId(pack.id)
    const industry = INDUSTRY_LABELS[pack.category ?? ''] ?? pack.category ?? '—'
    const tmplCount = pack.includedTemplates?.length ?? 0
    // Derive a rough coverage from template count (placeholder — real data from DB)
    const coverage = Math.min(95, 60 + tmplCount * 5)

    // Fetch real content stats for this pack
    const [stats, setStats] = useState<PackContentStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setStatsLoading(true)
        setStats(null)
        fetch(`/api/admin/packs/${encodeURIComponent(pack.id)}/stats`)
            .then((r) => r.json())
            .then((d) => { if (!cancelled && d.data) setStats(d.data as PackContentStats) })
            .catch(() => { /* non-fatal — fall back to '—' */ })
            .finally(() => { if (!cancelled) setStatsLoading(false) })
        return () => { cancelled = true }
    }, [pack.id])

    const SAMPLE_PREVIEW = [
        { field: 'hero.headline',      value: `Welcome to ${pack.name}` },
        { field: 'hero.subtitle',      value: 'Khám phá những điều tuyệt vời' },
        { field: 'cta.primary',        value: 'Bắt đầu ngay' },
    ]

    return (
        <div className="pk-detail">
            {/* Header card */}
            <div className="card pk-detail-header-card">
                <div className="pk-detail-hd">
                    <div
                        className="pk-detail-avatar"
                        style={{
                            background: `hsl(${hue},40%,90%)`,
                            color: `hsl(${hue},50%,40%)`,
                        }}
                    >
                        {(pack.name.charAt(0) ?? '?').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                            <h2 className="pk-detail-title">{pack.name}</h2>
                            <span className="mono chip chip-accent" style={{ fontSize: 11 }}>v1.0</span>
                        </div>
                        <p className="muted pk-detail-desc">{pack.description ?? '—'}</p>
                        <div className="row pk-detail-meta">
                            <span className="muted">📍 {industry}</span>
                            <span className="muted">🌐 vi-VN</span>
                            <span className="muted">🕒 {new Date(pack.updatedAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-sm">
                            <Eye size={12} /> Preview
                        </button>
                        <button className="btn btn-sm">
                            <Copy size={12} /> Clone
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={onEdit}>
                            <Edit size={12} /> Edit pack
                        </button>
                    </div>
                </div>

                {/* Coverage bar */}
                <div className="pk-coverage">
                    <div className="row" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>Content coverage</span>
                        <div style={{ flex: 1 }} />
                        <span className="mono" style={{ fontWeight: 600 }}>{coverage}%</span>
                    </div>
                    <div className="pk-coverage-track">
                        <div
                            className="pk-coverage-fill"
                            style={{
                                width: `${coverage}%`,
                                background:
                                    coverage >= 90
                                        ? 'var(--success)'
                                        : coverage >= 75
                                        ? 'var(--warn)'
                                        : 'var(--danger)',
                            }}
                        />
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        {coverage >= 90
                            ? '✓ Đủ content cho mọi field'
                            : coverage >= 75
                            ? '⚠ Còn thiếu một số field — xem Missing'
                            : '✗ Cần bổ sung nhiều field'}
                    </div>
                </div>
            </div>

            {/* Stats row — real data from /api/admin/packs/[id]/stats */}
            <div className="pk-stats-row">
                <CoverStat
                    label="Strings"
                    value={statsLoading ? '…' : stats ? String(stats.strings) : '—'}
                    sub="copy fields"
                />
                <CoverStat
                    label="Images"
                    value={statsLoading ? '…' : stats ? String(stats.images) : '—'}
                    sub="image fields"
                />
                <CoverStat
                    label="Products"
                    value={statsLoading ? '…' : stats ? String(stats.products) : '—'}
                    sub="product blocks"
                />
                <CoverStat label="Templates" value={tmplCount} sub="đang dùng" />
            </div>

            {/* Sample content */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                    <span className="card-title">Sample content</span>
                    <span className="card-sub">3 fields</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-xs btn-ghost">
                        <Edit size={11} /> Edit all
                    </button>
                </div>
                <div style={{ padding: 0 }}>
                    {SAMPLE_PREVIEW.map((item, i) => (
                        <div key={i} className="pk-sample-row" style={{ borderBottom: i < SAMPLE_PREVIEW.length - 1 ? '1px dashed var(--border)' : 'none' }}>
                            <span className="mono muted pk-sample-field">{item.field}</span>
                            <span className="pk-sample-val">&ldquo;{item.value}&rdquo;</span>
                            <div className="pk-sample-actions">
                                <button className="btn btn-xs btn-ghost"><Edit size={11} /></button>
                            </div>
                        </div>
                    ))}
                    <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button className="btn btn-sm btn-ghost">Xem tất cả fields →</button>
                    </div>
                </div>
            </div>

            {/* Used by templates */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                    <span className="card-title">Used by templates</span>
                    <span className="card-sub">{tmplCount}</span>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-xs btn-ghost">
                        <Link size={11} /> Link to template
                    </button>
                </div>
                {tmplCount === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center' }}>
                        <p className="muted" style={{ fontSize: 13 }}>No templates linked to this pack.</p>
                    </div>
                ) : (
                    <div className="pk-tmpl-grid">
                        {(pack.includedTemplates ?? []).map((t) => (
                            <div key={t.id} className="pk-tmpl-item">
                                <div className="ph pk-tmpl-thumb">
                                    <span>{t.name.slice(0, 4)}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="pk-tmpl-name">{t.name}</div>
                                    <div className="muted" style={{ fontSize: 11 }}>v1.0</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Validation warnings */}
            <div className="card">
                <div className="card-head">
                    <span className="card-title">Validation &amp; missing fields</span>
                    <span className="card-sub">{VALIDATION_WARNINGS.length} issues</span>
                </div>
                <div style={{ padding: 0 }}>
                    {VALIDATION_WARNINGS.map((v, i) => {
                        const meta = KIND_META[v.kind]
                        return (
                            <div
                                key={i}
                                className="pk-validation-row"
                                style={{ borderBottom: i < VALIDATION_WARNINGS.length - 1 ? '1px dashed var(--border)' : 'none' }}
                            >
                                <span
                                    className="pk-validation-badge"
                                    style={{ color: meta.color, background: meta.bg }}
                                >
                                    {meta.label}
                                </span>
                                <span className="mono pk-validation-field">{v.field}</span>
                                <span className="muted pk-validation-note">{v.note}</span>
                                <div style={{ textAlign: 'right' }}>
                                    <button className="btn btn-xs">Fix</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function CoverStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
    return (
        <div className="stat pk-stat">
            <div className="stat-label">{label}</div>
            <div className="stat-value pk-stat-value">{value}</div>
            <div className="muted" style={{ fontSize: 11 }}>{sub}</div>
        </div>
    )
}
