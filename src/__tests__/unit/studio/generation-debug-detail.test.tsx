import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { routerBack, routerPush } = vi.hoisted(() => ({ routerBack: vi.fn(), routerPush: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush, back: routerBack }) }))

import { GenerationDebugDetail } from '@/app/studio/generations/_components/generation-debug-detail'

const detail = {
    id: '41', submittedAt: '2026-09-15T08:00:00.000Z', lifecycle: 'terminal', outcome: 'partial_failed', recoveryStatus: 'eligible', priority: 'retryable',
    recoveryPolicy: { action: 'retry_website', retryable: true, reasonCode: 'RETRY_ELIGIBLE' }, pageSummary: { expected: 2, persisted: 1, failed: 1 }, incidentSummary: null, affectedError: null,
    endpoint: 'site-generator', category: 'retail', website: { id: 'site-1', name: 'Flower Store', domain: 'flower.example.test', status: 'draft', urls: { preview: '/preview/site-1', live: 'flower.example.test' } },
    recoveredWebsite: null, user: { id: 'user-1', name: 'Mai Lan', email: 'mai@example.test' }, inputSchemaVersion: 'f41.v1', inputHash: 'hash', traceId: 'f41-ui-fixture-detail-41',
    input: { available: true, summary: [['Tên doanh nghiệp', 'Flower Store'], ['Ngành hàng', 'Retail'], ['Mô tả', 'Hoa tươi'], ['Sản phẩm / dịch vụ', 'Hoa hồng'], ['Ngôn ngữ', 'vi']], full: { businessName: 'Flower Store', extraInstructions: 'Full safe instructions' } },
    pages: [{ pageKey: 'contact', title: 'Liên hệ', slug: 'contact', pageId: 'page-1', status: 'failed', blockCount: 2, errorCode: 'PAGE_FAILED', errorSummary: 'Không thể lưu trang' }],
    errors: [], timeline: [{ event: 'submitted', at: '2026-09-15T08:00:00.000Z' }], durationMs: null,
    incident: { kind: 'page', label: 'Lỗi tạo trang', location: { type: 'page', key: 'contact', label: 'Liên hệ', known: true }, cause: { label: 'Không thể tạo trang', code: 'PAGE_FAILED', validationRule: null, observedState: null }, impact: { expected: 2, persisted: 1, failed: 1, summary: '1/2 trang chưa tạo, 1 trang đã lưu.' }, recovery: { retryable: true, scope: 'website', reasonCode: 'RETRY_ELIGIBLE' }, owner: { kind: 'operator', label: 'Người trực tracking' }, nextAction: { kind: 'retry_website', label: 'Gen lại toàn bộ website.' }, developerEvidence: null, legacy: false, relatedErrorCount: 1 },
    lineage: { source: 'user_submit', parentGenerationId: null, retryRootGenerationId: null, retryAttempt: 0 }, retryHistory: [],
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    window.sessionStorage.clear()
})

describe('[TC-F41-15/16] GenerationDebugDetail', () => {
    it('does not render the out-of-scope copy-link action', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect(await screen.findByRole('heading', { name: 'Flower Store' })).toBeVisible()
        expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument()
    })

    it('TC-F41-15: keeps the full allowlisted form hidden until the operator expands it', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Flower Store' })).toBeVisible())

        // Assert
        const fullForm = () => document.querySelector('.f41-full-form')
        expect(fullForm()).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Xem form đầy đủ' }))
        expect(fullForm()).toBeVisible()
        expect(screen.getByText('Hướng dẫn thêm')).toBeVisible()
        expect(screen.getByText('Full safe instructions')).toBeVisible()
        expect(screen.queryByText('extraInstructions')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Thu gọn form' }))
        expect(fullForm()).not.toBeInTheDocument()
    })

    it('TC-F41-16: explicitly reports unknown page/component capture instead of inventing a tree', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, pages: [], traceId: null } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        await expect(screen.findByText('Sự cố cần xử lý')).resolves.toBeVisible()
        expect(screen.queryByRole('heading', { name: 'Trang và component' })).not.toBeInTheDocument()
        expect(screen.queryByText('Thông tin kỹ thuật phục vụ Dev debug')).not.toBeInTheDocument()
    })

    it('shows technical evidence only when the generation contains useful debug data', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, durationMs: 1250, incident: { ...detail.incident, developerEvidence: { phase: 'page_persist', technicalMessage: 'Normalized diagnostic: PAGE_FAILED (timeout).' } } } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect(await screen.findByText('Thông tin kỹ thuật phục vụ Dev debug')).toBeVisible()
        const technicalSummary = screen.getByText('Thông tin kỹ thuật phục vụ Dev debug')
        fireEvent.click(technicalSummary)
        expect(screen.getByText('Normalized diagnostic: PAGE_FAILED (timeout).')).toBeVisible()
        expect(screen.getByText('Trace ID')).toBeVisible()
        expect(technicalSummary.closest('details')).toHaveAttribute('open')
        expect(screen.queryByText('Input hash')).not.toBeInTheDocument()
    })

    it('does not show a legacy page-data warning for a successful generation', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, lifecycle: 'terminal', outcome: 'succeeded', pages: [] } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        await expect(screen.findByRole('heading', { name: 'Flower Store' })).resolves.toBeVisible()
        expect(screen.queryByText(/Dữ liệu trang.component không được lưu/i)).not.toBeInTheDocument()
    })

    it('TC-F41-20: translates a retryable failure into an operational status and action', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, errors: [{ code: 'PAGE_FAILED', locationType: 'page', locationKey: 'Liên hệ', category: 'unknown', retryabilityReason: null, message: 'Không tạo được trang Liên hệ.', technicalMessage: null }] } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect((await screen.findAllByText('Có thể gen lại website'))[0]).toBeVisible()
        expect(screen.getByText('Lỗi tạo trang')).toBeVisible()
        expect(screen.getAllByText('Liên hệ')[0]).toBeVisible()
        expect(screen.getByText(/1\/2 trang chưa tạo, 1 trang đã lưu/)).toBeVisible()
        expect(screen.getByText('Khả năng khôi phục')).toBeVisible()
        expect(screen.getByText('Có thể gen lại toàn bộ website')).toBeVisible()
        expect(screen.queryByText('RETRY_ELIGIBLE')).not.toBeInTheDocument()
    })

    it('TC-F41-20: directs an unrecoverable generation to Issues & feedback', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, recoveryStatus: 'ticket_required', recoveryPolicy: { action: 'create_ticket', retryable: false, reasonCode: 'TICKET_REQUIRED' }, incident: { ...detail.incident, owner: { kind: 'dev', label: 'Team Dev' }, nextAction: { kind: 'open_issues', label: 'Tạo ticket để team Dev điều tra.' } } } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect((await screen.findAllByText('Cần Dev xử lý'))[0]).toBeVisible()
        expect(screen.getByRole('link', { name: 'Mở Issues & feedback' })).toHaveAttribute('href', '/studio/issues')
    })

    it('TC-F41-20: displays one generation-level impact summary for heterogeneous errors', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, pageSummary: { expected: 5, persisted: 2, failed: 3 }, incident: { ...detail.incident, impact: { expected: 5, persisted: 2, failed: 3, summary: '3/5 trang chưa tạo, 2 trang đã lưu.' }, relatedErrorCount: 2 }, errors: [
            { code: 'FORM_INVALID', locationType: 'input', locationKey: 'businessName', category: 'input', retryabilityReason: null, message: 'Tên doanh nghiệp chưa hợp lệ.', technicalMessage: null },
            { code: 'PAGE_FAILED', locationType: 'page', locationKey: 'contact', category: 'unknown', retryabilityReason: null, message: 'Không tạo được trang Liên hệ.', technicalMessage: null },
        ] } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect((await screen.findByText(/3\/5 trang chưa tạo, 2 trang đã lưu/))).toBeVisible()
        expect(screen.getByText(/2 lỗi liên quan/)).toBeVisible()
        expect(screen.getAllByText(/3\/5 trang chưa tạo/)).toHaveLength(1)
    })

    it('TC-F41-15: returns to the prior queue only when opened from the listing', async () => {
        // Arrange
        window.sessionStorage.setItem('f41-generation-detail-return', '1')
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Quay lại danh sách' }))

        // Assert
        expect(routerBack).toHaveBeenCalledOnce()
        expect(routerPush).not.toHaveBeenCalled()
    })

    it('TC-F41-15: falls back to the list for a directly shared detail URL', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Quay lại danh sách' }))

        // Assert
        expect(routerPush).toHaveBeenCalledWith('/studio/generations')
        expect(routerBack).not.toHaveBeenCalled()
    })

    it('TC-F41-16: renders a legacy page with no terminal status as unknown', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...detail, pages: [{ ...detail.pages[0], status: 'unknown' }] } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect(await screen.findByText('Chưa xác định')).toBeVisible()
        expect(document.querySelector('.f41-page-tree')).not.toHaveTextContent('Chưa tạo được')
    })

    it('TC-F41-20: exposes the derived internal preview URL without accepting an external scheme', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect(await screen.findByRole('link', { name: /mở preview/i })).toHaveAttribute('href', '/preview/site-1')
    })

    it('TC-F41-14: does not render a stored live URL that embeds credentials', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
            ...detail,
            website: { ...detail.website, domain: 'https://ops-user:ops-secret@example.test', urls: { ...detail.website.urls, live: 'https://ops-user:ops-secret@example.test' } },
        } }), { status: 200 })))

        // Act
        render(<GenerationDebugDetail generationId="41" />)

        // Assert
        expect(await screen.findByText('Chưa có URL public')).toBeVisible()
        expect(screen.queryByRole('link', { name: /mở website/i })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('ops-secret')
    })

    it('TC-F41-20: ignores a stale detail response after the operator changes generation', async () => {
        // Arrange
        let resolveFirst: ((value: Response) => void) | undefined
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...detail, id: '42', website: { ...detail.website, name: 'Current Store' } } }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const view = render(<GenerationDebugDetail generationId="41" />)
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        // Act
        view.rerender(<GenerationDebugDetail generationId="42" />)
        await expect(screen.findByRole('heading', { name: 'Current Store' })).resolves.toBeVisible()
        resolveFirst?.(new Response(JSON.stringify({ data: detail }), { status: 200 }))

        // Assert
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Current Store' })).toBeVisible())
        expect(screen.queryByRole('heading', { name: 'Flower Store' })).not.toBeInTheDocument()
    })
})
