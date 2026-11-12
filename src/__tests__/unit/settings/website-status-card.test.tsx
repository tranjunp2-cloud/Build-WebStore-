/**
 * US-F05-10 — Settings → Domains "Website status" card
 *   TC-F05-10-16 → 3 states, Unpublish hidden without builder access, DELETE call, 409 refresh
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom'
import en from '@/i18n/locales/en.json'

const refresh = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) } }))
vi.mock('next/font/google', () => ({ Inter: () => ({ className: 'inter' }) }))
vi.mock('@/i18n', () => ({ useI18n: () => ({ t: en, locale: 'en' }) }))

import { WebsiteStatusCard } from '@/app/(dashboard)/settings/domains/WebsiteStatusCard'
import { resolveWebsiteStatus } from '@/app/(dashboard)/settings/domains/website-status'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fetchMock = vi.fn()
beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
})

const card = (over: Partial<React.ComponentProps<typeof WebsiteStatusCard>> = {}) =>
    render(<WebsiteStatusCard siteId="s1" status="live" siteUrl="https://shop.primeweb.app" canUnpublish {...over} />)

async function confirmUnpublish() {
    fireEvent.click(screen.getByRole('button', { name: en.Domains.websiteStatus.unpublish }))
    fireEvent.click(screen.getByLabelText(en.editor.unpublishModal.acknowledge))
    fireEvent.click(screen.getByRole('button', { name: en.editor.unpublishModal.confirmBtn }))
}

describe('resolveWebsiteStatus', () => {
    it('[TC-F05-10-16] lives in a module without \'use client\' so the Server Component page can call it', () => {
        const dir = join(process.cwd(), 'src/app/(dashboard)/settings/domains')
        expect(readFileSync(join(dir, 'website-status.ts'), 'utf8')).not.toMatch(/^\s*['"]use client['"]/m)
        expect(readFileSync(join(dir, 'page.tsx'), 'utf8')).not.toContain('WebsiteStatusCard')
    })

    it('[TC-F05-10-16] maps site status to live / maintenance / draft', () => {
        expect(resolveWebsiteStatus({ status: 'published', publishedAt: '2026-01-01' })).toBe('live')
        expect(resolveWebsiteStatus({ status: 'draft', publishedAt: '2026-01-01' })).toBe('maintenance')
        expect(resolveWebsiteStatus({ status: 'draft', publishedAt: null })).toBe('draft')
    })
})

describe('WebsiteStatusCard', () => {
    it('[TC-F05-10-16] live: shows status, URL, Unpublish button and description', () => {
        card()
        expect(screen.getByTestId('website-status-badge')).toHaveTextContent('Live')
        expect(screen.getByText('shop.primeweb.app')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Unpublish website' })).toBeInTheDocument()
        expect(screen.getByText(en.Domains.websiteStatus.unpublishDesc)).toBeInTheDocument()
    })

    it('[TC-F05-10-16] maintenance / draft: Open Editor link and no Unpublish', () => {
        const { unmount } = card({ status: 'maintenance' })
        expect(screen.getByTestId('website-status-badge')).toHaveTextContent('Under maintenance')
        expect(screen.getByRole('link', { name: /Open Editor/ })).toHaveAttribute('href', '/editor/s1')
        expect(screen.queryByRole('button', { name: 'Unpublish website' })).toBeNull()
        unmount()
        card({ status: 'draft' })
        expect(screen.getByTestId('website-status-badge')).toHaveTextContent('Draft')
        expect(screen.queryByRole('button', { name: 'Unpublish website' })).toBeNull()
    })

    it('[TC-F05-10-16] hides Unpublish when the user cannot build the site (API would 403)', () => {
        card({ canUnpublish: false })
        expect(screen.getByTestId('website-status-badge')).toHaveTextContent('Live')
        expect(screen.queryByRole('button', { name: 'Unpublish website' })).toBeNull()
    })

    it('[TC-F05-10-16] confirmed unpublish calls DELETE once and flips to maintenance', async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200 })
        card()
        await confirmUnpublish()
        await waitFor(() => expect(screen.getByTestId('website-status-badge')).toHaveTextContent('Under maintenance'))
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/api/sites/s1/publish', expect.objectContaining({ method: 'DELETE' }))
        expect(refresh).toHaveBeenCalled()
    })

    it('[TC-F05-10-16] no API call until the checkbox is ticked', () => {
        card()
        fireEvent.click(screen.getByRole('button', { name: 'Unpublish website' }))
        const confirm = screen.getByRole('button', { name: en.editor.unpublishModal.confirmBtn })
        expect(confirm).toBeDisabled()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('[TC-F05-10-16] 409 (already unpublished) shows an error toast and refreshes', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 409 })
        card()
        await confirmUnpublish()
        await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.Domains.websiteStatus.alreadyUnpublished))
        expect(refresh).toHaveBeenCalled()
    })

    it('[TC-F05-10-16] 500 keeps the card live and the modal usable', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500 })
        card()
        await confirmUnpublish()
        await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.Domains.websiteStatus.unpublishFailed))
        expect(screen.getByTestId('website-status-badge')).toHaveTextContent('Live')
        expect(screen.getByRole('button', { name: en.editor.unpublishModal.confirmBtn })).toBeEnabled()
    })
})
