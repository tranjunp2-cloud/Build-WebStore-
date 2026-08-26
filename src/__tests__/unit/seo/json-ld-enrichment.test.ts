/**
 * @fileoverview Tests for JSON-LD enrichment (Plan 1 — G3)
 * TC-IDs: TC-F03.G3-01 to TC-F03.G3-09
 */
import { describe, it, expect } from 'vitest'
import {
    generateOrganizationSchema,
    generateLocalBusinessSchema,
    generateWebPageSchema,
    generatePageSchemas,
} from '@/lib/seo/json-ld'

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseSite = {
    name: 'Tiệm Bánh ABC',
    domain: 'tiembanhabc.com',
    branding: { logo: 'https://tiembanhabc.com/logo.png' },
    contactInfo: { phone: '+60123456789', email: 'hello@tiembanhabc.com', address: '123 Jalan Bukit Bintang, KL 50200' },
    socialLinks: {
        facebook: 'https://facebook.com/tiembanhabc',
        instagram: 'https://instagram.com/tiembanhabc',
        linkedin: null,
        youtube: '',
        twitter: null,
        tiktok: 'https://tiktok.com/@tiembanhabc',
    },
}

// ── TC-F03.G3-01: Organization có sameAs khi socialLinks có giá trị ────────

describe('[TC-F03.G3-01] Organization schema — sameAs from socialLinks', () => {
    it('includes sameAs array with non-empty social links only', () => {
        const schema = generateOrganizationSchema(baseSite)!
        expect(schema.sameAs).toEqual([
            'https://facebook.com/tiembanhabc',
            'https://instagram.com/tiembanhabc',
            'https://tiktok.com/@tiembanhabc',
        ])
    })
})

// ── TC-F03.G3-02: Organization bỏ sameAs khi socialLinks rỗng ──────────────

describe('[TC-F03.G3-02] Organization schema — no sameAs when empty', () => {
    it('omits sameAs when all social links are empty', () => {
        const site = { ...baseSite, socialLinks: { facebook: '', instagram: null, twitter: null } }
        const schema = generateOrganizationSchema(site)!
        expect(schema.sameAs).toBeUndefined()
    })

    it('omits sameAs when socialLinks is undefined', () => {
        const site = { name: 'Test', domain: 'test.com' }
        const schema = generateOrganizationSchema(site)!
        expect(schema.sameAs).toBeUndefined()
    })
})

// ── TC-F03.G3-03: Organization có telephone, email từ contactInfo ───────────

describe('[TC-F03.G3-03] Organization schema — contact info', () => {
    it('includes telephone and email from contactInfo', () => {
        const schema = generateOrganizationSchema(baseSite)!
        expect(schema.telephone).toBe('+60123456789')
        expect(schema.email).toBe('hello@tiembanhabc.com')
    })

    it('omits telephone/email when contactInfo is missing', () => {
        const site = { name: 'Test', domain: 'test.com' }
        const schema = generateOrganizationSchema(site)!
        expect(schema.telephone).toBeUndefined()
        expect(schema.email).toBeUndefined()
    })
})

// ── TC-F03.G3-04: Organization logo từ branding ─────────────────────────────

describe('[TC-F03.G3-04] Organization schema — logo from branding', () => {
    it('uses branding.logo', () => {
        const schema = generateOrganizationSchema(baseSite)!
        expect(schema.logo).toBe('https://tiembanhabc.com/logo.png')
    })
})

// ── TC-F03.G3-05: LocalBusiness có PostalAddress thay vì string ─────────────

describe('[TC-F03.G3-05] LocalBusiness schema — structured PostalAddress', () => {
    it('prefers canonical Contact Info address over a contact-block address', () => {
        const contactBlock = { blockType: 'contact', address: '456 Jalan Ampang', phone: '+60111', email: 'shop@test.com' }
        const schema = generateLocalBusinessSchema(contactBlock, baseSite)!
        expect(schema.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: '123 Jalan Bukit Bintang, KL 50200',
            addressCountry: 'MY',
        })
    })

    it('uses site contactInfo.address with implicit Malaysia country', () => {
        const contactBlock = { blockType: 'contact' }
        const schema = generateLocalBusinessSchema(contactBlock, baseSite)!
        expect(schema.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: '123 Jalan Bukit Bintang, KL 50200',
            addressCountry: 'MY',
        })
    })

    it('falls back to a legacy contact-block address when the site has no address', () => {
        const contactBlock = { blockType: 'contact', address: '456 Jalan Ampang' }
        const site = { ...baseSite, contactInfo: { ...baseSite.contactInfo, address: '' } }
        const schema = generateLocalBusinessSchema(contactBlock, site)!
        expect(schema.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: '456 Jalan Ampang',
            addressCountry: 'MY',
        })
    })

    it('includes url and sameAs', () => {
        const contactBlock = { blockType: 'contact' }
        const schema = generateLocalBusinessSchema(contactBlock, baseSite)!
        expect(schema.url).toBe('https://tiembanhabc.com')
        expect(schema.sameAs).toEqual([
            'https://facebook.com/tiembanhabc',
            'https://instagram.com/tiembanhabc',
            'https://tiktok.com/@tiembanhabc',
        ])
    })
})

// ── TC-F03.G3-06: WebPage schema cho trang con ─────────────────────────────

describe('[TC-F03.G3-06] WebPage schema — non-homepage', () => {
    it('generates WebPage with name, description, url', () => {
        const page = { slug: 'about', name: 'About Us', seo: { title: 'About Tiệm Bánh ABC', description: 'Learn about us' } }
        const schema = generateWebPageSchema(page, baseSite)!
        expect(schema['@type']).toBe('WebPage')
        expect(schema.name).toBe('About Tiệm Bánh ABC')
        expect(schema.description).toBe('Learn about us')
        expect(schema.url).toBe('https://tiembanhabc.com/about')
        expect(schema.isPartOf).toEqual({ '@type': 'WebSite', name: 'Tiệm Bánh ABC' })
    })

    it('falls back to page.name when seo.title is missing', () => {
        const page = { slug: 'services', name: 'Services' }
        const schema = generateWebPageSchema(page, baseSite)!
        expect(schema.name).toBe('Services')
    })

    it('uses siteUrl for home slug', () => {
        const page = { slug: 'home', name: 'Home' }
        const schema = generateWebPageSchema(page, baseSite)!
        expect(schema.url).toBe('https://tiembanhabc.com')
    })
})

// ── TC-F03.G3-07: WebPage KHÔNG emit cho homepage ──────────────────────────

describe('[TC-F03.G3-07] generatePageSchemas — homepage vs non-homepage', () => {
    const homepageBlocks = [{ blockType: 'navigation' }, { blockType: 'hero' }, { blockType: 'contact', address: '123 St' }]
    const subpageBlocks = [{ blockType: 'navigation' }, { blockType: 'features' }]
    const homePage = { slug: 'home', name: 'Home' }
    const aboutPage = { slug: 'about', name: 'About', seo: { title: 'About Us' } }

    it('homepage: has Organization + WebSite, no WebPage', () => {
        const schemas = generatePageSchemas({ blocks: homepageBlocks, site: baseSite, page: homePage, isHomepage: true })
        const types = schemas.map(s => s['@type'])
        expect(types).toContain('Organization')
        expect(types).toContain('WebSite')
        expect(types).not.toContain('WebPage')
    })

    it('subpage: has WebPage, no Organization/WebSite', () => {
        const schemas = generatePageSchemas({ blocks: subpageBlocks, site: baseSite, page: aboutPage, isHomepage: false })
        const types = schemas.map(s => s['@type'])
        expect(types).toContain('WebPage')
        expect(types).not.toContain('Organization')
        expect(types).not.toContain('WebSite')
    })
})

// ── TC-F03.G3-08: Homepage Organization has full data ───────────────────────

describe('[TC-F03.G3-08] generatePageSchemas — homepage Organization enriched', () => {
    it('Organization includes sameAs + telephone + email', () => {
        const blocks = [{ blockType: 'navigation' }, { blockType: 'hero' }]
        const schemas = generatePageSchemas({ blocks, site: baseSite, page: { slug: 'home' }, isHomepage: true })
        const org = schemas.find(s => s['@type'] === 'Organization')!
        expect(org.sameAs).toBeDefined()
        expect(org.telephone).toBe('+60123456789')
        expect(org.email).toBe('hello@tiembanhabc.com')
    })
})

// ── TC-F03.G3-09: LocalBusiness has PostalAddress in aggregator ─────────────

describe('[TC-F03.G3-09] generatePageSchemas — LocalBusiness enriched', () => {
    it('LocalBusiness uses the canonical Contact Info PostalAddress', () => {
        const blocks = [{ blockType: 'contact', address: '789 Street' }]
        const schemas = generatePageSchemas({ blocks, site: baseSite, page: { slug: 'contact' }, isHomepage: false })
        const lb = schemas.find(s => s['@type'] === 'LocalBusiness')!
        expect(lb.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: '123 Jalan Bukit Bintang, KL 50200',
            addressCountry: 'MY',
        })
        expect(lb.sameAs).toBeDefined()
    })
})
