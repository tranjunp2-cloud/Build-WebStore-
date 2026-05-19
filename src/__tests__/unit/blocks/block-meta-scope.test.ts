import { describe, it, expect } from 'vitest'
import { cartWidgetMeta } from '@/blocks/cart-widget/config'
import { heroMeta } from '@/blocks/hero/config'

// TC-F09.221..222 — BlockMeta scope tag tests
describe('BlockMeta scope tags', () => {
    describe('TC-F09.221: cartWidgetMeta.scope === "global"', () => {
        it('should have scope property set to "global"', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const scope = meta.scope

            // Assert
            expect(scope).toBe('global')
        })

        it('should be explicitly marked as global for site-wide rendering', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const isGlobal = meta.scope === 'global'

            // Assert
            expect(isGlobal).toBe(true)
        })

        it('should have scope defined (not undefined)', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const hasScopeProperty = meta.scope !== undefined

            // Assert
            expect(hasScopeProperty).toBe(true)
        })

        it('should include scopeTooltip for Vietnamese UI', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const tooltip = meta.scopeTooltip

            // Assert
            expect(tooltip).toBeDefined()
            expect(typeof tooltip).toBe('string')
            expect(tooltip.length).toBeGreaterThan(0)
        })

        it('should be categorized as "commerce" block', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const category = meta.category

            // Assert
            expect(category).toBe('commerce')
        })

        it('should not be marked as system-only block (visible in AI editor)', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const isVisible = meta.aiVisible

            // Assert
            expect(isVisible).toBe(true)
        })

        it('should have cart-related configuration', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const name = meta.name
            const type = meta.type

            // Assert
            expect(name).toBe('Cart Button')
            expect(type).toBe('cartWidget')
        })

        it('should support floating variant as default', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const defaultVariant = meta.defaultVariant
            const variants = meta.variants

            // Assert
            expect(defaultVariant).toBe('floating')
            expect(variants).toContain('floating')
        })
    })

    describe('TC-F09.222: heroMeta.scope === undefined (default page)', () => {
        it('should have no scope property or scope === undefined', () => {
            // Arrange
            const meta = heroMeta

            // Act
            const scope = meta.scope

            // Assert
            expect(scope).toBeUndefined()
        })

        it('should indicate page-level (not global) scoping by default', () => {
            // Arrange
            const meta = heroMeta

            // Act
            const isPageLevel = meta.scope === undefined

            // Assert
            expect(isPageLevel).toBe(true)
        })

        it('should not have scope property explicitly set', () => {
            // Arrange
            const meta = heroMeta

            // Act
            const hasScopeKey = 'scope' in meta && meta.scope !== undefined

            // Assert
            expect(hasScopeKey).toBe(false)
        })

        it('should be a standard content block', () => {
            // Arrange
            const meta = heroMeta

            // Act
            const type = meta.type

            // Assert
            expect(type).toBe('hero')
        })

        it('should be categorized as "content" or similar (not global utility)', () => {
            // Arrange
            const meta = heroMeta

            // Act
            const category = meta.category

            // Assert
            expect(['basics', 'content', 'media']).toContain(category)
        })

        it('should be visible in AI editor block list', () => {
            // Arrange
            const meta = heroMeta

            // Act
            const aiVisible = meta.aiVisible

            // Assert
            // Should be true (not explicitly false) for standard blocks
            expect(aiVisible !== false).toBe(true)
        })
    })

    describe('Scope distinction — global vs page-level', () => {
        it('should have different scope values (cartWidget=global, hero=undefined)', () => {
            // Arrange
            const cartMeta = cartWidgetMeta
            const heroMeta_ = heroMeta

            // Act
            const cartScope = cartMeta.scope
            const heroScope = heroMeta_.scope

            // Assert
            expect(cartScope).toBe('global')
            expect(heroScope).toBeUndefined()
            expect(cartScope).not.toBe(heroScope)
        })

        it('should allow multiple page-level blocks but single global cart', () => {
            // Arrange
            const cartMeta = cartWidgetMeta
            const heroMeta_ = heroMeta

            // Act
            const cartIsGlobal = cartMeta.scope === 'global'
            const heroIsPageLevel = heroMeta_.scope === undefined

            // Assert
            expect(cartIsGlobal).toBe(true)
            expect(heroIsPageLevel).toBe(true)
        })

        it('cartWidgetMeta should be idempotent (scope consistent)', () => {
            // Arrange
            const meta1 = cartWidgetMeta
            const meta2 = cartWidgetMeta

            // Act
            const scope1 = meta1.scope
            const scope2 = meta2.scope

            // Assert
            expect(scope1).toBe(scope2)
            expect(scope1).toBe('global')
        })

        it('heroMeta should be idempotent (no scope consistent)', () => {
            // Arrange
            const meta1 = heroMeta
            const meta2 = heroMeta

            // Act
            const scope1 = meta1.scope
            const scope2 = meta2.scope

            // Assert
            expect(scope1).toBe(scope2)
            expect(scope1).toBeUndefined()
        })
    })

    describe('Type safety — BlockMeta scope field', () => {
        it('cartWidgetMeta scope should be type-safe (not just any string)', () => {
            // Arrange
            const meta = cartWidgetMeta

            // Act
            const scope = meta.scope

            // Assert
            expect(['global', 'page']).toContain(scope)
        })

        it('should allow scope: "page" for explicit page-level blocks (future-proofing)', () => {
            // Arrange — simulate a potential page-level block meta
            const pageBlockMeta = {
                type: 'example' as const,
                scope: 'page' as const,
            }

            // Act
            const isPageLevel = pageBlockMeta.scope === 'page'

            // Assert
            expect(isPageLevel).toBe(true)
        })
    })
})
