import { describe, expect, it } from 'vitest'
import { repairFooterLinks } from '@/lib/migration/pw1-footer-links-repair'

const source = [
    { title: 'Our Services', text: 'Open daily', links: [{ label: 'Web', url: '/services/web' }, { label: 'Mail', url: 'mailto:a@b.co', imageUrl: 'https://x.test/i.png' }] },
    { title: 'About', links: [{ label: 'Team', url: '/team' }] },
]

// TC-F35.M71: footer link repair restores hyperlinks flattened to text
describe('pw1 footer links repair', () => {
    it('restores links and text for a column that lost its links', () => {
        const footer = { blockType: 'footer', variant: 'dark-gradient', columns: [{ title: 'Our Services', text: 'Web\nMail', links: [] }, { title: 'About', links: [{ label: 'Team', url: '/team' }] }] }
        const repair = repairFooterLinks(footer, source)
        expect(repair).toMatchObject({ changed: true, columns: ['Our Services'] })
        if (!repair.changed) return
        const columns = repair.footer.columns as Array<Record<string, unknown>>
        expect(columns[0]).toEqual({ title: 'Our Services', text: 'Open daily', links: [{ label: 'Web', url: '/services/web' }, { label: 'Mail', url: 'mailto:a@b.co', imageUrl: 'https://x.test/i.png' }] })
        expect(columns[1]).toBe((footer.columns as unknown[])[1])
        expect(repair.footer.variant).toBe('dark-gradient')
    })
    it('drops the old text when the source column has none', () => {
        const repair = repairFooterLinks({ columns: [{ title: ' about ', text: 'Team', links: [] }] }, source)
        expect(repair.changed && (repair.footer.columns as Array<Record<string, unknown>>)[0]).toEqual({ title: ' about ', links: [{ label: 'Team', url: '/team' }] })
    })
    it('leaves columns that already hold all their links alone', () => {
        const footer = { columns: [{ title: 'About', links: [{ label: 'Team', url: '/team' }] }] }
        expect(repairFooterLinks(footer, source)).toEqual({ changed: false })
    })
    it('does not count the source social icon links as missing links', () => {
        const withSocial = [{ title: 'About', links: [{ label: 'Team', url: '/team' }, { label: 'Facebook', url: 'https://www.facebook.com/' }] }]
        const footer = { socials: [{ platform: 'facebook', url: 'https://www.facebook.com/' }], columns: [{ title: 'About', text: 'Team', links: [{ label: 'Team', url: '/team' }] }] }
        expect(repairFooterLinks(footer, withSocial)).toEqual({ changed: false })
        const flattened = { ...footer, columns: [{ title: 'About', text: 'Team\nFacebook', links: [] }] }
        const repair = repairFooterLinks(flattened, withSocial)
        expect(repair.changed && (repair.footer.columns as Array<{ links: unknown[] }>)[0].links).toEqual([{ label: 'Team', url: '/team' }])
    })
    it('leaves a column without text alone even when the source has more links', () => {
        const footer = { columns: [{ title: 'About', links: [] }] }
        expect(repairFooterLinks(footer, source)).toEqual({ changed: false })
    })
    it('ignores unmatched columns and non-footer values', () => {
        expect(repairFooterLinks({ columns: [{ title: 'Other', links: [] }] }, source)).toEqual({ changed: false })
        expect(repairFooterLinks(null, source)).toEqual({ changed: false })
        expect(repairFooterLinks({ columns: [] }, source)).toEqual({ changed: false })
    })
})
