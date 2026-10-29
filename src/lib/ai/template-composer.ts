import { getCategoryContent } from '@/lib/ai/content'
import type { CategoryContent, BusinessSample } from '@/lib/ai/content/types'
import type { ThemePreset } from '@/lib/ai/theme-presets'
import { DEFAULT_FOCUS_STYLE } from '@/lib/ai/theme-presets'
import { FONT_PAIRINGS } from '@/lib/fonts/pairings'
import { TEMPLATE_RULES } from '@/lib/ai/template-rules'
import { isUnsupportedBlock } from './unsupported-blocks'

/** Resolve explicit heading + body font names from a pairing id. Returns nulls if id unknown. */
function resolveFontNames(pairingId: string | undefined): { heading?: string; body?: string } {
    if (!pairingId) return {}
    const pairing = FONT_PAIRINGS.find((p) => p.id === pairingId)
    return pairing ? { heading: pairing.headingFont, body: pairing.bodyFont } : {}
}
import { blockRegistry } from '@/blocks/registry'
import { enforceMinContent } from './variant-validation'
import { applyContentValidation, type ContentLang } from './content-rules'
import { getBlockStrings, getSectionLabels } from './block-i18n'
import {
  resolveLocaleStructuralStrings,
  type LocaleStructuralStrings,
} from './locale-structural-strings'
import { THEME_MOODS, getCategoryCTA as getMoodCTA, type ThemeMood } from './theme-moods'
import { getBlogSeeds } from './content/blog-seeds'
import {
  groundedFaq,
  groundedLogos,
  groundedPricingPlans,
  isPlanlessPricing,
  groundedStats,
  groundedTeam,
  groundedTestimonials,
  groundedLogoHeadline,
  groundedProductBlurb,
  groundedServiceBlurb,
  formatPrice,
} from './grounded-blocks'
import { emptyFacts, type GenerationFacts } from './generation-facts'
import {
  NEUTRAL_FALLBACK_SVG,
  PORTRAIT_FALLBACK_SVG,
  AVATAR_FALLBACK_SVG,
} from './fallback-svg'

// ── Types ───────────────────────────────────────────────────────────────────

export type ComposerInput = {
  category: string
  businessIndex: number
  variant: 'starter' | 'professional' | 'premium'
  themePreset: ThemePreset
  compositionSeed?: number  // Seed for variety — undefined = backward-compatible (no shuffle)
}

// ── Seeded PRNG Utilities ─────────────────────────────────────────────────

function createSeededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    return (s >>> 0) / 0xFFFFFFFF
  }
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

// ── Seed-Based Variant Selection ──────────────────────────────────────────

// Plan 260417 Wave 1 A3 — variants declared in Zod enum but NOT implemented
// in the block's render switch. AI gen would silently fall through to the
// block's default variant, hiding the mismatch from QA.
// GH-1266: video/split-video require a videoUrl the composer never supplies —
// exclude from seed-based selection so the seeded path cannot emit a broken hero.
export const BROKEN_VARIANTS: Record<string, string[]> = {
  hero: ['animated-gradient', 'video', 'split-video'],
  testimonials: ['grid', 'single'],
}


function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Select a variant deterministically based on seed.
 * Same seed + blockType + category = always same variant.
 * disabledSet: optional set of `${blockType}:${variantName}` keys to exclude.
 * If all variants are excluded, falls back to defaultVariant even if disabled (safer than crash).
 */
export function selectVariant(
  blockType: string,
  seed: number,
  category: string,
  disabledSet?: Set<string>,
): string {
  const meta = blockRegistry.has(blockType) ? blockRegistry.getBlockMeta(blockType) : null
  if (!meta || meta.variants.length <= 1) return meta?.defaultVariant ?? 'default'

  const broken = BROKEN_VARIANTS[blockType] ?? []
  const safe = meta.variants.filter((v) => {
    if (broken.includes(v)) return false
    if (disabledSet?.has(`${blockType}:${v}`)) return false
    return true
  })
  // All variants filtered out → fall back to defaultVariant (even if disabled) to avoid crash
  if (safe.length === 0) return meta.defaultVariant ?? meta.variants[0]!

  const hash = simpleHash(blockType + category + seed)
  return safe[hash % safe.length]!
}

export type TemplateSeed = {
  name: string
  description: string
  category: string
  tier: 'starter' | 'professional' | 'premium'
  isPremium: boolean
  thumbnail?: string
  theme: ThemePreset
  pages: TemplatePage[]
}

export type TemplatePage = {
  title: string
  slug: string
  layout: Record<string, unknown>[]
}

// ── Hero variant mapping per category ───────────────────────────────────────

export const CATEGORY_HERO_VARIANTS: Record<string, string[]> = {
  restaurant: ['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen'],
  ecommerce: ['slideshow', 'cards-overlay', 'gradient', 'split-right', 'magazine'],
  beauty: ['gradient', 'minimal', 'parallax', 'split-left', 'magazine'],
  tech: ['gradient', 'minimal', 'cards-overlay', 'parallax', 'split-left', 'slideshow'],
  health: ['centered', 'split-left', 'minimal', 'gradient', 'parallax'],
  education: ['centered', 'split-right', 'gradient', 'magazine', 'parallax'],
  realestate: ['fullscreen', 'parallax', 'slideshow', 'split-left', 'magazine'],
  fitness: ['fullscreen', 'parallax', 'cards-overlay', 'gradient', 'split-left', 'magazine'],
  creative: ['magazine', 'parallax', 'cards-overlay', 'minimal', 'gradient'],
  business: ['centered', 'split-left', 'gradient', 'minimal', 'parallax'],
  fnb: ['split-left', 'gradient', 'magazine', 'parallax', 'fullscreen'],
  events: ['fullscreen', 'gradient', 'split-left', 'centered', 'parallax'],
  blog: ['minimal', 'split-left', 'fullscreen', 'centered', 'magazine'],
  travel: ['fullscreen', 'parallax', 'split-left', 'gradient', 'slideshow'],
}

// ── Block builders ──────────────────────────────────────────────────────────

/**
 * Resolve the primary CTA label for a block given optional mood + category.
 * Falls back to the legacy hardcoded labels when mood is absent so the
 * composer keeps working on legacy paths that don't resolve mood.
 *
 * Plan 260414-2249 phase-02: centralizes CTA wording per mood archetype.
 */
function resolveCTA(
  mood: ThemeMood | undefined,
  category: string,
  role: 'primary' | 'secondary',
): string {
  if (mood) return getMoodCTA(mood, category, role)
  return role === 'primary' ? 'Get Started' : 'Learn More'
}

/**
 * Plan 260415 nav-bugfix A — resolve a safe CTA URL for the navigation block.
 * Checks if the site actually has a contact page before emitting `/contact`
 * (previous hardcoded value 404'd when the template had no contact page).
 * Priority: /contact → /services → /about → anchor fallback `/#contact`.
 */
function resolveNavCtaUrl(pages: string[]): string {
  const priorityOrder = ['contact', 'services', 'about', 'booking', 'pricing']
  for (const slug of priorityOrder) {
    if (pages.includes(slug)) return `/${slug}`
  }
  return '/#contact'
}

// Exported for gen-page-split (gen-perf phase-09): the parallel-split path
// injects this deterministic navigation on every page instead of letting GPT
// write it — identical links guaranteed, ~200 output tokens saved per call.
export function buildNavigation(
  biz: BusinessSample,
  pages: string[],
  category: string = 'business',
  mood?: ThemeMood,
  language?: string,
  localeStrings?: LocaleStructuralStrings | null,
): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const navigation = localeStrings?.navigation ?? i18n.navigation
  const SLUG_LABELS: Record<string, string> = {
    '/': navigation.home,
    'about': navigation.about,
    'services': navigation.services,
    'contact': navigation.contact,
    // gen-perf phase-09: split path passes '/blog' — label it properly
    // instead of the capitalize fallback (which rendered a raw "/blog").
    // "Blog" is the label across every locale seed (vi/ms/en/ja all use it).
    'blog': localeStrings?.navigation.blog ?? 'Blog',
  }
  const links = pages.map((p) => {
    const slug = p === '/' ? '/' : p.replace(/^\/+/, '').toLowerCase()
    // Capitalize fallback works on the SLASH-STRIPPED slug ('/team' → 'Team').
    const label = SLUG_LABELS[slug] ?? (slug.charAt(0).toUpperCase() + slug.slice(1))
    return { label, url: p === '/' ? '/' : `/${slug}` }
  })
  return {
    blockType: 'navigation',
    logoText: biz.name,
    links,
    ctaButton: {
      show: true,
      label: localeStrings?.navigation.getStarted ?? resolveCTA(mood, category, 'primary'),
      url: resolveNavCtaUrl(pages),
    },
    ariaLabel: localeStrings ? biz.name : `${biz.name} main navigation`,
    breadcrumbConfig: { showOnAllPages: true, homeLabel: navigation.home, separator: '/' },
  }
}

/**
 * Plan 07 — truncate on word boundary so the hero subheadline + headline
 * never break mid-word. Mirrors the helper in seo-generator.ts / content-injection.ts.
 */
function truncateHeroText(str: string, maxChars: number): string {
  if (!str) return ''
  if (str.length <= maxChars) return str
  const sliced = str.slice(0, maxChars - 1)
  const lastSpace = sliced.lastIndexOf(' ')
  if (lastSpace > maxChars * 0.6) return sliced.slice(0, lastSpace).trimEnd() + '…'
  return sliced.trimEnd() + '…'
}

function capHeroWords(str: string, maxWords: number): string {
  if (!str) return ''
  const words = str.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return words.slice(0, maxWords).join(' ')
}

export function buildHero(
  biz: BusinessSample,
  category: string,
  variantIndex: number,
  mood?: ThemeMood,
  language?: string,
): Record<string, unknown> {
  const variants = CATEGORY_HERO_VARIANTS[category] ?? ['centered']
  const variant = variants[variantIndex % variants.length]

  // Plan 07 — headline derived from biz.name + short tail so each business
  // produces a distinct hero. Canned `biz.heroHeadline` becomes a defensive
  // fallback for the pathological "all user fields empty" case.
  const name = (biz.name || '').trim()
  const description = (biz.description || '').trim()
  const topProduct = biz.products?.[0]?.trim() || undefined
  const descWords = description.split(/\s+/).filter(Boolean)
  const tail = topProduct
    ? capitalizeFirst(topProduct)
    : descWords.length >= 3
      ? descWords.slice(0, 5).join(' ')
      : (biz.tagline || '').split(/\s+/).slice(0, 5).join(' ')

  let headline: string
  if (name && (tail || description)) {
    headline = capHeroWords(tail ? `${name} — ${tail}` : name, 10)
  } else {
    // Defensive — biz.heroHeadline from canned pool.
    headline = biz.heroHeadline
  }

  // Subheadline: user description truncated on word boundary. Fall back to
  // canned heroSubheadline only when biz.description is missing (rare since
  // canned BusinessSample always has a description).
  const subheadline = description
    ? truncateHeroText(description, 140)
    : biz.heroSubheadline
  const localized = resolveLocaleStructuralStrings(language)
  const useLocalizedCTA = localized && language?.split('-')[0] !== 'en'
  const primaryLabel = useLocalizedCTA
    ? localized.navigation.getStarted
    : resolveCTA(mood, category, 'primary')
  const secondaryLabel = useLocalizedCTA
    ? localized.navigation.about
    : resolveCTA(mood, category, 'secondary')

  return {
    blockType: 'hero',
    variant,
    headline,
    subheadline,
    ctaButtons: [
      { label: primaryLabel, url: '/contact', style: 'primary' },
      { label: secondaryLabel, url: '/about', style: 'outline' },
    ],
    overlay: variant === 'fullscreen' || variant === 'parallax',
    overlayOpacity: 0.4,
    height: '90vh',
  }
}

// Icon rotation for product-derived feature cards — keyed by category so the
// cards still feel on-brand. Order drives card 1→N.
const PRODUCT_FEATURE_ICONS: Record<string, string[]> = {
  restaurant: ['Utensils', 'ChefHat', 'Flame', 'Soup', 'Pizza', 'Coffee'],
  fnb: ['Coffee', 'Cake', 'Utensils', 'Croissant', 'Wine', 'IceCream'],
  ecommerce: ['ShoppingBag', 'Package', 'Star', 'Tag', 'Gift', 'Heart'],
  beauty: ['Sparkles', 'Flower', 'Heart', 'Gem', 'Palette', 'Brush'],
  health: ['Stethoscope', 'HeartPulse', 'Pill', 'Syringe', 'Activity', 'Plus'],
  fitness: ['Dumbbell', 'Activity', 'Flame', 'Trophy', 'Zap', 'Timer'],
  education: ['BookOpen', 'GraduationCap', 'Pencil', 'Library', 'Award', 'Brain'],
  tech: ['Zap', 'Code', 'Cpu', 'Cloud', 'Shield', 'Rocket'],
  creative: ['Palette', 'Brush', 'Layers', 'Camera', 'Film', 'PenTool'],
  business: ['Briefcase', 'TrendingUp', 'Target', 'BarChart', 'Handshake', 'Award'],
  realestate: ['Home', 'Key', 'Building', 'MapPin', 'TrendingUp', 'Shield'],
  events: ['Calendar', 'Sparkles', 'Music', 'Gift', 'Star', 'Camera'],
  blog: ['PenTool', 'BookOpen', 'Bookmark', 'Coffee', 'Feather', 'Newspaper'],
  travel: ['Map', 'Compass', 'Plane', 'Camera', 'Mountain', 'Globe'],
}

function capitalizeFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Build feature cards from user-supplied products. Each card gets:
 *  - icon rotated from PRODUCT_FEATURE_ICONS[category]
 *  - title rotated from FEATURE_TITLE_TEMPLATES[category] (e.g. "{P} Specialties")
 *  - description from FEATURE_BODY_TEMPLATES[category]
 *
 * Caps at `maxCards` (usually 3-4) to match existing featureMap cardinality
 * and prevent layout overflow. Spec example: ["ramen","sushi","gyoza"] in
 * restaurant category → "Ramen Specialties / Fresh Sushi / Handmade Gyoza".
 */
function featuresFromProducts(
  products: string[],
  category: string,
  maxCards: number,
  language?: string,
  biz?: BusinessSample,
): { icon: string; title: string; description: string }[] {
  const icons = PRODUCT_FEATURE_ICONS[category] ?? PRODUCT_FEATURE_ICONS['business']!
  const listed = biz?.facts?.products ?? []

  return products.slice(0, maxCards).map((product, idx) => {
    const match = listed.find((p) => p.name.toLowerCase() === product.toLowerCase())
    return {
      icon: icons[idx % icons.length]!,
      title: capitalizeFirst(product),
      // Only what the merchant told us: the product itself, its price if they gave one.
      description: groundedProductBlurb(biz?.name ?? '', match, language),
    }
  })
}

export function buildFeatures(biz: BusinessSample, category: string, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const icons = PRODUCT_FEATURE_ICONS[category] ?? PRODUCT_FEATURE_ICONS['business']!
  const locale = language?.split('-')[0] ?? 'en'

  // #2103 A1: features come from (1) the merchant's own site import, (2) the products
  // they listed, else (3) a claim-free trio. Never certifications, SLAs, partners, counts.
  const neutralCopy: Record<string, Array<{ title: string; description: string }>> = {
    en: [
      { title: 'Tell us what you need', description: 'Share your requirements and we will help you choose the right option.' },
      { title: 'Easy to reach', description: 'Send us a message from the contact page.' },
      { title: 'Made around you', description: 'Every order or request starts with a conversation about what you want.' },
    ],
    ms: [
      { title: 'Beritahu keperluan anda', description: 'Kongsikan keperluan anda dan kami akan membantu memilih pilihan yang sesuai.' },
      { title: 'Mudah dihubungi', description: 'Hantar mesej kepada kami melalui halaman hubungi.' },
      { title: 'Disesuaikan untuk anda', description: 'Setiap tempahan bermula dengan perbualan tentang apa yang anda mahu.' },
    ],
    vi: [
      { title: 'Cho chúng tôi biết nhu cầu', description: 'Chia sẻ yêu cầu của bạn và chúng tôi sẽ giúp bạn chọn phương án phù hợp.' },
      { title: 'Dễ dàng liên hệ', description: 'Gửi tin nhắn cho chúng tôi từ trang liên hệ.' },
      { title: 'Làm theo mong muốn của bạn', description: 'Mỗi đơn hàng bắt đầu bằng một cuộc trò chuyện về điều bạn muốn.' },
    ],
  }

  const userProducts = biz.products ?? []
  // Skip user-provided product names when target lang is English but products contain
  // non-ASCII characters (e.g. Vietnamese diacritics). Prevents mixed-language output
  // like "Ship faster with our Phần mềm quản lý..." (GH-1184).
  const hasNonAsciiProducts = language === 'en' && userProducts.some(p => /[^\x00-\x7F]/.test(p))
  const realFeatures = biz.facts?.features ?? []
  const features =
    realFeatures.length >= 2
      ? realFeatures.slice(0, 6).map((f, idx) => ({ icon: icons[idx % icons.length]!, title: f.title, description: f.description }))
      : userProducts.length >= 2 && !hasNonAsciiProducts
        ? featuresFromProducts(userProducts, category, 6, language, biz)
        : (neutralCopy[locale] ?? neutralCopy.en!).map((f, idx) => ({ icon: icons[idx % icons.length]!, ...f }))
  // Skip non-ASCII tagline when target is English — avoids VN subheadline in EN features block (GH-1184).
  const subheadline = (language === 'en' && biz.tagline && /[^\x00-\x7F]/.test(biz.tagline))
    ? undefined
    : biz.tagline
  return {
    blockType: 'features',
    variant: 'grid-3',
    headline: i18n.features.headlineWhyChoose(biz.name),
    subheadline,
    features,
  }
}

export function buildTestimonials(
  biz: Pick<BusinessSample, 'name' | 'facts'>,
  language?: string,
): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const bizName = biz.name
  const facts = biz.facts ?? emptyFacts(bizName)
  const headlineFull = bizName ? i18n.testimonials.headlineWithBiz(bizName) : i18n.testimonials.headline
  // #2103 A1: only real quotes from the merchant's own site. With none, ONE invitation
  // card ("Be the first to review {brand}") — no invented person, quote or rating.
  const items = groundedTestimonials(facts, language)
  const hasReal = facts.reviews.length > 0
  return {
    blockType: 'testimonials',
    variant: 'cards',
    headline: headlineFull,
    ...(hasReal ? { subheadline: i18n.testimonials.subheadline } : {}),
    testimonials: items.map((t) => ({
      ...t,
      ...(hasReal ? { avatarUrl: AVATAR_FALLBACK_SVG } : {}),
    })),
  }
}

function buildContact(biz: BusinessSample, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  return {
    blockType: 'contact',
    variant: 'split',
    headline: i18n.contact.headline,
    subtext: i18n.contact.subheadlineWithBiz(biz.name),
    sectionLabel: i18n.navigation.contact,
    email: biz.email,
    phone: biz.phone,
    address: biz.address,
    submitLabel: i18n.contact.submitLabel,
    phoneLabel: i18n.contact.phoneLabel,
    addressLabel: i18n.contact.addressLabel,
    emailLabel: i18n.contact.emailLabel,
    formFields: [
      { label: i18n.contact.nameLabel, fieldName: 'name', fieldType: 'text', placeholder: i18n.contact.namePlaceholder, required: true },
      { label: i18n.contact.emailLabel, fieldName: 'email', fieldType: 'email', placeholder: 'your@email.com', required: true },
      { label: i18n.contact.phoneLabel, fieldName: 'phone', fieldType: 'phone', placeholder: '+60 12-345 6789', required: false },
      { label: i18n.contact.messageLabel, fieldName: 'message', fieldType: 'textarea', placeholder: i18n.contact.messagePlaceholder, required: true },
    ],
  }
}

function buildFooter(
  biz: BusinessSample,
  pages: string[],
  language: ContentLang = 'en',
): Record<string, unknown> {
  // Next-wins plan 260419-0034 phase-03: upgrade default to mega variant với 4 columns
  // (Explore / Company / Support / Legal) to meet Wix-pro footer expectations.
  // GH-820: build known-url set so secondary columns only include links to real pages.
  // Normalize to lowercase — pages may be passed as capitalized titles ('About', 'Contact')
  // or lowercase slugs ('about', 'contact') depending on call site.
  const knownUrls = new Set(
    pages.map((p) => (p === '/' ? '/' : `/${p.replace(/^\/+/, '').toLowerCase()}`)),
  )
  // External links (mailto:, http, #) are always safe; internal links only if page exists.
  const isLiveLink = (url: string) =>
    url.startsWith('mailto:') || url.startsWith('http') || url === '#' || knownUrls.has(url.toLowerCase())

  const i18n = getBlockStrings(language)
  const pageLabels: Record<string, string> = {
    '': i18n.navigation.home,
    home: i18n.navigation.home,
    about: i18n.navigation.about,
    services: i18n.navigation.services,
    contact: i18n.navigation.contact,
    blog: 'Blog',
  }
  const exploreLinks = pages.map((p) => {
    const slug = p === '/' ? '' : p.replace(/^\/+/, '').toLowerCase()
    return {
      label: pageLabels[slug] ?? (p === '/' ? i18n.navigation.home : p.charAt(0).toUpperCase() + p.slice(1)),
      url: p === '/' ? '/' : `/${p.replace(/^\/+/, '')}`,
    }
  })

  const companyLinks = [
    { label: i18n.footer.aboutUs, url: '/about' },
    { label: i18n.navigation.contact, url: '/contact' },
    { label: i18n.footer.careers, url: '/careers' },
  ].filter((l) => isLiveLink(l.url))

  const supportLinks = [
    { label: i18n.footer.helpCenter, url: '/help' },
    { label: 'FAQ', url: '/faq' },
    ...(biz.email ? [{ label: i18n.footer.getInTouch, url: `mailto:${biz.email}` }] : []),
  ].filter((l) => isLiveLink(l.url))

  const legalLinks = [
    { label: i18n.footer.privacyPolicy, url: '/privacy' },
    { label: i18n.footer.termsOfService, url: '/terms' },
    { label: i18n.footer.cookiePolicy, url: '/cookies' },
  ].filter((l) => isLiveLink(l.url))

  const linkColumns = [
    { title: i18n.footer.explore, links: exploreLinks },
    ...(companyLinks.length > 0 ? [{ title: i18n.footer.company, links: companyLinks }] : []),
    ...(supportLinks.length > 0 ? [{ title: i18n.footer.support, links: supportLinks }] : []),
    ...(legalLinks.length > 0 ? [{ title: i18n.footer.legal, links: legalLinks }] : []),
  ]
  return {
    blockType: 'footer',
    variant: 'mega',
    logoText: biz.name,
    tagline: biz.tagline,
    columns: linkColumns,
    copyrightText: `© ${new Date().getFullYear()} ${biz.name}. ${i18n.footer.allRightsReserved}`,
    contactEmail: biz.email,
    contactPhone: biz.phone,
    socials: [
      { platform: 'facebook', url: '#' },
      { platform: 'instagram', url: '#' },
      { platform: 'whatsapp', url: '#' },
    ],
  }
}

export function buildStats(biz: Pick<BusinessSample, 'name' | 'facts'>, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  // #2103 A1: real numbers only (year started, products listed, site-import stats).
  // Fewer than two → no numbers; the block renders nothing instead of fake figures.
  const stats = groundedStats(biz.facts ?? emptyFacts(biz.name), language)
  return {
    blockType: 'stats',
    variant: 'row',
    ...(stats.length > 0 ? { headline: i18n.stats.headline } : {}),
    stats,
  }
}

function buildGallery(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'gallery',
    variant: 'grid',
    headline: `Gallery — ${biz.name}`,
    images: Array.from({ length: TEMPLATE_GALLERY_IMAGE_COUNT }, (_, index) => ({
      image: {
        url: NEUTRAL_FALLBACK_SVG,
        alt: `${biz.name} photo ${index + 1}`,
      },
    })),
  }
}

export function buildFAQ(biz: Pick<BusinessSample, 'name' | 'facts'>, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const bizName = biz.name
  // #2103 A1: only questions answerable from FACTS (contact, what we sell, how to buy, areas).
  const items = groundedFaq(biz.facts ?? emptyFacts(bizName), language)
  return {
    blockType: 'faq',
    variant: 'accordion',
    headline: bizName ? i18n.faq.headlineWithBiz(bizName) : i18n.faq.headline,
    items,
  }
}

export function buildCTA(
  biz: BusinessSample,
  category: string = 'business',
  mood?: ThemeMood,
  language?: string,
): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const primaryCTA = resolveCTA(mood, category, 'primary')
  const headline = mood ? i18n.cta.headlineDiscover(biz.name) : i18n.cta.headlineReady(biz.name)
  return {
    blockType: 'cta',
    variant: 'banner',
    headline,
    subheadline: i18n.cta.subheadline,
    ctaLabel: primaryCTA,
    ctaUrl: '/contact',
    ctaStyle: 'primary',
  }
}

export function buildAbout(biz: BusinessSample, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const sectionLabels = getSectionLabels(language)
  const aboutPrefix = sectionLabels?.aboutHeadlinePrefix ?? i18n.about.headlinePrefix
  const sectionLabel = sectionLabels?.about ?? i18n.footer.aboutUs
  return {
    blockType: 'about',
    variant: 'split',
    headline: aboutPrefix ? `${aboutPrefix} ${biz.name}` : biz.name,
    body: biz.description,
    layout: 'image-right',
    sectionLabel,
  }
}

export function buildPricing(biz: Pick<BusinessSample, 'name' | 'facts'>, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  // #2103 A1: plans are the merchant's own priced products — never invented tiers or perks.
  const plans = groundedPricingPlans(biz.facts ?? emptyFacts(biz.name), i18n.pricing.learnMore, language)
  return {
    blockType: 'pricing',
    variant: 'cards',
    headline: i18n.pricing.headline,
    subheadline: i18n.pricing.subheadline,
    plans,
  }
}

export function buildTeam(biz: Pick<BusinessSample, 'name' | 'facts'>, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  // #2103 A1: no invented names, credentials or bios — just the owner/brand.
  return {
    blockType: 'team',
    variant: 'grid',
    headline: i18n.team.headline,
    subheadline: i18n.team.subheadline,
    members: groundedTeam(biz.facts ?? emptyFacts(biz.name), language),
  }
}

function buildNewsletter(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'newsletter',
    variant: 'inline',
    headline: `Stay Updated with ${biz.name}`,
    subheadline: 'Get the latest news, promotions, and updates delivered to your inbox.',
    buttonLabel: 'Subscribe',
    placeholder: 'your@email.com',
  }
}

// ── Industry block builders ─────────────────────────────────────────────────

// GH-1024: menu-display hidden — use menu-food (schema: price: string, currency: string, tag?: string, no dietaryTags).
// GH-1219: prefer library block categories (already in canonical format) over hardcoded fallback.
function buildMenuFood(
  content: CategoryContent,
  biz: BusinessSample,
  language?: string,
): Record<string, unknown> {
  const industryBlock = content.industryBlocks.find((b) => b.blockType === 'menu-food') as Record<string, unknown> | undefined
  const menuHeadline: Record<string, string> = {
    en: 'Our Menu',
    ms: 'Menu Kami',
    vi: 'Thực Đơn',
  }
  const headline = menuHeadline[language ?? 'en']
    ?? (industryBlock?.headline as string)
    ?? (industryBlock?.title as string)
    ?? menuHeadline.en
  const libCategories = Array.isArray(industryBlock?.categories) && (industryBlock.categories as unknown[]).length > 0
    ? industryBlock.categories as unknown[]
    : null
  const productCategoryNames: Record<string, string> = {
    en: 'Our Selection',
    ms: 'Pilihan Kami',
    vi: 'Lựa Chọn Của Chúng Tôi',
  }
  // #2103 A2: prices come from what the merchant typed ("Kek lapis (whole RM65…)" → 65), never
  // from the library. An item without a merchant price stays price-less here; the generation
  // service fills it from the product we create for it, or leaves it blank.
  const listed = biz.facts?.products ?? []
  const names = listed.length > 0 ? listed.map((p) => p.name) : (biz.products ?? [])
  const productItems = names.slice(0, 12).map((name) => {
    const match = listed.find((p) => p.name.toLowerCase() === name.toLowerCase())
    return match?.price !== undefined
      ? { name, price: formatPrice(match.price), currency: 'RM' }
      : { name, price: '' }
  })
  const productCategories = productItems.length >= 2
    ? [{ name: productCategoryNames[language ?? 'en'] ?? productCategoryNames.en, items: productItems }]
    : null

  return {
    blockType: 'menu-food',
    variant: 'classic',
    headline,
    categories: productCategories ?? libCategories ?? [],
  }
}

function buildBookingWidget(biz: BusinessSample): Record<string, unknown> {
  // #2103 A1: services are the merchant's own listed products (with their price when given).
  // No invented services, durations-with-prices or opening hours.
  const services = (biz.facts?.products ?? []).slice(0, 6).map((p) => ({
    name: p.name,
    duration: 60,
    price: p.price ?? 0,
    description: '',
  }))
  return {
    blockType: 'booking-widget',
    variant: 'inline',
    headline: 'Book an Appointment',
    subheadline: 'Choose a service and pick your preferred time slot.',
    services,
    availableDays: [1, 2, 3, 4, 5, 6],
    timeSlotInterval: 30,
    startTime: '09:00',
    endTime: '18:00',
    showPrice: services.some((s) => s.price > 0),
  }
}

function buildClassSchedule(): Record<string, unknown> {
  // #2103 A1: no invented instructors, classes or attendance numbers — the merchant adds their timetable.
  return {
    blockType: 'class-schedule',
    variant: 'grid',
    headline: 'Weekly Schedule',
    showCapacity: false,
    highlightToday: true,
    classes: [],
  }
}

function buildReviewCards(): Record<string, unknown> {
  // #2103 A1: review-cards need a star rating per review, which a site import does not carry,
  // so nothing is invented — the merchant adds real reviews.
  return {
    blockType: 'review-cards',
    variant: 'grid',
    headline: 'Customer Reviews',
    showAverage: false,
    reviews: [],
  }
}

function buildVideoShowcase(): Record<string, unknown> {
  return {
    blockType: 'video-showcase',
    variant: 'grid',
    headline: 'Watch & Learn',
    showCategories: false,
    autoplay: false,
    videos: [],
  }
}

function buildDoctorProfile(): Record<string, unknown> {
  // #2103 A1: never invent practitioners, qualifications or fees.
  return {
    blockType: 'doctor-profile',
    variant: 'cards',
    headline: 'Our Team',
    doctors: [],
  }
}

function buildPropertyCard(): Record<string, unknown> {
  // #2103 A1: no invented listings or prices — the merchant adds their properties.
  return {
    blockType: 'property-card',
    variant: 'grid',
    headline: 'Featured Properties',
    showMap: false,
    currency: 'RM',
    properties: [],
  }
}

/**
 * Turn user-supplied products into product-quick-view items, padded with
 * canned items when fewer than 3 provided. Placeholder imageUrl is used —
 * the downstream Unsplash pipeline replaces these based on deriveKeywords.
 */
function quickViewItemsFromProducts(
  biz: BusinessSample,
): Record<string, unknown>[] {
  // #2103 A1/A2: the merchant's own products with their own prices; no canned padding.
  const listed = biz.facts?.products ?? (biz.products ?? []).map((name) => ({ name }) as { name: string; price?: number })
  return listed.map((p) => ({
    name: capitalizeFirst(p.name),
    price: p.price ?? 0,
    imageUrls: [PORTRAIT_FALLBACK_SVG],
    description: '',
    ctaLabel: 'Shop Now',
    ctaUrl: '#',
  }))
}

function buildProductQuickView(biz: BusinessSample): Record<string, unknown> {
  const products = quickViewItemsFromProducts(biz)
  return {
    blockType: 'product-quick-view',
    variant: 'grid',
    headline: products.length > 0 ? `Shop ${biz.name}` : 'Shop',
    columns: 4 as const,
    showQuickView: true,
    currency: 'RM',
    products,
  }
}

function buildPortfolioGrid(): Record<string, unknown> {
  // #2103 A1: no invented clients or projects.
  return {
    blockType: 'portfolio-grid',
    variant: 'masonry',
    headline: 'Our Work',
    projects: [],
  }
}

export function buildServiceCards(biz: BusinessSample, category: string, language?: string): Record<string, unknown> {
  type SItem = { title: string; icon: string; title_ms?: string }
  const servicesMap: Record<string, SItem[]> = {
    business: [
      { title: 'Strategy Consulting', icon: 'BarChart', title_ms: 'Perundingan Strategi', },
      { title: 'Market Entry', icon: 'Globe', title_ms: 'Kemasukan Pasaran', },
      { title: 'M&A Advisory', icon: 'Handshake', title_ms: 'Penasihat M&A', },
    ],
    beauty: [
      { title: 'Facial Treatment', icon: 'Sparkles', title_ms: 'Rawatan Muka', },
      { title: 'Nail Art', icon: 'Palette', title_ms: 'Seni Kuku', },
      { title: 'Lash Extensions', icon: 'Eye', title_ms: 'Sambungan Bulu Mata', },
    ],
    health: [
      { title: 'General Consultation', icon: 'Stethoscope', title_ms: 'Perundingan Umum', },
      { title: 'Health Screening', icon: 'Activity', title_ms: 'Saringan Kesihatan', },
      { title: 'Minor Procedures', icon: 'Syringe', title_ms: 'Prosedur Kecil', },
    ],
    tech: [
      { title: 'Managed Hosting', icon: 'Server', title_ms: 'Pengehosan Terurus', },
      { title: 'DevOps Setup', icon: 'GitBranch', title_ms: 'Persediaan DevOps', },
      { title: '24/7 Support', icon: 'Headphones', title_ms: 'Sokongan 24/7', },
    ],
    education: [
      { title: 'Group Classes', icon: 'Users', title_ms: 'Kelas Berkumpulan', },
      { title: '1-on-1 Tutoring', icon: 'User', title_ms: 'Pengajaran 1-lawan-1', },
      { title: 'Exam Bootcamp', icon: 'GraduationCap', title_ms: 'Kem Latihan Peperiksaan', },
    ],
    fitness: [
      { title: 'Personal Training', icon: 'Dumbbell', title_ms: 'Latihan Peribadi', },
      { title: 'Group Classes', icon: 'Users', title_ms: 'Kelas Berkumpulan', },
      { title: 'Sports Rehab', icon: 'HeartPulse', title_ms: 'Pemulihan Sukan', },
    ],
    creative: [
      { title: 'Brand Identity', icon: 'Palette', title_ms: 'Identiti Jenama', },
      { title: 'Web Design', icon: 'Monitor', title_ms: 'Reka Bentuk Web', },
      { title: 'Content Creation', icon: 'Camera', title_ms: 'Penciptaan Kandungan', },
    ],
    restaurant: [
      { title: 'Dine-In Experience', icon: 'Utensils', title_ms: 'Pengalaman Makan Di Tempat', },
      { title: 'Private Events', icon: 'Calendar', title_ms: 'Acara Peribadi', },
      { title: 'Catering Service', icon: 'Truck', title_ms: 'Perkhidmatan Katering', },
    ],
    fnb: [
      { title: 'Retail Store', icon: 'Store', title_ms: 'Kedai Runcit', },
      { title: 'Party Platters', icon: 'Package', title_ms: 'Dulang Parti', },
      { title: 'Corporate Catering', icon: 'Truck', title_ms: 'Katering Korporat', },
    ],
    ecommerce: [
      { title: 'Fast Delivery', icon: 'Truck', title_ms: 'Penghantaran Pantas', },
      { title: 'Easy Returns', icon: 'RotateCcw', title_ms: 'Pemulangan Mudah', },
      { title: 'WhatsApp Concierge', icon: 'MessageCircle', title_ms: 'Concierge WhatsApp', },
    ],
    realestate: [
      { title: 'Property Viewing', icon: 'Home', title_ms: 'Tontonan Hartanah', },
      { title: 'Sale & Purchase', icon: 'FileText', title_ms: 'Jual Beli', },
      { title: 'Investment Advisory', icon: 'TrendingUp', title_ms: 'Penasihat Pelaburan', },
    ],
    events: [
      { title: 'Wedding Planning', icon: 'Heart', title_ms: 'Perancangan Perkahwinan', },
      { title: 'Corporate Events', icon: 'Briefcase', title_ms: 'Acara Korporat', },
      { title: 'Décor & Styling', icon: 'Sparkles', title_ms: 'Dekorasi & Penggayaan', },
    ],
    travel: [
      { title: 'Day Tours', icon: 'Map', title_ms: 'Lawatan Sehari', },
      { title: 'Multi-Day Packages', icon: 'Backpack', title_ms: 'Pakej Berbilang Hari', },
      { title: 'Custom Itineraries', icon: 'Compass', title_ms: 'Itinerari Tersuai', },
    ],
    blog: [
      { title: 'Sponsored Articles', icon: 'FileText', title_ms: 'Artikel Tajaan', },
      { title: 'Newsletter Placements', icon: 'Mail', title_ms: 'Penempatan Surat Berita', },
      { title: 'Podcast Interviews', icon: 'Mic', title_ms: 'Temu Bual Podcast', },
    ],
  }

  const localizeService = (s: SItem) => ({
    ...s,
    title: (language === 'ms' && s.title_ms) ? s.title_ms : s.title,
    // #2103 A1: category-generic service names only — no canned prices, counts, SLAs or guarantees.
    description: groundedServiceBlurb(biz.name, language),
  })

  const i18n = getBlockStrings(language)
  const canned = servicesMap[category] ?? servicesMap['business']!

  // Plan 260414-2249 phase-01: when user supplies ≥2 products, emit them as
  // service cards (title = product, description = category template, icon =
  // rotated from PRODUCT_FEATURE_ICONS). Leaves price empty — storefront can
  // add pricing later via the editor.
  const userProducts = biz.products ?? []
  const localizedCanned = canned.map(localizeService)
  const userServices =
    userProducts.length >= 2
      ? featuresFromProducts(userProducts, category, 6, language, biz).map((card) => ({
          title: card.title,
          description: card.description,
          icon: card.icon,
          cta: { label: i18n.serviceCards.ctaLabel, url: '/contact' },
        }))
      : []
  const services = userServices.length > 0
    ? [...userServices]
    : localizedCanned.map((s) => ({
          ...s,
          cta: { label: i18n.serviceCards.ctaLabel, url: '/contact' },
        }))

  if (userServices.length > 0 && services.length < 4) {
    const existingTitles = new Set(services.map((service) => service.title.toLocaleLowerCase()))
    for (const fallback of localizedCanned) {
      if (services.length >= 4) break
      if (existingTitles.has(fallback.title.toLocaleLowerCase())) continue
      services.push({
        ...fallback,
        cta: { label: i18n.serviceCards.ctaLabel, url: '/contact' },
      })
      existingTitles.add(fallback.title.toLocaleLowerCase())
    }
  }

  return {
    blockType: 'service-cards',
    variant: 'grid',
    headline: i18n.serviceCards.headline,
    subheadline: i18n.serviceCards.subheadline(biz.name),
    services,
  }
}

export function buildClientLogos(biz: Pick<BusinessSample, 'name' | 'facts'>, language?: string): Record<string, unknown> {
  // #2103 A1: only payment methods the merchant has actually enabled, as name-only
  // badges. Never third-party brands (banks, telcos, retailers) the merchant doesn't work with.
  const logos = groundedLogos(biz.facts ?? emptyFacts(biz.name))
  return {
    blockType: 'logo-cloud',
    variant: 'row',
    ...(logos.length > 0 ? { headline: groundedLogoHeadline(language) } : {}),
    logos,
  }
}

function buildFeatureComparison(): Record<string, unknown> {
  // #2103 A1: no invented plan tiers or inclusions.
  return {
    blockType: 'feature-comparison',
    variant: 'table',
    headline: 'Compare Options',
    products: [],
    features: [],
  }
}

function buildPricingTable(): Record<string, unknown> {
  // #2103 A1: no invented plans or prices.
  return {
    blockType: 'pricing-table',
    variant: 'columns',
    headline: 'Pricing',
    billingToggle: 'monthly',
    plans: [],
  }
}

// ── Main composer ───────────────────────────────────────────────────────────

function getPageNames(variant: 'starter' | 'professional' | 'premium'): string[] {
  switch (variant) {
    case 'starter':
      return ['/']
    case 'professional':
      return ['/', 'about', 'contact']
    case 'premium':
      return ['/', 'about', 'services', 'contact', 'blog']
  }
}

function buildIndustryBlock(blockType: string, content: CategoryContent, biz: BusinessSample, category: string): Record<string, unknown> | null {
  // Guard: unsupported block types — return null so callers skip them cleanly
  if (isUnsupportedBlock(blockType)) return null
  switch (blockType) {
    case 'menu-food':
      return buildMenuFood(content, biz)
    case 'booking-widget':
      return buildBookingWidget(biz)
    case 'class-schedule':
      return buildClassSchedule()
    case 'review-cards':
      return buildReviewCards()
    // case 'video-showcase': // temporarily hidden (aiVisible: false, archived)
    //   return buildVideoShowcase()
    case 'doctor-profile':
      return buildDoctorProfile()
    case 'property-card':
      return buildPropertyCard()
    case 'product-quick-view':
      return buildProductQuickView(biz)
    case 'portfolio-grid':
      return buildPortfolioGrid()
    case 'service-cards':
      return buildServiceCards(biz, category)
    case 'logo-cloud':
      return buildClientLogos(biz)
    case 'feature-comparison':
      return buildFeatureComparison()
    case 'pricing-table':
      return buildPricingTable()
    case 'before-after':
      return {
        blockType: 'before-after',
        variant: 'slider',
        headline: 'See the Transformation',
        beforeImage: { url: NEUTRAL_FALLBACK_SVG, alt: 'Before treatment', label: 'Before' },
        afterImage: { url: NEUTRAL_FALLBACK_SVG, alt: 'After treatment', label: 'After' },
      }
    default:
      return null
  }
}

function buildHomePage(
  biz: BusinessSample,
  content: CategoryContent,
  category: string,
  variant: 'starter' | 'professional' | 'premium',
  themePresetIndex: number,
  pages: string[],
  compositionSeed?: number,
  disabledSet?: Set<string>,
): TemplatePage {
  // Helper: get variant for a block type — seed-based if available, else hardcoded default
  const getVariant = (blockType: string, fallback: string): string => {
    if (compositionSeed != null) {
      return selectVariant(blockType, compositionSeed, category, disabledSet)
    }
    // Legacy: use themePresetIndex for hero only, hardcoded for rest
    if (blockType === 'hero') {
      const heroVariants = CATEGORY_HERO_VARIANTS[category] ?? ['centered']
      return heroVariants[themePresetIndex % heroVariants.length]!
    }
    return fallback
  }

  const blocks: Record<string, unknown>[] = []

  // Navigation always first
  blocks.push({ ...buildNavigation(biz, pages), variant: getVariant('navigation', 'simple') })

  // Hero always second
  blocks.push({ ...buildHero(biz, category, themePresetIndex), variant: getVariant('hero', 'centered') })

  // Middle blocks — collect all, then optionally shuffle
  const middleBlocks: Record<string, unknown>[] = []

  // Features / Services (always included) — enforce min content so grid-4 doesn't render partial
  const featuresBlock = buildFeatures(biz, category) as Record<string, unknown>
  const featuresCount = Array.isArray(featuresBlock.features) ? featuresBlock.features.length : 3
  const featuresVariant = enforceMinContent('features', getVariant('features', 'grid-3'), featuresCount)
  middleBlocks.push({ ...featuresBlock, variant: featuresVariant })

  // Ben-Ben guard: starter tier must also include signature blocks + stats + gallery
  // to avoid the hero → generic → footer empty-hole symptom.
  // Inject up to 2 category-specific industry blocks + universal stats + gallery.
  if (variant === 'starter') {
    const industryBlockTypes = TEMPLATE_RULES[category]?.industryBlocks ?? []
    const maxIndustry = Math.min(2, industryBlockTypes.length)
    for (let i = 0; i < maxIndustry; i++) {
      const block = buildIndustryBlock(industryBlockTypes[i]!, content, biz, category)
      if (block) middleBlocks.push(block)
    }
    // Universal trust blocks — also cover business category signature (stats, team)
    middleBlocks.push({ ...buildStats(biz), variant: getVariant('stats', 'row') })
    middleBlocks.push({ ...buildGallery(biz), variant: getVariant('gallery', 'grid') })
  }

  if (variant === 'professional' || variant === 'premium') {
    middleBlocks.push({ ...buildStats(biz), variant: getVariant('stats', 'row') })
    middleBlocks.push({ ...buildGallery(biz), variant: getVariant('gallery', 'grid') })

    // Industry blocks
    const industryBlockTypes = TEMPLATE_RULES[category]?.industryBlocks ?? []
    const maxIndustry = variant === 'premium' ? industryBlockTypes.length : Math.min(2, industryBlockTypes.length)
    for (let i = 0; i < maxIndustry; i++) {
      const block = buildIndustryBlock(industryBlockTypes[i]!, content, biz, category)
      if (block) middleBlocks.push(block)
    }
  }

  // Testimonials
  const testimonialsVariant = getVariant('testimonials', 'cards')
  const legacyTestimonials = buildTestimonials(biz)
  const finalTestimonialsVariant = enforceMinContent('testimonials', testimonialsVariant, (legacyTestimonials.testimonials as unknown[]).length)
  middleBlocks.push({ ...legacyTestimonials, variant: finalTestimonialsVariant })

  if (variant === 'professional' || variant === 'premium') {
    middleBlocks.push({ ...buildFAQ(biz), variant: getVariant('faq', 'accordion') })
    middleBlocks.push({ ...buildCTA(biz), variant: getVariant('cta', 'banner') })
  }

  if (variant === 'premium') {
    const pricing = buildPricing(biz)
    // no priced products → no pricing section (never invented tiers)
    if (!isPlanlessPricing(pricing)) middleBlocks.push({ ...pricing, variant: getVariant('pricing', 'cards') })
    middleBlocks.push({ ...buildTeam(biz), variant: getVariant('team', 'grid') })
    middleBlocks.push({ ...buildNewsletter(biz), variant: getVariant('newsletter', 'inline') })
  }

  // Shuffle middle blocks if seed provided (backward-compatible: no seed = no shuffle)
  if (compositionSeed != null) {
    const rand = createSeededRandom(compositionSeed)
    // Ordering constraints: features must be before stats
    const shuffled = shuffleArray(middleBlocks, rand)
    // Enforce: features before stats, features before testimonials
    const enforced = enforceBlockOrdering(shuffled)
    blocks.push(...enforced)
  } else {
    blocks.push(...middleBlocks)
  }

  // Contact (starter only puts it on home page)
  if (variant === 'starter') {
    blocks.push({ ...buildContact(biz), variant: getVariant('contact', 'split') })
  }

  // Footer always last
  blocks.push({ ...buildFooter(biz, pages), variant: getVariant('footer', 'simple') })

  return { title: 'Home', slug: '/', layout: blocks }
}

/** Enforce ordering: features before stats, about before team */
function enforceBlockOrdering(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  const result = [...blocks]
  const deps: [string, string][] = [
    ['features', 'stats'],
    ['features', 'testimonials'],
  ]
  for (const [before, after] of deps) {
    const beforeIdx = result.findIndex(b => b.blockType === before)
    const afterIdx = result.findIndex(b => b.blockType === after)
    if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx > afterIdx) {
      const [moved] = result.splice(beforeIdx, 1)
      const newAfterIdx = result.findIndex(b => b.blockType === after)
      result.splice(newAfterIdx, 0, moved!)
    }
  }
  return result
}

function buildAboutPage(biz: BusinessSample, content: CategoryContent, category: string, pages: string[]): TemplatePage {
  // Plan 260414-2249 phase-05: mini-hero with user description excerpt,
  // story block reads biz.description (woven by Phase 01 mapper when user
  // supplies shortDescription), values → team → testimonials → CTA.
  const storyExcerpt = biz.description
    ? biz.description.length > 140
      ? biz.description.slice(0, 137) + '...'
      : biz.description
    : `Learn more about what makes ${biz.name} special.`
  return {
    title: 'About',
    slug: '/about',
    layout: [
      buildNavigation(biz, pages, category),
      { blockType: 'hero', variant: 'minimal', headline: `Our Story`, subheadline: storyExcerpt, height: '45vh' },
      buildAbout(biz),
      buildStats(biz),
      buildTeam(biz),
      buildTestimonials(biz),
      buildCTA(biz, category),
      buildFooter(biz, pages),
    ],
  }
}

function buildContactPage(biz: BusinessSample, category: string, pages: string[]): TemplatePage {
  // Plan 260414-2249 phase-05: mini-hero + contact (user phone/email/address
  // already wired via Phase 01 bizOverride) + Google Maps + FAQ for hours.
  return {
    title: 'Contact',
    slug: '/contact',
    layout: [
      buildNavigation(biz, pages, category),
      { blockType: 'hero', variant: 'minimal', headline: `Contact ${biz.name}`, subheadline: 'We\'d love to hear from you.', height: '40vh' },
      buildContact(biz),
      // TODO(GH-820): re-enable google-maps when embedUrl pipeline lands (owner fills in via builder for now)
      {
        blockType: 'faq',
        variant: 'accordion',
        headline: 'Visit Us',
        items: [
          { question: 'What are your opening hours?', answer: 'We are open 9:00 AM to 9:00 PM daily. See our Google Maps listing for real-time updates.' },
          { question: 'Do you offer walk-ins or is booking required?', answer: 'Walk-ins welcome for most services. For peak hours and specific requests, booking is recommended.' },
          { question: 'Is parking available?', answer: 'Yes — street parking and nearby covered parking are both within a 2-minute walk.' },
        ],
      },
      buildFooter(biz, pages),
    ],
  }
}

function buildServicesPage(biz: BusinessSample, content: CategoryContent, category: string, pages: string[]): TemplatePage {
  const blocks: Record<string, unknown>[] = [
    buildNavigation(biz, pages),
    { blockType: 'hero', variant: 'minimal', headline: `Our Services`, subheadline: biz.tagline, height: '40vh' },
    buildServiceCards(biz, category),
  ]

  // Add relevant industry blocks
  const industryBlockTypes = TEMPLATE_RULES[category]?.industryBlocks ?? []
  for (const bt of industryBlockTypes) {
    if (bt !== 'review-cards') {
      const block = buildIndustryBlock(bt, content, biz, category)
      if (block) blocks.push(block)
    }
  }

  const pricing = buildPricing(biz)
  if (!isPlanlessPricing(pricing)) blocks.push(pricing)
  blocks.push(buildFAQ(biz))
  blocks.push(buildCTA(biz))
  blocks.push(buildFooter(biz, pages))

  return { title: 'Services', slug: '/services', layout: blocks }
}

function buildBlogPage(biz: BusinessSample, category: string, pages: string[], seed?: number): TemplatePage {
  // Plan 260414-2249 phase-05: seed blog-list with category-appropriate
  // posts so the Blog sub-page never renders with a single empty heading.
  // Plan 07: pass biz so seed titles substitute `{business}` + `{product}`.
  // GH-912: thread compositionSeed so two same-category users get different
  // post ordering instead of identical hardcoded sequences.
  const seeds = getBlogSeeds(category, biz, seed)
  const items = seeds.slice(0, 6).map((post) => ({
    title: post.title,
    excerpt: post.excerpt,
    slug: post.slug,
    category: post.category ?? 'Latest',
    readTime: post.readTime ?? '4 min',
    // Placeholder image — media pipeline (Phase 03) replaces with pool photo
    imageUrl: '',
  }))

  return {
    title: 'Blog',
    slug: '/blog',
    layout: [
      buildNavigation(biz, pages, category),
      { blockType: 'hero', variant: 'minimal', headline: 'Blog & Updates', subheadline: `Latest news from ${biz.name}`, height: '40vh' },
      {
        blockType: 'blog-list',
        headline: 'Latest Articles',
        subheadline: 'Stay up to date with our latest news and insights.',
        limit: items.length > 0 ? items.length : 6,
        items,
      },
      buildNewsletter(biz),
      buildCTA(biz, category),
      buildFooter(biz, pages),
    ],
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

// ── Blueprint-driven composer (NEW — replaces algorithmic composition) ──────

import {
  TEMPLATE_GALLERY_IMAGE_COUNT,
  type TemplatePreset,
  type BlockSpec,
} from './template-definitions'
import { pickRecipe, type CategoryRecipe } from './category-recipes'
import {
  NAV_VARIANT_BY_CATEGORY,
  CONTACT_VARIANT_BY_CATEGORY,
  FOOTER_VARIANT_BY_CATEGORY,
  FEATURES_VARIANT_BY_CATEGORY,
  TESTIMONIALS_VARIANT_BY_CATEGORY,
  ABOUT_VARIANT_BY_CATEGORY,
  CTA_VARIANT_BY_CATEGORY,
  STATS_VARIANT_BY_CATEGORY,
  NEWSLETTER_VARIANT_BY_CATEGORY,
  TEAM_VARIANT_BY_CATEGORY,
  FAQ_VARIANT_BY_CATEGORY,
  GALLERY_VARIANT_BY_CATEGORY,
  PRICING_VARIANT_BY_CATEGORY,
  SERVICE_CARDS_VARIANT_BY_CATEGORY,
} from './category-requirements'
import { seededShufflePick, hashString } from './seeded-random'
import { withoutLibraryIdentity } from './library-identity'

/**
 * Plan 260415 — rotate structural block variants per category seed pool.
 * Walks every page layout and overrides `variant` for navigation / contact
 * / footer blocks with a seed-picked entry from the curated category pool,
 * so same-category businesses spread across different shapes instead of
 * locking to the composer's hardcoded default.
 */
export function rotateStructuralVariants(
  pages: TemplatePage[],
  category: string,
  seed: number,
): void {
  const pools: Array<{ blockType: string; pool: readonly string[] | undefined; salt: string }> = [
    { blockType: 'navigation', pool: NAV_VARIANT_BY_CATEGORY[category], salt: 'navigation' + category },
    { blockType: 'contact', pool: CONTACT_VARIANT_BY_CATEGORY[category], salt: 'contact' + category },
    { blockType: 'footer', pool: FOOTER_VARIANT_BY_CATEGORY[category], salt: 'footer' + category },
    { blockType: 'features', pool: FEATURES_VARIANT_BY_CATEGORY[category], salt: 'features' + category },
    { blockType: 'testimonials', pool: TESTIMONIALS_VARIANT_BY_CATEGORY[category], salt: 'testimonials' + category },
    { blockType: 'about', pool: ABOUT_VARIANT_BY_CATEGORY[category], salt: 'about' + category },
    { blockType: 'cta', pool: CTA_VARIANT_BY_CATEGORY[category], salt: 'cta' + category },
    { blockType: 'stats', pool: STATS_VARIANT_BY_CATEGORY[category], salt: 'stats' + category },
    { blockType: 'newsletter', pool: NEWSLETTER_VARIANT_BY_CATEGORY[category], salt: 'newsletter' + category },
    { blockType: 'team', pool: TEAM_VARIANT_BY_CATEGORY[category], salt: 'team' + category },
    { blockType: 'faq', pool: FAQ_VARIANT_BY_CATEGORY[category], salt: 'faq' + category },
    { blockType: 'gallery', pool: GALLERY_VARIANT_BY_CATEGORY[category], salt: 'gallery' + category },
    { blockType: 'pricing', pool: PRICING_VARIANT_BY_CATEGORY[category], salt: 'pricing' + category },
    { blockType: 'service-cards', pool: SERVICE_CARDS_VARIANT_BY_CATEGORY[category], salt: 'service-cards' + category },
  ]
  const debug = process.env.AI_GEN_DEBUG === '1'
  for (const { blockType, pool, salt } of pools) {
    if (!pool || pool.length === 0) continue
    const picked = seededShufflePick(pool, seed ^ hashString(salt)) ?? pool[0]
    if (debug) {
      console.debug(`[composer] rotate block=${blockType} category=${category} variant=${picked} seed=${seed}`)
    }
    for (const page of pages) {
      for (const block of page.layout as Array<Record<string, unknown>>) {
        if (block.blockType === blockType) {
          // Guard: enforce min content for picked variant — prevents grid-4 with 3 items etc.
          const contentFields = ['features', 'testimonials', 'items', 'plans', 'members', 'images', 'stats', 'logos', 'services']
          let count = 0
          for (const field of contentFields) {
            const v = block[field]
            if (Array.isArray(v) && v.length > count) count = v.length
          }
          block.variant = count > 0 ? enforceMinContent(blockType, picked, count) : picked
          if (blockType === 'service-cards' && Array.isArray(block.services)) {
            const target = block.variant === 'featured' ? 4 : 3
            if (block.services.length > target) {
              block.services = block.services.slice(0, target)
            }
          }
        }
      }
    }
  }
}

/**
 * Plan 07 — reorder a page's BlockSpecs to follow the recipe's block
 * sequence (best-effort). Navigation (index 0) and footer (last) are
 * locked in place; hero follows nav; middle blocks are reordered per
 * `recipe.blocks` with leftover specs appended after the recipe-matched
 * ones so nothing is lost.
 *
 * Returns `null` only when the page has no hero spec at all (a shape
 * the composer can't safely rearrange). Missing required blocks from
 * the recipe are silently skipped — the reorder is best-effort so
 * partial recipe application still changes same-category sites.
 */
function reorderSpecsByRecipe(
  specs: BlockSpec[],
  recipe: CategoryRecipe,
): BlockSpec[] | null {
  const nav = specs.find((s) => s.blockType === 'navigation')
  const hero = specs.find((s) => s.blockType === 'hero')
  const footer = specs.find((s) => s.blockType === 'footer')
  if (!hero) return null

  // Middle pool: non-structural specs grouped by blockType.
  const middlePool = new Map<string, BlockSpec[]>()
  for (const s of specs) {
    if (s === nav || s === hero || s === footer) continue
    const arr = middlePool.get(s.blockType) ?? []
    arr.push(s)
    middlePool.set(s.blockType, arr)
  }

  // Walk the recipe order, consuming from the middle pool. Skip recipe
  // block types that the preset doesn't have (sub-page blocks like
  // `contact` / `about` commonly live off-homepage in our blueprints).
  const consumed = new Set<BlockSpec>()
  const middleOrdered: BlockSpec[] = []
  for (const bt of recipe.blocks) {
    if (bt === 'hero' || bt === 'navigation' || bt === 'footer') continue
    const arr = middlePool.get(bt)
    if (arr && arr.length > 0) {
      const spec = arr.shift()!
      middleOrdered.push(spec)
      consumed.add(spec)
    }
  }
  // Append any preset specs the recipe did not mention, preserving their
  // original relative order — no block is ever dropped.
  for (const s of specs) {
    if (s === nav || s === hero || s === footer) continue
    if (!consumed.has(s)) middleOrdered.push(s)
  }

  const out: BlockSpec[] = []
  if (nav) out.push(nav)
  out.push(hero)
  out.push(...middleOrdered)
  if (footer) out.push(footer)
  return out
}

/**
 * Build a single block from a BlockSpec blueprint.
 * Dispatches to existing block builders, passing optional variant/count overrides.
 * When spec.variant is undefined and compositionSeed is provided, auto-selects via selectVariant().
 */
function buildBlockFromSpec(
  spec: BlockSpec,
  content: CategoryContent,
  biz: BusinessSample,
  category: string,
  pageNames: string[],
  compositionSeed?: number,
  mood?: ThemeMood,
  disabledSet?: Set<string>,
  language: ContentLang = 'en',
): Record<string, unknown> {
  // Auto-select variant if not specified in blueprint and seed is available
  const resolvedVariant = spec.variant ?? (compositionSeed != null ? selectVariant(spec.blockType, compositionSeed, category, disabledSet) : undefined)
  switch (spec.blockType) {
    case 'navigation':
      return { ...buildNavigation(biz, pageNames, category, mood, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'hero':
      return {
        ...buildHero(biz, category, 0, mood, language),
        ...(resolvedVariant ? { variant: resolvedVariant } : {}),
        ...(spec.overrides ?? {}),
      }
    case 'features': {
      const fb = buildFeatures(biz, category, language) as Record<string, unknown>
      const fbCount = Array.isArray(fb.features) ? (fb.features as unknown[]).length : 0
      const finalVariant = resolvedVariant ? enforceMinContent('features', resolvedVariant, fbCount) : undefined
      return { ...fb, ...(finalVariant ? { variant: finalVariant } : {}) }
    }
    case 'testimonials':
      return { ...buildTestimonials(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'contact':
      return { ...buildContact(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'footer':
      return { ...buildFooter(biz, pageNames, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'stats':
      return { ...buildStats(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'gallery':
      return { ...buildGallery(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'faq':
      return { ...buildFAQ(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'cta':
      return { ...buildCTA(biz, category, mood, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'about':
      return { ...buildAbout(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'pricing':
      return { ...buildPricing(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'team':
      return { ...buildTeam(biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'newsletter':
      return { ...buildNewsletter(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'logo-cloud':
    case 'client-logos': // backward compat alias — always normalise to logo-cloud (client-logos not in Payload whitelist)
      return { ...buildClientLogos(biz, language), blockType: 'logo-cloud', ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    // Industry-specific blocks
    case 'menu-food':
      return { ...buildMenuFood(content, biz, language), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'booking-widget':
      return buildBookingWidget(biz)
    case 'class-schedule':
      return buildClassSchedule()
    case 'review-cards':
      return buildReviewCards()
    // case 'video-showcase': // temporarily hidden (aiVisible: false, archived)
    //   return buildVideoShowcase()
    // doctor-profile handled below (line ~1188) with items
    case 'property-card':
      return buildPropertyCard()
    case 'product-quick-view':
      return buildProductQuickView(biz)
    case 'portfolio-grid': {
      const count = spec.count ?? 6
      const projects = Array.from({ length: count }, (_, i) => ({
        title: `${biz.name} Project ${i + 1}`,
        category: ['Branding', 'Web Design', 'Photography', 'Illustration'][i % 4],
        image: NEUTRAL_FALLBACK_SVG,
        description: `Creative project showcasing ${biz.tagline ?? 'our craft'}.`,
      }))
      return {
        blockType: 'portfolio-grid',
        variant: resolvedVariant ?? 'masonry',
        headline: 'Our Work',
        subheadline: biz.tagline ?? 'Selected projects',
        projects,
      }
    }
    case 'service-cards':
      return buildServiceCards(biz, category, language)
    case 'feature-comparison':
      return buildFeatureComparison()
    case 'pricing-table':
      return buildPricingTable()
    case 'doctor-profile': {
      const count = spec.count ?? 4
      const items = Array.from({ length: count }, (_, i) => ({
        name: `Dr. ${['Aisha', 'Rahman', 'Mei Ling', 'Kumar', 'Siti', 'Jonathan'][i % 6]} ${['Tan', 'Lee', 'Wong', 'Patel', 'Ismail', 'Lim'][i % 6]}`,
        title: ['Consultant Physician', 'Senior Specialist', 'Chief Medical Officer', 'Head of Department'][i % 4],
        specialty: ['Cardiology', 'Pediatrics', 'General Practice', 'Dermatology'][i % 4],
        image: AVATAR_FALLBACK_SVG,
        bio: `Experienced medical professional at ${biz.name}.`,
        experience: `${10 + i} years`,
      }))
      return {
        blockType: 'doctor-profile',
        variant: resolvedVariant ?? 'cards',
        headline: 'Meet Our Specialists',
        subheadline: `Expert care at ${biz.name}`,
        items,
      }
    }
    case 'before-after': {
      // Supply an items array (slider variant renders from items[] not single pair).
      // Enforce minimum 3 so grid/slider variants don't render partial.
      const count = Math.max(spec.count ?? 3, 3)
      const items = Array.from({ length: count }, (_, i) => ({
        label: `Transformation ${i + 1}`,
        beforeImage: {
          url: NEUTRAL_FALLBACK_SVG,
          alt: `Before ${i + 1}`,
        },
        afterImage: {
          url: NEUTRAL_FALLBACK_SVG,
          alt: `After ${i + 1}`,
        },
      }))
      return {
        blockType: 'before-after',
        variant: resolvedVariant ?? 'slider',
        headline: 'See the Transformation',
        subheadline: `Real results from ${biz.name}`,
        items,
      }
    }
    case 'countdown-timer':
      return { blockType: 'countdown-timer', variant: resolvedVariant ?? 'banner', headline: biz.name, targetDate: '2026-12-31T00:00:00' }
    case 'blog-list': {
      // Enforce min 3 for hero-card/masonry variants
      const count = Math.max(spec.count ?? 3, 4)
      const items = Array.from({ length: count }, (_, i) => ({
        title: [`Inside ${biz.name}`, 'Tips & Insights', 'Latest News', 'Case Study', 'Industry Update', 'Best Practices'][i % 6]!,
        excerpt: `Stay up to date with the latest from ${biz.name}. Read our take on ${biz.tagline ?? 'the industry'}.`,
        image: NEUTRAL_FALLBACK_SVG,
        author: ['Editorial Team', 'Lead Writer', 'Guest Contributor'][i % 3],
        date: '2026-04-14',
        category: ['News', 'Guides', 'Stories'][i % 3],
        readTime: `${3 + (i % 5)} min`,
      }))
      return {
        blockType: 'blog-list',
        variant: resolvedVariant ?? 'grid',
        headline: 'Latest Articles',
        subheadline: `Fresh reads from ${biz.name}`,
        count,
        items,
      }
    }
    case 'social-proof':
      return {
        blockType: 'social-proof',
        variant: resolvedVariant ?? 'cards',
        // #2103 A1: social-proof reviews need a rating a site import does not carry — none invented.
        reviews: [],
      }
    case 'products-grid': {
      // Generate placeholder items — previously this returned only {variant, count}
      // with no items array, causing render to show empty grid (Ben-Ben class bug).
      const count = spec.count ?? 6
      const items = Array.from({ length: count }, (_, i) => ({
        name: `${biz.name} Item ${i + 1}`,
        price: `RM ${(25 + i * 15).toFixed(2)}`,
        image: PORTRAIT_FALLBACK_SVG,
        description: `Curated product from ${biz.name}`,
        category: biz.tagline ?? 'Featured',
      }))
      return {
        blockType: 'products-grid',
        variant: resolvedVariant ?? 'grid-3',
        count,
        items,
      }
    }
    // ── Aliases: map preset blockType names to actual block builders ──
    case 'contact-form':
      return { ...buildContact(biz), blockType: 'contact', ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'map':
    case 'map-embed':
    case 'google-maps':
      return { blockType: 'google-maps', variant: resolvedVariant ?? 'full-width', address: biz.address, height: 400 }
    case 'content':
    case 'content-block':
      return { ...buildAbout(biz), blockType: 'about', ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'timeline':
      return { ...buildAbout(biz), blockType: 'about', variant: 'timeline' }
    default:
      // Try industry block builder as fallback
      const industryBlock = buildIndustryBlock(spec.blockType, content, biz, category)
      if (industryBlock) return industryBlock
      // Unknown block — return minimal spec to avoid silent skip
      console.warn(`[Composer] Unknown blockType: ${spec.blockType}`)
      return { blockType: spec.blockType, variant: resolvedVariant ?? 'default' }
  }
}

/**
 * Plan 260414-2249 phase-05: enrich sub-pages in place so every composed
 * site ships the 5-page completeness standard:
 *
 *  - Home (from blueprint — untouched)
 *  - About — override hero subheadline with biz.description excerpt
 *  - Contact — ensure google-maps + opening-hours FAQ blocks
 *  - Blog — append a new page with seeded posts if missing
 *
 * Mutates the `pages` array in place. Safe to call when pages already
 * contain these — existing content is preserved, only missing blocks/pages
 * are added.
 */
function enrichSubPages(
  pages: TemplatePage[],
  biz: BusinessSample,
  category: string,
  seed?: number,
  language: ContentLang = 'en',
): void {
  const getPage = (title: string): TemplatePage | undefined =>
    pages.find((p) => p.title?.toLowerCase() === title.toLowerCase())

  const pageNames = pages.map((p) => p.title)

  // ── About: weave user description into hero subheadline ─────────────
  const aboutPage = getPage('About')
  if (aboutPage && biz.description && biz.description.length > 0) {
    const heroIdx = aboutPage.layout.findIndex(
      (b) => (b as Record<string, unknown>).blockType === 'hero',
    )
    if (heroIdx >= 0) {
      const hero = aboutPage.layout[heroIdx] as Record<string, unknown>
      const excerpt =
        biz.description.length > 140
          ? biz.description.slice(0, 137) + '...'
          : biz.description
      aboutPage.layout[heroIdx] = { ...hero, subheadline: excerpt }
    }
  }

  // ── Contact: ensure google-maps + hours FAQ ─────────────────────────
  const contactPage = getPage('Contact')
  if (contactPage) {
    const hasMaps = contactPage.layout.some(
      (b) => (b as Record<string, unknown>).blockType === 'google-maps',
    )
    const hasFaq = contactPage.layout.some(
      (b) => (b as Record<string, unknown>).blockType === 'faq',
    )
    // Insert before footer (last block)
    const footerIdx = contactPage.layout.findIndex(
      (b) => (b as Record<string, unknown>).blockType === 'footer',
    )
    const insertAt = footerIdx >= 0 ? footerIdx : contactPage.layout.length

    // TODO(GH-820): re-enable google-maps injection when embedUrl pipeline lands
    // #2103 A1: the contact-page FAQ is built from FACTS only (no invented opening hours,
    // parking or walk-in policy). With nothing to say, no FAQ block is added.
    if (!hasFaq) {
      const contactFaqHeadline: Record<ContentLang, string> = {
        en: 'Visit Us',
        ms: 'Kunjungi Kami',
        vi: 'Ghé Thăm Chúng Tôi',
      }
      const faqItems = groundedFaq(biz.facts ?? emptyFacts(biz.name), language)
      if (faqItems.length > 0) {
        const insertIdx = contactPage.layout.findIndex(
          (b) => (b as Record<string, unknown>).blockType === 'footer',
        )
        const beforeFooter = insertIdx >= 0 ? insertIdx : contactPage.layout.length
        contactPage.layout.splice(beforeFooter, 0, {
          blockType: 'faq',
          variant: 'accordion',
          headline: contactFaqHeadline[language],
          items: faqItems,
        } as unknown as Record<string, unknown>)
      }
    }
  }

  // ── Blog: append if missing, with seeded posts ─────────────────────
  const blogPage = getPage('Blog')
  if (!blogPage) {
    const blogTemplate = buildBlogPage(biz, category, pageNames, seed)
    pages.push(blogTemplate)
  } else {
    // Existing Blog page — ensure blog-list has seeded items if empty
    const blogListIdx = blogPage.layout.findIndex(
      (b) => (b as Record<string, unknown>).blockType === 'blog-list',
    )
    if (blogListIdx >= 0) {
      const blogList = blogPage.layout[blogListIdx] as Record<string, unknown>
      const existingItems = (blogList.items as unknown[] | undefined) ?? []
      if (existingItems.length === 0) {
        const seeds = getBlogSeeds(category, biz, seed).slice(0, 6).map((post) => ({
          title: post.title,
          excerpt: post.excerpt,
          slug: post.slug,
          category: post.category ?? 'Latest',
          readTime: post.readTime ?? '4 min',
          imageUrl: '',
        }))
        blogPage.layout[blogListIdx] = {
          ...blogList,
          items: seeds,
          limit: seeds.length,
        }
      }
    }
  }
}

/**
 * Compose a template from a TemplatePreset blueprint.
 * Reads pages[].blocks[] and builds each block — no algorithmic guessing.
 * When BlockSpec.variant is undefined, uses selectVariant() for seed-based variety.
 *
 * Optional `bizOverride`: shallow-merged over the content.businesses[preset.businessIndex]
 * AFTER a deep clone, so the fallback path can inject user-extracted business name / tagline
 * without polluting the cached content pack (same pattern as researcher-03 Q3).
 */
export function composeFromBlueprint(
  preset: TemplatePreset,
  compositionSeed?: number,
  bizOverride?: Partial<BusinessSample>,
  disabledSet?: Set<string>,
  language: ContentLang = 'en',
): TemplateSeed | null {
  // Plan 260415 fix-500 — return null instead of throw so caller (e.g.
  // fallback-adapter.composeFallbackResult) can fall back to the legacy
  // generateBlocks path cleanly rather than bubbling an uncaught error up
  // through the AI gen outer catch.
  const content = getCategoryContent(preset.category)
  if (!content) {
    console.warn(`[composeFromBlueprint] Content not found for category: ${preset.category}`)
    return null
  }

  const baseBiz = content.businesses[preset.businessIndex]
  if (!baseBiz) {
    console.warn(`[composeFromBlueprint] businessIndex ${preset.businessIndex} out of range for ${preset.category} (has ${content.businesses.length})`)
    return null
  }

  // Real generation (bizOverride present): never leak the library sample's
  // identity or contact (name, tagline, description, phone, email, address)
  // into a user's site — they stay empty unless the merchant supplied them.
  // Template gallery/preview (no override) keeps the sample data.
  const biz: BusinessSample = bizOverride
    ? withoutLibraryIdentity(structuredClone(baseBiz), bizOverride)
    : baseBiz

  // Use businessIndex as seed if not provided — each template gets deterministic but different variants
  const seed = compositionSeed ?? preset.businessIndex * 7919

  const pageNames = preset.pages.map((p) => p.name)

  // Plan 260414-2249 phase-02: resolve mood from themePreset.moodId. Every
  // ThemePreset carries a moodId, so this is always defined for canonical
  // presets. Defensive fallback to `serene` (safest neutral tone).
  const mood: ThemeMood =
    THEME_MOODS[preset.themePreset.moodId] ?? THEME_MOODS.serene

  // Plan 07 — runtime recipe picker. Same (category, seed, biz.name) always
  // returns the same recipe so reruns are stable, but two businesses with
  // different names at the same base seed land on different block sequences.
  // The reorder helper returns null when the preset blueprint is missing a
  // required block — in that case we keep the preset sequence untouched.
  const recipe = pickRecipe(preset.category, seed, { name: biz.name })

  // Old presets still reference menu-display, which is hidden in the editor.
  // Normalize its blueprint to the supported menu-food schema before the
  // unsupported-block filter runs, otherwise F&B templates lose their menu.
  const normalizeSpec = (spec: BlockSpec): BlockSpec => {
    if (spec.blockType !== 'menu-display') return spec
    const menuVariant = spec.variant === 'cards' || spec.variant === 'photo-grid'
      ? 'cards'
      : spec.variant === 'minimal' || spec.variant === 'luxury-list'
        ? 'minimal'
        : 'classic'
    return { ...spec, blockType: 'menu-food', variant: menuVariant }
  }

  const pages: TemplatePage[] = preset.pages.map((page, pageIdx) => {
    // Only reorder the homepage — sub-pages keep their preset blueprint so
    // About/Contact/Blog/Services stay on their canonical shapes.
    let specs: readonly BlockSpec[] = page.blocks
    if (pageIdx === 0) {
      const reordered = reorderSpecsByRecipe([...page.blocks], recipe)
      if (reordered) specs = reordered
    }
    return {
      title: page.name,
      slug: page.slug,
      layout: specs
        .map(normalizeSpec)
        // Filter out unsupported block types before building
        .filter((spec) => !isUnsupportedBlock(spec.blockType))
        .map((spec) => {
          const block = buildBlockFromSpec(spec, content, biz, preset.category, pageNames, seed, mood, disabledSet, language)
          return applyContentValidation(block, language)
        })
        // a pricing section without plans has nothing to show: skip it, never invent tiers
        .filter((block) => !isPlanlessPricing(block)),
    }
  })

  // Plan 260414-2249 phase-05: enrich sub-pages to 5-page completeness standard.
  // - Ensure Blog page exists with seeded posts from content/blog-seeds.ts
  // - Ensure About page hero subheadline weaves user biz.description when present
  // - Ensure Contact page has google-maps + opening-hours FAQ when user provides address
  // Mutates `pages` in place via helper — adds missing pages, updates existing.
  enrichSubPages(pages, biz, preset.category, seed, language)

  // Plan 260415 — rotate navigation / contact / footer variants from the
  // curated per-category pools so same-category businesses ship different
  // structural shapes instead of locking to the composer's default variant.
  rotateStructuralVariants(pages, preset.category, seed)

  return {
    name: preset.name,
    description: preset.description,
    category: preset.category,
    tier: 'premium',
    isPremium: true,
    theme: (() => {
      const fonts = resolveFontNames(preset.themePreset.fontPairingId)
      return {
        ...preset.themePreset,
        // v1.3 plan 260419-0047: textColor default từ colorMode
        textColor: (preset.themePreset as { textColor?: string }).textColor ?? (preset.themePreset.colorMode === 'dark' ? '#fafafa' : '#111111'),
        // A11y plan 260418-2357: guarantee focusStyle token present
        focusStyle: preset.themePreset.focusStyle ?? DEFAULT_FOCUS_STYLE,
        // Next-wins plan 260419-0034 phase-01: explicit font names for distinct check
        ...(fonts.heading ? { fontHeading: fonts.heading } : {}),
        ...(fonts.body ? { fontBody: fonts.body } : {}),
      }
    })(),
    pages,
  }
}

// ── Legacy composer (deprecated — kept for backward compat) ────────────────

/** @deprecated Use composeFromBlueprint() with TemplatePreset instead */
export function composeTemplate(input: ComposerInput, disabledSet?: Set<string>): TemplateSeed | null {
  // Plan 260415 fix-500 — return null instead of throw (same reason as
  // composeFromBlueprint above).
  const content = getCategoryContent(input.category)
  if (!content) {
    console.warn(`[composeTemplate] Unknown category: ${input.category}`)
    return null
  }

  const biz = content.businesses[input.businessIndex]
  if (!biz) {
    console.warn(`[composeTemplate] Business index ${input.businessIndex} out of range for category ${input.category} (has ${content.businesses.length})`)
    return null
  }

  const pages = getPageNames(input.variant)
  const templatePages: TemplatePage[] = []

  // Home page (always present)
  templatePages.push(buildHomePage(biz, content, input.category, input.variant, input.businessIndex, pages, input.compositionSeed, disabledSet))

  // Additional pages for professional/premium
  if (input.variant === 'professional' || input.variant === 'premium') {
    templatePages.push(buildAboutPage(biz, content, input.category, pages))
    templatePages.push(buildContactPage(biz, input.category, pages))
  }

  if (input.variant === 'premium') {
    templatePages.push(buildServicesPage(biz, content, input.category, pages))
    templatePages.push(buildBlogPage(biz, input.category, pages, input.compositionSeed))
  }

  // Build the template name
  const tierLabel = input.variant.charAt(0).toUpperCase() + input.variant.slice(1)
  const name = `${biz.name} — ${input.themePreset.name}`
  const description = `${tierLabel} template for ${input.category}: ${biz.tagline}`

  // Phase 04 — apply content validation across every block built by the
  // legacy path (same rules as AI path + blueprint path, single source of
  // truth in content-rules.ts).
  const legacyLang: ContentLang = 'en'
  const validatedPages: TemplatePage[] = templatePages.map((page) => ({
    ...page,
    layout: page.layout.map((block) =>
      applyContentValidation(block as Record<string, unknown>, legacyLang),
    ),
  }))

  return {
    name,
    description,
    category: input.category,
    tier: input.variant,
    isPremium: input.variant === 'premium',
    theme: (() => {
      const fonts = resolveFontNames(input.themePreset.fontPairingId)
      return {
        ...input.themePreset,
        textColor: (input.themePreset as { textColor?: string }).textColor ?? (input.themePreset.colorMode === 'dark' ? '#fafafa' : '#111111'),
        focusStyle: input.themePreset.focusStyle ?? DEFAULT_FOCUS_STYLE,
        ...(fonts.heading ? { fontHeading: fonts.heading } : {}),
        ...(fonts.body ? { fontBody: fonts.body } : {}),
      }
    })(),
    pages: validatedPages,
  }
}
