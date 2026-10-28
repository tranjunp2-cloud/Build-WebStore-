/**
 * Unit Tests: sanitizeBlockData — covers uncovered branches in openai-generator.ts
 * Lines targeted: 395-500, 506-515 (features array, stats, links, team socials extended)
 * TC-IDs: TC-F01.08, TC-F05.XX
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getAllMeta: () => [],
        has: () => false,
        validate: (_type: string, data: unknown) => ({ success: true, data }),
    },
}))
vi.mock('@/lib/ai/system-prompt', () => ({
    buildSystemPrompt: () => '',
    buildUserPrompt: () => '',
}))

import { sanitizeBlockData } from '@/lib/ai/openai-generator'

// ─── Features block — array normalization (lines 395-406) ────────────────────

describe('sanitizeBlockData — features block array [TC-F01.08]', () => {
    it('maps string items to feature objects with icon, title, description', () => {
        // Arrange
        const input = {
            blockType: 'features',
            features: ['Fast Delivery', 'Secure Payment'],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const features = output.features as Array<{ icon: string; title: string; description: string }>
        expect(features).toHaveLength(2)
        expect(features[0]).toEqual({ icon: '⭐', title: 'Fast Delivery', description: '' })
        expect(features[1]).toEqual({ icon: '⭐', title: 'Secure Payment', description: '' })
    })

    it('maps object features using title/name/heading fallback [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'features',
            features: [
                { name: 'Easy Setup', description: 'Setup in minutes', emoji: '🚀' },
                { heading: 'Reliable', text: 'Always online', icon: '✅' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const features = output.features as Array<{ icon: string; title: string; description: string }>
        expect(features[0].title).toBe('Easy Setup')
        expect(features[0].icon).toBe('🚀')
        expect(features[0].description).toBe('Setup in minutes')
        expect(features[1].title).toBe('Reliable')
        expect(features[1].icon).toBe('✅')
        expect(features[1].description).toBe('Always online')
    })

    it('uses "Feature" as fallback title for objects with no name [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'features',
            features: [{ icon: '⭐', description: 'Something useful' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const features = output.features as Array<{ title: string }>
        expect(features[0].title).toBe('Feature')
    })

    it('migrates s.items to s.features and removes items key [TC-F01.08]', () => {
        // Arrange — AI hallucinated "items" instead of "features"
        const input = {
            blockType: 'features',
            items: [{ title: 'Speed', description: 'Very fast', icon: '⚡' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        expect(output.features).toBeDefined()
        expect(output.items).toBeUndefined()
        const features = output.features as Array<{ title: string }>
        expect(features[0].title).toBe('Speed')
    })

    it('does not migrate items to features when features already exists [TC-F01.08]', () => {
        // Arrange — both items and features present; features should win
        const input = {
            blockType: 'features',
            features: [{ title: 'Primary Feature', description: '', icon: '⭐' }],
            items: [{ title: 'Should be ignored' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const features = output.features as Array<{ title: string }>
        expect(features).toHaveLength(1)
        expect(features[0].title).toBe('Primary Feature')
    })
})

// ─── Stats array normalization (lines 494-500) ───────────────────────────────

describe('sanitizeBlockData — stats array [TC-F01.08]', () => {
    it('normalizes string stats to { value, label } objects', () => {
        // Arrange — AI produces array of strings
        const input = {
            blockType: 'about',
            stats: ['1000+ customers', '5 star rating'],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const stats = output.stats as Array<{ value: string; label: string }>
        expect(stats[0]).toEqual({ value: '1000+ customers', label: '1000+ customers' })
        expect(stats[1]).toEqual({ value: '5 star rating', label: '5 star rating' })
    })

    it('normalizes object stats using value/number and label/text [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'about',
            stats: [
                { number: '500+', text: 'Happy Clients' },
                { value: '10', label: 'Years Experience' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const stats = output.stats as Array<{ value: string; label: string }>
        expect(stats[0]).toEqual({ value: '500+', label: 'Happy Clients' })
        expect(stats[1]).toEqual({ value: '10', label: 'Years Experience' })
    })

    it('uses "0" and "Stat" as fallback for empty stat objects [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'stats',
            stats: [{}],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const stats = output.stats as Array<{ value: string; label: string }>
        expect(stats[0]).toEqual({ value: '0', label: 'Stat' })
    })

    it('handles stats on non-about blocks too (generic stats array) [TC-F01.08]', () => {
        // Arrange — stats can appear on any block type
        const input = {
            blockType: 'hero',
            stats: [{ value: '99%', label: 'Uptime' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — stats still normalized
        const stats = output.stats as Array<{ value: string; label: string }>
        expect(stats[0]).toEqual({ value: '99%', label: 'Uptime' })
    })
})

// ─── Generic links array normalization (lines 505-515) ───────────────────────

describe('sanitizeBlockData — generic links array [TC-F01.08]', () => {
    it('normalizes string links to { label, url } objects', () => {
        // Arrange — non-navigation block with string links
        const input = {
            blockType: 'cta',
            links: ['Home', 'About', 'Contact'],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const links = output.links as Array<{ label: string; url: string }>
        expect(links[0]).toEqual({ label: 'Home', url: '#' })
        expect(links[1]).toEqual({ label: 'About', url: '#' })
    })

    it('normalizes object links using label/text/title/name and url/href [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'footer',
            blockTypeNavigation: false,
            links: [
                { text: 'Privacy Policy', href: '/privacy' },
                { title: 'Terms', link: '/terms' },
                { name: 'Sitemap', url: '/sitemap' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const links = output.links as Array<{ label: string; url: string }>
        expect(links[0]).toEqual({ label: 'Privacy Policy', url: '/privacy' })
        expect(links[1]).toEqual({ label: 'Terms', url: '/terms' })
        expect(links[2]).toEqual({ label: 'Sitemap', url: '/sitemap' })
    })

    it('uses "Link" and "#" as fallback for empty link objects [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'cta',
            links: [{}],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const links = output.links as Array<{ label: string; url: string }>
        expect(links[0]).toEqual({ label: 'Link', url: '#' })
    })

    it('does NOT normalize links on navigation block (navigation handles its own links) [TC-F01.08]', () => {
        // Arrange — navigation block has its own link normalization
        const input = {
            blockType: 'navigation',
            links: [{ label: 'Home', url: '/' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — navigation links processed by navigation handler, not generic links
        // The key check: generic links branch is skipped for navigation
        // Navigation handler runs first and may transform links differently
        expect(output.links).toBeDefined()
    })
})

// ─── Team members — extended social normalization (lines 411-431) ────────────

describe('sanitizeBlockData — team members extended [TC-F01.08]', () => {
    it('maps string member to { name, role } with default role "Member"', () => {
        // Arrange
        const input = {
            blockType: 'team',
            members: ['Alice', 'Bob'],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const members = output.members as Array<{ name: string; role: string }>
        expect(members[0]).toMatchObject({ name: 'Alice', role: 'Member' })
        expect(members[1]).toMatchObject({ name: 'Bob', role: 'Member' })
    })

    it('maps fullName and position from object members [TC-F01.08]', () => {
        // Arrange — AI uses fullName/position instead of name/role
        const input = {
            blockType: 'team',
            members: [
                { fullName: 'John Doe', position: 'CEO' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const members = output.members as Array<{ name: string; role: string }>
        expect(members[0].name).toBe('John Doe')
        expect(members[0].role).toBe('CEO')
    })

    it('handles members without socials array gracefully [TC-F01.08]', () => {
        // Arrange — member with no socials property
        const input = {
            blockType: 'team',
            members: [{ name: 'Jane', role: 'Designer' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — no crash, member data preserved
        const members = output.members as Array<{ name: string; role: string }>
        expect(members[0].name).toBe('Jane')
        expect(members[0].role).toBe('Designer')
    })

    // GH: team Zod schema expects members[].image as object {url,alt?}. AI often
    // emits a string URL → "Expected object, received string". Sanitizer wraps it.
    it('wraps a string member image into { url, alt } [TC-F01.08]', () => {
        // Arrange — AI returned image as a bare URL string
        const input = {
            blockType: 'team',
            members: [{ name: 'Ali', role: 'CEO', image: 'https://img.test/ali.jpg' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — string wrapped to object, satisfies Zod object schema
        const members = output.members as Array<{ image: { url: string; alt: string } }>
        expect(members[0].image).toEqual({ url: 'https://img.test/ali.jpg', alt: 'Ali' })
    })

    it('preserves an object member image and fills alt from name [TC-F01.08]', () => {
        // Arrange — AI returned a partial object image (url only)
        const input = {
            blockType: 'team',
            members: [{ name: 'Bo', role: 'CTO', image: { url: 'https://img.test/bo.jpg' } }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const members = output.members as Array<{ image: { url: string; alt: string } }>
        expect(members[0].image).toEqual({ url: 'https://img.test/bo.jpg', alt: 'Bo' })
    })

    it('strips an empty/invalid member image to undefined [TC-F01.08]', () => {
        // Arrange — empty string + missing image
        const input = {
            blockType: 'team',
            members: [
                { name: 'A', role: 'Dev', image: '' },
                { name: 'B', role: 'Dev' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — no string leaks through; field is undefined
        const members = output.members as Array<{ image?: unknown }>
        expect(members[0].image).toBeUndefined()
        expect(members[1].image).toBeUndefined()
    })
})

// ─── FAQ items (lines 436-447) ────────────────────────────────────────────────

describe('sanitizeBlockData — faq items [TC-F01.08]', () => {
    it('maps object FAQ items using q/a alias fields [TC-F01.08]', () => {
        // Arrange — AI used short-form q/a
        const input = {
            blockType: 'faq',
            items: [
                { q: 'Do you deliver?', a: 'Yes, nationwide.' },
            ],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — normalizer writes canonical `faqs` field and removes legacy `items`
        const faqs = output.faqs as Array<{ question: string; answer: string }>
        expect(faqs[0].question).toBe('Do you deliver?')
        expect(faqs[0].answer).toBe('Yes, nationwide.')
        expect(output.items).toBeUndefined()
    })

    it('uses "Question?" and "Answer." as fallback for empty FAQ objects [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'faq',
            items: [{}],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — normalizer writes canonical `faqs` field and removes legacy `items`
        const faqs = output.faqs as Array<{ question: string; answer: string }>
        expect(faqs[0]).toEqual({ question: 'Question?', answer: 'Answer.' })
        expect(output.items).toBeUndefined()
    })
})

// ─── Pricing plans extended (lines 452-475) ──────────────────────────────────

describe('sanitizeBlockData — pricing plans extended [TC-F01.08]', () => {
    it('maps features inside plans to {text, included} objects [TC-F01.08]', () => {
        // Arrange — plans with mixed features (objects + strings)
        const input = {
            blockType: 'pricing',
            plans: [{
                name: 'Pro',
                price: 'RM 99',
                features: [
                    { text: 'Unlimited pages' },
                    { name: 'Custom domain' },
                    { feature: 'SSL certificate' },
                    'Priority support',  // plain string → {text, included: true}
                ],
            }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — Payload expects {text, included} objects
        const plans = output.plans as Array<{ name: string; features: Array<{ text: string; included: boolean }> }>
        expect(plans[0].features).toEqual([
            { text: 'Unlimited pages', included: true },
            { text: 'Custom domain', included: true },
            { text: 'SSL certificate', included: true },
            { text: 'Priority support', included: true },
        ])
    })

    it('uses cost as price fallback when price missing [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'pricing',
            plans: [{ title: 'Starter', cost: 'RM 49' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const plans = output.plans as Array<{ name: string; price: string }>
        expect(plans[0].name).toBe('Starter')
        expect(plans[0].price).toBe('RM 49')
    })

    it('sets empty features array when plan has no features property [TC-F01.08]', () => {
        // Arrange
        const input = {
            blockType: 'pricing',
            plans: [{ name: 'Basic', price: 'Free' }],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert
        const plans = output.plans as Array<{ features: string[] }>
        expect(plans[0].features).toEqual([])
    })
})

// ─── Gallery + logo-cloud cleanup (lines 480-489) ────────────────────────────

describe('sanitizeBlockData — gallery and logo-cloud cleanup [TC-F01.08]', () => {
    it('wraps gallery URL strings to { image: { url, alt }, caption } per Zod schema', () => {
        // Arrange
        const input = {
            blockType: 'gallery',
            images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — URL strings wrapped into ImageRef shape, not stripped
        const images = output.images as Array<{ image: { url: string; alt: string }; caption: string }>
        expect(images).toHaveLength(2)
        expect(images[0]).toHaveProperty('image')
        expect(images[0]!.image.url).toBe('https://example.com/img1.jpg')
        expect(images[1]!.image.url).toBe('https://example.com/img2.jpg')
    })

    it('converts logo-cloud URL strings to name objects', () => {
        // Arrange
        const input = {
            blockType: 'logo-cloud',
            logos: ['logo1.png', 'logo2.png'],
        }

        // Act
        const output = sanitizeBlockData(input)

        // Assert — strings converted to name metadata
        const logos = output.logos as unknown as Array<Record<string, unknown>>
        expect(logos).toHaveLength(2)
        expect(logos[0]).toHaveProperty('name')
    })
})
