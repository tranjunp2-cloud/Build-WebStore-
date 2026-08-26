import { describe, it, expect } from 'vitest'
import { ContactConfigSchema, contactMeta } from '@/blocks/contact/config'

// ── TC-S2-013: Contact Block Variants ───────────────────────────────────────

const CONTACT_VARIANTS = [
    'form', 'info-only', 'split', 'card-float', 'minimal-inline',
] as const

const minimalContactConfig = (overrides: Record<string, unknown> = {}) => ({
    blockType: 'contact',
    headline: 'Get in Touch',
    formFields: [
        { label: 'Name', fieldName: 'name' },
        { label: 'Email', fieldName: 'email', fieldType: 'email', required: true },
    ],
    ...overrides,
})

describe('[TC-S2-013] Contact Block Variants', () => {
    describe('Config Schema', () => {
        it('validates all 5 variants', () => {
            for (const v of CONTACT_VARIANTS) {
                const result = ContactConfigSchema.safeParse(minimalContactConfig({ variant: v }))
                expect(result.success, `variant '${v}' should be valid`).toBe(true)
            }
        })

        it('rejects invalid variant name', () => {
            const result = ContactConfigSchema.safeParse(minimalContactConfig({ variant: 'nonexistent' }))
            expect(result.success).toBe(false)
        })

        it('defaults to "form" when variant not specified', () => {
            const result = ContactConfigSchema.parse(minimalContactConfig())
            expect(result.variant).toBe('form')
        })

        it('accepts full contact config with all optional fields', () => {
            const result = ContactConfigSchema.safeParse(minimalContactConfig({
                variant: 'split',
                subtext: 'We would love to hear from you',
                email: 'hello@example.com',
                phone: '+60123456789',
                address: '123 Jalan Bukit Bintang, KL',
            }))
            expect(result.success).toBe(true)
        })

        it('defaults formFields to empty array when not provided', () => {
            const result = ContactConfigSchema.parse({
                blockType: 'contact',
            })
            expect(result.formFields).toEqual([])
        })

        it('defaults fieldType to "text"', () => {
            const result = ContactConfigSchema.parse(minimalContactConfig({
                formFields: [{ label: 'Name', fieldName: 'name' }],
            }))
            expect(result.formFields[0].fieldType).toBe('text')
        })

        it('defaults required to false', () => {
            const result = ContactConfigSchema.parse(minimalContactConfig({
                formFields: [{ label: 'Name', fieldName: 'name' }],
            }))
            expect(result.formFields[0].required).toBe(false)
        })
    })

    describe('Meta', () => {
        it('has exactly 5 variants', () => {
            expect(contactMeta.variants).toHaveLength(5)
        })

        it('variants match schema enum', () => {
            for (const v of contactMeta.variants) {
                const result = ContactConfigSchema.safeParse(minimalContactConfig({ variant: v }))
                expect(result.success, `meta variant '${v}' should be valid in schema`).toBe(true)
            }
        })

        it('has correct block type', () => {
            expect(contactMeta.type).toBe('contact')
        })

        it('defaultVariant is "form"', () => {
            expect(contactMeta.defaultVariant).toBe('form')
        })
    })
})
