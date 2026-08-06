import { describe, expect, it } from 'vitest'
import { parseEditorSettingsDeepLink } from '@/lib/editor/settings-deep-link'

// ── TC-F37-04-12: allowlisted Editor deep links ─────────────────────────────
describe('[TC-F37-04-12] Editor settings deep-link parser', () => {
    it.each([
        [
            'settingsTab=global&section=brand',
            { tab: 'global', section: 'brand' },
        ],
        [
            'settingsTab=global&section=contact&focus=phone',
            { tab: 'global', section: 'contact', focus: 'phone' },
        ],
        [
            'settingsTab=global&section=contact&focus=address',
            { tab: 'global', section: 'contact', focus: 'address' },
        ],
        [
            'settingsTab=global&section=localBusiness&focus=address',
            { tab: 'global', section: 'localBusiness', focus: 'address' },
        ],
        [
            'settingsTab=global&section=localBusiness&focus=schemaSubtype',
            { tab: 'global', section: 'localBusiness', focus: 'schemaSubtype' },
        ],
        [
            'settingsTab=global&section=localBusiness&focus=openingHours',
            { tab: 'global', section: 'localBusiness', focus: 'openingHours' },
        ],
        [
            'settingsTab=global&section=localBusiness&focus=map',
            { tab: 'global', section: 'localBusiness', focus: 'map' },
        ],
        [
            'settingsTab=global&section=localBusiness&focus=priceRange',
            { tab: 'global', section: 'localBusiness', focus: 'priceRange' },
        ],
        [
            'settingsTab=seo&section=searchVerification',
            { tab: 'seo', section: 'searchVerification' },
        ],
    ] as const)('accepts %s', (query, expected) => {
        // Arrange
        const params = new URLSearchParams(query)

        // Act
        const result = parseEditorSettingsDeepLink(params)

        // Assert
        expect(result).toEqual(expected)
    })

    it.each([
        'settingsTab=block&section=brand',
        'settingsTab=global&section=localBusiness&focus=unknown',
        'settingsTab=seo&section=searchVerification&focus=phone',
        'settingsTab=seo&section=arbitrary',
    ])('rejects untrusted target %s', (query) => {
        // Arrange
        const params = new URLSearchParams(query)

        // Act
        const result = parseEditorSettingsDeepLink(params)

        // Assert
        expect(result).toBeNull()
    })
})
