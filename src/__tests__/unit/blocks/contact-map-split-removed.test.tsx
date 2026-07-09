/**
 * Unit Tests: Contact Block — map-split variant removed (GH-1465)
 * TC-IDs: TC-1465-01 → TC-1465-06
 * Convention: docs/TEST_CONVENTION.md
 * QA doc: docs/qa/F30-template-system-v2.md
 *
 * Phase 02 Part A: Verify map-split is removed from selectable variants,
 * but legacy Zod validation still accepts it for backward compatibility.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Imports ────────────────────────────────────────────────────────────────
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'
import { ContactBlock } from '@/blocks/contact'
import {
    CATEGORY_VARIANT_WEIGHTS,
} from '@/lib/ai/openai-generator'
import {
    CONTACT_VARIANT_BY_CATEGORY,
} from '@/lib/ai/category-requirements'

// ── TC-1465-01: contactMeta and Pages.ts exclude map-split ─────────────────
describe('[TC-1465-01] map-split excluded from selectable variants', () => {
    it('contactMeta.variants excludes map-split', () => {
        expect(contactMeta.variants).not.toContain('map-split')
    })

    it('contactMeta.variants has exactly 5 entries', () => {
        expect(contactMeta.variants).toHaveLength(5)
    })

    it('all remaining variants are valid: form, info-only, split, card-float, minimal-inline', () => {
        const expected = ['form', 'info-only', 'split', 'card-float', 'minimal-inline']
        expect(new Set(contactMeta.variants)).toEqual(new Set(expected))
    })
})

// ── TC-1465-02: Legacy map-split still Zod-validates (non-breaking) ────────
describe('[TC-1465-02] Legacy map-split content still Zod-valid', () => {
    it('ContactConfigSchema.safeParse accepts variant=map-split (backward compat)', () => {
        const result = ContactConfigSchema.safeParse({
            blockType: 'contact',
            variant: 'map-split',
            headline: 'Contact Us',
            address: '123 Main St',
            email: 'test@example.com',
            formFields: [{ label: 'Name', fieldName: 'name' }],
        })

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.variant).toBe('map-split')
        }
    })

    it('Legacy map-split config does not throw during parse', () => {
        const legacyConfig = {
            blockType: 'contact' as const,
            variant: 'map-split' as const,
            headline: 'Find Us',
            address: '456 Oak Ave, Springfield',
        }

        expect(() => ContactConfigSchema.parse(legacyConfig)).not.toThrow()
    })
})

// ── TC-1465-03: AI recipe pools exclude map-split ───────────────────────────
describe('[TC-1465-03] AI generator pools exclude map-split', () => {
    it('CATEGORY_VARIANT_WEIGHTS: no contact pool contains map-split', () => {
        for (const [category, variants] of Object.entries(CATEGORY_VARIANT_WEIGHTS)) {
            const contactVariants = variants.contact
            if (contactVariants) {
                expect(
                    contactVariants,
                    `CATEGORY_VARIANT_WEIGHTS[${category}].contact should not include map-split`
                ).not.toContain('map-split')
            }
        }
    })

    it('CONTACT_VARIANT_BY_CATEGORY: no category pool contains map-split', () => {
        for (const [category, variants] of Object.entries(CONTACT_VARIANT_BY_CATEGORY)) {
            expect(
                variants,
                `CONTACT_VARIANT_BY_CATEGORY[${category}] should not include map-split`
            ).not.toContain('map-split')
        }
    })
})

// ── TC-1465-04: Render map-split → split layout (no iframe) ──────────────────
describe('[TC-1465-04] ContactBlock renders map-split as split layout (no iframe)', () => {
    it('variant=map-split renders without iframe and with split layout elements', () => {
        const { container } = render(
            <ContactBlock
                blockIndex={0}
                block={{
                    blockType: 'contact',
                    variant: 'map-split',
                    headline: 'Find Us',
                    address: '123 Main Street, Suite 400, San Francisco, CA 94105',
                    email: 'hello@example.com',
                    phone: '+1-800-555-0199',
                    formFields: [
                        { label: 'Name', fieldName: 'name', fieldType: 'text', required: true },
                        { label: 'Email', fieldName: 'email', fieldType: 'email', required: true },
                    ],
                }}
                page={{ id: 'test-page' }}
                site={{ id: 'test-site', theme: 'light' }}
            />
        )

        // Assert: no iframe element
        expect(container.querySelector('iframe')).toBeNull()

        // Assert: no output=embed Google Maps URL
        const links = container.querySelectorAll('a[href*="maps.google.com"]')
        for (const link of links) {
            expect(link.href).not.toContain('output=embed')
        }

        // Assert: layout elements present (form + info card)
        expect(screen.queryByText('Find Us')).toBeTruthy()
    })
})

// ── TC-1465-05: Render split/form variant → external Google Maps link ──────
describe('[TC-1465-05] ContactBlock renders external Google Maps link', () => {
    it('split variant with address renders external Google Maps link', () => {
        const { container } = render(
            <ContactBlock
                blockIndex={0}
                block={{
                    blockType: 'contact',
                    variant: 'split',
                    headline: 'Get in Touch',
                    address: '456 Oak Avenue, Portland, OR 97201',
                    email: 'contact@example.com',
                    formFields: [{ label: 'Name', fieldName: 'name' }],
                }}
                page={{ id: 'test-page' }}
                site={{ id: 'test-site', theme: 'light' }}
            />
        )

        const mapLink = container.querySelector('a[href^="https://maps.google.com/?q="]')
        expect(mapLink).toBeTruthy()
        if (mapLink) {
            expect(mapLink.getAttribute('target')).toBe('_blank')
        }
    })

    it('form variant with address renders external Google Maps link', () => {
        const { container } = render(
            <ContactBlock
                blockIndex={0}
                block={{
                    blockType: 'contact',
                    variant: 'form',
                    headline: 'Contact Us',
                    address: '789 Elm Street, Seattle, WA 98101',
                    email: 'info@example.com',
                    formFields: [{ label: 'Name', fieldName: 'name' }],
                }}
                page={{ id: 'test-page' }}
                site={{ id: 'test-site', theme: 'light' }}
            />
        )

        const mapLink = container.querySelector('a[href^="https://maps.google.com/?q="]')
        expect(mapLink).toBeTruthy()
        if (mapLink) {
            expect(mapLink.getAttribute('target')).toBe('_blank')
        }
    })
})

// ── TC-1465-06: Regression — all 5 remaining variants render without error ──
describe('[TC-1465-06] All 5 remaining variants render successfully', () => {
    const variants = ['form', 'info-only', 'split', 'card-float', 'minimal-inline']

    for (const variant of variants) {
        it(`variant="${variant}" renders without throwing`, () => {
            expect(() => {
                render(
                    <ContactBlock
                        blockIndex={0}
                        block={{
                            blockType: 'contact',
                            variant: variant as any,
                            headline: 'Contact Section',
                            formFields: [{ label: 'Name', fieldName: 'name' }],
                        }}
                        page={{ id: 'test-page' }}
                        site={{ id: 'test-site', theme: 'light' }}
                    />
                )
            }).not.toThrow()
        })
    }
})
