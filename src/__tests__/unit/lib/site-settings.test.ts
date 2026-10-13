import { describe, it, expect, beforeEach } from 'vitest'
import {
    mergeContactInfoWithSite,
    getSiteSocialWidgetLinks,
    mergeSocialWidgetLinksWithSite,
    mergeFooterSocialsWithSite,
    mergeNavigationBrandingWithSite,
} from '@/lib/site-settings'
import type { SiteContactInfo, SiteSocialLinks, SiteBranding } from '@/lib/site-settings'

// ── TC-F19.12, TC-F19.53, TC-F19.54: Contact & Social site settings ────────

describe('[TC-F19.12] mergeContactInfoWithSite — block contact info fallback', () => {
    it('uses block values when all are provided', () => {
        // Arrange
        const block = { email: 'block@shop.com', phone: '01112223333', address: '1 Block St' }
        const siteInfo: SiteContactInfo = { email: 'site@shop.com', phone: '09999999999', address: 'Site Ave' }

        // Act
        const result = mergeContactInfoWithSite(block, siteInfo)

        // Assert — block values take priority
        expect(result.email).toBe('block@shop.com')
        expect(result.phone).toBe('01112223333')
        expect(result.address).toBe('1 Block St')
    })

    it('falls back to site contact info when block fields are empty strings', () => {
        // Arrange
        const block = { email: '', phone: '', address: '' }
        const siteInfo: SiteContactInfo = { email: 'site@shop.com', phone: '09999999999', address: 'Site Ave' }

        // Act
        const result = mergeContactInfoWithSite(block, siteInfo)

        // Assert — empty string is falsy, falls back to site values
        expect(result.email).toBe('site@shop.com')
        expect(result.phone).toBe('09999999999')
        expect(result.address).toBe('Site Ave')
    })

    it('returns empty strings when both block and site info are empty/null', () => {
        // Arrange
        const block = { email: '', phone: '', address: '' }

        // Act
        const result = mergeContactInfoWithSite(block, null)

        // Assert
        expect(result.email).toBe('')
        expect(result.phone).toBe('')
        expect(result.address).toBe('')
    })

    it('returns empty strings when siteContactInfo is undefined', () => {
        // Arrange
        const block = { email: '', phone: '', address: '' }

        // Act
        const result = mergeContactInfoWithSite(block, undefined)

        // Assert
        expect(result.email).toBe('')
        expect(result.phone).toBe('')
        expect(result.address).toBe('')
    })

    it('does partial fallback — uses site only for empty block fields', () => {
        // Arrange
        const block = { email: 'block@shop.com', phone: '', address: '' }
        const siteInfo: SiteContactInfo = { email: 'site@shop.com', phone: '09999999999', address: 'Site Ave' }

        // Act
        const result = mergeContactInfoWithSite(block, siteInfo)

        // Assert — email from block, phone+address from site
        expect(result.email).toBe('block@shop.com')
        expect(result.phone).toBe('09999999999')
        expect(result.address).toBe('Site Ave')
    })

    it('preserves extra block properties beyond email/phone/address', () => {
        // Arrange
        const block = { email: 'e@shop.com', phone: '111', address: 'Addr', blockType: 'contact', title: 'Reach Us' }
        const siteInfo: SiteContactInfo = { email: 'site@shop.com' }

        // Act
        const result = mergeContactInfoWithSite(block, siteInfo)

        // Assert — extra fields are not lost
        expect(result).toMatchObject({ blockType: 'contact', title: 'Reach Us' })
    })
})

// ── TC-F19.53: Social widget links from site social config ─────────────────
describe('[TC-F19.53] getSiteSocialWidgetLinks — site social links mapping', () => {
    it('returns only platforms that have a URL set', () => {
        // Arrange
        const siteSocialLinks: SiteSocialLinks = {
            facebook: 'https://facebook.com/shop',
            instagram: 'https://instagram.com/shop',
        }

        // Act
        const result = getSiteSocialWidgetLinks(siteSocialLinks)

        // Assert
        expect(result).toHaveLength(2)
        expect(result.map(r => r.platform)).toEqual(['facebook', 'instagram'])
    })

    it('returns platforms in the canonical order: facebook, whatsapp, instagram, linkedin, youtube, twitter, tiktok', () => {
        // Arrange — deliberately provide out-of-order keys
        const siteSocialLinks: SiteSocialLinks = {
            tiktok: 'https://tiktok.com/@shop',
            facebook: 'https://facebook.com/shop',
            youtube: 'https://youtube.com/shop',
        }

        // Act
        const result = getSiteSocialWidgetLinks(siteSocialLinks)

        // Assert — order follows SOCIAL_PLATFORM_ORDER
        expect(result.map(r => r.platform)).toEqual(['facebook', 'youtube', 'tiktok'])
    })

    it('marks each result item as enabled: true', () => {
        // Arrange
        const siteSocialLinks: SiteSocialLinks = {
            whatsapp: 'https://wa.me/60123456789',
        }

        // Act
        const result = getSiteSocialWidgetLinks(siteSocialLinks)

        // Assert
        expect(result[0].enabled).toBe(true)
    })

    it('returns empty array when no social links are set', () => {
        // Arrange
        const siteSocialLinks: SiteSocialLinks = {}

        // Act
        const result = getSiteSocialWidgetLinks(siteSocialLinks)

        // Assert
        expect(result).toEqual([])
    })

    it('returns empty array when siteSocialLinks is null', () => {
        // Act
        const result = getSiteSocialWidgetLinks(null)

        // Assert
        expect(result).toEqual([])
    })

    it('returns empty array when siteSocialLinks is undefined', () => {
        // Act
        const result = getSiteSocialWidgetLinks(undefined)

        // Assert
        expect(result).toEqual([])
    })

    it('includes correct url in each returned item', () => {
        // Arrange
        const siteSocialLinks: SiteSocialLinks = {
            linkedin: 'https://linkedin.com/company/shop',
        }

        // Act
        const result = getSiteSocialWidgetLinks(siteSocialLinks)

        // Assert
        expect(result[0].url).toBe('https://linkedin.com/company/shop')
    })
})

// ── TC-F19.12: Merge social widget links with site (block fallback) ─────────
describe('[TC-F19.12] mergeSocialWidgetLinksWithSite — block links vs site links', () => {
    it('returns block unchanged when block has links with urls', () => {
        // Arrange
        const block = {
            links: [
                { platform: 'facebook', url: 'https://facebook.com/myshop', enabled: true },
            ],
        }
        const siteSocialLinks: SiteSocialLinks = { facebook: 'https://facebook.com/site' }

        // Act
        const result = mergeSocialWidgetLinksWithSite(block, siteSocialLinks)

        // Assert — block has its own links, site links not used
        expect(result).toBe(block)
        expect(result.links[0].url).toBe('https://facebook.com/myshop')
    })

    it('falls back to site social links when block.links is undefined', () => {
        // Arrange
        const block = {}
        const siteSocialLinks: SiteSocialLinks = { instagram: 'https://instagram.com/shop' }

        // Act
        const result = mergeSocialWidgetLinksWithSite(block, siteSocialLinks)

        // Assert
        expect(result.links).toBeDefined()
        expect(result.links![0].platform).toBe('instagram')
    })

    it('falls back to site social links when block.links is empty array', () => {
        // Arrange
        const block = { links: [] as Array<{ platform: string; url: string; enabled?: boolean }> }
        const siteSocialLinks: SiteSocialLinks = { twitter: 'https://twitter.com/shop' }

        // Act
        const result = mergeSocialWidgetLinksWithSite(block, siteSocialLinks)

        // Assert — empty array has no items with url, triggers fallback
        expect(result.links!.length).toBeGreaterThan(0)
        expect(result.links![0].platform).toBe('twitter')
    })

    it('falls back to site social links when all block links have empty urls and enabled=false', () => {
        // Arrange
        const block = {
            links: [
                { platform: 'facebook', url: '', enabled: false },
            ],
        }
        const siteSocialLinks: SiteSocialLinks = { facebook: 'https://facebook.com/site' }

        // Act
        const result = mergeSocialWidgetLinksWithSite(block, siteSocialLinks)

        // Assert — url is falsy AND enabled is false → falls back
        expect(result.links![0].url).toBe('https://facebook.com/site')
    })

    it('does NOT fall back when block link has url even if enabled is false', () => {
        // Arrange — url is truthy so condition `item.url || item.enabled !== false` is true
        const block = {
            links: [
                { platform: 'facebook', url: 'https://facebook.com/block', enabled: false },
            ],
        }
        const siteSocialLinks: SiteSocialLinks = { facebook: 'https://facebook.com/site' }

        // Act
        const result = mergeSocialWidgetLinksWithSite(block, siteSocialLinks)

        // Assert — block url wins
        expect(result).toBe(block)
    })

    it('returns block with empty links when both block and site have no social data', () => {
        // Arrange
        const block = { links: [] as Array<{ platform: string; url: string }> }

        // Act
        const result = mergeSocialWidgetLinksWithSite(block, null)

        // Assert
        expect(result.links).toEqual([])
    })
})

// ── TC-F19.54: Footer socials merge with site branding ─────────────────────
describe('[TC-F19.54] mergeFooterSocialsWithSite — footer block social + branding', () => {
    it('uses block socials when block has non-empty socials array', () => {
        // Arrange
        const block = {
            socials: [{ platform: 'facebook', url: 'https://facebook.com/block' }],
            logoText: '',
        }
        const site = {
            socialLinks: { facebook: 'https://facebook.com/site' },
            name: 'Site Name',
            branding: null,
        }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert — block socials take priority
        expect(result.socials).toHaveLength(1)
        expect(result.socials[0].url).toBe('https://facebook.com/block')
    })

    it('falls back to site social links when block.socials is empty', () => {
        // Arrange
        const block = { socials: [] as Array<{ platform: string; url: string }>, logoText: '' }
        const site = {
            socialLinks: { instagram: 'https://instagram.com/site' },
            name: 'My Shop',
            branding: null,
        }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.socials.length).toBeGreaterThan(0)
        expect(result.socials[0].platform).toBe('instagram')
        expect(result.socials[0].url).toBe('https://instagram.com/site')
    })

    it('falls back to site social links when block.socials is undefined', () => {
        // Arrange
        const block = { logoText: 'My Shop' }
        const site = {
            socialLinks: { tiktok: 'https://tiktok.com/@site' },
            name: 'My Shop',
            branding: null,
        }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.socials[0].platform).toBe('tiktok')
    })

    it('uses block.logoText when set', () => {
        // Arrange
        const block = { socials: [], logoText: 'Block Logo Text' }
        const site = { socialLinks: null, name: 'Site Name', branding: null }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.logoText).toBe('Block Logo Text')
    })

    it('falls back to site name for logoText when block.logoText is empty', () => {
        // Arrange
        const block = { socials: [], logoText: '' }
        const site = { socialLinks: null, name: 'Awesome Store', branding: null }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.logoText).toBe('Awesome Store')
    })

    it('returns empty logoText when both block and site name are absent', () => {
        // Arrange
        const block = { socials: [], logoText: '' }
        const site = { socialLinks: null, name: null, branding: null }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.logoText).toBe('')
    })

    it('uses site branding logo when block has no logo', () => {
        // Arrange
        const block = { socials: [], logoText: '' }
        const site = {
            socialLinks: null,
            name: 'My Shop',
            branding: { logo: 'https://cdn.example.com/logo.png', favicon: null } as SiteBranding,
        }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.logo).toEqual({ url: 'https://cdn.example.com/logo.png', alt: 'My Shop' })
    })

    it('leaves logo undefined when site has no branding logo and block has no logo', () => {
        // Arrange
        const block = { socials: [], logoText: '' }
        const site = { socialLinks: null, name: 'My Shop', branding: null }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.logo).toBeUndefined()
    })

    it('site logo alt text falls back to "Logo" when site name is null', () => {
        // Arrange
        const block = { socials: [], logoText: '' }
        const site = {
            socialLinks: null,
            name: null,
            branding: { logo: 'https://cdn.example.com/logo.png' } as SiteBranding,
        }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect((result.logo as { url: string; alt: string }).alt).toBe('Logo')
    })

    it('returns empty socials array when both block and site have no socials', () => {
        // Arrange
        const block = { socials: [], logoText: '' }
        const site = { socialLinks: null, name: null, branding: null }

        // Act
        const result = mergeFooterSocialsWithSite(block, site)

        // Assert
        expect(result.socials).toEqual([])
    })
})

// ── TC-F19.01 (branding): Navigation branding merge with site ───────────────
describe('[TC-F19.01] mergeNavigationBrandingWithSite — nav block branding fallback', () => {
    it('uses block.logoText when set', () => {
        // Arrange
        const block = { logoText: 'My Brand', logo: { url: '', alt: '' } }
        const site = { name: 'Site Name', branding: null }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert
        expect(result.logoText).toBe('My Brand')
    })

    it('falls back to site.name for logoText when block.logoText is empty', () => {
        // Arrange
        const block = { logoText: '', logo: undefined }
        const site = { name: 'Awesome Site', branding: null }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert
        expect(result.logoText).toBe('Awesome Site')
    })

    it('returns empty logoText when both block and site name are absent', () => {
        // Arrange
        const block = { logoText: '' }
        const site = { name: null, branding: null }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert
        expect(result.logoText).toBe('')
    })

    it('uses block logo when block.logo.url is set', () => {
        // Arrange
        const block = {
            logoText: '',
            logo: { url: 'https://cdn.example.com/block-logo.png', alt: 'Block Logo' },
        }
        const site = {
            name: 'Site',
            branding: { logo: 'https://cdn.example.com/site-logo.png' } as SiteBranding,
        }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert — block logo wins when it has a url
        expect(result.logo?.url).toBe('https://cdn.example.com/block-logo.png')
    })

    it('falls back to site branding logo when block.logo.url is empty', () => {
        // Arrange
        const block = { logoText: '', logo: { url: '', alt: '' } }
        const site = {
            name: 'My Store',
            branding: { logo: 'https://cdn.example.com/site-logo.png' } as SiteBranding,
        }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert
        expect(result.logo?.url).toBe('https://cdn.example.com/site-logo.png')
        expect(result.logo?.alt).toBe('My Store')
    })

    it('logo alt falls back to "Logo" when site name is null', () => {
        // Arrange
        const block = { logoText: '', logo: { url: '', alt: '' } }
        const site = {
            name: null,
            branding: { logo: 'https://cdn.example.com/site-logo.png' } as SiteBranding,
        }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert
        expect(result.logo?.alt).toBe('Logo')
    })

    it('returns block.logo as-is when block has no logo url and site has no branding', () => {
        // Arrange
        const block = { logoText: 'My Brand', logo: { url: '', alt: 'My Alt' } }
        const site = { name: 'My Brand', branding: null }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert — no site logo, block logo (with empty url) is returned as-is
        expect(result.logo).toEqual({ url: '', alt: 'My Alt' })
    })

    it('preserves extra block properties beyond logoText and logo', () => {
        // Arrange
        const block = {
            logoText: '',
            logo: undefined,
            menuItems: [{ label: 'Home', url: '/' }],
            variant: 'sticky',
        }
        const site = { name: 'Shop', branding: null }

        // Act
        const result = mergeNavigationBrandingWithSite(block, site)

        // Assert
        expect(result).toMatchObject({ menuItems: [{ label: 'Home', url: '/' }], variant: 'sticky' })
    })

    it('handles site being null', () => {
        // Arrange
        const block = { logoText: '', logo: undefined }

        // Act
        const result = mergeNavigationBrandingWithSite(block, null)

        // Assert
        expect(result.logoText).toBe('')
        expect(result.logo).toBeUndefined()
    })

    it('handles site being undefined', () => {
        // Arrange
        const block = { logoText: 'Fallback Text', logo: undefined }

        // Act
        const result = mergeNavigationBrandingWithSite(block, undefined)

        // Assert
        expect(result.logoText).toBe('Fallback Text')
    })
})

it('[TC-F19.54] explicit blank footer social does not restore inherited links or render an empty icon', () => {
    expect(mergeFooterSocialsWithSite({ socials: [{ platform: 'facebook', url: '' }] }, { socialLinks: { facebook: 'https://facebook.com/site' } }).socials).toEqual([])
})

describe('[TC-F35.M65] mergeFooterSocialsWithSite — stored logo reference', () => {
    it('falls back to the branding logo when the footer logo is a media id without a url', () => {
        const block = { logo: 73571, socials: [], logoText: '' } as unknown as { socials: Array<{ platform: string; url: string }>; logoText: string }
        const result = mergeFooterSocialsWithSite(block, { name: 'Shop', branding: { logo: 'https://cdn.test/logo.png' } })
        expect((result as { logo?: { url: string } }).logo).toEqual({ url: 'https://cdn.test/logo.png', alt: 'Shop' })
    })
    it('keeps a footer logo that already has a url', () => {
        const block = { logo: { url: 'https://cdn.test/own.png' }, socials: [], logoText: '' } as unknown as { socials: Array<{ platform: string; url: string }>; logoText: string }
        const result = mergeFooterSocialsWithSite(block, { name: 'Shop', branding: { logo: 'https://cdn.test/logo.png' } })
        expect((result as { logo?: { url: string } }).logo?.url).toBe('https://cdn.test/own.png')
    })
})

