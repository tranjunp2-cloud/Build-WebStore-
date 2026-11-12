/**
 * US-F05-10 — editor toolbar publish area (Unpublish moved to Settings → Domains)
 *   TC-F05-10-13 → one primary button per publish state; `live` has no Preview / no primary
 *   TC-F05-10-14 → no Unpublish / "View live" dropdown, compact and desktop
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import '@testing-library/jest-dom'
import en from '@/i18n/locales/en.json'

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: en, locale: 'en' }),
}))

import { EditorToolbar, type PublishState } from '@/components/editor/EditorToolbar'
import {
    formatLiveLabel,
    resolvePublishAwareSaveLabel,
} from '@/components/editor/toolbar-publish-controls'

const SITE_URL = 'https://myshop.primeweb.app'

type Scenario = { isPublished: boolean; isPublishing: boolean; hasUnsavedChanges: boolean; hasUnpublishedChanges: boolean }
const SCENARIOS: Record<PublishState, Scenario> = {
    draft: { isPublished: false, isPublishing: false, hasUnsavedChanges: false, hasUnpublishedChanges: false },
    publishing: { isPublished: false, isPublishing: true, hasUnsavedChanges: false, hasUnpublishedChanges: false },
    'live-dirty': { isPublished: true, isPublishing: false, hasUnsavedChanges: false, hasUnpublishedChanges: true },
    updating: { isPublished: true, isPublishing: true, hasUnsavedChanges: false, hasUnpublishedChanges: true },
    live: { isPublished: true, isPublishing: false, hasUnsavedChanges: false, hasUnpublishedChanges: false },
}

function renderToolbar(state: PublishState, compact: boolean, extra: Partial<React.ComponentProps<typeof EditorToolbar>> = {}) {
    return render(
        <EditorToolbar
            siteId="site-1"
            currentPageId="page-1"
            siteName="Shop"
            currentPageTitle="Home"
            pages={[]}
            isSaving={false}
            saveSuccess={false}
            lastSavedAt={null}
            publishSuccess={false}
            canUndo={false}
            canRedo={false}
            viewport="desktop"
            compact={compact}
            onOpenMenu={() => {}}
            onPageSelected={() => {}}
            onUndo={() => {}}
            onRedo={() => {}}
            onSave={() => {}}
            onPublish={() => {}}
            onRepublish={() => {}}
            onCopyLink={() => {}}
            onViewportChange={() => {}}
            siteUrl={SITE_URL}
            {...SCENARIOS[state]}
            {...extra}
        />,
    )
}

const hasPreview = (c: HTMLElement) => !!c.querySelector('a[href^="/preview/site-1"], button[title^="Saving"]')
const primaryButtons = (c: HTMLElement) => Array.from(c.querySelectorAll('button')).filter((b) => b.className.includes('bg-gradient-to-r') && !b.closest('[data-viewport-toggle]') && /Publish|Update live|Publishing|Updating/.test(b.textContent ?? ''))

describe.each([false, true])('EditorToolbar publish area (compact=%s)', (compact) => {
    it('[TC-F05-10-13] draft: Preview + Publish', () => {
        const { container } = renderToolbar('draft', compact)
        expect(hasPreview(container)).toBe(true)
        expect(screen.getByRole('button', { name: /^Publish$/ })).toBeInTheDocument()
        expect(screen.queryByText('Update live')).toBeNull()
    })

    it('[TC-F05-10-13] live + pending changes: Preview, Update live, small open-live arrow', () => {
        const onRepublish = vi.fn()
        const { container } = renderToolbar('live-dirty', compact, { onRepublish })
        expect(hasPreview(container)).toBe(true)
        fireEvent.click(screen.getByRole('button', { name: /Update live/ }))
        expect(onRepublish).toHaveBeenCalledOnce()
        const openLive = screen.getByLabelText('Open live website')
        expect(openLive).toHaveAttribute('href', SITE_URL)
        expect(openLive).toHaveAttribute('target', '_blank')
        expect(screen.queryByRole('button', { name: /^Publish$/ })).toBeNull()
        expect(primaryButtons(container)).toHaveLength(1)
    })

    it('[TC-F05-10-13] live + in sync: no Preview, no primary button, domain link + Copy link', () => {
        const onCopyLink = vi.fn()
        const { container } = renderToolbar('live', compact, { onCopyLink })
        expect(hasPreview(container)).toBe(false)
        expect(primaryButtons(container)).toHaveLength(0)
        const link = screen.getByTitle(SITE_URL)
        expect(link).toHaveAttribute('href', SITE_URL)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
        expect(link).toHaveTextContent('myshop.primeweb.app')
        fireEvent.click(screen.getByLabelText('Copy link'))
        expect(onCopyLink).toHaveBeenCalledOnce()
    })

    it('[TC-F05-10-13] open-live / Copy link icons are never hidden by a breakpoint class (phone keeps them)', () => {
        renderToolbar('live-dirty', compact)
        expect(screen.getByLabelText('Open live website').className).not.toMatch(/hidden/)
        document.body.innerHTML = ''
        renderToolbar('live', compact)
        expect(screen.getByLabelText('Copy link').className).not.toMatch(/hidden/)
    })

    it('[TC-F05-10-13] Update live is disabled while saving or publishing', () => {
        renderToolbar('live-dirty', compact, { isSaving: true })
        expect(screen.getByRole('button', { name: /Update live/ })).toBeDisabled()
    })

    it('[TC-F05-10-14] never offers Unpublish or a View live dropdown', () => {
        for (const state of Object.keys(SCENARIOS) as PublishState[]) {
            const { container, unmount } = renderToolbar(state, compact)
            expect(screen.queryByText(/unpublish/i)).toBeNull()
            expect(screen.queryByText('View live')).toBeNull()
            expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull()
            unmount()
        }
    })
})

describe('maintenance banner (site was live, now unpublished)', () => {
    it('[TC-F05-10-12] keeps the banner and the Publish primary button', () => {
        renderToolbar('draft', false, { wasPublished: true })
        expect(screen.getByText(en.editor.maintenance.banner)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^Publish$/ })).toBeInTheDocument()
    })
})

describe('formatLiveLabel', () => {
    it('[TC-F05-10-13] drops scheme/trailing slash and truncates long domains with an ellipsis', () => {
        expect(formatLiveLabel('https://myshop.com/')).toBe('myshop.com')
        const long = formatLiveLabel('https://a-very-long-subdomain-name-for-a-shop.primeweb.app', 20)
        expect(long).toHaveLength(20)
        expect(long.endsWith('…')).toBe(true)
    })
})

describe('resolvePublishAwareSaveLabel', () => {
    const labels = { savedDraftNotLive: 'Draft saved · Not live yet', savedLive: 'Saved · Live' }
    it('[TC-F05-10-13] relabels settled saves on a live site only', () => {
        const f = (saveStatus: 'saving' | 'unsaved' | 'saved' | 'savedJustNow', publishState: PublishState) =>
            resolvePublishAwareSaveLabel({ saveStatus, publishState, labels, fallback: 'Saved' })
        expect(f('saved', 'live')).toBe('Saved · Live')
        expect(f('savedJustNow', 'live-dirty')).toBe('Draft saved · Not live yet')
        expect(f('saved', 'draft')).toBe('Saved')
        expect(f('unsaved', 'live-dirty')).toBe('Saved')
    })
})
