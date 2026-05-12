import { describe, it, expect } from 'vitest'
import {
    inferAddSectionType,
    getAddSectionLabel,
    isAddSectionInstruction,
    createAddSectionBlock,
    normalizeAddSectionBlock,
} from '@/lib/ai/add-section'

// ─── TC-F05.13: Add Block — Gọi thêm section mới qua lệnh AI ───────────
// ─── TC-F05.26: Social Widget — Gắn Widget Social Media ─────────────────
// ─── TC-F05.27: Cart UI — Component Giỏ Hàng ────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// inferAddSectionType
// ──────────────────────────────────────────────────────────────────────────
describe('inferAddSectionType [TC-F05.13]', () => {
    // Happy path — primary keyword match
    it('returns "testimonials" for "testimonial" keyword', () => {
        expect(inferAddSectionType('Add a testimonials section')).toBe('testimonials')
    })

    it('returns "testimonials" for "review" keyword', () => {
        expect(inferAddSectionType('Show me customer reviews')).toBe('testimonials')
    })

    it('returns "faq" for "faq" keyword', () => {
        expect(inferAddSectionType('Insert a faq block')).toBe('faq')
    })

    it('returns "faq" for "questions" keyword', () => {
        expect(inferAddSectionType('Add a questions section')).toBe('faq')
    })

    it('returns "faq" for "q&a" keyword', () => {
        expect(inferAddSectionType('create a q&a section')).toBe('faq')
    })

    it('returns "gallery" for "gallery" keyword', () => {
        expect(inferAddSectionType('insert a gallery section')).toBe('gallery')
    })

    it('returns "gallery" for "photos" keyword', () => {
        expect(inferAddSectionType('add some photos')).toBe('gallery')
    })

    it('returns "gallery" for "images" keyword', () => {
        expect(inferAddSectionType('create an images block')).toBe('gallery')
    })

    it('returns "features" for "features" keyword', () => {
        expect(inferAddSectionType('add a features section')).toBe('features')
    })

    it('returns "features" for "services" keyword', () => {
        expect(inferAddSectionType('append a services block')).toBe('features')
    })

    it('returns "features" for "benefits" keyword', () => {
        expect(inferAddSectionType('show the benefits')).toBe('features')
    })

    it('returns "team" for "team" keyword', () => {
        expect(inferAddSectionType('add a team section')).toBe('team')
    })

    it('returns "team" for "staff" keyword', () => {
        expect(inferAddSectionType('insert staff block')).toBe('team')
    })

    it('returns "team" for "members" keyword', () => {
        expect(inferAddSectionType('show team members')).toBe('team')
    })

    it('returns "newsletter" for "newsletter" keyword', () => {
        expect(inferAddSectionType('add newsletter section')).toBe('newsletter')
    })

    it('returns "newsletter" for "subscribe" keyword', () => {
        expect(inferAddSectionType('add a subscribe form')).toBe('newsletter')
    })

    it('returns "newsletter" for "email capture" keyword', () => {
        expect(inferAddSectionType('add email capture section')).toBe('newsletter')
    })

    it('returns "banner" for "banner" keyword', () => {
        expect(inferAddSectionType('insert a banner')).toBe('banner')
    })

    it('returns "banner" for "promo" keyword', () => {
        expect(inferAddSectionType('add promo section')).toBe('banner')
    })

    it('returns "cta" for "cta" keyword', () => {
        expect(inferAddSectionType('add cta block')).toBe('cta')
    })

    it('returns "cta" for "call to action" keyword', () => {
        expect(inferAddSectionType('insert a call to action')).toBe('cta')
    })

    it('returns "socialWidget" for "social media" keyword', () => {
        expect(inferAddSectionType('add social media widget')).toBe('socialWidget')
    })

    it('returns "whatsapp-button" for "whatsapp" keyword', () => {
        expect(inferAddSectionType('add whatsapp button')).toBe('whatsapp-button')
    })

    it('returns "socialWidget" for "facebook" keyword', () => {
        expect(inferAddSectionType('link to facebook')).toBe('socialWidget')
    })

    it('returns "socialWidget" for "instagram" keyword [TC-F05.26]', () => {
        expect(inferAddSectionType('show instagram link')).toBe('socialWidget')
    })

    // GH-960: cartWidget re-enabled — cart keywords now resolve to 'cartWidget'
    it('returns "cartWidget" for "cart" keyword [TC-F05.27]', () => {
        expect(inferAddSectionType('add a cart widget')).toBe('cartWidget')
    })

    it('returns "cartWidget" for "shopping cart" keyword', () => {
        expect(inferAddSectionType('add shopping cart')).toBe('cartWidget')
    })

    it('returns "cartWidget" for "checkout" keyword', () => {
        expect(inferAddSectionType('show checkout button')).toBe('cartWidget')
    })

    // requestedType is prepended to haystack — whichever SECTION_TYPE_MATCHERS entry
    // appears first in the array wins when both match. 'testimonials' comes before 'faq'
    // in SECTION_TYPE_MATCHERS, so instruction keywords still win over requestedType
    // when the instruction contains an earlier-matched keyword.
    it('uses requestedType when instruction has no matching keywords', () => {
        expect(inferAddSectionType('add something here', 'faq')).toBe('faq')
    })

    it('uses requestedType alone when instruction has no keywords', () => {
        expect(inferAddSectionType('add a new section', 'gallery')).toBe('gallery')
    })

    // Case insensitivity
    it('matches keywords case-insensitively', () => {
        expect(inferAddSectionType('Add TESTIMONIALS block')).toBe('testimonials')
        expect(inferAddSectionType('INSERT FAQ')).toBe('faq')
        expect(inferAddSectionType('Create a GALLERY')).toBe('gallery')
    })

    // Null for unknown
    it('returns null when no keyword matches', () => {
        expect(inferAddSectionType('add a completely unknown section type')).toBeNull()
    })

    it('returns null for empty instruction with no requestedType', () => {
        expect(inferAddSectionType('')).toBeNull()
    })

    // Word boundary — partial word should NOT match
    it('does not match "faq" inside unrelated word (word boundary)', () => {
        // "unfaq" should not match — \bfaq\b requires word boundary
        expect(inferAddSectionType('add an unfaq section')).toBeNull()
    })
})

// ──────────────────────────────────────────────────────────────────────────
// getAddSectionLabel
// ──────────────────────────────────────────────────────────────────────────
describe('getAddSectionLabel [TC-F05.13]', () => {
    it('returns "section" for null input', () => {
        expect(getAddSectionLabel(null)).toBe('section')
    })

    it('returns "testimonials" for testimonials type', () => {
        expect(getAddSectionLabel('testimonials')).toBe('testimonials')
    })

    it('returns "FAQ" (uppercase) for faq type', () => {
        expect(getAddSectionLabel('faq')).toBe('FAQ')
    })

    it('returns "gallery" for gallery type', () => {
        expect(getAddSectionLabel('gallery')).toBe('gallery')
    })

    it('returns "features" for features type', () => {
        expect(getAddSectionLabel('features')).toBe('features')
    })

    it('returns "team" for team type', () => {
        expect(getAddSectionLabel('team')).toBe('team')
    })

    it('returns "newsletter" for newsletter type', () => {
        expect(getAddSectionLabel('newsletter')).toBe('newsletter')
    })

    it('returns "banner" for banner type', () => {
        expect(getAddSectionLabel('banner')).toBe('banner')
    })

    it('returns "CTA" (uppercase) for cta type', () => {
        expect(getAddSectionLabel('cta')).toBe('CTA')
    })

    it('returns "social media" for socialWidget type', () => {
        expect(getAddSectionLabel('socialWidget')).toBe('social media')
    })

    it('returns "cart" for cartWidget type', () => {
        expect(getAddSectionLabel('cartWidget')).toBe('cart')
    })
})

// ──────────────────────────────────────────────────────────────────────────
// isAddSectionInstruction
// ──────────────────────────────────────────────────────────────────────────
describe('isAddSectionInstruction [TC-F05.13]', () => {
    it('returns true for "add" intent', () => {
        expect(isAddSectionInstruction('add a new section')).toBe(true)
    })

    it('returns true for "insert" intent', () => {
        expect(isAddSectionInstruction('insert a gallery')).toBe(true)
    })

    it('returns true for "append" intent', () => {
        expect(isAddSectionInstruction('append a banner')).toBe(true)
    })

    it('returns true for "create" intent', () => {
        expect(isAddSectionInstruction('create a team section')).toBe(true)
    })

    it('returns false when no add-intent keyword present', () => {
        expect(isAddSectionInstruction('show me the testimonials')).toBe(false)
    })

    it('returns false for empty string', () => {
        expect(isAddSectionInstruction('')).toBe(false)
    })

    it('matches case-insensitively', () => {
        expect(isAddSectionInstruction('ADD a faq block')).toBe(true)
        expect(isAddSectionInstruction('INSERT testimonials')).toBe(true)
    })
})

// ──────────────────────────────────────────────────────────────────────────
// createAddSectionBlock
// ──────────────────────────────────────────────────────────────────────────
describe('createAddSectionBlock — testimonials [TC-F05.13]', () => {
    it('returns testimonials block with blockType "testimonials"', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials' })
        expect(block?.blockType).toBe('testimonials')
    })

    it('defaults to 3 testimonials when no count specified', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials' }) as Record<string, unknown>
        expect(Array.isArray(block?.testimonials)).toBe(true)
        expect((block?.testimonials as unknown[]).length).toBe(3)
    })

    it('uses requested count from instruction (e.g., "5 reviews")', () => {
        const block = createAddSectionBlock({ instruction: 'add 5 reviews' }) as Record<string, unknown>
        expect((block?.testimonials as unknown[]).length).toBe(5)
    })

    it('caps testimonials count at 8', () => {
        const block = createAddSectionBlock({ instruction: 'add 99 testimonials' }) as Record<string, unknown>
        expect((block?.testimonials as unknown[]).length).toBe(8)
    })

    it('uses siteName in headline', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials', siteName: 'AcmeCo' }) as Record<string, unknown>
        expect(String(block?.headline)).toContain('AcmeCo')
    })

    it('falls back to "Your Brand" when siteName is missing', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials' }) as Record<string, unknown>
        expect(String(block?.headline)).toContain('Your Brand')
    })

    it('falls back to "Your Brand" when siteName is whitespace only', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials', siteName: '   ' }) as Record<string, unknown>
        expect(String(block?.headline)).toContain('Your Brand')
    })

    it('sets variant to "grid"', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials' }) as Record<string, unknown>
        expect(block?.variant).toBe('grid')
    })

    it('each testimonial has required fields: quote, name, title, company, rating', () => {
        const block = createAddSectionBlock({ instruction: 'add testimonials' }) as Record<string, unknown>
        const testimonials = block?.testimonials as Record<string, unknown>[]
        testimonials.forEach(t => {
            expect(t).toHaveProperty('quote')
            expect(t).toHaveProperty('name')
            expect(t).toHaveProperty('title')
            expect(t).toHaveProperty('company')
            expect(t).toHaveProperty('rating')
        })
    })
})

describe('createAddSectionBlock — faq [TC-F05.13]', () => {
    it('returns faq block with blockType "faq"', () => {
        const block = createAddSectionBlock({ instruction: 'add a faq section' })
        expect(block?.blockType).toBe('faq')
    })

    it('has exactly 3 default FAQ items', () => {
        const block = createAddSectionBlock({ instruction: 'add faq' }) as Record<string, unknown>
        expect(Array.isArray(block?.faqs)).toBe(true)
        expect((block?.faqs as unknown[]).length).toBe(3)
    })

    it('each faq item has question and answer fields', () => {
        const block = createAddSectionBlock({ instruction: 'add faq' }) as Record<string, unknown>
        const faqs = block?.faqs as Record<string, unknown>[]
        faqs.forEach(item => {
            expect(item).toHaveProperty('question')
            expect(item).toHaveProperty('answer')
        })
    })

    it('includes siteName in the FAQ headline', () => {
        const block = createAddSectionBlock({ instruction: 'add faq', siteName: 'MyStore' }) as Record<string, unknown>
        expect(String(block?.headline)).toContain('MyStore')
    })
})

describe('createAddSectionBlock — gallery [TC-F05.13]', () => {
    it('returns gallery block with blockType "gallery"', () => {
        const block = createAddSectionBlock({ instruction: 'add a gallery' })
        expect(block?.blockType).toBe('gallery')
    })

    it('defaults to 6 images when no count specified', () => {
        const block = createAddSectionBlock({ instruction: 'add gallery' }) as Record<string, unknown>
        expect((block?.images as unknown[]).length).toBe(6)
    })

    it('uses requested count from instruction (e.g., "4 photos")', () => {
        const block = createAddSectionBlock({ instruction: 'add 4 photos' }) as Record<string, unknown>
        expect((block?.images as unknown[]).length).toBe(4)
    })

    it('caps image count at 8', () => {
        const block = createAddSectionBlock({ instruction: 'add 20 images' }) as Record<string, unknown>
        expect((block?.images as unknown[]).length).toBe(8)
    })

    it('sets layout to "grid"', () => {
        const block = createAddSectionBlock({ instruction: 'add gallery' }) as Record<string, unknown>
        expect(block?.layout).toBe('grid')
    })
})

describe('createAddSectionBlock — features [TC-F05.13]', () => {
    it('returns features block with blockType "features"', () => {
        const block = createAddSectionBlock({ instruction: 'add features section' })
        expect(block?.blockType).toBe('features')
    })

    it('has exactly 3 default feature items', () => {
        const block = createAddSectionBlock({ instruction: 'add features' }) as Record<string, unknown>
        expect((block?.features as unknown[]).length).toBe(3)
    })

    it('sets layout to "grid-3"', () => {
        const block = createAddSectionBlock({ instruction: 'add features' }) as Record<string, unknown>
        expect(block?.layout).toBe('grid-3')
    })
})

describe('createAddSectionBlock — team [TC-F05.13]', () => {
    it('returns team block with blockType "team"', () => {
        const block = createAddSectionBlock({ instruction: 'add team section' })
        expect(block?.blockType).toBe('team')
    })

    it('has exactly 3 default team members', () => {
        const block = createAddSectionBlock({ instruction: 'add team' }) as Record<string, unknown>
        expect((block?.members as unknown[]).length).toBe(3)
    })

    it('each member has name, role, bio', () => {
        const block = createAddSectionBlock({ instruction: 'add team' }) as Record<string, unknown>
        const members = block?.members as Record<string, unknown>[]
        members.forEach(m => {
            expect(m).toHaveProperty('name')
            expect(m).toHaveProperty('role')
            expect(m).toHaveProperty('bio')
        })
    })
})

describe('createAddSectionBlock — newsletter / banner / cta [TC-F05.13]', () => {
    it('newsletter keeps newsletter blockType', () => {
        const block = createAddSectionBlock({ instruction: 'add newsletter' })
        expect(block?.blockType).toBe('newsletter')
        expect(block?.variant).toBe('inline')
    })

    it('banner maps to hero blockType', () => {
        const block = createAddSectionBlock({ instruction: 'add banner' })
        expect(block?.blockType).toBe('hero')
    })

    it('cta maps to hero blockType', () => {
        const block = createAddSectionBlock({ instruction: 'add cta' })
        expect(block?.blockType).toBe('hero')
    })

    it('newsletter block has subscription copy', () => {
        const block = createAddSectionBlock({ instruction: 'add newsletter' }) as Record<string, unknown>
        expect(block?.buttonLabel).toBe('Subscribe')
        expect(block?.placeholder).toBe('Enter your email')
    })
})

describe('createAddSectionBlock — socialWidget [TC-F05.26]', () => {
    it('returns socialWidget blockType', () => {
        const block = createAddSectionBlock({ instruction: 'add social widget' })
        expect(block?.blockType).toBe('socialWidget')
    })

    it('returns links array with at least one item', () => {
        const block = createAddSectionBlock({ instruction: 'add social media' }) as Record<string, unknown>
        expect(Array.isArray(block?.links)).toBe(true)
        expect((block?.links as unknown[]).length).toBeGreaterThan(0)
    })

    it('sets variant to "floating"', () => {
        const block = createAddSectionBlock({ instruction: 'add social media' }) as Record<string, unknown>
        expect(block?.variant).toBe('floating')
    })
})

// GH-960: cartWidget re-enabled — createAddSectionBlock returns block for cart instructions
describe('createAddSectionBlock — cartWidget [TC-F05.27]', () => {
    it('returns cartWidget block for "add cart widget" instruction', () => {
        const block = createAddSectionBlock({ instruction: 'add cart widget' })
        expect(block).toMatchObject({ blockType: 'cartWidget', variant: 'floating' })
    })

    it('returns cartWidget block for "add cart" instruction', () => {
        const block = createAddSectionBlock({ instruction: 'add cart' })
        expect(block).toMatchObject({ blockType: 'cartWidget', variant: 'floating' })
    })
})

describe('createAddSectionBlock — unknown / null cases [TC-F05.13]', () => {
    it('returns null when section type cannot be inferred', () => {
        const block = createAddSectionBlock({ instruction: 'do something random' })
        expect(block).toBeNull()
    })

    it('returns null for empty instruction with no requestedType', () => {
        const block = createAddSectionBlock({ instruction: '' })
        expect(block).toBeNull()
    })

    it('uses requestedType to override inference from instruction', () => {
        const block = createAddSectionBlock({ instruction: 'add something', requestedType: 'gallery' })
        expect(block?.blockType).toBe('gallery')
    })
})

// ──────────────────────────────────────────────────────────────────────────
// normalizeAddSectionBlock
// ──────────────────────────────────────────────────────────────────────────
describe('normalizeAddSectionBlock — basic merge [TC-F05.13]', () => {
    it('returns fallback block when no AI block provided', () => {
        const result = normalizeAddSectionBlock({ instruction: 'add testimonials', siteName: 'Brand' }, null)
        expect(result?.blockType).toBe('testimonials')
    })

    it('returns fallback block when AI block is undefined', () => {
        const result = normalizeAddSectionBlock({ instruction: 'add gallery' }, undefined)
        expect(result?.blockType).toBe('gallery')
    })

    it('returns undefined when section type cannot be inferred and no block given', () => {
        // normalizeAddSectionBlock returns block as BlockData | undefined when fallback is null.
        // When block input is also null, it casts null → undefined via "block as BlockData | undefined"
        // but the actual return is null (cast). We assert it is falsy (null or undefined).
        const result = normalizeAddSectionBlock({ instruction: 'random stuff' }, null)
        expect(result).toBeFalsy()
    })

    it('returns AI block unchanged when fallback cannot be created', () => {
        const aiBlock = { blockType: 'unknown-block-xyz', headline: 'Hello' }
        const result = normalizeAddSectionBlock({ instruction: 'random stuff' }, aiBlock)
        expect(result).toEqual(aiBlock)
    })

    it('merges AI block over fallback for simple fields', () => {
        const aiBlock = { blockType: 'team', headline: 'AI Custom Headline' }
        const result = normalizeAddSectionBlock({ instruction: 'add team' }, aiBlock) as Record<string, unknown>
        expect(result?.headline).toBe('AI Custom Headline')
        expect(result?.blockType).toBe('team')
    })
})

describe('normalizeAddSectionBlock — faq normalization [TC-F05.13]', () => {
    it('uses block.faqs when present', () => {
        const aiBlock = {
            blockType: 'faq',
            faqs: [{ question: 'Q1?', answer: 'A1.' }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add faq' }, aiBlock) as Record<string, unknown>
        expect(Array.isArray(result?.faqs)).toBe(true)
        const faqs = result?.faqs as Record<string, unknown>[]
        expect(faqs[0].question).toBe('Q1?')
    })

    it('falls back to block.items when faqs is absent', () => {
        const aiBlock = {
            blockType: 'faq',
            items: [{ question: 'ItemQ?', answer: 'ItemA.' }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add faq' }, aiBlock) as Record<string, unknown>
        const faqs = result?.faqs as Record<string, unknown>[]
        expect(faqs[0].question).toBe('ItemQ?')
    })

    it('removes "items" and "variant" keys from normalized faq block', () => {
        const aiBlock = { blockType: 'faq', items: [], variant: 'accordion' }
        const result = normalizeAddSectionBlock({ instruction: 'add faq' }, aiBlock) as Record<string, unknown>
        expect(result).not.toHaveProperty('items')
        expect(result).not.toHaveProperty('variant')
    })
})

describe('normalizeAddSectionBlock — testimonials normalization [TC-F05.13]', () => {
    it('preserves avatar field and whitelists valid testimonial fields', () => {
        const aiBlock = {
            blockType: 'testimonials',
            testimonials: [
                { quote: 'Great!', name: 'Ali', avatar: 'url/avatar.jpg', rating: 5, junk: true },
            ],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add testimonials' }, aiBlock) as Record<string, unknown>
        const testimonials = result?.testimonials as Record<string, unknown>[]
        expect(testimonials[0]).toHaveProperty('avatar')
        expect(testimonials[0]).not.toHaveProperty('junk')
        expect(testimonials[0].quote).toBe('Great!')
    })

    it('defaults to "grid" variant when variant is invalid', () => {
        const aiBlock = { blockType: 'testimonials', variant: 'unknown-variant', testimonials: [] }
        const result = normalizeAddSectionBlock({ instruction: 'add testimonials' }, aiBlock) as Record<string, unknown>
        expect(result?.variant).toBe('grid')
    })

    it('preserves valid variant values', () => {
        const validVariants = ['carousel', 'grid', 'masonry', 'single']
        validVariants.forEach(v => {
            const aiBlock = { blockType: 'testimonials', variant: v, testimonials: [] }
            const result = normalizeAddSectionBlock({ instruction: 'add testimonials' }, aiBlock) as Record<string, unknown>
            expect(result?.variant).toBe(v)
        })
    })
})

describe('normalizeAddSectionBlock — gallery normalization [TC-F05.13]', () => {
    it('preserves image field and whitelists valid gallery fields', () => {
        const aiBlock = {
            blockType: 'gallery',
            images: [{ caption: 'Photo 1', image: 'url/photo.jpg', junk: true }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add gallery' }, aiBlock) as Record<string, unknown>
        const images = result?.images as Record<string, unknown>[]
        expect(images[0]).toHaveProperty('image')
        expect(images[0]).not.toHaveProperty('junk')
        expect(images[0].caption).toBe('Photo 1')
    })

    it('defaults to "grid" layout when layout is invalid', () => {
        const aiBlock = { blockType: 'gallery', layout: 'invalid-layout', images: [] }
        const result = normalizeAddSectionBlock({ instruction: 'add gallery' }, aiBlock) as Record<string, unknown>
        expect(result?.layout).toBe('grid')
    })

    it('accepts valid gallery layouts', () => {
        const validLayouts = ['masonry', 'grid', 'carousel', 'lightbox']
        validLayouts.forEach(l => {
            const aiBlock = { blockType: 'gallery', layout: l, images: [] }
            const result = normalizeAddSectionBlock({ instruction: 'add gallery' }, aiBlock) as Record<string, unknown>
            expect(result?.layout).toBe(l)
        })
    })

    it('removes "variant" key from gallery block', () => {
        const aiBlock = { blockType: 'gallery', variant: 'some-variant', images: [] }
        const result = normalizeAddSectionBlock({ instruction: 'add gallery' }, aiBlock) as Record<string, unknown>
        expect(result).not.toHaveProperty('variant')
    })
})

describe('normalizeAddSectionBlock — features normalization [TC-F05.13]', () => {
    it('uses block.features when present', () => {
        const aiBlock = {
            blockType: 'features',
            features: [{ icon: '⚡', title: 'Fast', description: 'Very fast.' }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add features' }, aiBlock) as Record<string, unknown>
        const features = result?.features as Record<string, unknown>[]
        expect(features[0].title).toBe('Fast')
    })

    it('falls back to block.items when features is absent', () => {
        const aiBlock = {
            blockType: 'features',
            items: [{ icon: '🛡️', title: 'Safe', description: 'Very safe.' }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add features' }, aiBlock) as Record<string, unknown>
        const features = result?.features as Record<string, unknown>[]
        expect(features[0].title).toBe('Safe')
    })

    it('defaults to "grid-3" when layout is invalid', () => {
        const aiBlock = { blockType: 'features', layout: 'bad-layout', features: [] }
        const result = normalizeAddSectionBlock({ instruction: 'add features' }, aiBlock) as Record<string, unknown>
        expect(result?.layout).toBe('grid-3')
    })

    it('removes "variant" key from features block', () => {
        const aiBlock = { blockType: 'features', variant: 'foo', features: [] }
        const result = normalizeAddSectionBlock({ instruction: 'add features' }, aiBlock) as Record<string, unknown>
        expect(result).not.toHaveProperty('variant')
    })
})

describe('normalizeAddSectionBlock — team normalization [TC-F05.13]', () => {
    it('strips image field from each team member', () => {
        const aiBlock = {
            blockType: 'team',
            members: [{ name: 'Ali', role: 'CEO', image: 'url/ali.jpg', bio: 'Founder.' }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add team' }, aiBlock) as Record<string, unknown>
        const members = result?.members as Record<string, unknown>[]
        expect(members[0]).not.toHaveProperty('image')
        expect(members[0].name).toBe('Ali')
    })

    it('removes "variant" key from team block', () => {
        const aiBlock = { blockType: 'team', variant: 'bar', members: [] }
        const result = normalizeAddSectionBlock({ instruction: 'add team' }, aiBlock) as Record<string, unknown>
        expect(result).not.toHaveProperty('variant')
    })
})

describe('normalizeAddSectionBlock — newsletter/banner/cta remapping [TC-F05.13]', () => {
    it('keeps newsletter blockType', () => {
        const aiBlock = { blockType: 'newsletter', headline: 'Subscribe' }
        const result = normalizeAddSectionBlock({ instruction: 'add newsletter' }, aiBlock) as Record<string, unknown>
        expect(result?.blockType).toBe('newsletter')
        expect(result?.variant).toBe('inline')
    })

    it('remaps banner blockType to "hero"', () => {
        const aiBlock = { blockType: 'banner', headline: 'Promo' }
        const result = normalizeAddSectionBlock({ instruction: 'add banner' }, aiBlock) as Record<string, unknown>
        expect(result?.blockType).toBe('hero')
    })

    it('remaps cta blockType to "hero"', () => {
        const aiBlock = { blockType: 'cta', headline: 'Get Started' }
        const result = normalizeAddSectionBlock({ instruction: 'add cta' }, aiBlock) as Record<string, unknown>
        expect(result?.blockType).toBe('hero')
    })
})

describe('normalizeAddSectionBlock — socialWidget [TC-F05.26]', () => {
    it('returns socialWidget block with links array', () => {
        const aiBlock = {
            blockType: 'socialWidget',
            links: [{ platform: 'facebook', url: 'https://facebook.com/test', enabled: true }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add social' }, aiBlock) as Record<string, unknown>
        expect(result?.blockType).toBe('socialWidget')
        expect(Array.isArray(result?.links)).toBe(true)
    })

    it('normalizes invalid platform to "facebook"', () => {
        const aiBlock = {
            blockType: 'socialWidget',
            links: [{ platform: 'tiktok', url: 'https://tiktok.com', enabled: true }],
        }
        const result = normalizeAddSectionBlock({ instruction: 'add social' }, aiBlock) as Record<string, unknown>
        const links = result?.links as Record<string, unknown>[]
        expect(links[0].platform).toBe('facebook')
    })
})

// ──────────────────────────────────────────────────────────────────────────
// BUG-F05-04: Placeholder images & normalize whitelist
// ──────────────────────────────────────────────────────────────────────────

describe('BUG-F05-04: Gallery placeholder images', () => {
    it('createAddSectionBlock returns gallery images with valid image structure', () => {
        const result = createAddSectionBlock({ instruction: 'add gallery', siteName: 'Test' })
        expect(result?.blockType).toBe('gallery')
        const images = (result as Record<string, unknown>).images as Record<string, unknown>[]
        expect(images.length).toBeGreaterThan(0)
        expect(images[0]).toHaveProperty('image')
        expect(images[0]).toHaveProperty('caption')
        const img = images[0].image as Record<string, unknown>
        expect(img).toHaveProperty('url')
        // url is intentionally empty so the gallery block's render-time fallback
        // picks the correct category + S3 images (GH-727 fix)
        expect(typeof img.url).toBe('string')
    })

    it('normalizeAddSectionBlock preserves gallery image structure', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add gallery', siteName: 'Test' },
            { blockType: 'gallery', variant: 'grid' },
        ) as Record<string, unknown>
        const images = result.images as Record<string, unknown>[]
        expect(images.length).toBeGreaterThan(0)
        expect(images[0]).toHaveProperty('image')
        const img = images[0].image as Record<string, unknown>
        expect(img).toHaveProperty('url')
    })

    it('normalizeAddSectionBlock strips unknown fields from gallery images', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add gallery', siteName: 'Test' },
            { blockType: 'gallery', variant: 'grid', images: [{ image: { url: '/test.jpg', alt: 'Test' }, caption: 'C', unknownField: 'junk' }] },
        ) as Record<string, unknown>
        const images = result.images as Record<string, unknown>[]
        expect(images[0]).not.toHaveProperty('unknownField')
        expect(images[0]).toHaveProperty('image')
        expect(images[0]).toHaveProperty('caption')
    })
})

describe('BUG-F05-04: Team placeholder avatars', () => {
    it('createAddSectionBlock returns team members with avatar', () => {
        const result = createAddSectionBlock({ instruction: 'add team', siteName: 'Test' })
        expect(result?.blockType).toBe('team')
        const members = (result as Record<string, unknown>).members as Record<string, unknown>[]
        expect(members.length).toBeGreaterThan(0)
        expect(members[0]).toHaveProperty('avatar')
        const avatar = members[0].avatar as Record<string, unknown>
        expect(avatar).toHaveProperty('url')
        expect(typeof avatar.url).toBe('string')
    })

    it('normalizeAddSectionBlock whitelists team member fields', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add team', siteName: 'Test' },
            { blockType: 'team', members: [{ name: 'A', role: 'Dev', bio: 'Bio', avatar: { url: '/a.jpg' }, extraField: 'junk' }] },
        ) as Record<string, unknown>
        const members = result.members as Record<string, unknown>[]
        expect(members[0]).not.toHaveProperty('extraField')
        expect(members[0]).toHaveProperty('name')
        expect(members[0]).toHaveProperty('avatar')
    })
})

describe('BUG-F05-04: Testimonials normalize', () => {
    it('normalizeAddSectionBlock whitelists testimonial fields', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add testimonials', siteName: 'Test' },
            { blockType: 'testimonials', variant: 'grid', testimonials: [{ quote: 'Great', name: 'A', title: 'CEO', company: 'Co', rating: 5, avatar: { url: '/a.jpg' }, junk: true }] },
        ) as Record<string, unknown>
        const testimonials = result.testimonials as Record<string, unknown>[]
        expect(testimonials[0]).not.toHaveProperty('junk')
        expect(testimonials[0]).toHaveProperty('quote')
        expect(testimonials[0]).toHaveProperty('avatar')
    })

    it('normalizeAddSectionBlock works without avatar in testimonials', () => {
        const result = normalizeAddSectionBlock(
            { instruction: 'add testimonials', siteName: 'Test' },
            { blockType: 'testimonials', variant: 'grid' },
        ) as Record<string, unknown>
        const testimonials = result.testimonials as Record<string, unknown>[]
        expect(testimonials.length).toBeGreaterThan(0)
        expect(testimonials[0]).toHaveProperty('quote')
        expect(testimonials[0]).toHaveProperty('name')
    })
})
