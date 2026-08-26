/**
 * Unit Tests: LogoCloudBlock — per-tile MediaUploadOverlay wrapper (GH-1461 rework)
 * TC-IDs: TC-GH1461-LC-01
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F04-block-renderer.md §7
 *
 * MediaUploadOverlay tracks hover on its parentElement. If the logo tiles share
 * one parent (the flex row), hovering a single logo lights up the overlay on
 * every tile — so each tile must live in its own dedicated wrapper element.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

// ── Mocks (top-level, before imports) ──────────────────────────────────────
vi.mock('@/blocks/shared/animations', () => ({
    AnimatedSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

vi.mock('@/blocks/shared/media-upload-overlay', () => ({
    MediaUploadOverlay: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="media-upload-overlay">{children}</div>
    ),
}))

// ── Imports (after mocks) ──────────────────────────────────────────────────
import { LogoCloudBlock } from '@/blocks/logo-cloud'
import type { LogoCloudConfig } from '@/blocks/logo-cloud/config'
import type { BlockProps } from '@/blocks/types'

const block = {
    blockType: 'logo-cloud',
    variant: 'row',
    headline: 'Trusted by',
    // no logo.url → placeholder path, keeps next/image out of the test
    logos: [{ name: 'Acme' }, { name: 'Globex' }, { name: 'Initech' }],
} as unknown as BlockProps<LogoCloudConfig>['block']

const theme = {} as BlockProps<LogoCloudConfig>['theme']

describe('[TC-GH1461-LC] LogoCloudBlock — per-tile overlay wrapper', () => {
    it('TC-GH1461-LC-01: each MediaUploadOverlay gets its own wrapper (hover stays per-tile)', () => {
        // Act
        render(<LogoCloudBlock block={block} theme={theme} />)

        // Assert — one overlay per logo
        const overlays = screen.getAllByTestId('media-upload-overlay')
        expect(overlays).toHaveLength(3)

        // Each overlay's parentElement is a dedicated wrapper holding exactly
        // one overlay — the invariant MediaUploadOverlay's hover tracking needs.
        const parents = overlays.map((o) => o.parentElement as HTMLElement)
        parents.forEach((parent) => {
            expect(within(parent).getAllByTestId('media-upload-overlay')).toHaveLength(1)
        })

        // And the wrappers are pairwise distinct elements (not one shared row)
        expect(new Set(parents).size).toBe(3)
    })
})
