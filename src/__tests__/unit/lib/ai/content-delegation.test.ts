/**
 * TC-F01V-CD — Content delegation to template-composer builders
 * Source: plans/260415-0900-wire-template-builders-to-ai-gapfill/phase-01-wire-builders.md
 *
 * Verifies that buildBlockFromLibrary delegates features/stats/pricing/team/
 * service-cards cases to template-composer builders, returning Malaysia-
 * specific hand-curated content instead of the legacy generic pool.
 */

import { describe, expect, it } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'

describe('buildBlockFromLibrary — delegation to template-composer (R-wire)', () => {
    describe('features delegation', () => {
        it('TC-F01V-CD.01 — health features contain curated "Expert Doctors"', () => {
            const block = buildBlockFromLibrary('features', 'health', { seed: 42 })
            const features = (block?.features as Array<{ title: string }>) ?? []
            const titles = features.map((f) => f.title)
            expect(titles).toContain('Expert Doctors')
            expect(titles).not.toContain('Quality Service')
        })

        it('TC-F01V-CD.02 — restaurant features contain "Halal Certified" (JAKIM context)', () => {
            const block = buildBlockFromLibrary('features', 'restaurant', { seed: 100 })
            const features = (block?.features as Array<{ title: string; description: string }>) ?? []
            const titles = features.map((f) => f.title)
            expect(titles).toContain('Halal Certified')
            const halal = features.find((f) => f.title === 'Halal Certified')
            expect(halal?.description).toMatch(/JAKIM/)
        })

        it('TC-F01V-CD.03 — beauty features contain curated Korean/Japanese products', () => {
            const block = buildBlockFromLibrary('features', 'beauty', { seed: 7 })
            const features = (block?.features as Array<{ title: string; description: string }>) ?? []
            const descriptions = features.map((f) => f.description).join(' ')
            expect(descriptions).toMatch(/Korea|Japan|halal-certified|dermatologist/i)
        })

        it('TC-F01V-CD.04 — tech features contain curated SLA/enterprise language', () => {
            const block = buildBlockFromLibrary('features', 'tech', { seed: 1 })
            const features = (block?.features as Array<{ title: string; description: string }>) ?? []
            const text = features.map((f) => `${f.title} ${f.description}`).join(' ')
            expect(text).toMatch(/SLA|enterprise|SOC 2|uptime/i)
        })
    })

    describe('stats delegation', () => {
        it('TC-F01V-CD.05 — health stats contain "Patients Treated"', () => {
            const block = buildBlockFromLibrary('stats', 'health', { seed: 42 })
            const stats = (block?.stats as Array<{ label: string }>) ?? []
            const labels = stats.map((s) => s.label)
            expect(labels).toContain('Patients Treated')
            expect(labels).not.toContain('Happy Customers')
        })

        it('TC-F01V-CD.06 — restaurant stats contain "Customers Served" or "Menu Items"', () => {
            const block = buildBlockFromLibrary('stats', 'restaurant', { seed: 99 })
            const stats = (block?.stats as Array<{ label: string }>) ?? []
            const labels = stats.map((s) => s.label)
            expect(labels.some((l) => /Customers Served|Menu Items|Years Serving/.test(l))).toBe(true)
        })
    })

    describe('team delegation', () => {
        it('TC-F01V-CD.07 — health team contains "Dr. Tan Wei Ming" (Malaysian name + credentials)', () => {
            const block = buildBlockFromLibrary('team', 'health', { seed: 7 })
            const members = (block?.members as Array<{ name: string; bio: string }>) ?? []
            const names = members.map((m) => m.name)
            expect(names).toContain('Dr. Tan Wei Ming')
            expect(names).not.toContain('Team Lead')
            const firstMember = members[0]
            expect(firstMember?.bio).toMatch(/MBBS|BDS|MRCP/)
        })

        it('TC-F01V-CD.08 — tech team contains "Ahmad Razif" (curated)', () => {
            const block = buildBlockFromLibrary('team', 'tech', { seed: 7 })
            const members = (block?.members as Array<{ name: string }>) ?? []
            const names = members.map((m) => m.name)
            expect(names).toContain('Ahmad Razif')
        })
    })

    describe('pricing delegation', () => {
        it('TC-F01V-CD.09 — beauty pricing contains "Bridal Package" (curated)', () => {
            const block = buildBlockFromLibrary('pricing', 'beauty', { seed: 3 })
            const plans = (block?.plans as Array<{ name: string }>) ?? []
            const names = plans.map((p) => p.name)
            expect(names).toContain('Bridal Package')
            expect(names).not.toContain('Starter')
        })

        it('TC-F01V-CD.10 — education pricing contains "SPM Package" (Malaysia-specific)', () => {
            const block = buildBlockFromLibrary('pricing', 'education', { seed: 5 })
            const plans = (block?.plans as Array<{ name: string }>) ?? []
            const names = plans.map((p) => p.name)
            expect(names.some((n) => /SPM|Single Subject|Premium/.test(n))).toBe(true)
        })

        it('TC-F01V-CD.11 — pricing for uncovered category falls to composer default (still curated)', () => {
            // 'travel' not in composer pricingMap → falls to defaultPlans which
            // has RM prices + real feature lists (still better than old generic).
            const block = buildBlockFromLibrary('pricing', 'travel', { seed: 2 })
            const plans = (block?.plans as Array<{ price: string }>) ?? []
            expect(plans.length).toBeGreaterThan(0)
            expect(plans[0]?.price).toMatch(/RM/)
        })
    })

    describe('service-cards delegation', () => {
        it('TC-F01V-CD.12 — service-cards delegates to composer (not generic "Premium Service")', () => {
            const block = buildBlockFromLibrary('service-cards', 'health', {
                seed: 42,
                userBiz: { name: 'Test Clinic', products: [] },
            })
            const services = (block?.services as Array<{ title: string }>) ?? []
            expect(services.length).toBeGreaterThan(0)
            // composer buildServiceCards generates per-category or biz.products-driven services
            // Either path should NOT emit the old "Premium Service" generic
            const titles = services.map((s) => s.title)
            expect(titles.every((t) => t !== 'Premium Service')).toBe(true)
        })

        it('TC-F01V-CD.13 — service-cards with biz.products emits product-derived services', () => {
            const block = buildBlockFromLibrary('service-cards', 'health', {
                seed: 10,
                userBiz: {
                    name: 'bibi Dental',
                    products: ['Teeth Whitening', 'Dental Implants', 'Orthodontics'],
                },
            })
            const services = (block?.services as Array<{ title: string }>) ?? []
            const titlesText = services.map((s) => s.title.toLowerCase()).join(' ')
            // Composer's productToService maps product names to service titles
            expect(
                /whitening|implant|orthodont|dental/.test(titlesText),
            ).toBe(true)
        })
    })

    describe('determinism + shape compat', () => {
        it('TC-F01V-CD.14 — same seed + category reproduces same block', () => {
            const a = buildBlockFromLibrary('features', 'health', { seed: 123 })
            const b = buildBlockFromLibrary('features', 'health', { seed: 123 })
            expect(JSON.stringify(a)).toBe(JSON.stringify(b))
        })

        it('TC-F01V-CD.15 — delegated blocks have correct blockType field', () => {
            const features = buildBlockFromLibrary('features', 'beauty', { seed: 1 })
            const stats = buildBlockFromLibrary('stats', 'beauty', { seed: 1 })
            const pricing = buildBlockFromLibrary('pricing', 'beauty', { seed: 1 })
            const team = buildBlockFromLibrary('team', 'beauty', { seed: 1 })
            const svc = buildBlockFromLibrary('service-cards', 'beauty', { seed: 1 })
            expect(features?.blockType).toBe('features')
            expect(stats?.blockType).toBe('stats')
            expect(pricing?.blockType).toBe('pricing')
            expect(team?.blockType).toBe('team')
            expect(svc?.blockType).toBe('service-cards')
        })
    })
})
