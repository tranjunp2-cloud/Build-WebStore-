/**
 * Unit Tests — Navigation variant schema + default seeding
 * TC-NAV-01, TC-NAV-02, TC-NAV-05
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F-navigation.md
 */

import { describe, it, expect } from 'vitest'
import { NavigationConfigSchema } from '@/blocks/navigation/config'
import { ensureNavigationBlocks, type PageShape } from '@/lib/ai/ensure-navigation'

const seoStub = { title: 'Test', description: 'Test page' }

const minimalNav = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'navigation',
    logoText: 'Brand',
    links: [{ label: 'Home', url: '/' }],
    ...overrides,
})

// ── TC-NAV-01: Schema accepts all 6 new names ────────────────────────────────

describe('TC-NAV-01 — NavigationConfigSchema accepts new variant names', () => {
    const NEW_VARIANTS = ['default', 'centered', 'mega', 'transparent', 'sidebar', 'floating'] as const

    it('parses each of the 6 canonical variant names without error', () => {
        for (const variant of NEW_VARIANTS) {
            // Arrange
            const input = minimalNav({ variant })

            // Act
            const result = NavigationConfigSchema.safeParse(input)

            // Assert
            expect(result.success, `variant '${variant}' should be valid`).toBe(true)
        }
    })

    it('defaults variant to "default" when field is absent', () => {
        // Arrange
        const input = minimalNav()

        // Act
        const result = NavigationConfigSchema.parse(input)

        // Assert
        expect(result.variant).toBe('default')
    })
})

// ── TC-NAV-02: Schema rejects old legacy names ───────────────────────────────

describe('TC-NAV-02 — NavigationConfigSchema rejects old legacy variant names', () => {
    const OLD_VARIANTS = ['simple', 'mega-menu', 'pill'] as const

    it('rejects each legacy variant name at the schema layer', () => {
        for (const variant of OLD_VARIANTS) {
            // Arrange
            const input = minimalNav({ variant })

            // Act
            const result = NavigationConfigSchema.safeParse(input)

            // Assert
            expect(result.success, `legacy variant '${variant}' should fail schema validation`).toBe(false)
        }
    })

    it('rejects arbitrary unknown variant strings', () => {
        // Arrange
        const input = minimalNav({ variant: 'nonexistent' })

        // Act
        const result = NavigationConfigSchema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
    })
})

// ── TC-NAV-05: buildDefaultNavigation seeds variant 'default' ────────────────

describe('TC-NAV-05 — ensureNavigationBlocks injects navigation with variant "default"', () => {
    it('adds a navigation block with variant "default" when no nav exists', () => {
        // Arrange
        const pages: PageShape[] = [
            {
                title: 'Home',
                slug: '/',
                isHomepage: true,
                layout: [{ blockType: 'hero', headline: 'Welcome' }],
                seo: seoStub,
            },
        ]

        // Act
        const result = ensureNavigationBlocks(pages, 'Acme Corp')

        // Assert
        const navBlock = result[0].layout.find(
            (b) => (b as Record<string, unknown>).blockType === 'navigation',
        ) as Record<string, unknown> | undefined

        expect(navBlock).toBeDefined()
        expect(navBlock?.variant).toBe('default')
    })

    it('preserves existing navigation block variant unchanged', () => {
        // Arrange
        const pages: PageShape[] = [
            {
                title: 'Home',
                slug: '/',
                isHomepage: true,
                layout: [
                    { blockType: 'navigation', variant: 'centered', links: [] },
                    { blockType: 'hero', headline: 'Welcome' },
                ],
                seo: seoStub,
            },
        ]

        // Act
        const result = ensureNavigationBlocks(pages, 'Acme Corp')

        // Assert
        const navBlock = result[0].layout.find(
            (b) => (b as Record<string, unknown>).blockType === 'navigation',
        ) as Record<string, unknown> | undefined

        expect(navBlock?.variant).toBe('centered')
    })
})
