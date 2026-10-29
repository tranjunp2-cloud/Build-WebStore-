import { describe, expect, it } from 'vitest'
import { toPublicDoc, toPublicSite } from '@/lib/storefront/public-site-dto'

// Shape of a tenant as the Local API returns it (overrideAccess: true → field access ignored)
const tenantDoc = {
    id: 7,
    slug: 'the-hehe',
    xenditSecretKey: 'xnd_development_secret',
    xenditCallbackToken: 'cb_token',
    stripeCustomerId: 'cus_123',
    payments: { account_number: '1234567890', bank_name: 'Maybank' },
    easyParcelIntegration: { enabled: true, accessToken: 'ep_access', refreshToken: 'ep_refresh' },
    echIntegration: { apiKey: 'ech_key' },
}

const siteDoc = {
    id: 3,
    name: 'The Hehe',
    tenant: tenantDoc,
    theme: { primaryColor: '#00D3D4' },
    contactInfo: { phone: '+60 12 345' },
    headerBlock: { blockType: 'navigation', links: [] },
    seo: { metaTitle: 'Hehe', metaDescription: 'Snacks', trackedKeywords: [{ keyword: 'snack' }] },
    paymentConfig: { bankAccountNo: '9876543210', bankName: 'CIMB' },
    shippingConfig: { westRate: 800 },
    aiGenerationMetadata: { originalPrompt: 'private onboarding brief' },
    pendingHeaderBlock: { blockType: 'navigation' },
}

const SECRETS = ['xnd_development_secret', 'cb_token', 'cus_123', '1234567890', '9876543210', 'ep_access', 'ep_refresh', 'ech_key', 'private onboarding brief', 'snack']

describe('public storefront DTO [GH-2077]', () => {
    it('[TC-F09.265] toPublicSite keeps the render fields and drops secrets, payment/shipping config and AI brief', () => {
        // Arrange
        const site = { ...siteDoc, tenantSlug: 'the-hehe', siteBasePath: '/sites/the-hehe' }

        // Act
        const result = toPublicSite(site) as Record<string, unknown>

        // Assert
        const json = JSON.stringify(result)
        for (const secret of SECRETS) expect(json).not.toContain(secret)
        expect(result).toEqual({
            id: 3,
            name: 'The Hehe',
            tenant: 7,
            theme: { primaryColor: '#00D3D4' },
            contactInfo: { phone: '+60 12 345' },
            headerBlock: { blockType: 'navigation', links: [] },
            seo: { metaTitle: 'Hehe', metaDescription: 'Snacks' },
            tenantSlug: 'the-hehe',
            siteBasePath: '/sites/the-hehe',
        })
    })

    it('[TC-F09.266] toPublicDoc collapses populated tenant relations at any depth (page.tenant, media.tenant)', () => {
        // Arrange
        const page = {
            id: 11,
            tenant: tenantDoc,
            layout: [{ blockType: 'hero', image: { id: 90, url: '/media/hero.jpg', tenant: tenantDoc } }],
        }

        // Act
        const result = toPublicDoc(page)

        // Assert
        expect(result).toEqual({
            id: 11,
            tenant: 7,
            layout: [{ blockType: 'hero', image: { id: 90, url: '/media/hero.jpg', tenant: 7 } }],
        })
    })

    it('[TC-F09.267] toPublicDoc reduces a populated page.site to the public site shape', () => {
        // Arrange
        const pages = [{ id: 1, slug: '/', site: siteDoc }]

        // Act
        const result = toPublicDoc(pages)

        // Assert
        const json = JSON.stringify(result)
        for (const secret of SECRETS) expect(json).not.toContain(secret)
        expect(result[0].site).toMatchObject({ id: 3, name: 'The Hehe', tenant: 7 })
    })

    it('[TC-F09.268] toPublicDoc leaves an unpopulated tenant id and plain values untouched', () => {
        // Arrange
        const page = { id: 2, tenant: 7, title: 'About', layout: [{ blockType: 'text', items: ['a', 'b'] }] }

        // Act
        const result = toPublicDoc(page)

        // Assert
        expect(result).toEqual(page)
        expect(result).not.toBe(page)
    })
})
