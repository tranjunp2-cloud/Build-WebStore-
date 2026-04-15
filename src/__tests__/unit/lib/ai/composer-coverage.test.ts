/**
 * TC-F01-CC-01..03 — Phase 02 composer category coverage expansion.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/phase-02-expand-composer-coverage.md
 *
 * Confirms buildPricing/buildTeam/buildServiceCards return category-specific
 * (non-fallback) content for all 14 supported categories.
 */

import { describe, it, expect } from 'vitest'
import { buildPricing, buildTeam, buildServiceCards } from '@/lib/ai/template-composer'
import type { BusinessSample } from '@/lib/ai/template-composer'

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

// Fallback "Basic/Professional/Enterprise" plans from template-composer.ts:670-674.
// Any category whose output matches this set is falling through to the generic.
const FALLBACK_PLAN_NAMES = new Set(['Basic', 'Professional', 'Enterprise'])
const FALLBACK_TEAM_NAMES = new Set(['Founder', 'Operations Lead', 'Marketing Lead'])
// Default service-cards list is the `business` map, so treat `business` specially in that test.
const BUSINESS_SERVICE_TITLES = new Set(['Strategy Consulting', 'Market Entry', 'M&A Advisory'])

describe('Phase 02 — composer category coverage', () => {
    describe('TC-F01-CC-01: buildPricing covers 14/14 categories', () => {
        for (const cat of CATEGORIES) {
            it(`${cat} returns curated pricing (not Basic/Pro/Enterprise fallback)`, () => {
                const block = buildPricing(cat) as { plans: Array<{ name: string }> }
                expect(block.plans).toBeDefined()
                expect(block.plans.length).toBeGreaterThanOrEqual(3)
                const names = new Set(block.plans.map((p) => p.name))
                const isFallback = [...FALLBACK_PLAN_NAMES].every((n) => names.has(n))
                expect(isFallback, `${cat} fell through to default plans`).toBe(false)
            })
        }
    })

    describe('TC-F01-CC-02: buildTeam covers 14/14 categories', () => {
        for (const cat of CATEGORIES) {
            it(`${cat} returns curated team members (not Founder/Ops/Marketing fallback)`, () => {
                const block = buildTeam(cat) as { members: Array<{ name: string; role: string; bio: string }> }
                expect(block.members).toBeDefined()
                expect(block.members.length).toBeGreaterThanOrEqual(3)
                const names = new Set(block.members.map((m) => m.name))
                const isFallback = [...FALLBACK_TEAM_NAMES].every((n) => names.has(n))
                expect(isFallback, `${cat} fell through to default team`).toBe(false)
                for (const m of block.members) {
                    expect(m.name.length).toBeGreaterThan(0)
                    expect(m.role.length).toBeGreaterThan(0)
                    expect(m.bio.length).toBeGreaterThan(10)
                }
            })
        }
    })

    describe('TC-F01-CC-03: buildServiceCards covers 14/14 categories', () => {
        for (const cat of CATEGORIES) {
            it(`${cat} returns curated services`, () => {
                const block = buildServiceCards(stubBiz, cat) as {
                    services: Array<{ title: string; description: string }>
                }
                expect(block.services).toBeDefined()
                expect(block.services.length).toBeGreaterThanOrEqual(3)

                const titles = new Set(block.services.map((s) => s.title))
                if (cat !== 'business') {
                    // All non-business categories must have their own content,
                    // not the business fallback.
                    const isBusinessFallback = [...BUSINESS_SERVICE_TITLES].every((t) => titles.has(t))
                    expect(isBusinessFallback, `${cat} fell through to business fallback`).toBe(false)
                }
                for (const s of block.services) {
                    expect(s.title.length).toBeGreaterThan(0)
                    expect(s.description.length).toBeGreaterThan(10)
                }
            })
        }
    })
})
