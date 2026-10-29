/**
 * Block content built ONLY from GenerationFacts (#2103 A1) — the replacement for
 * the old hard-coded testimonial/stat/team/FAQ/logo pools. When a fact is
 * missing the block still exists but carries no invented items.
 *
 * Copy is localized for en/ms/vi (the locales the composer owns); other locales
 * fall back to English because their copy is model-written.
 */

import { TESTIMONIAL_INVITE_TITLE, type GenerationFacts } from './generation-facts'
import { getBlockStrings } from './block-i18n'

type Lang = 'en' | 'ms' | 'vi'

function toLang(language?: string): Lang {
  const l = (language ?? 'en').split('-')[0]
  return l === 'ms' || l === 'vi' ? l : 'en'
}

type Copy = {
  invite: (brand: string) => string
  teamName: (brand: string) => string
  teamRole: string
  statLabels: { 'year-started': string; products: string }
  list: (items: string[]) => string
  faq: {
    contactQ: (brand: string) => string
    contactA: (parts: string[]) => string
    offerQ: (brand: string) => string
    offerA: (brand: string, items: string) => string
    orderQ: string
    orderA: (parts: string[]) => string
    areaQ: string
    areaA: (area: string) => string
    locationQ: string
    locationA: (address: string) => string
  }
  contactLabels: { phone: string; whatsapp: string; email: string; address: string }
  buying: Record<string, string>
  paymentsA: (methods: string) => string
}

const COPY: Record<Lang, Copy> = {
  en: {
    invite: (brand) => `Be the first to review ${brand}`,
    teamName: (brand) => `The ${brand} team`,
    teamRole: 'Founder',
    statLabels: { 'year-started': 'Year started', products: 'Products' },
    list: (items) =>
      items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`,
    faq: {
      contactQ: (b) => `How can I contact ${b}?`,
      contactA: (p) => `You can reach us via ${p.join(', ')}.`,
      offerQ: (b) => `What does ${b} offer?`,
      offerA: (b, items) => `${b} offers ${items}.`,
      orderQ: 'How do I order?',
      orderA: (p) => p.join(' '),
      areaQ: 'Which areas do you serve?',
      areaA: (a) => `We serve ${a}.`,
      locationQ: 'Where are you located?',
      locationA: (a) => `You can find us at ${a}.`,
    },
    contactLabels: { phone: 'phone', whatsapp: 'WhatsApp', email: 'email', address: 'visiting us' },
    buying: {
      delivery: 'We offer delivery.',
      pickup: 'You can collect your order from us.',
      walk_in: 'Walk-ins are welcome.',
      booking: 'Contact us to make a booking.',
      cod: 'Cash on delivery is available.',
      online_payment: 'You can pay online.',
    },
    paymentsA: (m) => `Accepted payment methods: ${m}.`,
  },
  ms: {
    invite: (brand) => `Jadilah yang pertama menilai ${brand}`,
    teamName: (brand) => `Pasukan ${brand}`,
    teamRole: 'Pengasas',
    statLabels: { 'year-started': 'Tahun bermula', products: 'Produk' },
    list: (items) =>
      items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`,
    faq: {
      contactQ: (b) => `Bagaimana saya boleh menghubungi ${b}?`,
      contactA: (p) => `Anda boleh menghubungi kami melalui ${p.join(', ')}.`,
      offerQ: (b) => `Apakah yang ditawarkan oleh ${b}?`,
      offerA: (b, items) => `${b} menawarkan ${items}.`,
      orderQ: 'Bagaimana saya membuat tempahan?',
      orderA: (p) => p.join(' '),
      areaQ: 'Kawasan mana yang anda layani?',
      areaA: (a) => `Kami melayani ${a}.`,
      locationQ: 'Di manakah lokasi anda?',
      locationA: (a) => `Anda boleh mendapati kami di ${a}.`,
    },
    contactLabels: { phone: 'telefon', whatsapp: 'WhatsApp', email: 'e-mel', address: 'berkunjung ke' },
    buying: {
      delivery: 'Kami menyediakan penghantaran.',
      pickup: 'Anda boleh mengambil tempahan sendiri.',
      walk_in: 'Pelanggan tanpa temu janji dialu-alukan.',
      booking: 'Hubungi kami untuk membuat tempahan.',
      cod: 'Bayaran tunai semasa penghantaran tersedia.',
      online_payment: 'Anda boleh membayar dalam talian.',
    },
    paymentsA: (m) => `Kaedah pembayaran diterima: ${m}.`,
  },
  vi: {
    invite: (brand) => `Hãy là người đầu tiên đánh giá ${brand}`,
    teamName: (brand) => `Đội ngũ ${brand}`,
    teamRole: 'Người sáng lập',
    statLabels: { 'year-started': 'Năm bắt đầu', products: 'Sản phẩm' },
    list: (items) =>
      items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`,
    faq: {
      contactQ: (b) => `Làm sao để liên hệ ${b}?`,
      contactA: (p) => `Bạn có thể liên hệ qua ${p.join(', ')}.`,
      offerQ: (b) => `${b} cung cấp những gì?`,
      offerA: (b, items) => `${b} cung cấp ${items}.`,
      orderQ: 'Tôi đặt hàng như thế nào?',
      orderA: (p) => p.join(' '),
      areaQ: 'Bạn phục vụ khu vực nào?',
      areaA: (a) => `Chúng tôi phục vụ ${a}.`,
      locationQ: 'Cửa hàng ở đâu?',
      locationA: (a) => `Bạn có thể tìm chúng tôi tại ${a}.`,
    },
    contactLabels: { phone: 'điện thoại', whatsapp: 'WhatsApp', email: 'email', address: 'đến trực tiếp' },
    buying: {
      delivery: 'Chúng tôi có giao hàng.',
      pickup: 'Bạn có thể đến lấy hàng trực tiếp.',
      walk_in: 'Chào đón khách đến trực tiếp.',
      booking: 'Liên hệ với chúng tôi để đặt lịch.',
      cod: 'Có thanh toán khi nhận hàng.',
      online_payment: 'Bạn có thể thanh toán trực tuyến.',
    },
    paymentsA: (m) => `Phương thức thanh toán: ${m}.`,
  },
}

export type GroundedTestimonial = {
  quote: string
  name: string
  title?: string
  company?: string
}

/** Real quotes from the merchant's own site; otherwise ONE invitation card (no person, no rating). */
export function groundedTestimonials(facts: GenerationFacts, language?: string): GroundedTestimonial[] {
  if (facts.reviews.length > 0) {
    return facts.reviews.map((r) => ({ quote: r.quote, name: r.name, ...(r.role ? { title: r.role } : {}) }))
  }
  const c = COPY[toLang(language)]
  // `name` is required by the Pages schema, so the invitation carries the brand;
  // renderers key off the title marker to hide stars, name and avatar.
  return [{ quote: c.invite(facts.brand), name: facts.brand, title: TESTIMONIAL_INVITE_TITLE }]
}

/** Real numbers only. Fewer than 2 → no numbers at all (the block renders nothing). */
export function groundedStats(facts: GenerationFacts, language?: string): Array<{ value: string; label: string }> {
  const c = COPY[toLang(language)]
  const items = facts.stats.map((s) => ({
    value: s.value,
    label: s.label in c.statLabels ? c.statLabels[s.label as keyof Copy['statLabels']] : s.label,
  }))
  return items.length >= 2 ? items.slice(0, 4) : []
}

/** The owner / brand — never invented people or credentials. */
export function groundedTeam(facts: GenerationFacts, language?: string): Array<{ name: string; role: string }> {
  const c = COPY[toLang(language)]
  return [{ name: c.teamName(facts.brand), role: c.teamRole }]
}

/** Questions answerable from FACTS (contact, what we sell, how to buy, areas). Real FAQ from URL import first. */
export function groundedFaq(facts: GenerationFacts, language?: string): Array<{ question: string; answer: string }> {
  const c = COPY[toLang(language)]
  const items = [...facts.faqItems]
  const { contact } = facts

  const contactParts = [
    contact.phone && `${c.contactLabels.phone} ${contact.phone}`,
    contact.whatsapp && `${c.contactLabels.whatsapp} ${contact.whatsapp}`,
    contact.email && `${c.contactLabels.email} ${contact.email}`,
    contact.address && `${c.contactLabels.address} ${contact.address}`,
  ].filter((p): p is string => Boolean(p))
  if (contactParts.length > 0) {
    items.push({ question: c.faq.contactQ(facts.brand), answer: c.faq.contactA(contactParts) })
  }

  if (facts.products.length > 0) {
    const names = facts.products.slice(0, 6).map((p) => p.name)
    items.push({ question: c.faq.offerQ(facts.brand), answer: c.faq.offerA(facts.brand, c.list(names)) })
  }

  const orderParts = facts.buyingMethods.map((m) => c.buying[m]).filter((p): p is string => Boolean(p))
  if (facts.paymentMethods.length > 0) orderParts.push(c.paymentsA(facts.paymentMethods.join(', ')))
  if (orderParts.length > 0) items.push({ question: c.faq.orderQ, answer: c.faq.orderA(orderParts) })

  if (facts.serviceArea) items.push({ question: c.faq.areaQ, answer: c.faq.areaA(facts.serviceArea) })
  else if (contact.address) items.push({ question: c.faq.locationQ, answer: c.faq.locationA(contact.address) })

  const seen = new Set<string>()
  return items
    .filter((i) => {
      const key = i.question.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
}

/** Name-only badges for payment methods the tenant has actually enabled. No third-party brands otherwise. */
export function groundedLogos(facts: GenerationFacts): Array<{ name: string; logo: { url: string; alt: string } }> {
  return facts.paymentMethods.map((name) => ({ name, logo: { url: '', alt: name } }))
}

/** Pricing plans from the merchant's own priced products (max 3). No invented tiers. */
export function groundedPricingPlans(
  facts: GenerationFacts,
  ctaLabel: string,
  language?: string,
): Array<Record<string, unknown>> {
  const priced = facts.products.filter((p) => p.price !== undefined).slice(0, 3)
  const from = { en: 'From', ms: 'Dari', vi: 'Từ' }[toLang(language)]
  return priced.map((p) => ({
    name: p.name,
    price: `${p.startingPrice ? `${from} ` : ''}RM ${formatPrice(p.price ?? 0)}`,
    period: '',
    features: [],
    highlighted: false,
    isPopular: false,
    ctaLabel,
    ctaUrl: '/contact',
  }))
}

/** A pricing block with no plans has nothing to show (and no tiers may be invented): generation drops it. */
export function isPlanlessPricing(block: unknown): boolean {
  if (!block || typeof block !== 'object') return false
  const b = block as { blockType?: unknown; plans?: unknown }
  if (b.blockType !== 'pricing' && b.blockType !== 'pricing-table') return false
  return !Array.isArray(b.plans) || b.plans.length === 0
}

export { isEmptyRequiredListBlock } from './required-list-blocks'

export function groundedLogoHeadline(language?: string): string {
  return { en: 'Payment methods', ms: 'Kaedah pembayaran', vi: 'Phương thức thanh toán' }[toLang(language)]
}

/** One-line blurb for a merchant-listed product: its price if the merchant gave one, else where to find it. */
export function groundedProductBlurb(
  brand: string,
  product: { price?: number; startingPrice?: boolean } | undefined,
  language?: string,
): string {
  const lang = toLang(language)
  if (product?.price !== undefined) {
    const from = { en: 'From ', ms: 'Dari ', vi: 'Từ ' }[lang]
    return `${product.startingPrice ? from : ''}RM ${formatPrice(product.price)}`
  }
  return {
    en: `Available at ${brand}.`,
    ms: `Boleh didapati di ${brand}.`,
    vi: `Có tại ${brand}.`,
  }[lang]
}

/** 65 → "65", 35.5 → "35.50". */
export function formatPrice(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2)
}

/** Neutral one-liner for category-generic service cards (no prices, counts or guarantees). */
export function groundedServiceBlurb(brand: string, language?: string): string {
  return {
    en: `Ask ${brand} for details.`,
    ms: `Tanya ${brand} untuk maklumat lanjut.`,
    vi: `Liên hệ ${brand} để biết thêm chi tiết.`,
  }[toLang(language)]
}

type PricedItem = { name: string; price?: string | number; [key: string]: unknown }

/**
 * Fill price-less menu items from the products we created (same name, case-insensitive).
 * Merchant-typed prices are already on the item; this only covers the AI-estimated
 * price of a created product when the merchant gave none. Returns a new layout — menu
 * blocks may reference shared library content, which must never be mutated.
 */
export function applyProductPricesToMenus<T extends Array<Record<string, unknown>>>(
  layout: T,
  products: ReadonlyArray<{ name: string; price: number }>,
): T {
  const byName = new Map(products.filter((p) => p.price > 0).map((p) => [p.name.trim().toLowerCase(), p.price]))
  if (byName.size === 0) return layout
  return layout.map((block) => {
    if (block?.blockType !== 'menu-food' || !Array.isArray(block.categories)) return block
    const categories = (block.categories as Array<{ items?: PricedItem[] }>).map((cat) => ({
      ...cat,
      items: (cat.items ?? []).map((item) => {
        if (item.price !== undefined && item.price !== '') return item
        const price = byName.get(String(item.name ?? '').trim().toLowerCase())
        return price === undefined ? item : { ...item, price: formatPrice(price), currency: 'RM' }
      }),
    }))
    return { ...block, categories }
  }) as T
}

// ── AI-written blocks: keep only what FACTS backs ───────────────────────────

const COMPOSER_LANGS = new Set(['en', 'ms', 'vi'])

type Json = Record<string, unknown>

const norm = (v: unknown): string => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Terms the model likes to invent for small shops. They survive only when the merchant
 * wrote them themselves (shop facts / description / product names / site import).
 */
const CLAIM_RE =
  /\b(halal|jakim|grab\s?food|grab\s?mart|food\s?panda|shopee\s?food|lalamove|\d{1,3}\s?%\s?(?:off|discount)|award[- ]winning|iso\s?\d{4,5}|fda[- ]approved)\b/i

const SKIP_KEYS = new Set(['blockType', 'variant', 'url', 'href', 'src', 'id', 'icon', 'slug', 'embedUrl', 'mapEmbedUrl', 'ctaUrl', 'imageUrl', 'avatarUrl'])

function allowedClaimText(facts: GenerationFacts): string {
  return norm(
    [
      facts.shopFacts,
      facts.description,
      facts.aboutText,
      ...facts.products.map((p) => p.name),
      ...facts.features.map((f) => `${f.title} ${f.description}`),
    ].join(' '),
  ).replace(/\s/g, '')
}

function isUngrounded(text: string, allowed: string): boolean {
  const m = text.match(CLAIM_RE)
  return Boolean(m) && !allowed.includes(m![0].toLowerCase().replace(/\s/g, ''))
}

function scrubValue(value: unknown, allowed: string): unknown {
  if (typeof value === 'string') {
    if (!isUngrounded(value, allowed)) return value
    // Drop only the offending sentences; an empty result removes the field.
    const kept = value.split(/(?<=[.!?])\s+/).filter((sentence) => !isUngrounded(sentence, allowed))
    return kept.join(' ').trim() || undefined
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        // An item (feature card, service, ...) whose own text makes the claim is removed whole.
        const direct = Object.entries(item as Json).filter(([k, v]) => !SKIP_KEYS.has(k) && typeof v === 'string')
        if (direct.some(([, v]) => isUngrounded(v as string, allowed))) continue
        out.push(scrubValue(item, allowed))
      } else {
        const next = scrubValue(item, allowed)
        if (next !== undefined) out.push(next)
      }
    }
    return out
  }
  if (value && typeof value === 'object') {
    const out: Json = {}
    for (const [k, v] of Object.entries(value as Json)) {
      if (SKIP_KEYS.has(k)) {
        out[k] = v
        continue
      }
      const next = scrubValue(v, allowed)
      if (next !== undefined) out[k] = next
    }
    return out
  }
  return value
}

/**
 * Final guard for AI-written pages (#2103 A1). Prompts tell the model to stick to FACTS; this
 * enforces it: reviews, numbers, team, logos, FAQ and pricing come from FACTS only, and
 * invented certifications / delivery partners / discounts are stripped from the other blocks.
 * Returns new block objects; input is not mutated.
 */
export function enforceGroundedBlocks(
  blocks: ReadonlyArray<Record<string, unknown>>,
  facts: GenerationFacts | undefined,
  language?: string,
): Array<Record<string, unknown>> {
  if (!facts) return [...blocks]
  const composerLang = COMPOSER_LANGS.has((language ?? 'en').split('-')[0]!)
  const allowed = allowedClaimText(facts)

  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block
    switch (block.blockType) {
      case 'testimonials': {
        const items = Array.isArray(block.testimonials) ? (block.testimonials as Json[]) : []
        const realQuotes = new Set(facts.reviews.map((r) => norm(r.quote)))
        const real = items.filter((t) => realQuotes.has(norm(t.quote)))
        const testimonials = real.length > 0 ? real : composerLang || facts.reviews.length > 0 ? groundedTestimonials(facts, language) : []
        return { ...block, testimonials }
      }
      case 'stats':
        // Model stats are never kept: matching only the digits let "5 ★ rating" pass for "5 products".
        // The block shows the real facts, labelled by us (fewer than 2 → empty → the block is dropped).
        return { ...block, stats: groundedStats(facts, language) }
      case 'team':
        return { ...block, members: composerLang ? groundedTeam(facts, language) : [] }
      case 'logo-cloud':
      case 'client-logos':
        return { ...block, logos: groundedLogos(facts) }
      case 'faq': {
        const items = groundedFaq(facts, composerLang ? language : 'en')
        // Non-composer locales: only the merchant's own imported Q&A (already in their language).
        const next = composerLang ? items : facts.faqItems
        return 'faqs' in block && !('items' in block) ? { ...block, faqs: next } : { ...block, items: next, ...('faqs' in block ? { faqs: next } : {}) }
      }
      case 'pricing':
        // no priced products → plans [] → the block is dropped below (never invented tiers)
        return { ...block, plans: groundedPricingPlans(facts, getBlockStrings(language).pricing.learnMore, language) }
      default:
        return scrubValue(block, allowed) as Json
    }
  }).filter((block) => !isPlanlessPricing(block))
}
