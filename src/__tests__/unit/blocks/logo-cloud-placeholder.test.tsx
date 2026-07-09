/**
 * Unit Tests: Logo Cloud — Placeholder Monogram Rendering
 * TC-IDs: TC-F04.LC1, TC-F04.LC2, TC-F04.LC3
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F04-block-renderer.md
 * GH-1185: Monogram logic for logo-less brand tiles
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock next/image to avoid build errors in test env
vi.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        // Render a simple img tag for testing
        return <img {...props} />
    },
}))

// Import the components to test
// We test via LogoCloudBlock component to see both LogoPlaceholder and LogoImage in action
import { LogoCloudBlock } from '@/blocks/logo-cloud'
import type { LogoCloudConfig } from '@/blocks/logo-cloud/config'
import type { BlockProps } from '@/blocks/types'

// Helper to render LogoCloudBlock with minimal props
function renderLogoCloud(config: Partial<LogoCloudConfig>) {
    const defaultConfig: LogoCloudConfig = {
        blockType: 'logo-cloud',
        headline: 'Our Partners',
        logos: [],
        variant: 'row',
        ...config,
    }

    const blockProps: BlockProps<LogoCloudConfig> = {
        block: defaultConfig,
        theme: {},
    }

    return render(<LogoCloudBlock {...blockProps} />)
}

describe('TC-F04.LC1: monogram single-word names', () => {
    it('renders "Aeon" as "AE"', () => {
        // Arrange: single-word brand name
        renderLogoCloud({
            logos: [{ name: 'Aeon', logo: undefined }],
        })

        // Act: component renders LogoPlaceholder with the name
        // Assert: monogram displays "AE"
        expect(screen.getByText('AE')).toBeTruthy()
    })

    it('renders "Maxis" as "MA"', () => {
        renderLogoCloud({
            logos: [{ name: 'Maxis', logo: undefined }],
        })

        expect(screen.getByText('MA')).toBeTruthy()
    })

    it('renders single letter name as-is uppercased', () => {
        renderLogoCloud({
            logos: [{ name: 'X', logo: undefined }],
        })

        expect(screen.getByText('X')).toBeTruthy()
    })
})

describe('TC-F04.LC2: monogram multi-word names and edge cases', () => {
    it('renders "Bank Negara Malaysia" as "BNM" (≤3 words)', () => {
        renderLogoCloud({
            logos: [{ name: 'Bank Negara Malaysia', logo: undefined }],
        })

        expect(screen.getByText('BNM')).toBeTruthy()
    })

    it('renders 4+ word name with only first 3 initials', () => {
        renderLogoCloud({
            logos: [{ name: 'One Two Three Four Five', logo: undefined }],
        })

        expect(screen.getByText('OTT')).toBeTruthy()
    })

    it('renders empty name as "?"', () => {
        renderLogoCloud({
            logos: [{ name: '', logo: undefined }],
        })

        expect(screen.getByText('?')).toBeTruthy()
    })

    it('renders undefined name as "?"', () => {
        renderLogoCloud({
            logos: [{ name: undefined, logo: undefined }],
        })

        expect(screen.getByText('?')).toBeTruthy()
    })

    it('renders whitespace-only name as "?"', () => {
        renderLogoCloud({
            logos: [{ name: '   ', logo: undefined }],
        })

        expect(screen.getByText('?')).toBeTruthy()
    })
})

describe('TC-F04.LC3: real logo vs placeholder + data-image-index', () => {
    it('renders LogoImage when logo.url present', () => {
        // Arrange: logo with URL
        const { container } = renderLogoCloud({
            logos: [
                {
                    name: 'Aeon',
                    logo: {
                        url: 'https://example.com/aeon-logo.png',
                        alt: 'Aeon Logo',
                    },
                },
            ],
        })

        // Act: component renders real <Image> component (mocked as <img>)
        // Assert: img tag present with data-image-index
        const img = container.querySelector('img[data-image-index="0"]')
        expect(img).toBeTruthy()
        expect(img?.getAttribute('src')).toBe('https://example.com/aeon-logo.png')
    })

    it('preserves data-image-index on LogoImage', () => {
        const { container } = renderLogoCloud({
            logos: [
                {
                    name: 'Brand A',
                    logo: { url: 'https://example.com/logo.png', alt: 'Logo' },
                },
                {
                    name: 'Brand B',
                    logo: { url: 'https://example.com/logo2.png', alt: 'Logo 2' },
                },
            ],
        })

        // Both images should have data-image-index for editor replace
        expect(container.querySelector('img[data-image-index="0"]')).toBeTruthy()
        expect(container.querySelector('img[data-image-index="1"]')).toBeTruthy()
    })

    it('preserves data-image-index on LogoPlaceholder', () => {
        const { container } = renderLogoCloud({
            logos: [
                {
                    name: 'Aeon',
                    logo: undefined,
                },
            ],
        })

        // Placeholder should have data-image-index for editor replace
        const placeholder = container.querySelector('[data-image-index="0"]')
        expect(placeholder).toBeTruthy()
        expect(placeholder?.textContent).toBe('AE')
    })

    it('renders both LogoImage and LogoPlaceholder with correct indices in mixed layout', () => {
        const { container } = renderLogoCloud({
            logos: [
                {
                    name: 'Brand A',
                    logo: { url: 'https://example.com/logo-a.png', alt: 'A' },
                },
                {
                    name: 'Brand B',
                    logo: undefined, // placeholder
                },
                {
                    name: 'Brand C',
                    logo: { url: 'https://example.com/logo-c.png', alt: 'C' },
                },
            ],
        })

        // Image indices should be sequential across both types
        expect(container.querySelector('img[data-image-index="0"]')).toBeTruthy() // LogoImage
        expect(container.querySelector('[data-image-index="1"]')).toBeTruthy() // LogoPlaceholder (monogram)
        expect(container.querySelector('img[data-image-index="2"]')).toBeTruthy() // LogoImage
    })

    it('renders placeholder monogram when logo has empty/missing URL', () => {
        const { container } = renderLogoCloud({
            logos: [
                {
                    name: 'Maxis',
                    logo: { url: '', alt: 'Maxis' }, // empty URL
                },
            ],
        })

        // Should render placeholder with monogram, not image
        expect(screen.getByText('MA')).toBeTruthy()
        expect(container.querySelector('[data-image-index="0"]')).toBeTruthy()
    })
})

describe('TC-F04.LC1-LC3: integration with variant layouts', () => {
    it('renders grid variant with correct spacing', () => {
        const { container } = renderLogoCloud({
            variant: 'grid',
            logos: [
                { name: 'A', logo: undefined },
                { name: 'B', logo: undefined },
            ],
        })

        // Both placeholders should render
        expect(screen.getByText('A')).toBeTruthy()
        expect(screen.getByText('B')).toBeTruthy()

        // Grid variant uses different className for spacing
        const wrapper = container.querySelector('[class*="gap-6"]')
        expect(wrapper).toBeTruthy()
    })

    it('renders row variant with correct spacing', () => {
        const { container } = renderLogoCloud({
            variant: 'row',
            logos: [
                { name: 'X', logo: undefined },
                { name: 'Y', logo: undefined },
            ],
        })

        expect(screen.getByText('X')).toBeTruthy()
        expect(screen.getByText('Y')).toBeTruthy()

        // Row variant uses different gap
        const wrapper = container.querySelector('[class*="gap-5"]')
        expect(wrapper).toBeTruthy()
    })
})
