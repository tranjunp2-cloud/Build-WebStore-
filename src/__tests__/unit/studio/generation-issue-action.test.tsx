import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GenerationIssueAction } from '@/app/studio/generations/_components/generation-issue-action'
import type { GenerationRecord } from '@/app/studio/generations/_components/generation-types'

const record: GenerationRecord = {
    id: '41', submittedAt: '2026-09-15T00:00:00.000Z',
    user: { id: 'user-1', label: 'Operator', missing: false }, site: { id: 'site-1', label: 'Website', missing: false },
    lifecycle: 'terminal', outcome: 'failed', recoveryStatus: 'ticket_required', priority: 'cannot_recover',
    recoveryPolicy: { action: 'create_ticket', retryable: false, reasonCode: 'TICKET_REQUIRED' },
    pageSummary: { expected: 5, persisted: 4, failed: 1 }, incidentSummary: { kind: 'page', label: 'Lỗi tạo trang', scope: 'Liên hệ', totalErrors: 1 }, affectedError: null,
}

afterEach(() => vi.unstubAllGlobals())

describe('[TC-F41-23/29] GenerationIssueAction', () => {
    it('TC-F41-23: confirms before creating a ticket and renders the created ticket link', async () => {
        // Arrange
        const onCreated = vi.fn()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: '88', created: true, href: '/studio/issues?relatedType=generation&relatedId=41' } }), { status: 201 })))
        render(<GenerationIssueAction record={record} onCreated={onCreated} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Tạo ticket Dev cho generation #41' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tạo ticket Dev' }))

        // Assert
        await waitFor(() => expect(screen.getByRole('link', { name: 'Mở ticket' })).toHaveAttribute('href', '/studio/issues?relatedType=generation&relatedId=41'))
        expect(screen.getByRole('status')).toHaveTextContent('Đã tạo ticket Dev.')
        expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it('TC-F41-29: explains the privacy boundary without rendering raw form content', () => {
        // Arrange
        render(<GenerationIssueAction record={record} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Tạo ticket Dev cho generation #41' }))

        // Assert
        expect(screen.getByText('Không gửi nội dung form, prompt hoặc dữ liệu nhạy cảm.')).toBeInTheDocument()
    })

    it('TC-F41-23: restores the action after a safe server rejection', async () => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Generation này không còn cần tạo ticket.' } }), { status: 409 })))
        render(<GenerationIssueAction record={record} />)

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Tạo ticket Dev cho generation #41' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tạo ticket Dev' }))

        // Assert
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Generation này không còn cần tạo ticket.'))
        expect(screen.getByRole('button', { name: 'Tạo ticket Dev' })).toBeEnabled()
    })
})
