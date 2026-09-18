'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, ChevronDown, ExternalLink, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { GenerationRetryAction } from './generation-retry-action'
import { GenerationIssueAction } from './generation-issue-action'
import type { GenerationRecord } from './generation-types'

type Detail = Omit<GenerationRecord, 'user' | 'site'> & {
    endpoint: string
    category: string | null
    website: { id: string | null; name: string; domain: string | null; status: string | null; urls: { preview: string | null; live: string | null } }
    recoveredWebsite: { id: string | null; name: string; domain: string | null; status: string | null; urls: { preview: string | null; live: string | null } } | null
    user: { id: string | null; name: string; email: string | null }
    input: { available: boolean; summary: [string, string][]; full: Record<string, unknown> | null }
    inputSchemaVersion: string | null
    inputHash: string | null
    traceId: string | null
    pages: Array<{ pageKey: string | null; title: string; slug: string | null; pageId: string | null; status: 'persisted' | 'failed' | 'unknown'; blockCount: number | null; errorCode: string | null; errorSummary: string | null; components: Array<{ order: number; type: string; label: string | null; fields: Array<[string, string]> }> }>
    errors: Array<{ phase: string; locationType: string; locationKey: string | null; code: string; category: string; retryabilityReason: string | null; message: string; technicalMessage: string | null }>
    incident: { kind: string; label: string; location: { type: string; key: string | null; label: string; known: boolean }; cause: { label: string; code: string; phase: string; validationRule: string | null; observedState: string | null }; impact: { expected: number | null; persisted: number; failed: number; summary: string }; recovery: { retryable: boolean; scope: string; reasonCode: string }; owner: { kind: string; label: string }; nextAction: { kind: string; label: string }; developerEvidence: { phase: string; technicalMessage: string } | null; legacy: boolean; relatedErrorCount: number } | null
    timeline: Array<{ event: string; at: string; jobId?: string; jobStatus?: string; childGenerationId?: string | null }>
    durationMs: number | null
    lineage: { source: string; parentGenerationId: string | null; retryRootGenerationId: string | null; retryAttempt: number }
    retryHistory: Array<{ id: string; submittedAt: string; outcome: string | null; recoveryStatus: string; retryAttempt: number }>
}

const eventLabel: Record<string, string> = { submitted: 'User gửi form', started: 'Bắt đầu tạo website', last_heartbeat: 'Cập nhật tiến trình', terminal: 'Kết thúc generation', recovery_queued: 'Đã xếp hàng gen lại', recovery_started: 'Bắt đầu gen lại', recovery_finished: 'Kết thúc gen lại' }
function date(value: string) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.valueOf()) ? 'Chưa ghi nhận' : parsed.toLocaleString('vi-VN')
}

function operationalStatus(detail: Pick<Detail, 'recoveryStatus' | 'recoveryPolicy'>) {
    switch (detail.recoveryStatus) {
        case 'retrying': return { label: 'Đang gen lại website', tone: 'info', explanation: 'Hệ thống đã nhận yêu cầu và đang xử lý. Chưa cần thao tác thêm.', nextStep: 'Theo dõi lần gen lại trong timeline bên dưới.' }
        case 'eligible': return { label: 'Có thể gen lại website', tone: 'warn', explanation: 'Lỗi này có thể được khôi phục bằng một lần gen lại toàn bộ website.', nextStep: 'Chọn “Gen lại website” để tạo một bản nháp recovery.' }
        case 'ticket_required':
        case 'exhausted': return { label: 'Cần Dev xử lý', tone: 'danger', explanation: 'Hệ thống không thể tự khôi phục generation này.', nextStep: 'Tạo ticket tại Issues & feedback để team Dev điều tra.', actionHref: '/studio/issues', actionLabel: 'Mở Issues & feedback' }
        case 'ticket_created': return { label: 'Đã chuyển Dev xử lý', tone: 'muted', explanation: 'Issue cho generation này đã được tạo.', nextStep: 'Theo dõi tiến độ xử lý tại Issues & feedback.' }
        case 'stale_running': return { label: 'Generation có dấu hiệu bị kẹt', tone: 'warn', explanation: 'Hệ thống chưa nhận được tiến trình mới trong thời gian dự kiến.', nextStep: 'Kiểm tra technical evidence trước khi quyết định xử lý tiếp.' }
        default: return { label: 'Đã ghi nhận generation', tone: 'muted', explanation: 'Không có hành động recovery đang chờ.', nextStep: detail.recoveryPolicy.retryable ? 'Bạn có thể gen lại website.' : 'Xem lỗi và timeline để tiếp tục điều tra.' }
    }
}

function outcomeLabel(outcome: Detail['outcome'], lifecycle: Detail['lifecycle']) {
    const value = outcome ?? lifecycle
    const labels: Record<string, string> = { succeeded: 'Hoàn tất', partial_failed: 'Hoàn tất một phần, có lỗi', failed: 'Tạo website thất bại', cancelled: 'Đã hủy', running: 'Đang tạo website', queued: 'Đang chờ xử lý', terminal: 'Đã kết thúc' }
    return value ? labels[value] ?? 'Chưa xác định' : 'Chưa xác định'
}

function sourceLabel(source: string) { return source === 'ops_retry' ? 'Gen lại bởi người trực' : 'User gửi form' }

function websiteStatusLabel(status: string | null) {
    const labels: Record<string, string> = { draft: 'Bản nháp, chưa công khai', published: 'Đã công khai', live: 'Đã công khai', archived: 'Đã lưu trữ' }
    return status ? labels[status] ?? 'Chưa xác định' : 'Chưa xác định'
}

function recoveryJobStatusLabel(status: string) {
    const labels: Record<string, string> = { queued: 'Đang chờ', running: 'Đang xử lý', succeeded: 'Hoàn tất', failed: 'Thất bại', cancelled: 'Đã hủy' }
    return labels[status] ?? 'Chưa xác định'
}

function errorLabel(locationType: string) {
    const labels: Record<string, string> = { page: 'Lỗi tạo trang', component: 'Lỗi tạo component', website: 'Lỗi tạo website', site: 'Lỗi tạo website', input: 'Lỗi dữ liệu đầu vào' }
    return labels[locationType] ?? 'Lỗi trong quá trình tạo website'
}

function recoveryLabel(incident: NonNullable<Detail['incident']>) {
    if (incident.recovery.retryable) return 'Có thể gen lại toàn bộ website'
    if (incident.recovery.reasonCode === 'RETRY_IN_PROGRESS') return 'Đang xử lý lần gen lại'
    return 'Không thể gen lại tự động'
}

const fullFormLabels: Record<string, string> = {
    businessName: 'Tên doanh nghiệp', industry: 'Ngành hàng', shortDescription: 'Mô tả', products: 'Sản phẩm / dịch vụ',
    services: 'Dịch vụ', language: 'Ngôn ngữ', generationLocale: 'Ngôn ngữ generation', extraInstructions: 'Hướng dẫn thêm', contentBriefCaptured: 'Đã cung cấp content brief',
}

function fullFormEntries(full: Record<string, unknown> | null) {
    if (!full) return [] as Array<[string, string]>
    return Object.entries(full).flatMap(([key, value]) => {
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return []
        const label = fullFormLabels[key]
        if (!label) return []
        const text = key === 'contentBriefCaptured' ? (value ? 'Có' : 'Không') : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join(', ') : String(value)
        return [[label, text] as [string, string]]
    })
}
function safeHref(value: string | null) {
    if (!value || /[\s<>]/.test(value)) return null
    if (value.startsWith('/')) {
        const url = new URL(value, window.location.origin)
        return url.origin === window.location.origin && /^\/preview\/[^/]+$/.test(url.pathname) ? `${url.pathname}${url.search}` : null
    }
    const normalized = /^https?:\/\//.test(value) ? value : `https://${value}`
    if (!URL.canParse(normalized)) return null
    const url = new URL(normalized)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname && !url.username && !url.password
        ? url.href
        : null
}

const DETAIL_RETURN_MARKER = 'f41-generation-detail-return'

export function GenerationDebugDetail({ generationId }: { generationId: string }) {
    const router = useRouter()
    const [detail, setDetail] = useState<Detail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        try {
            const response = await fetch(`/api/admin/generations/${encodeURIComponent(generationId)}`, { cache: 'no-store', signal })
            const body = await response.json().catch(() => null) as { data?: Detail; error?: string } | null
            if (!response.ok || !body?.data) throw new Error(body?.error ?? 'Không thể tải generation detail.')
            if (!signal?.aborted) { setDetail(body.data); setError(null) }
        } catch (caught) {
            if (!signal?.aborted) setError(caught instanceof Error ? caught.message : 'Không thể tải generation detail.')
        } finally { if (!signal?.aborted) setLoading(false) }
    }, [generationId])
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])
    const returnToList = () => {
        // Detail is normally opened from the queue. Browser back retains the
        // active in-memory queue filters; a shareable/direct URL has no queue
        // history, so it safely falls back to the default list.
        if (typeof window !== 'undefined' && window.sessionStorage.getItem(DETAIL_RETURN_MARKER) === '1') {
            window.sessionStorage.removeItem(DETAIL_RETURN_MARKER)
            router.back()
            return
        }
        router.push('/studio/generations')
    }
    if (loading) return <main className="f41-detail-page"><p>Đang tải generation detail…</p></main>
    if (error || !detail) return <main className="f41-detail-page"><button className="btn btn-sm" onClick={returnToList}><ArrowLeft size={14} /> Quay lại danh sách</button><p role="alert" className="f41-load-error">{error ?? 'Không tìm thấy generation.'}</p><button className="btn btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Thử lại</button></main>
    const previewHref = safeHref(detail.website.urls.preview)
    const liveHref = safeHref(detail.website.urls.live)
    const recoveryPreviewHref = safeHref(detail.recoveredWebsite?.urls.preview ?? null)
    const retryRecord: GenerationRecord = { ...detail, user: { id: detail.user.id, label: detail.user.name, missing: !detail.user.id, email: detail.user.email }, site: { id: detail.website.id, label: detail.website.name, missing: !detail.website.id } }
    const status = operationalStatus(detail)
    const formEntries = fullFormEntries(detail.input.full)
    const originalTimeline = detail.timeline.filter((item) => !item.event.startsWith('recovery_'))
    const recoveryTimeline = detail.timeline.filter((item) => item.event.startsWith('recovery_'))
    const hasTechnicalEvidence = Boolean(detail.incident) && (Boolean(detail.incident?.developerEvidence) || detail.durationMs !== null || detail.traceId !== null)
    const submittedAt = detail.timeline.find((item) => item.event === 'submitted')?.at
    const startedAt = detail.timeline.find((item) => item.event === 'started')?.at
    const hasLegacyTimelineOrder = Boolean(submittedAt && startedAt && new Date(startedAt) < new Date(submittedAt))
    return <main className="f41-detail-page">
        <div className="f41-detail-top"><button className="btn btn-sm" onClick={returnToList}><ArrowLeft size={14} /> Quay lại danh sách</button></div>
        <header className="f41-detail-header"><div><p className="f41-eyebrow">GENERATION #{detail.id}</p><h1>{detail.website.name}</h1><p>{detail.user.name}{detail.user.email ? ` · ${detail.user.email}` : ''} · gửi lúc {date(detail.submittedAt)}</p></div></header>
        <section className={`f41-status-summary ${status.tone}`} aria-label="Trạng thái xử lý"><AlertTriangle size={18} /><div><b>{status.label}</b><small>{status.nextStep}</small></div></section>
        <section className="f41-detail-section f41-incident-section"><div className="f41-section-title"><div><h2>Sự cố cần xử lý</h2><p>Thông tin để người trực quyết định hướng xử lý ngay.</p></div></div>{detail.incident ? <div className="f41-incident-panel"><div className="f41-incident-head"><strong>{detail.incident.label}</strong>{detail.incident.relatedErrorCount > 1 && <span>{detail.incident.relatedErrorCount} lỗi liên quan</span>}</div><dl className="f41-incident-facts"><div><dt>Vị trí ảnh hưởng</dt><dd>{detail.incident.location.known ? detail.incident.location.label : 'Chưa xác định từ generation cũ'}{(detail.incident.location.type === 'page' || detail.incident.location.type === 'component') && <small>Xem tên trang/component ở mục bên dưới.</small>}</dd></div><div><dt>Nguyên nhân</dt><dd>{detail.incident.cause.label}<small>Mã: {detail.incident.cause.code}</small></dd></div><div><dt>Ảnh hưởng</dt><dd>{detail.incident.impact.summary}</dd></div>{detail.incident.cause.validationRule && <div><dt>Quy tắc kiểm tra</dt><dd>{detail.incident.cause.validationRule} · {detail.incident.cause.observedState}</dd></div>}</dl><div className="f41-incident-action"><div><span>Khả năng khôi phục</span><b>{recoveryLabel(detail.incident)}</b></div><div><span>Người xử lý</span><b>{detail.incident.owner.label}</b></div><div><span>Hành động tiếp theo</span><b>{detail.incident.nextAction.label}</b></div>{detail.incident.nextAction.kind === 'retry_website' && <GenerationRetryAction record={retryRecord} onAccepted={() => void load()} />}{detail.incident.nextAction.kind === 'open_issues' && <GenerationIssueAction record={retryRecord} onCreated={() => void load()} />}</div>{hasTechnicalEvidence && <details className="f41-evidence f41-incident-evidence"><summary><span>Thông tin kỹ thuật phục vụ Dev debug</span><small>Chỉ dữ liệu đã chuẩn hóa, không chứa prompt hoặc secret</small></summary><dl>{detail.incident.developerEvidence && <><dt>Giai đoạn lỗi</dt><dd>{detail.incident.developerEvidence.phase}</dd><dt>Diagnostic</dt><dd>{detail.incident.developerEvidence.technicalMessage}</dd></>}{detail.traceId && <><dt>Trace ID</dt><dd>{detail.traceId}</dd></>}{detail.durationMs !== null && <><dt>Thời lượng xử lý</dt><dd>{detail.durationMs}ms</dd></>}</dl></details>}</div> : <p className="f41-empty">Không có sự cố cần xử lý cho generation này.</p>}</section>
        <section className="f41-detail-grid" aria-label="Kết quả, website và người dùng"><article><h2>Kết quả tạo website</h2><dl><dt>Trang dự kiến</dt><dd>{detail.pageSummary.expected ?? 'Chưa ghi nhận'}</dd><dt>Đã lưu</dt><dd>{detail.pageSummary.persisted}</dd><dt>Chưa tạo được</dt><dd>{detail.pageSummary.failed}</dd><dt>Kết quả lần tạo gốc</dt><dd>{outcomeLabel(detail.outcome, detail.lifecycle)}</dd><dt>Xử lý hiện tại</dt><dd>{status.label}</dd></dl></article><article><h2>Website và người dùng</h2><dl><dt>Website</dt><dd>{detail.website.name} {detail.website.id && <small>#{detail.website.id}</small>}</dd><dt>Trạng thái</dt><dd>{websiteStatusLabel(detail.website.status)}</dd><dt>Preview URL</dt><dd>{previewHref ? <a href={previewHref} target="_blank" rel="noreferrer">Mở preview <ExternalLink size={13} /></a> : 'Chưa có preview'}</dd><dt>Live URL</dt><dd>{liveHref ? <a href={liveHref} target="_blank" rel="noreferrer">Mở website <ExternalLink size={13} /></a> : 'Chưa có URL public'}</dd>{detail.recoveredWebsite && <><dt>Website recovery</dt><dd>{detail.recoveredWebsite.name} {recoveryPreviewHref && <a href={recoveryPreviewHref} target="_blank" rel="noreferrer">Mở preview recovery <ExternalLink size={13} /></a>}</dd></>}<dt>Người dùng</dt><dd>{detail.user.name}{detail.user.email ? ` · ${detail.user.email}` : ''}</dd><dt>User ID</dt><dd>{detail.user.id ?? 'Không còn liên kết'}</dd></dl></article></section>
        <section className="f41-detail-section"><div className="f41-section-title"><div><h2>Thông tin user đã nhập</h2><p>Chỉ dữ liệu form đã được chuẩn hóa và allowlist được hiển thị.</p></div><button className="btn btn-sm" onClick={() => setShowForm((visible) => !visible)} aria-expanded={showForm}>{showForm ? 'Thu gọn form' : 'Xem form đầy đủ'} <ChevronDown size={14} /></button></div>{detail.input.available ? <><div className="f41-input-summary">{detail.input.summary.map(([label, value]) => <div key={label}><small>{label}</small><span>{value}</span></div>)}</div>{showForm && <dl className="f41-full-form">{formEntries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</> : <p className="f41-empty">Generation cũ chưa lưu snapshot form; không thể suy đoán lại input.</p>}</section>
        {detail.pages.length > 0 && <section className="f41-detail-section"><h2>Trang và component</h2><p className="f41-empty">Mở từng trang để xem component và dữ liệu đã gen.</p><div className="f41-page-tree">{detail.pages.map((page) => <article key={page.pageKey ?? page.pageId ?? page.title} className={page.status === 'failed' ? 'failed' : ''}><details className="f41-page-disclosure"><summary><div><b>{page.title}</b><small>{page.slug ?? page.pageKey ?? 'Không có slug'} · {page.blockCount ?? '?'} components</small></div><span className={`gen-pill gen-pill-${page.status === 'failed' ? 'danger' : page.status === 'persisted' ? 'success' : 'muted'}`}>{page.status === 'failed' ? 'Chưa tạo được' : page.status === 'persisted' ? 'Đã lưu' : 'Chưa xác định'}</span><ChevronDown size={16} aria-hidden /></summary>{page.errorSummary && <p>{page.errorSummary}</p>}{page.components.length > 0 ? <ol className="f41-component-list">{page.components.map((component) => <li key={`${component.order}-${component.type}`}><b>{component.order}. {component.type}</b>{component.label && <span>{component.label}</span>}{component.fields.length > 0 && <dl>{component.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}</li>)}</ol> : <p className="f41-component-unknown">{page.status === 'persisted' ? 'Chưa đọc được component từ page đã lưu.' : 'Trang chưa được lưu nên chưa có component để hiển thị.'}</p>}</details></article>)}</div></section>}
        <section className="f41-detail-grid"><article><h2>Timeline</h2>{hasLegacyTimelineOrder && <p className="f41-timeline-warning">Một số mốc từ generation cũ không theo thứ tự thời gian. Đây là mốc ghi nhận, không dùng để suy luận duration.</p>}<h3>Generation gốc</h3><ol className="f41-timeline">{originalTimeline.sort((a, b) => ['submitted', 'started', 'last_heartbeat', 'terminal'].indexOf(a.event) - ['submitted', 'started', 'last_heartbeat', 'terminal'].indexOf(b.event)).map((item) => <li key={`${item.event}-${item.at}`}><b>{eventLabel[item.event] ?? item.event}</b><span>{date(item.at)}</span></li>)}</ol>{recoveryTimeline.length > 0 && <><h3>Lần gen lại</h3><ol className="f41-timeline">{recoveryTimeline.map((item) => <li key={`${item.event}-${item.at}-${item.jobId ?? ''}`}><b>{eventLabel[item.event] ?? item.event}{item.jobStatus ? ` · ${recoveryJobStatusLabel(item.jobStatus)}` : ''}</b><span>{date(item.at)}</span>{item.childGenerationId && <a href={`/studio/generations/${encodeURIComponent(item.childGenerationId)}`}>Xem generation #{item.childGenerationId}</a>}</li>)}</ol></>}</article><article><h2>Retry lineage</h2><dl><dt>Nguồn</dt><dd>{sourceLabel(detail.lineage.source)}</dd><dt>Lần retry hiện tại</dt><dd>{detail.lineage.retryAttempt}</dd><dt>Generation cha</dt><dd>{detail.lineage.parentGenerationId ? <a href={`/studio/generations/${encodeURIComponent(detail.lineage.parentGenerationId)}`}>#{detail.lineage.parentGenerationId}</a> : 'Không có, đây là generation gốc'}</dd></dl>{detail.retryHistory.length > 0 && <ul className="f41-retry-history">{detail.retryHistory.map((retry) => <li key={retry.id}><a href={`/studio/generations/${encodeURIComponent(retry.id)}`}>Generation #{retry.id}</a> · lần {retry.retryAttempt} · {operationalStatus({ recoveryStatus: retry.recoveryStatus, recoveryPolicy: detail.recoveryPolicy }).label}</li>)}</ul>}</article></section>
    </main>
}
