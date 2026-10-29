import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { I18nProvider } from '@/i18n'
import { useConnectivity } from '@/hooks/useConnectivity'
import { OfflineBanner } from '@/components/editor/OfflineBanner'
import { EditorToolbar } from '@/components/editor/EditorToolbar'

function stubOnLine(value: boolean | undefined) {
    vi.stubGlobal('navigator', { onLine: value })
}

function ConnectivityBannerProbe() {
    const { isOnline, isSyncing } = useConnectivity()
    return <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} />
}

const toolbarProps = {
    siteId: '3',
    currentPageId: '3',
    siteName: 'Harness Site',
    currentPageTitle: 'Home',
    pages: [],
    isPublished: false,
    isSaving: false,
    saveSuccess: false,
    hasUnsavedChanges: false,
    isPublishing: false,
    publishSuccess: false,
    canUndo: false,
    canRedo: false,
    viewport: 'desktop' as const,
    onOpenMenu: vi.fn(),
    onPageSelected: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onPublish: vi.fn(),
    onViewportChange: vi.fn(),
}

function renderToolbarString(lastSavedAt: number | null) {
    return renderToString(
        <I18nProvider>
            <EditorToolbar {...toolbarProps} lastSavedAt={lastSavedAt} />
        </I18nProvider>,
    )
}

describe('[TC-S73] editor hydration determinism (S72-D6)', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('server render emits no offline banner when navigator.onLine is unavailable', () => {
        stubOnLine(undefined)
        const html = renderToString(<ConnectivityBannerProbe />)
        expect(html).toBe('')
    })

    it('reflects actual connectivity after mount', () => {
        stubOnLine(false)
        render(<ConnectivityBannerProbe />)
        expect(screen.getByText(/offline/i)).toBeTruthy()
    })

    it('emits no banner after mount while online', () => {
        stubOnLine(true)
        const { container } = render(<ConnectivityBannerProbe />)
        expect(container.innerHTML).toBe('')
    })

    it('toolbar save-status markup is identical across wall clock', () => {
        vi.useFakeTimers()
        const lastSavedAt = 1_000_000_000_000
        vi.setSystemTime(lastSavedAt + 30_000)
        const first = renderToolbarString(lastSavedAt)
        vi.setSystemTime(lastSavedAt + 90_000)
        const second = renderToolbarString(lastSavedAt)
        expect(second).toBe(first)
        expect(first).toContain('Saved just now')
    })
})
