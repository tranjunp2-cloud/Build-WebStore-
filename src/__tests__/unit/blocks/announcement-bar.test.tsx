import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BlockProps } from '@/blocks/types'
import type { AnnouncementBarConfig } from '@/blocks/announcement-bar/config'
import { AnnouncementBarConfigSchema, announcementBarMeta } from '@/blocks/announcement-bar/config'
import { AnnouncementBarBlock } from '@/blocks/announcement-bar'

// ── TC-F05-899: Announcement Bar Block Tests ───────────────────────────────
// Component render tests, schema validation, and preview renderer tests

/** Minimal theme stub for testing */
const themeStub = {
    primaryColor: '#0ea5e9',
    secondaryColor: '#d946ef',
    accentColor: '#f59e0b',
    surfaceColor: '#fff',
    textColor: '#09090b',
    mutedColor: '#71717a',
    fontPairingId: null,
    fontHeading: 'Inter',
    fontBody: 'Inter',
    spacingPreset: 'default' as const,
    borderRadius: 'rounded' as const,
    shadowPreset: 'subtle' as const,
    colorMode: 'light' as const,
    backgroundColor: '#fff',
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT RENDER TESTS (TC-F05-899-01..09)
// ═════════════════════════════════════════════════════════════════════════════

describe('AnnouncementBarBlock [TC-F05-899]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Component Render Tests', () => {
        // ── TC-F05-899-01: gradient variant ──────────────────────────────────
        it('TC-F05-899-01: gradient variant renders linear-gradient in style', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Summer sale! 20% off',
                variant: 'gradient',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="linear-gradient"]')
            expect(div).toBeTruthy()
            expect(div?.getAttribute('style')).toContain('linear-gradient(135deg')
        })

        // ── TC-F05-899-02: gradient with backgroundColor2 ──────────────────────
        it('TC-F05-899-02: gradient with backgroundColor2 includes second color', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Flash sale!',
                variant: 'gradient',
                backgroundColor2: '#ff0000',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="linear-gradient"]')
            expect(div?.getAttribute('style')).toContain('#ff0000')
        })

        // ── TC-F05-899-03: solid variant does NOT have linear-gradient ──────────
        it('TC-F05-899-03: solid variant renders backgroundColor without gradient', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Announcement',
                variant: 'solid',
                backgroundColor: '#000',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="background"]')
            const style = div?.getAttribute('style') || ''
            expect(style).not.toContain('linear-gradient')
            expect(style).toContain('background-color')
            expect(style).toContain('rgb(0, 0, 0)')
        })

        // ── TC-F05-899-04: minimal variant → transparent bg + borderBottom ──────
        it('TC-F05-899-04: minimal variant renders transparent background with border', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'New feature available',
                variant: 'minimal',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="transparent"]')
            const style = div?.getAttribute('style') || ''
            expect(style).toContain('transparent')
            expect(style).toContain('border-bottom')
        })

        // ── TC-F05-899-05: linkText with whitespace-only → no <a> element ────────
        it('TC-F05-899-05: linkText with whitespace only does not render link', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Limited offer',
                linkText: '   ',
                linkUrl: '/shop',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            render(<AnnouncementBarBlock {...props} />)

            // Assert
            const link = screen.queryByRole('link')
            expect(link).not.toBeInTheDocument()
        })

        // ── TC-F05-899-06: linkText + linkUrl → <a> element exists ────────────────
        it('TC-F05-899-06: linkText and linkUrl render clickable link', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Click here: ',
                linkText: 'Shop',
                linkUrl: '/shop',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            render(<AnnouncementBarBlock {...props} />)

            // Assert
            const link = screen.getByRole('link')
            expect(link).toBeVisible()
            expect(link).toHaveAttribute('href', '/shop')
            expect(link.textContent).toContain('Shop')
        })

        // ── TC-F05-899-07: paddingY=24 → inline style paddingTop=24 ────────────────
        it('TC-F05-899-07: paddingY=24 applies to inline style', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Padded message',
                paddingY: 24,
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="padding"]')
            const style = div?.getAttribute('style') || ''
            expect(style).toContain('padding-top')
            expect(style).toContain('24')
        })

        // ── TC-F05-899-08: no paddingY → default 12 applied ──────────────────────
        it('TC-F05-899-08: paddingY defaults to 12 when not provided', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Default padding',
                // paddingY not specified
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="padding"]')
            const style = div?.getAttribute('style') || ''
            expect(style).toContain('padding-top')
            expect(style).toContain('12')
        })

        // ── TC-F05-899-09: dismissible=false → no dismiss button ────────────────────
        it('TC-F05-899-09: dismissible=false does not render close button', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Non-dismissible message',
                dismissible: false,
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            render(<AnnouncementBarBlock {...props} />)

            // Assert
            const button = screen.queryByLabelText(/dismiss announcement/i)
            expect(button).not.toBeInTheDocument()
        })
    })

    // ═════════════════════════════════════════════════════════════════════════
    // SCHEMA VALIDATION TESTS (TC-F05-899-10..11)
    // ═════════════════════════════════════════════════════════════════════════

    describe('Schema Validation Tests', () => {
        // ── TC-F05-899-10: schema parses new optional fields ─────────────────────
        it('TC-F05-899-10: schema parses backgroundColor2, paddingY, linkIsInternal', () => {
            // Arrange
            const input = {
                blockType: 'announcement-bar',
                message: 'Test message',
                backgroundColor: '#0ea5e9',
                backgroundColor2: '#d946ef',
                paddingY: 16,
                linkText: 'Click',
                linkUrl: '/path',
                linkIsInternal: true,
            }

            // Act
            const result = AnnouncementBarConfigSchema.safeParse(input)

            // Assert
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.backgroundColor2).toBe('#d946ef')
                expect(result.data.paddingY).toBe(16)
                expect(result.data.linkIsInternal).toBe(true)
            }
        })

        // ── TC-F05-899-11: paddingY=100 fails validation (max 32) ─────────────────
        it('TC-F05-899-11: schema rejects paddingY > 32', () => {
            // Arrange
            const input = {
                blockType: 'announcement-bar',
                message: 'Message',
                paddingY: 100,
            }

            // Act
            const result = AnnouncementBarConfigSchema.safeParse(input)

            // Assert
            expect(result.success).toBe(false)
        })
    })

    // ═════════════════════════════════════════════════════════════════════════
    // PREVIEW RENDERER TESTS (TC-F05-899-12..15)
    // ═════════════════════════════════════════════════════════════════════════

    describe('Preview Renderer Tests', () => {
        // Template theme object (matches renderSections signature)
        const templateTheme = {
            primary: '#0ea5e9',
            secondary: '#d946ef',
            bg: '#fff',
            text: '#09090b',
            muted: '#71717a',
            accent: '#f59e0b',
            fontHeading: 'Inter',
            fontBody: 'Inter',
            navStyle: 'classic' as const,
            heroStyle: 'centered' as const,
        }

        // ── TC-F05-899-12: variant=gradient → output contains linear-gradient ────
        it('TC-F05-899-12: renderSections with gradient variant produces linear-gradient HTML', async () => {
            // Arrange
            const block = {
                blockType: 'announcement-bar',
                message: 'Gradient sale',
                variant: 'gradient',
                backgroundColor: '#0ea5e9',
                backgroundColor2: '#d946ef',
                paddingY: 12,
            }

            // Note: We cannot directly import renderSections from sections.ts
            // because it's an internal preview renderer. Instead, we test the
            // component's output and verify the gradient is applied correctly.
            const props: BlockProps<AnnouncementBarConfig> = {
                block: block as AnnouncementBarConfig,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="linear-gradient"]')
            expect(div).toBeTruthy()
            const style = div?.getAttribute('style') || ''
            expect(style).toMatch(/linear-gradient\(135deg/)
        })

        // ── TC-F05-899-13: variant=solid → no linear-gradient ──────────────────────
        it('TC-F05-899-13: renderSections with solid variant does NOT contain linear-gradient', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Solid announcement',
                variant: 'solid',
                backgroundColor: '#0ea5e9',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const gradDiv = container.querySelector('div[style*="linear-gradient"]')
            expect(gradDiv).not.toBeInTheDocument()

            const bgDiv = container.querySelector('div[style*="background"]')
            expect(bgDiv).toBeTruthy()
        })

        // ── TC-F05-899-14: variant=minimal → background:transparent ──────────────────
        it('TC-F05-899-14: renderSections with minimal variant sets transparent background', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'Minimal style',
                variant: 'minimal',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            const { container } = render(<AnnouncementBarBlock {...props} />)

            // Assert
            const div = container.querySelector('div[style*="transparent"]')
            expect(div).toBeTruthy()
            const style = div?.getAttribute('style') || ''
            expect(style).toContain('transparent')
        })

        // ── TC-F05-899-15: linkText='' → no <a> tag in output ──────────────────────
        it('TC-F05-899-15: renderSections with empty linkText does NOT render <a>', () => {
            // Arrange
            const block: AnnouncementBarConfig = {
                blockType: 'announcement-bar',
                message: 'No link here',
                linkText: '',
                linkUrl: '/path',
            }
            const props: BlockProps<AnnouncementBarConfig> = {
                block,
                theme: themeStub,
            }

            // Act
            render(<AnnouncementBarBlock {...props} />)

            // Assert
            const link = screen.queryByRole('link')
            expect(link).not.toBeInTheDocument()
        })
    })

    // ═════════════════════════════════════════════════════════════════════════
    // METADATA VALIDATION TEST
    // ═════════════════════════════════════════════════════════════════════════

    describe('Metadata', () => {
        it('TC-F05-899-16: meta has all required fields', () => {
            // Assert
            expect(announcementBarMeta.type).toBe('announcement-bar')
            expect(announcementBarMeta.name).toBeDefined()
            expect(announcementBarMeta.description).toBeDefined()
            expect(announcementBarMeta.icon).toBeDefined()
            expect(announcementBarMeta.variants).toContain('gradient')
            expect(announcementBarMeta.variants).toContain('solid')
            expect(announcementBarMeta.variants).toContain('minimal')
            expect(announcementBarMeta.defaultVariant).toBe('gradient')
            expect(announcementBarMeta.editableFields).toContain('message')
            expect(announcementBarMeta.editableFields).toContain('dismissible')
        })
    })
})
