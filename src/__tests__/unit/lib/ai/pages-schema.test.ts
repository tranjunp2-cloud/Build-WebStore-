/**
 * TC-F01-AT-01..04 — Phase 01 apply-template whitelist bug fix.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/phase-01-fix-apply-template-whitelist.md
 *
 * Verifies `sanitizeBlocksForPayload` preserves the content fields that
 * were previously stripped by the PAGES_FIELDS whitelist (team.members,
 * pricing.plans, stats.variant, etc.) while still rejecting unknown
 * block types + fields.
 */

import { describe, it, expect } from 'vitest'
import {
    sanitizeBlockForPayload,
    sanitizeBlocksForPayload,
    PAGES_FIELDS,
    CONTENT_FIELDS,
    PAGES_BLOCK_WHITELIST,
} from '@/lib/ai/pages-schema'

describe('pages-schema sanitizer', () => {
    describe('TC-F01-AT-01: team.members preserved', () => {
        it('keeps members array with name/role/bio', () => {
            const block = {
                blockType: 'team',
                variant: 'grid',
                headline: 'Meet Our Team',
                members: [
                    { name: 'Dr. Tan Wei Ming', role: 'General Practitioner', bio: 'MBBS (UM), 15 years' },
                    { name: 'Dr. Aishah Ahmad', role: 'Dental Surgeon', bio: 'BDS (USM)' },
                ],
            }

            const result = sanitizeBlockForPayload(block)

            expect(result).toMatchObject({
                blockType: 'team',
                variant: 'grid',
                headline: 'Meet Our Team',
                members: [
                    expect.objectContaining({ name: 'Dr. Tan Wei Ming', role: 'General Practitioner' }),
                    expect.objectContaining({ name: 'Dr. Aishah Ahmad' }),
                ],
            })
            expect((result!.members as unknown[]).length).toBe(2)
        })

        it('preserves variant enum with fallback when invalid', () => {
            const block = { blockType: 'team', variant: 'wonky', headline: 'Team', members: [] }
            const result = sanitizeBlockForPayload(block)
            expect(result!.variant).toBe('grid')
        })
    })

    describe('TC-F01-AT-02: pricing.plans preserved', () => {
        it('keeps plans array with nested features', () => {
            const block = {
                blockType: 'pricing',
                headline: 'Choose Your Plan',
                subheadline: 'Straightforward pricing',
                plans: [
                    {
                        name: 'Basic Check-up',
                        price: 'RM 80',
                        description: 'Consultation + basic tests',
                        features: [
                            { text: 'Doctor consultation', included: true },
                            { text: 'Blood pressure check', included: true },
                        ],
                        isPopular: false,
                        ctaLabel: 'Book Now',
                        ctaUrl: '/contact',
                    },
                ],
            }

            const result = sanitizeBlockForPayload(block)

            expect(result).toMatchObject({
                blockType: 'pricing',
                headline: 'Choose Your Plan',
                subheadline: 'Straightforward pricing',
                plans: [expect.objectContaining({ name: 'Basic Check-up', price: 'RM 80' })],
            })
            const plans = result!.plans as Array<Record<string, unknown>>
            expect(plans[0]!.features).toHaveLength(2)
        })
    })

    describe('TC-F01-AT-03: hero.ctaButtons + contact/stats/footer variants', () => {
        it('hero keeps ctaButtons + badge', () => {
            const block = {
                blockType: 'hero',
                variant: 'split-left',
                headline: 'Welcome',
                subheadline: 'Sub',
                ctaButtons: [
                    { label: 'Book', url: '/book', style: 'primary' },
                    { label: 'Learn', url: '/about', style: 'outline' },
                ],
                badge: { show: true, text: 'New' },
            }
            const result = sanitizeBlockForPayload(block)
            expect(result!.ctaButtons).toHaveLength(2)
            expect(result!.badge).toEqual({ show: true, text: 'New' })
            expect(result!.variant).toBe('split-left')
        })

        it('contact.variant = "split" now preserved (was null-schema bug)', () => {
            const block = {
                blockType: 'contact',
                variant: 'split',
                headline: 'Get In Touch',
                email: 'hi@example.com',
                phone: '+60 3-1234 5678',
                formFields: [{ label: 'Name', fieldName: 'name', fieldType: 'text', required: true }],
            }
            const result = sanitizeBlockForPayload(block)
            expect(result!.variant).toBe('split')
            expect(result!.email).toBe('hi@example.com')
            expect(result!.formFields).toHaveLength(1)
        })

        it('stats.variant = "grid" now preserved', () => {
            const block = {
                blockType: 'stats',
                variant: 'grid',
                headline: 'Our Impact',
                stats: [{ value: '15000+', label: 'Patients Treated' }],
            }
            const result = sanitizeBlockForPayload(block)
            expect(result!.variant).toBe('grid')
            expect(result!.stats).toHaveLength(1)
        })

        it('footer.variant = "expanded" now preserved', () => {
            const block = {
                blockType: 'footer',
                variant: 'expanded',
                logoText: 'Klinik Dr. Tan',
                tagline: 'Your Family Health Partner',
                columns: [{ title: 'Pages', links: [{ label: 'Home', url: '/' }] }],
            }
            const result = sanitizeBlockForPayload(block)
            expect(result!.variant).toBe('expanded')
            expect(result!.columns).toHaveLength(1)
        })
    })

    describe('TC-F01-AT-04: defensive stripping still works', () => {
        it('drops unknown block types entirely', () => {
            const blocks = [
                { blockType: 'team', headline: 'Team', members: [] },
                { blockType: 'before-after', headline: 'Dropped' },
                { blockType: 'doctor-profile', headline: 'Also dropped' },
            ]
            const result = sanitizeBlocksForPayload(blocks)
            expect(result).toHaveLength(1)
            expect(result[0]!.blockType).toBe('team')
        })

        it('drops unknown fields within a known block', () => {
            const block = {
                blockType: 'hero',
                variant: 'centered',
                headline: 'Welcome',
                // unknown fields that should be dropped:
                leftoverAiField: 'dropme',
                crmReferenceId: 42,
                image: 'https://placehold.co/1200x800',
            }
            const result = sanitizeBlockForPayload(block)
            expect(result).not.toHaveProperty('leftoverAiField')
            expect(result).not.toHaveProperty('crmReferenceId')
            // image is NOT yet whitelisted (Phase 05 will add upload sanitization)
            expect(result).not.toHaveProperty('image')
            expect(result!.headline).toBe('Welcome')
        })

        it('falls back to default variant when raw value is invalid', () => {
            const block = { blockType: 'hero', variant: 'unknown-variant', headline: 'x' }
            const result = sanitizeBlockForPayload(block)
            expect(result!.variant).toBe('centered')
        })

        it('aliases legacy variant names for hero', () => {
            const block = { blockType: 'hero', variant: 'split-image', headline: 'x' }
            const result = sanitizeBlockForPayload(block)
            expect(result!.variant).toBe('split-left')
        })
    })

    describe('whitelist coverage invariants', () => {
        it('PAGES_FIELDS covers all 14 PAGES_BLOCK_WHITELIST entries', () => {
            for (const bt of PAGES_BLOCK_WHITELIST) {
                expect(PAGES_FIELDS[bt]).toBeDefined()
                expect(PAGES_FIELDS[bt]!.length).toBeGreaterThan(0)
            }
        })

        it('CONTENT_FIELDS derived from PAGES_FIELDS minus structural fields', () => {
            expect(CONTENT_FIELDS.team).toEqual(['headline', 'members'])
            expect(CONTENT_FIELDS.pricing).toEqual(['headline', 'subheadline', 'plans'])
            expect(CONTENT_FIELDS.hero).not.toContain('variant')
        })
    })
})
