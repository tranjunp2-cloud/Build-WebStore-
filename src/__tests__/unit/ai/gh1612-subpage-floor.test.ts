import { describe, it, expect } from 'vitest'
import { composeFallbackResult } from '@/lib/ai/fallback-adapter'
import { enforceSubpageStructure } from '@/lib/ai/structure-enforcer'
import type { BusinessInfoInput } from '@/lib/ai/system-prompt'

function buildMockBusinessInfo(category: string): BusinessInfoInput {
    return {
        businessName: `Test ${category} Business`,
        industry: category,
        products: 'Services, consultations, products',
        shortDescription: `A premium business providing professional services in the ${category} industry.`,
        phone: '+60 12-345 6789',
        email: 'info@testbusiness.com',
        address: '123 Test Street, KL',
    }
}

describe('GH-1612 subpage floor and thickness tests (AC-10 / AC-01 / AC-03)', () => {
    const CATEGORIES = ['restaurant', 'beauty', 'tech', 'health', 'education']
    const LANGUAGES = ['en', 'vi']

    // Test matrix: 5 categories x 2 languages
    for (const category of CATEGORIES) {
        for (const lang of LANGUAGES) {
            describe(`Category: ${category}, Lang: ${lang}`, () => {
                it('template-first: every subpage has >= 5 content sections', () => {
                    const info = buildMockBusinessInfo(category)
                    const result = composeFallbackResult(category, 42, lang, info)
                    
                    expect(result.pages).toBeDefined()
                    const pages = result.pages || []
                    
                    // Must have homepage and subpages
                    expect(pages.length).toBeGreaterThanOrEqual(2)
                    
                    for (const page of pages) {
                        if (page.isHomepage) {
                            continue
                        }
                        
                        const blocks = page.blocks || []
                        const contentBlocks = blocks.filter(
                            (b) => b.blockType !== 'navigation' && b.blockType !== 'footer'
                        )
                        
                        // AC-01 & AC-03: Every subpage has >= 5 content sections (no navigation + footer)
                        expect(contentBlocks.length).toBeGreaterThanOrEqual(5)
                    }
                })

                it('AI-first: enforceSubpageStructure pads slim pages to >= 5 content sections', () => {
                    // Start with an empty block list
                    const slimBlocks = [
                        { blockType: 'navigation' },
                        { blockType: 'footer' }
                    ]
                    
                    const enforced = enforceSubpageStructure(slimBlocks, category, { seed: 42 })
                    
                    const contentBlocks = enforced.filter(
                        (b) => b.blockType !== 'navigation' && b.blockType !== 'footer'
                    )
                    
                    // AC-01 & AC-03: Every subpage has >= 5 content sections after enforcer
                    expect(contentBlocks.length).toBeGreaterThanOrEqual(5)
                })
            })
        }
    }
})
