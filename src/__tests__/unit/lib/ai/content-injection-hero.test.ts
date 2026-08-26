/**
 * TC-F01-CI-HERO-01..03 — Phase 03 buildHero gap-fill wire.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/phase-03-wire-buildhero.md
 *
 * Confirms hero gap-fill delegates to template-composer buildHero when user
 * biz data is available, and falls back to the legacy path when it is not.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'
import * as composer from '@/lib/ai/template-composer'

describe('Phase 03 — hero gap-fill delegation', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('TC-F01-CI-HERO-01: delegates to composer when biz has data', () => {
        it('uses composer buildHero output for business with name + description', () => {
            const block = buildBlockFromLibrary('hero', 'health', {
                userBiz: {
                    name: 'Klinik Dr. Tan',
                    description: 'Your trusted family health partner in Petaling Jaya.',
                    products: ['Family Medicine', 'Vaccinations'],
                },
            })

            expect(block).toBeDefined()
            expect(block!.blockType).toBe('hero')
            // Composer buildHero emits `${name} — ${topProduct}` form.
            expect(block!.headline).toContain('Klinik Dr. Tan')
            expect(block!.ctaButtons).toBeDefined()
        })

        it('uses composer output for restaurant biz with only tagline', () => {
            const block = buildBlockFromLibrary('hero', 'restaurant', {
                userBiz: {
                    name: 'Warung Pak Ali',
                    tagline: 'Authentic Malaysian home cooking since 1985',
                },
            })

            expect(block).toBeDefined()
            expect(block!.headline).toContain('Warung Pak Ali')
        })
    })

    describe('TC-F01-CI-HERO-02: legacy fallback on composer failure', () => {
        it('falls back to legacy path when composer throws', () => {
            const spy = vi.spyOn(composer, 'buildHero').mockImplementation(() => {
                throw new Error('composer exploded')
            })

            const block = buildBlockFromLibrary('hero', 'beauty', {
                userBiz: { name: 'Bo Bo Spa', description: 'Wellness retreat in KL.' },
            })

            expect(spy).toHaveBeenCalled()
            expect(block).toBeDefined()
            expect(block!.blockType).toBe('hero')
            // Legacy path still produces a usable hero, never throws.
            expect(typeof block!.headline).toBe('string')
            expect((block!.headline as string).length).toBeGreaterThan(0)
        })

        it('still delegates when userBiz empty because library default fills mergedBiz', () => {
            // With empty userBiz, mergedBiz = library biz sample which has
            // name + description → delegation still fires. This is intended —
            // composer output is better than legacy even without user data.
            const spy = vi.spyOn(composer, 'buildHero')
            const block = buildBlockFromLibrary('hero', 'tech', { userBiz: {} })

            expect(spy).toHaveBeenCalled()
            expect(block).toBeDefined()
            expect(block!.blockType).toBe('hero')
        })
    })

    describe('TC-F01-CI-HERO-03: CTA labels resolved from mood/category', () => {
        it('adds ctaButtons primary + secondary', () => {
            const block = buildBlockFromLibrary('hero', 'health', {
                userBiz: { name: 'Klinik Dr. Lee', description: 'Family care in PJ.' },
            }) as { ctaButtons: Array<{ label: string; url: string; style: string }> }

            expect(block.ctaButtons).toHaveLength(2)
            expect(block.ctaButtons[0]!.style).toBe('primary')
            expect(block.ctaButtons[1]!.style).toBe('secondary')
            expect(block.ctaButtons[0]!.url).toBe('/contact')
            expect(block.ctaButtons[1]!.url).toBe('/about')
        })

        it('keeps both CTA buttons and resolves their labels from the target locale', () => {
            // Arrange
            const context = {
                language: 'zh-CN',
                userBiz: {
                    name: '智慧生活家居',
                    description: '提供节能又美观的智能家居产品。',
                },
            }

            // Act
            const block = buildBlockFromLibrary('hero', 'ecommerce', context) as {
                ctaButtons: Array<{ label: string }>
            }

            // Assert
            expect(block.ctaButtons).toHaveLength(2)
            expect(block.ctaButtons.map((cta) => cta.label)).toEqual(['开始', '关于我们'])
        })
    })
})
