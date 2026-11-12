/**
 * FACTS — the one object per generation that every claim on a generated site
 * must come from (#2103 A1). Built from what the merchant told us (form, URL
 * import, account/tenant/site data) and nothing else: no invented people,
 * quotes, ratings, numbers, certifications, partners or discounts.
 *
 * Pure functions only — no I/O. The caller (generate-site-service) loads the
 * tenant/site docs and passes them in; tests import this module directly.
 */

import { parseProducts, type ParsedProduct } from './business-info-mapper'
import { sanitizeForPrompt } from './sanitize-user-input'
import { TESTIMONIAL_INVITE_TITLE } from '@/blocks/testimonials/config'

export const BUYING_METHOD_VALUES = [
  'delivery',
  'pickup',
  'walk_in',
  'booking',
  'cod',
  'online_payment',
] as const
export type BuyingMethodValue = (typeof BUYING_METHOD_VALUES)[number]

export type FactsReview = { quote: string; name: string; role?: string }
export type FactsFaq = { question: string; answer: string }
export type FactsStat = { value: string; label: string }

export type GenerationFacts = {
  brand: string
  description?: string
  contact: { phone?: string; email?: string; address?: string; whatsapp?: string }
  websiteUrl?: string
  socialLinks: Array<{ platform: string; url: string }>
  buyingMethods: BuyingMethodValue[]
  serviceArea?: string
  /** Free text the merchant typed in "Facts we can say" (year started, certifications, awards). */
  shopFacts?: string
  yearStarted?: number
  /** Products the merchant listed (name + optional price), capped at MAX_LISTED_PRODUCTS. */
  products: ParsedProduct[]
  /** Labels of payment methods enabled on the tenant ("FPX", "Cash on delivery", ...). */
  paymentMethods: string[]
  /** Real items from a URL import (contentBrief) — the merchant's own website. */
  reviews: FactsReview[]
  faqItems: FactsFaq[]
  stats: FactsStat[]
  features: Array<{ title: string; description: string }>
  aboutText?: string
}

type TenantFactsSource = {
  whatsappNumber?: unknown
  businessAddress?: unknown
  payments?: Record<string, unknown> | null
}

type SiteFactsSource = {
  contactInfo?: { phone?: unknown; email?: unknown; address?: unknown } | null
  socialLinks?: Record<string, unknown> | null
  localBusiness?: {
    streetAddress?: unknown
    city?: unknown
    state?: unknown
    postcode?: unknown
    serviceAreaDescription?: unknown
  } | null
}

export type BuildFactsInput = {
  businessInfo: {
    businessName: string
    shortDescription?: string
    products?: string
    phone?: string
    email?: string
    address?: string
    businessUrl?: string
    buyingMethods?: readonly string[]
    serviceArea?: string
    shopFacts?: string
  }
  /** Raw `contentBrief` from the request (unvalidated JSON from URL/image import). */
  contentBrief?: unknown
  tenant?: TenantFactsSource | null
  site?: SiteFactsSource | null
}

/** Tenant payment toggles → merchant-facing label. Order = display order. */
const PAYMENT_LABELS: ReadonlyArray<[string, string]> = [
  ['payment_card', 'Card'],
  ['payment_fpx', 'FPX'],
  ['xendit_fpx', 'FPX'],
  ['xendit_tng', "Touch 'n Go"],
  ['xendit_grabpay', 'GrabPay'],
  ['xendit_duitnow', 'DuitNow'],
  ['xendit_shopeepay', 'ShopeePay'],
  ['xendit_boost', 'Boost'],
  ['xendit_mae', 'MAE'],
  ['payment_qr', 'QR payment'],
  ['payment_cod', 'Cash on delivery'],
]

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'] as const

function str(v: unknown, max = 300): string | undefined {
  if (typeof v !== 'string') return undefined
  const cleaned = (sanitizeForPrompt(v) ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, max) : undefined
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

const YEAR_RE =
  /(?:since|started|founded|established|est\.?|opened|operating since|sejak|ditubuhkan|dibuka|mula beroperasi|từ năm|thành lập|bắt đầu|hoạt động từ)\s*(?:in|pada|vào)?\s*(?:năm\s*)?((?:19[5-9]\d|20[0-4]\d))/i

/** "Since 2015" / "started in 2015" → 2015. Only a year the merchant stated, never inferred. */
export function extractYearStarted(text: string | undefined, now = new Date()): number | undefined {
  if (!text) return undefined
  const m = text.match(YEAR_RE)
  if (!m) return undefined
  const year = Number(m[1])
  return year <= now.getFullYear() ? year : undefined
}

function readContentBrief(raw: unknown) {
  const ref = rec(rec(raw).referenceContent)
  const reviews: FactsReview[] = []
  for (const t of arr(ref.testimonials)) {
    const o = rec(t)
    const quote = str(o.quote, 500)
    const name = str(o.name, 80)
    if (!quote || !name) continue
    const role = str(o.role, 80)
    reviews.push({ quote, name, ...(role ? { role } : {}) })
    if (reviews.length >= 6) break
  }
  const faqItems: FactsFaq[] = []
  for (const f of arr(ref.faqItems)) {
    const o = rec(f)
    const question = str(o.question, 200)
    const answer = str(o.answer, 600)
    if (question && answer) faqItems.push({ question, answer })
    if (faqItems.length >= 8) break
  }
  const stats: FactsStat[] = []
  for (const s of arr(ref.socialProofStats)) {
    const o = rec(s)
    const value = str(o.number ?? o.value, 20)
    const label = str(o.label, 60)
    if (value && label) stats.push({ value, label })
    if (stats.length >= 4) break
  }
  const features: Array<{ title: string; description: string }> = []
  for (const f of arr(ref.featuresList)) {
    const o = rec(f)
    const title = str(o.title, 80)
    const description = str(o.description, 300)
    if (title && description) features.push({ title, description })
    if (features.length >= 6) break
  }
  const contact = rec(ref.contactInfo)
  return {
    reviews,
    faqItems,
    stats,
    features,
    aboutText: str(ref.aboutText, 800),
    contact: {
      phone: str(contact.phone, 40),
      email: str(contact.email, 100),
      address: str(contact.address, 300),
    },
  }
}

export function buildGenerationFacts(input: BuildFactsInput): GenerationFacts {
  const { businessInfo, tenant, site } = input
  const brief = readContentBrief(input.contentBrief)

  const siteAddress = (() => {
    const lb = site?.localBusiness
    if (!lb) return undefined
    const parts = [lb.streetAddress, lb.postcode, lb.city, lb.state].map((p) => str(p, 120)).filter(Boolean)
    return parts.length >= 2 ? parts.join(', ') : undefined
  })()

  const contact = {
    phone: str(businessInfo.phone, 40) ?? str(site?.contactInfo?.phone, 40) ?? brief.contact.phone,
    email: str(businessInfo.email, 100) ?? str(site?.contactInfo?.email, 100) ?? brief.contact.email,
    address:
      str(businessInfo.address, 300) ??
      str(site?.contactInfo?.address, 300) ??
      str(tenant?.businessAddress, 300) ??
      siteAddress ??
      brief.contact.address,
    whatsapp: str(tenant?.whatsappNumber, 30),
  }

  const payments = tenant?.payments ?? {}
  const paymentMethods: string[] = []
  for (const [key, label] of PAYMENT_LABELS) {
    if (payments[key] === true && !paymentMethods.includes(label)) paymentMethods.push(label)
  }

  const socialLinks: GenerationFacts['socialLinks'] = []
  for (const platform of SOCIAL_PLATFORMS) {
    const url = str(site?.socialLinks?.[platform], 300)
    if (url) socialLinks.push({ platform, url })
  }

  const buyingMethods = [
    ...new Set(
      (businessInfo.buyingMethods ?? []).filter((m): m is BuyingMethodValue =>
        (BUYING_METHOD_VALUES as readonly string[]).includes(m),
      ),
    ),
  ]

  const products = parseProducts(businessInfo.products)
  const shopFacts = str(businessInfo.shopFacts, 500)
  const yearStarted = extractYearStarted(shopFacts)

  // Real numbers only: the merchant's own site stats, the year they said they started,
  // and how many products they listed.
  const stats: FactsStat[] = [...brief.stats]
  if (yearStarted) stats.push({ value: String(yearStarted), label: 'year-started' })
  if (products.length >= 2) stats.push({ value: String(products.length), label: 'products' })

  return {
    brand: str(businessInfo.businessName, 120) ?? '',
    description: str(businessInfo.shortDescription, 600) ?? brief.aboutText,
    contact,
    websiteUrl: str(businessInfo.businessUrl, 300),
    socialLinks,
    buyingMethods,
    serviceArea: str(businessInfo.serviceArea, 120) ?? str(site?.localBusiness?.serviceAreaDescription, 120),
    shopFacts,
    yearStarted,
    products,
    paymentMethods,
    reviews: brief.reviews,
    faqItems: brief.faqItems,
    stats,
    features: brief.features,
    aboutText: brief.aboutText,
  }
}

/** Facts with nothing but a brand name — used when a caller (template gallery, tests) has no merchant data. */
export function emptyFacts(brand = ''): GenerationFacts {
  return {
    brand,
    contact: {},
    socialLinks: [],
    buyingMethods: [],
    products: [],
    paymentMethods: [],
    reviews: [],
    faqItems: [],
    stats: [],
    features: [],
  }
}

/** Prompt block that pins the model to FACTS. Appended to the user prompt. */
export function factsToPromptSection(facts: GenerationFacts): string {
  const lines: string[] = []
  const { contact } = facts
  lines.push(`- Business name: ${facts.brand}`)
  if (facts.description) lines.push(`- What the merchant says about the business: ${facts.description}`)
  const contactParts = [
    contact.phone && `phone ${contact.phone}`,
    contact.whatsapp && `WhatsApp ${contact.whatsapp}`,
    contact.email && `email ${contact.email}`,
    contact.address && `address ${contact.address}`,
  ].filter(Boolean)
  if (contactParts.length) lines.push(`- Contact: ${contactParts.join('; ')}`)
  if (facts.products.length) {
    lines.push(
      `- Products/services the merchant listed: ${facts.products
        .map((p) => (p.price !== undefined ? `${p.name} (${p.startingPrice ? 'from ' : ''}RM${p.price})` : p.name))
        .join('; ')}`,
    )
  }
  if (facts.buyingMethods.length) lines.push(`- How customers buy: ${facts.buyingMethods.join(', ')}`)
  if (facts.serviceArea) lines.push(`- Service area: ${facts.serviceArea}`)
  if (facts.paymentMethods.length) lines.push(`- Payment methods enabled: ${facts.paymentMethods.join(', ')}`)
  if (facts.shopFacts) lines.push(`- Facts the merchant stated (year started, certifications, awards, numbers): ${facts.shopFacts}`)
  if (facts.reviews.length) {
    lines.push(
      `- Real customer reviews (from the merchant's own site): ${facts.reviews
        .map((r) => `"${r.quote}" — ${r.name}${r.role ? `, ${r.role}` : ''}`)
        .join(' | ')}`,
    )
  }
  if (facts.stats.length) {
    const real = facts.stats.filter((s) => s.label !== 'year-started' && s.label !== 'products')
    if (real.length) lines.push(`- Real numbers: ${real.map((s) => `${s.value} ${s.label}`).join('; ')}`)
  }
  return `FACTS (the ONLY source for claims about this business):
${lines.join('\n')}
GROUNDING RULES: never invent people, quotes, ratings, review counts, numbers, years, staff names or credentials, brands/logos, certifications (e.g. halal, ISO), awards, delivery partners (e.g. GrabFood), discounts, prices or opening hours. If a fact is not listed above, do not state it. For sections that would need such facts (reviews, numbers, team, partner logos), keep the section but leave its items empty or generic.`
}

export type GenerationPlaceholder = { pageSlug: string; blockType: string; label: string }

export { TESTIMONIAL_INVITE_TITLE }

const PLACEHOLDER_LABELS: Record<string, string> = {
  testimonials: 'Customer reviews',
  stats: 'Numbers',
  team: 'Team',
  'logo-cloud': 'Logos',
  faq: 'FAQ',
  pricing: 'Pricing plans',
  'menu-food': 'Menu prices',
}

/**
 * Blocks that still hold placeholder content the merchant should replace
 * (done-event `placeholders`). Informational only — never blocks publishing.
 */
export function collectPlaceholders(
  pages: ReadonlyArray<{ slug?: unknown; layout?: unknown; blocks?: unknown }>,
  facts?: GenerationFacts,
): GenerationPlaceholder[] {
  const out: GenerationPlaceholder[] = []
  const teamPlaceholder = facts ? `The ${facts.brand} team` : undefined
  for (const page of pages) {
    const slug = typeof page.slug === 'string' ? page.slug : '/'
    const blocks = arr(page.layout ?? page.blocks)
    for (const raw of blocks) {
      const block = rec(raw)
      const type = typeof block.blockType === 'string' ? block.blockType : ''
      let isPlaceholder = false
      switch (type) {
        case 'testimonials': {
          const items = arr(block.testimonials)
          isPlaceholder = items.length === 0 || items.some((t) => rec(t).title === TESTIMONIAL_INVITE_TITLE)
          break
        }
        case 'stats':
          isPlaceholder = arr(block.stats).length === 0
          break
        case 'logo-cloud':
          isPlaceholder = arr(block.logos).length === 0
          break
        case 'faq':
          isPlaceholder = arr(block.items ?? block.faqs).length === 0
          break
        case 'pricing':
          isPlaceholder = arr(block.plans).length === 0
          break
        case 'team': {
          const members = arr(block.members)
          isPlaceholder =
            members.length === 0 || (teamPlaceholder !== undefined && members.some((m) => rec(m).name === teamPlaceholder))
          break
        }
        case 'menu-food': {
          const cats = arr(block.categories)
          const items = cats.flatMap((c) => arr(rec(c).items))
          isPlaceholder = items.length > 0 && items.every((i) => rec(i).price === undefined || rec(i).price === '')
          break
        }
      }
      if (isPlaceholder) out.push({ pageSlug: slug, blockType: type, label: PLACEHOLDER_LABELS[type] ?? type })
    }
  }
  return out
}
