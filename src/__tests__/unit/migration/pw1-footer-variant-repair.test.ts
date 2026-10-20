import { describe, expect, it } from 'vitest'
import { repairFooterVariant } from '@/lib/migration/pw1-footer-variant-repair'
import { isBrandWithColumns } from '@/lib/migration/pw1-footer-brand'

const columns = [{ title: 'Quick Links', links: [] }, { title: 'Our Services', links: [] }, { title: 'Coverage', links: [] }]
const footer = (overrides: Record<string, unknown> = {}) => ({ blockType: 'footer', variant: 'centered-stack', logo: { url: 'https://x/logo.png' }, copyrightText: 'c', columns, ...overrides })
const site = { metaDescription: 'We install fibre.', phone: '0116', email: 'a@b.com', address: 'Selangor' }

// TC-F35.M68: footer variant repair for generated stores
describe('[TC-F35.M68] repairFooterVariant', () => {
    it('switches a 3-column footer with brand info to dark-gradient and changes nothing else', () => {
        const result = repairFooterVariant(footer(), site)
        expect(result).toMatchObject({ changed: true, from: 'centered-stack', to: 'dark-gradient' })
        if (!result.changed) throw new Error('expected a repair')
        expect(result.footer).toEqual({ ...footer(), variant: 'dark-gradient' })
    })

    it.each([
        ['an own tagline', footer({ tagline: 'Our own words' }), {}],
        ['the site SEO description', footer(), { metaDescription: 'We install fibre.' }],
        ['contact details alone', footer(), { phone: '0116' }],
    ])('treats %s as brand info', (_label, input, siteInfo) => {
        expect(repairFooterVariant(input, siteInfo)).toMatchObject({ changed: true, to: 'dark-gradient' })
    })

    it('is idempotent: an already repaired footer is reported as correct', () => {
        const first = repairFooterVariant(footer(), site)
        if (!first.changed) throw new Error('expected a repair')
        expect(repairFooterVariant(first.footer, site)).toEqual({ changed: false, reason: 'already-correct' })
    })

    it('never touches a footer that is already dark-gradient', () => {
        expect(repairFooterVariant(footer({ variant: 'dark-gradient' }), site)).toEqual({ changed: false, reason: 'already-correct' })
    })

    it.each([
        ['fewer than 3 columns', footer({ columns: columns.slice(0, 2) }), site],
        ['no brand info', footer(), {}],
        ['blank brand info', footer(), { metaDescription: '  ', phone: '', email: null }],
    ])('leaves the footer alone with %s', (_label, input, siteInfo) => {
        expect(repairFooterVariant(input, siteInfo)).toEqual({ changed: false, reason: 'rule-not-matched' })
    })

    it.each([[null], [undefined], [{ blockType: 'hero' }], ['footer']])('ignores a non-footer value (%j)', value => {
        expect(repairFooterVariant(value, site)).toEqual({ changed: false, reason: 'no-footer' })
    })

    it('shares the binder rule helpers', () => {
        expect(isBrandWithColumns({ showContactInfo: true, columns })).toBe(true)
        expect(isBrandWithColumns({ tagline: 'x', columns: columns.slice(0, 2) })).toBe(false)
    })
})
