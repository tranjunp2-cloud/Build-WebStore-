/**
 * Smoke Test: Template System v2 — Compose & Validate All Templates
 *
 * TC-Q-050 → TC-Q-054 (from docs/qa/F30-template-quality-gaps.md)
 *
 * For each of 48 template definitions:
 *   1. composeTemplate() runs without errors
 *   2. All block types in output exist in block registry
 *   3. Theme resolves without errors
 *   4. Page count matches tier (starter=1, professional=3, premium=5)
 */

import { describe, it, expect } from 'vitest'
import { composeTemplate } from '@/lib/ai/template-composer'
import { TEMPLATE_DEFINITIONS } from '@/lib/ai/template-definitions'
import { blockRegistry } from '@/blocks/registry'
import { resolveTheme } from '@/lib/theme/resolve'

const TIER_PAGE_COUNT: Record<string, number> = {
    starter: 1,
    professional: 3,
    premium: 5,
}

const CATEGORIES = [
    'restaurant', 'ecommerce', 'beauty', 'tech', 'health',
    'education', 'realestate', 'fitness', 'creative', 'business', 'fnb',
]

describe('Template Smoke Test [TC-Q-050]', () => {

    it('has 48 template definitions', () => {
        expect(TEMPLATE_DEFINITIONS.length).toBe(48)
    })

    it('covers all 11 categories', () => {
        const categories = new Set(TEMPLATE_DEFINITIONS.map(d => d.category))
        for (const cat of CATEGORIES) {
            expect(categories.has(cat)).toBe(true)
        }
    })

    describe('compose all templates', () => {
        for (const [index, def] of TEMPLATE_DEFINITIONS.entries()) {
            const label = `[${index + 1}/48] ${def.category} ${def.variant} (business ${def.businessIndex})`

            it(`${label} — composes without error`, () => {
                const seed = composeTemplate(def)
                expect(seed).toBeDefined()
                expect(seed.name).toBeTruthy()
                expect(seed.category).toBe(def.category)
                expect(seed.pages.length).toBeGreaterThan(0)
            })

            it(`${label} — page count matches tier`, () => {
                const seed = composeTemplate(def)
                const expectedPages = TIER_PAGE_COUNT[def.variant] ?? 1
                expect(seed.pages.length).toBe(expectedPages)
            })

            it(`${label} — all blocks exist in registry`, () => {
                const seed = composeTemplate(def)
                const missingBlocks: string[] = []

                for (const page of seed.pages) {
                    for (const block of page.layout) {
                        const blockType = (block as Record<string, unknown>).blockType as string
                        if (blockType && !blockRegistry.has(blockType)) {
                            missingBlocks.push(blockType)
                        }
                    }
                }

                expect(missingBlocks).toEqual([])
            })

            it(`${label} — theme resolves without error`, () => {
                const seed = composeTemplate(def)
                const theme = resolveTheme(seed.theme as Record<string, unknown>)
                expect(theme).toBeDefined()
                expect(theme.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
                expect(theme.fontHeading).toBeTruthy()
                expect(theme.fontBody).toBeTruthy()
            })
        }
    })

    describe('category coverage', () => {
        for (const category of CATEGORIES) {
            it(`${category} has at least 3 templates`, () => {
                const count = TEMPLATE_DEFINITIONS.filter(d => d.category === category).length
                expect(count).toBeGreaterThanOrEqual(3)
            })

            it(`${category} has at least 1 starter template`, () => {
                const starters = TEMPLATE_DEFINITIONS.filter(d => d.category === category && d.variant === 'starter')
                expect(starters.length).toBeGreaterThanOrEqual(1)
            })
        }
    })
})
