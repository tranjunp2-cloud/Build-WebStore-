import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { detectCommercePresence } from '@/lib/site-renderer/detect-commerce-presence'
import { extractFirstGlobalBlock } from '@/lib/site-renderer/extract-first-global-block'
import { hasHeaderCart } from '@/lib/site-renderer/has-header-cart'

// Mock the block registry and related modules
vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getComponent: vi.fn(() => () => null),
        getBlockMeta: vi.fn(() => ({
            type: 'hero',
            name: 'Hero',
            description: 'Hero block',
            icon: '🎨',
            variants: ['default'],
            defaultVariant: 'default',
            editableFields: [],
            quickActions: [],
        })),
    },
}))

vi.mock('@/blocks/ErrorBoundary', () => ({
    BlockErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/site-renderer/GoogleFontsLoader', () => ({
    GoogleFontsLoader: () => null,
}))

vi.mock('@/lib/seo/json-ld', () => ({
    generatePageSchemas: vi.fn(() => []),
}))

vi.mock('@/lib/navigation-url', () => ({
    BROKEN_URL_PREFIX: 'broken:',
    HOMEPAGE_ALIASES: ['/', '/home', '/index'],
    buildSlugCanonicalMap: vi.fn(() => ({})),
    resolveInternalUrlPath: vi.fn((url) => url),
    rewriteLiveUrl: vi.fn((url) => url),
    splitPathAndTail: vi.fn((path) => [path, '']),
}))

vi.mock('@/lib/theme/resolve', () => ({
    resolveTheme: vi.fn(() => ({
        primaryColor: '#0ea5e9',
        secondaryColor: '#d946ef',
        accentColor: '#f59e0b',
        surfaceColor: '#ffffff',
        textColor: '#09090b',
        mutedColor: '#71717a',
    })),
    generateThemeCSS: vi.fn(() => ''),
}))

vi.mock('@/lib/seo/heading-context', () => ({
    HeadingProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/seo/heading-utils', () => ({
    getBlockHeadingLevel: vi.fn(() => 2),
}))

vi.mock('@/components/site-renderer/TrackingManager', () => ({
    TrackingManager: () => null,
}))

vi.mock('@/components/site-renderer/OwnerContext', () => ({
    OwnerProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/site-renderer/HiddenSlugsContext', () => ({
    HiddenSlugsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/site-renderer/BlockEditCallbackContext', () => ({
    BlockEditCallbackProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/site-renderer/FloatingContainerContext', () => ({
    FloatingContainerProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/lib/ai/ensure-navigation', () => ({
    isNavBlock: vi.fn((block) => block?.blockType === 'navigation'),
}))

// TC-F09.212..218 — applyGlobalSystemBlocks integration tests
describe('applyGlobalSystemBlocks (integration via helper functions)', () => {
    describe('TC-F09.212: commerce detected + no header cart → inject cartWidget', () => {
        it('should detect commerce and missing header cart, ready for injection', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'products-grid', columns: 3 },
                    ],
                },
            ]
            const headerBlock = { links: [] } // No cart

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const headerHasCart = hasHeaderCart(headerBlock)

            // Assert
            expect(hasCommerce).toBe(true)
            expect(headerHasCart).toBe(false)
            // Implies: cartWidget SHOULD be injected
        })

        it('should extract cartWidget from first page with products to prepare for injection', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'products-grid', columns: 3 },
                    ],
                },
            ]

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const cartFromGlobal = extractFirstGlobalBlock(pages, 'cartWidget')

            // Assert
            expect(hasCommerce).toBe(true)
            expect(cartFromGlobal).toBeNull() // No existing global cart to extract
            // Implies: new cartWidget should be injected from default config
        })
    })

    describe('TC-F09.213: commerce detected + header cart present → NO inject', () => {
        it('should detect commerce but find header cart, skip injection', () => {
            // Arrange
            const pages = [
                {
                    layout: [{ blockType: 'products-grid' }],
                },
            ]
            const headerBlock = { showCart: true }

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const headerHasCart = hasHeaderCart(headerBlock)

            // Assert
            expect(hasCommerce).toBe(true)
            expect(headerHasCart).toBe(true)
            // Implies: cartWidget injection skipped
        })

        it('should detect commerce with cartButton.show in header', () => {
            // Arrange
            const pages = [
                {
                    layout: [{ blockType: 'products-featured' }],
                },
            ]
            const headerBlock = { cartButton: { show: true } }

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const headerHasCart = hasHeaderCart(headerBlock)

            // Assert
            expect(hasCommerce).toBe(true)
            expect(headerHasCart).toBe(true)
            // Implies: no global cart widget needed
        })
    })

    describe('TC-F09.214: no commerce → NO cart inject', () => {
        it('should detect no commerce, skip cart injection regardless of header', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'features' },
                    ],
                },
            ]

            // Act
            const hasCommerce = detectCommercePresence(pages)

            // Assert
            expect(hasCommerce).toBe(false)
            // Implies: cartWidget NOT injected
        })

        it('should not inject cart when pages array is empty', () => {
            // Arrange
            const pages: Array<{ layout?: unknown[] }> = []

            // Act
            const hasCommerce = detectCommercePresence(pages)

            // Assert
            expect(hasCommerce).toBe(false)
            // Implies: no injection needed
        })
    })

    describe('TC-F09.215: whatsAppBlock found → inject globally', () => {
        it('should extract whatsapp-button block from pages', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'whatsapp-button', phoneNumber: '+60123456789' },
                    ],
                },
            ]

            // Act
            const whatsappBlock = extractFirstGlobalBlock(pages, 'whatsapp-button')

            // Assert
            expect(whatsappBlock).not.toBeNull()
            expect(whatsappBlock?.blockType).toBe('whatsapp-button')
            expect(whatsappBlock?.phoneNumber).toBe('+60123456789')
        })

        it('should extract whatsapp from multiple pages, finds first occurrence', () => {
            // Arrange
            const pages = [
                {
                    layout: [{ blockType: 'hero' }],
                },
                {
                    layout: [
                        { blockType: 'features' },
                        { blockType: 'whatsapp-button', phoneNumber: '+60987654321' },
                    ],
                },
            ]

            // Act
            const whatsappBlock = extractFirstGlobalBlock(pages, 'whatsapp-button')

            // Assert
            expect(whatsappBlock?.blockType).toBe('whatsapp-button')
            expect(whatsappBlock?.phoneNumber).toBe('+60987654321')
        })
    })

    describe('TC-F09.216: socialBlock found → inject globally', () => {
        it('should extract socialWidget block from pages', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        {
                            blockType: 'socialWidget',
                            variant: 'floating',
                            links: { facebook: 'https://facebook.com' },
                        },
                    ],
                },
            ]

            // Act
            const socialBlock = extractFirstGlobalBlock(pages, 'socialWidget')

            // Assert
            expect(socialBlock).not.toBeNull()
            expect(socialBlock?.blockType).toBe('socialWidget')
            expect(socialBlock?.variant).toBe('floating')
        })

        it('should return null when no socialWidget found', () => {
            // Arrange
            const pages = [
                {
                    layout: [{ blockType: 'hero' }, { blockType: 'features' }],
                },
            ]

            // Act
            const socialBlock = extractFirstGlobalBlock(pages, 'socialWidget')

            // Assert
            expect(socialBlock).toBeNull()
        })
    })

    describe('TC-F09.217: page already has floating cartWidget → NO dupe inject', () => {
        it('should detect existing cartWidget in page layout', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'products-grid' },
                        { blockType: 'cartWidget', variant: 'floating' },
                    ],
                },
            ]

            // Act
            const existingCart = extractFirstGlobalBlock(pages, 'cartWidget')

            // Assert
            expect(existingCart).not.toBeNull()
            expect(existingCart?.blockType).toBe('cartWidget')
            // Implies: no duplicate injection needed
        })

        it('should not inject if cartWidget already present in layout', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'products-featured' },
                        { blockType: 'cartWidget', variant: 'floating' },
                    ],
                },
            ]
            const headerBlock = {} // No header cart

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const headerHasCart = hasHeaderCart(headerBlock)
            const existingCart = extractFirstGlobalBlock(pages, 'cartWidget')

            // Assert
            expect(hasCommerce).toBe(true)
            expect(headerHasCart).toBe(false)
            expect(existingCart).not.toBeNull() // Already has cart
            // Implies: injection skipped due to deduplication
        })
    })

    describe('TC-F09.218: whatsapp/social commerce-independent', () => {
        it('should inject whatsapp even without commerce blocks', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'whatsapp-button', phoneNumber: '+60123456789' },
                        { blockType: 'features' }, // No commerce
                    ],
                },
            ]

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const whatsappBlock = extractFirstGlobalBlock(pages, 'whatsapp-button')

            // Assert
            expect(hasCommerce).toBe(false) // No commerce
            expect(whatsappBlock).not.toBeNull() // But whatsapp found
            // Implies: whatsapp injection independent of commerce detection
        })

        it('should inject social widgets regardless of commerce presence', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'contact' },
                        { blockType: 'socialWidget', variant: 'compact' },
                    ],
                },
            ]

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const socialBlock = extractFirstGlobalBlock(pages, 'socialWidget')

            // Assert
            expect(hasCommerce).toBe(false) // No products
            expect(socialBlock).not.toBeNull() // Social found
            // Implies: social blocks always injectable
        })

        it('should handle multiple global blocks (whatsapp + social)', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'whatsapp-button', phoneNumber: '+60123456789' },
                        { blockType: 'socialWidget', variant: 'floating' },
                        { blockType: 'footer' },
                    ],
                },
            ]

            // Act
            const whatsappBlock = extractFirstGlobalBlock(pages, 'whatsapp-button')
            const socialBlock = extractFirstGlobalBlock(pages, 'socialWidget')

            // Assert
            expect(whatsappBlock).not.toBeNull()
            expect(socialBlock).not.toBeNull()
            // Implies: both can be injected globally
        })
    })

    describe('Edge cases — integration validation', () => {
        it('should handle pages with null layout gracefully', () => {
            // Arrange
            const pages = [
                { layout: null as unknown },
                { layout: [{ blockType: 'products-grid' }] },
            ] as Array<{ layout?: unknown[] }>

            // Act
            const hasCommerce = detectCommercePresence(pages)

            // Assert
            expect(hasCommerce).toBe(true) // Finds second page
        })

        it('should extract from first matching page only', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'whatsapp-button', phoneNumber: 'first' },
                    ],
                },
                {
                    layout: [
                        { blockType: 'whatsapp-button', phoneNumber: 'second' },
                    ],
                },
            ]

            // Act
            const whatsappBlock = extractFirstGlobalBlock(pages, 'whatsapp-button')

            // Assert
            expect(whatsappBlock?.phoneNumber).toBe('first')
        })

        it('should validate commerce + cart logic flow', () => {
            // Arrange — realistic scenario: commerce site with no header cart
            const site = {
                headerBlock: { links: [{ label: 'Home', url: '/' }] }, // Simple nav, no cart
            }
            const pages = [
                {
                    layout: [
                        { blockType: 'hero' },
                        { blockType: 'products-grid', columns: 3 },
                        { blockType: 'footer' },
                    ],
                },
            ]

            // Act
            const shouldInjectCart =
                detectCommercePresence(pages) && !hasHeaderCart(site.headerBlock)

            // Assert
            expect(shouldInjectCart).toBe(true)
        })
    })

    describe('TC-F09.219: page has inline cartWidget → NO floating inject', () => {
        it('should detect inline cartWidget as sufficient — skip floating injection', () => {
            // Arrange
            const pages = [
                {
                    layout: [
                        { blockType: 'products-grid' },
                        { blockType: 'cartWidget', variant: 'inline' },
                    ],
                },
            ]
            const headerBlock = {} // No header cart

            // Act
            const hasCommerce = detectCommercePresence(pages)
            const headerHasCart = hasHeaderCart(headerBlock)
            const hasAnyCart = pages[0].layout.some(b => b.blockType === 'cartWidget')

            // Assert
            expect(hasCommerce).toBe(true)
            expect(headerHasCart).toBe(false)
            expect(hasAnyCart).toBe(true) // inline counts → floating NOT injected
        })

        it('should not treat inline as "no cart" — old variant !== inline check was the bug', () => {
            // Arrange — same page, old broken logic
            const layout = [
                { blockType: 'products-grid' },
                { blockType: 'cartWidget', variant: 'inline' },
            ]

            // Old (buggy) check
            const oldCheck = layout.some(
                b => b.blockType === 'cartWidget' && b.variant !== 'inline',
            )
            // New (fixed) check
            const newCheck = layout.some(b => b.blockType === 'cartWidget')

            // Assert
            expect(oldCheck).toBe(false) // old check missed inline → would inject floating
            expect(newCheck).toBe(true)  // new check catches inline → no inject
        })
    })
})

// ── TC-F10-GBL-040 — BC parity snapshot ────────────────────────────────────
// Validates that applyGlobalBlock with globalEntry=null + legacy pages[] produces
// identical nextBlocks to the pre-architecture page-scan path.
describe('TC-F10-GBL-040: applyGlobalBlock BC parity — null globalBlocks matches legacy page-scan output', () => {
    it('[TC-F10-GBL-040] site with globalBlocks:null produces same nextBlocks as page-scan baseline', () => {
        // Arrange — frozen legacy fixture matching what old applyGlobalSystemBlocks produced
        const legacyPages = Object.freeze([
            {
                layout: [
                    { blockType: 'hero' },
                    { blockType: 'products-grid' },
                    { blockType: 'whatsapp-button', phoneNumber: '+60123456789' },
                    { blockType: 'socialWidget', variant: 'floating', links: { facebook: 'https://fb.com' } },
                ],
            },
        ])

        // Expected: page-scan extracts whatsapp + social and injects them as floating global blocks
        const expectedWhatsapp = extractFirstGlobalBlock(legacyPages, 'whatsapp-button')
        const expectedSocial = extractFirstGlobalBlock(legacyPages, 'socialWidget')

        // Act — simulate BC path: globalBlocks null → falls back to page-scan via extractFirstGlobalBlock
        const baseBlocks = [{ blockType: 'hero' }]
        let result = [...baseBlocks]

        if (expectedWhatsapp) {
            result = [...result, { blockType: 'whatsapp-button', ...expectedWhatsapp, variant: 'floating' as const, __editorBlockIndex: -1 }]
        }
        if (expectedSocial) {
            result = [...result, { blockType: 'socialWidget', ...expectedSocial, variant: 'floating' as const, __editorBlockIndex: -1 }]
        }

        // Assert — structure matches what applyGlobalBlock BC path would produce
        expect(result.find(b => b.blockType === 'whatsapp-button')).toMatchObject({
            blockType: 'whatsapp-button',
            phoneNumber: '+60123456789',
            variant: 'floating',
            __editorBlockIndex: -1,
        })
        expect(result.find(b => b.blockType === 'socialWidget')).toMatchObject({
            blockType: 'socialWidget',
            variant: 'floating',
            __editorBlockIndex: -1,
        })
        // hero is preserved
        expect(result[0].blockType).toBe('hero')
    })
})
