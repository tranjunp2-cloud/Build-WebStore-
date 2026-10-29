/**
 * TC-F01-CC-01..03 — composer category coverage (updated for #2103 A1: grounded content).
 *
 * buildPricing / buildTeam / buildServiceCards must work for all 14 categories WITHOUT inventing
 * tiers, staff, credentials or prices: pricing comes from the merchant's priced products, the team is
 * the brand itself, and category service cards carry no canned prices or claims.
 */

import { describe, it, expect } from 'vitest'
import { buildPricing, buildTeam, buildServiceCards } from '@/lib/ai/template-composer'
import type { BusinessSample } from '@/lib/ai/template-composer'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'

const CATEGORIES = [
    'beauty', 'blog', 'business', 'creative', 'ecommerce', 'education',
    'events', 'fitness', 'fnb', 'health', 'realestate', 'restaurant',
    'tech', 'travel',
] as const

const stubBiz: BusinessSample = {
    name: 'Test Biz',
    tagline: 'Test tagline',
    description: 'Test description for coverage spec.',
    email: 'hi@test.my',
    phone: '+60 3-1234 5678',
    address: '1 Jalan Test, 50000 KL',
    heroHeadline: 'Welcome',
    heroSubheadline: 'Sub',
    products: [],
}

const pricedFacts = buildGenerationFacts({
    businessInfo: { businessName: 'Test Biz', products: 'Kek lapis RM65, Kuih box RM48' },
})

describe('composer category coverage (#2103 grounded)', () => {
    describe('TC-F01-CC-01: buildPricing never invents tiers', () => {
        for (const cat of CATEGORIES) {
            it(`${cat}: no merchant prices → no plans; merchant prices → their own products`, () => {
                expect((buildPricing(stubBiz) as { plans: unknown[] }).plans).toEqual([])
                const plans = (buildPricing({ ...stubBiz, facts: pricedFacts }) as {
                    plans: Array<{ name: string; price: string }>
                }).plans
                expect(plans.map((p) => p.name)).toEqual(['Kek lapis', 'Kuih box'])
                expect(plans.map((p) => p.price)).toEqual(['RM 65', 'RM 48'])
                void cat
            })
        }
    })

    describe('TC-F01-CC-02: buildTeam never invents people', () => {
        it('returns only the brand team card (no names, credentials or bios)', () => {
            const block = buildTeam(stubBiz) as { members: Array<{ name: string; role: string; bio?: string }> }
            expect(block.members).toEqual([{ name: 'The Test Biz team', role: 'Founder' }])
        })
        it('localizes the card for ms', () => {
            const block = buildTeam(stubBiz, 'ms') as { members: Array<{ name: string }> }
            expect(block.members[0]!.name).toBe('Pasukan Test Biz')
        })
    })

    describe('TC-F01-CC-03: buildServiceCards covers 14/14 categories without prices or claims', () => {
        for (const cat of CATEGORIES) {
            it(`${cat} returns category service names with a neutral blurb`, () => {
                const block = buildServiceCards(stubBiz, cat) as {
                    services: Array<{ title: string; description: string; price?: string; priceUnit?: string }>
                }
                expect(block.services.length).toBeGreaterThanOrEqual(3)
                for (const s of block.services) {
                    expect(s.title.length).toBeGreaterThan(0)
                    expect(s.description).toBe('Ask Test Biz for details.')
                    expect(s.price).toBeUndefined()
                    expect(s.priceUnit).toBeUndefined()
                }
            })
        }
    })
})
