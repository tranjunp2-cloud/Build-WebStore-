/**
 * TC-AIAUD-013..018 — FACTS: the one grounded source for claims on a generated site (#2103 A1).
 */
import { describe, it, expect } from 'vitest'
import {
  buildGenerationFacts,
  collectPlaceholders,
  extractYearStarted,
  factsToPromptSection,
  TESTIMONIAL_INVITE_TITLE,
} from '@/lib/ai/generation-facts'
import { enforceGroundedBlocks, groundedFaq, groundedStats, groundedTestimonials } from '@/lib/ai/grounded-blocks'
import { buildUserPrompt, buildPersonalizePrompt } from '@/lib/ai/system-prompt'

const businessInfo = {
  businessName: 'Dapur Kak Yah',
  shortDescription: 'Home bakery in Klang',
  products: 'Kek lapis (whole RM65, half RM35), kuih raya box RM48, birthday from RM120',
  phone: '012-3456789',
  email: 'hello@kakyah.my',
  buyingMethods: ['delivery', 'cod', 'walk_in'] as const,
  serviceArea: 'Klang Valley',
  shopFacts: 'Started in 2015. 500 customers served.',
}

describe('buildGenerationFacts (TC-AIAUD-013..014)', () => {
  it('TC-AIAUD-013: merges form answers, tenant (WhatsApp, address, enabled payments) and site (socials, address)', () => {
    // Arrange / Act
    const facts = buildGenerationFacts({
      businessInfo: { ...businessInfo, buyingMethods: [...businessInfo.buyingMethods] },
      tenant: {
        whatsappNumber: '60123456789',
        businessAddress: 'No 1, Jalan Kek, Klang',
        payments: { payment_fpx: true, payment_cod: true, payment_card: false, xendit_tng: true },
      },
      site: { socialLinks: { instagram: 'https://instagram.com/kakyah', facebook: '' } },
    })
    // Assert
    expect(facts.brand).toBe('Dapur Kak Yah')
    expect(facts.products.map((p) => [p.name, p.price])).toEqual([['Kek lapis', 65], ['kuih raya box', 48], ['birthday', 120]])
    expect(facts.contact).toEqual({ phone: '012-3456789', email: 'hello@kakyah.my', address: 'No 1, Jalan Kek, Klang', whatsapp: '60123456789' })
    expect(facts.paymentMethods).toEqual(['FPX', "Touch 'n Go", 'Cash on delivery'])
    expect(facts.socialLinks).toEqual([{ platform: 'instagram', url: 'https://instagram.com/kakyah' }])
    expect(facts.buyingMethods).toEqual(['delivery', 'cod', 'walk_in'])
    expect(facts.serviceArea).toBe('Klang Valley')
    expect(facts.yearStarted).toBe(2015)
  })

  it('TC-AIAUD-014: contentBrief supplies only REAL items; stats need two facts; junk is dropped', () => {
    const facts = buildGenerationFacts({
      businessInfo: { businessName: 'Acme', products: 'one, two' },
      contentBrief: {
        referenceContent: {
          testimonials: [{ quote: 'Lovely cake', name: 'Siti', role: 'Customer' }, { quote: '', name: 'x' }, 'junk'],
          faqItems: [{ question: 'Q?', answer: 'A.' }, { question: 'only q' }],
          socialProofStats: [{ number: '1200', label: 'orders' }],
          contactInfo: { phone: '03-1111' },
        },
      },
    })
    expect(facts.reviews).toEqual([{ quote: 'Lovely cake', name: 'Siti', role: 'Customer' }])
    expect(facts.faqItems).toEqual([{ question: 'Q?', answer: 'A.' }])
    expect(facts.contact.phone).toBe('03-1111')
    // 1200 orders (site) + 2 products listed = 2 real stats
    expect(groundedStats(facts)).toEqual([{ value: '1200', label: 'orders' }, { value: '2', label: 'Products' }])
    // one fact alone is not enough for a stats row
    expect(groundedStats(buildGenerationFacts({ businessInfo: { businessName: 'Acme', products: 'one', shopFacts: 'Since 2010' } }))).toEqual([])
    expect(extractYearStarted('Founded in 2012, 2099 plans')).toBe(2012)
    expect(extractYearStarted('we have 2015 customers')).toBeUndefined()
    expect(extractYearStarted('since 2999')).toBeUndefined()
  })
})

describe('prompts (TC-AIAUD-015)', () => {
  it('TC-AIAUD-015: the FACTS section lists only facts and forbids invented claims; hero personalize prompt too', () => {
    const facts = buildGenerationFacts({ businessInfo: { ...businessInfo, buyingMethods: ['delivery'] }, tenant: { payments: { payment_fpx: true } } })
    const prompt = buildUserPrompt({ ...businessInfo, industry: 'fnb', buyingMethods: ['delivery'] }, { facts, language: 'en' })
    expect(prompt).toContain('FACTS (the ONLY source for claims about this business)')
    expect(prompt).toContain('Kek lapis (RM65)')
    expect(prompt).toContain('birthday (from RM120)')
    expect(prompt).toContain('Payment methods enabled: FPX')
    expect(prompt).toContain('Facts the merchant stated')
    expect(prompt).toMatch(/never invent people, quotes, ratings/i)
    // the old instruction to make up reviewers is gone
    expect(prompt).not.toMatch(/sound realistic/i)
    // the facts lines themselves never mention certifications the merchant did not state
    expect(factsToPromptSection(facts).split('GROUNDING RULES')[0]).not.toMatch(/halal|jakim/i)
    const personalize = buildPersonalizePrompt({ ...businessInfo, industry: 'fnb' }, 'fnb', 'en')
    expect(personalize.system).toMatch(/never invent certifications/i)
    expect(personalize.user).toContain('Started in 2015')
  })
})

describe('collectPlaceholders (TC-AIAUD-016)', () => {
  it('TC-AIAUD-016: flags invitation card, empty stats/logos/faq/pricing, brand team card, price-less menu', () => {
    const facts = buildGenerationFacts({ businessInfo: { businessName: 'Acme' } })
    const pages = [
      {
        slug: '/',
        layout: [
          { blockType: 'hero' },
          { blockType: 'testimonials', testimonials: groundedTestimonials(facts) },
          { blockType: 'stats', stats: [] },
          { blockType: 'logo-cloud', logos: [] },
          { blockType: 'faq', items: [] },
          { blockType: 'pricing', plans: [] },
          { blockType: 'team', members: [{ name: 'The Acme team', role: 'Founder' }] },
          { blockType: 'menu-food', categories: [{ name: 'x', items: [{ name: 'Kek', price: '' }] }] },
        ],
      },
      { slug: '/about', layout: [{ blockType: 'testimonials', testimonials: [{ quote: 'Real', name: 'Siti' }] }] },
    ]
    const placeholders = collectPlaceholders(pages, facts)
    expect(placeholders.map((p) => `${p.pageSlug}:${p.blockType}`)).toEqual([
      '/:testimonials', '/:stats', '/:logo-cloud', '/:faq', '/:pricing', '/:team', '/:menu-food',
    ])
    expect(placeholders[0]).toEqual({ pageSlug: '/', blockType: 'testimonials', label: 'Customer reviews' })
    expect(groundedTestimonials(facts)[0]!.title).toBe(TESTIMONIAL_INVITE_TITLE)
  })
})

describe('enforceGroundedBlocks (TC-AIAUD-017..018) — AI-written pages', () => {
  const facts = buildGenerationFacts({
    businessInfo: { businessName: 'Acme', products: 'Kek lapis RM65', shopFacts: 'Halal certified by JAKIM since 2015', phone: '012' },
  })
  const aiBlocks = [
    { blockType: 'testimonials', testimonials: [{ quote: 'Best cake ever', name: 'Aisyah Razali', rating: 5 }] },
    { blockType: 'stats', stats: [{ value: '500', label: 'Happy Customers', suffix: '+' }, { value: '4.9', label: 'Rating' }] },
    { blockType: 'team', members: [{ name: 'Chef Azman', role: 'Executive Chef', bio: 'Le Cordon Bleu' }] },
    { blockType: 'logo-cloud', logos: [{ name: 'Maybank', logo: { url: '' } }] },
    { blockType: 'faq', items: [{ question: 'Are you halal?', answer: 'Yes, JAKIM certified.' }] },
    { blockType: 'pricing', plans: [{ name: 'Gold', price: 'RM 999' }] },
  ]

  it('TC-AIAUD-209: AI stats are replaced by the real facts - a model number that merely matches a real digit is not kept', () => {
    const real = buildGenerationFacts({
      businessInfo: { businessName: 'Acme', products: 'Kek lapis RM65, Brownies RM30, Cookies RM20, Tart RM40, Roti RM8', shopFacts: 'Since 2015' },
    })
    expect(real.stats).toEqual([{ value: '2015', label: 'year-started' }, { value: '5', label: 'products' }])
    const out = enforceGroundedBlocks(
      [{ blockType: 'stats', stats: [{ value: '5', label: '★ rating', suffix: '' }, { value: '2015', label: 'Awards won' }] }],
      real,
      'en',
    )
    expect(out[0]!.stats).toEqual([{ value: '2015', label: 'Year started' }, { value: '5', label: 'Products' }])
    expect(JSON.stringify(out)).not.toMatch(/rating|Awards/)
  })

  it('TC-AIAUD-017: replaces invented reviewers, numbers, staff, brands, FAQ and plans with FACTS-backed items', () => {
    const out = enforceGroundedBlocks(aiBlocks, facts, 'en')
    const byType = Object.fromEntries(out.map((b) => [b.blockType as string, b]))
    expect((byType.testimonials!.testimonials as Array<{ quote: string }>)[0]!.quote).toBe('Be the first to review Acme')
    expect(byType.stats!.stats).toEqual([])
    expect(byType.team!.members).toEqual([{ name: 'The Acme team', role: 'Founder' }])
    expect(byType['logo-cloud']!.logos).toEqual([])
    expect((byType.faq!.items as Array<{ question: string }>).map((i) => i.question)).toEqual([
      'How can I contact Acme?', 'What does Acme offer?',
    ])
    expect((byType.pricing!.plans as Array<{ name: string; price: string }>).map((p) => `${p.name}:${p.price}`)).toEqual(['Kek lapis:RM 65'])
    expect(JSON.stringify(out)).not.toMatch(/Aisyah|Azman|Maybank|Gold/)
    // input untouched
    expect((aiBlocks[0] as { testimonials: unknown[] }).testimonials).toHaveLength(1)
  })

  it('TC-AIAUD-018: strips halal / delivery-partner / discount claims unless the merchant stated them', () => {
    const features = {
      blockType: 'features',
      headline: 'Why us',
      subheadline: 'Fresh daily. Order on GrabFood today.',
      features: [
        { icon: 'Award', title: 'Halal Certified', description: 'JAKIM approved.' },
        { icon: 'Cake', title: 'Kek lapis', description: 'Layered cake.' },
        { icon: 'Tag', title: 'Sale', description: '20% off this week!' },
      ],
    }
    const noClaims = buildGenerationFacts({ businessInfo: { businessName: 'Acme', products: 'Kek lapis' } })
    const [scrubbed] = enforceGroundedBlocks([features], noClaims, 'en') as Array<typeof features>
    expect(scrubbed!.subheadline).toBe('Fresh daily.')
    expect(scrubbed!.features.map((f) => f.title)).toEqual(['Kek lapis'])
    // an item that makes the claim is dropped whole; clean items stay untouched
    expect(JSON.stringify(scrubbed)).not.toMatch(/halal|jakim|grabfood|20%/i)
    // the merchant DID say halal → kept
    const [kept] = enforceGroundedBlocks([features], facts, 'en') as Array<typeof features>
    expect(kept!.features.map((f) => f.title)).toContain('Halal Certified')
    expect(kept!.subheadline).toBe('Fresh daily.') // GrabFood was never stated
  })

  it('FAQ answers use only facts (contact / offer / how to order / area)', () => {
    const items = groundedFaq(buildGenerationFacts({ businessInfo }), 'ms')
    expect(items.map((i) => i.question)).toEqual([
      'Bagaimana saya boleh menghubungi Dapur Kak Yah?',
      'Apakah yang ditawarkan oleh Dapur Kak Yah?',
      'Bagaimana saya membuat tempahan?',
      'Kawasan mana yang anda layani?',
    ])
  })
})
