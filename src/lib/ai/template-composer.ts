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
import { THEME_MOODS, getCategoryCTA as getMoodCTA, type ThemeMood } from './theme-moods'
import { getBlogSeeds } from './content/blog-seeds'
import { pickLogosByCategory } from './content/client-logos-library'
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
export const BROKEN_VARIANTS: Record<string, string[]> = {
  hero: ['animated-gradient'],
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
function selectVariant(
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

const CATEGORY_HERO_VARIANTS: Record<string, string[]> = {
  restaurant: ['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen'],
  ecommerce: ['slideshow', 'cards-overlay', 'gradient', 'split-right', 'magazine'],
  beauty: ['gradient', 'minimal', 'parallax', 'split-left', 'magazine'],
  tech: ['gradient', 'split-video', 'minimal', 'parallax', 'cards-overlay'],
  health: ['centered', 'split-left', 'minimal', 'gradient', 'parallax'],
  education: ['centered', 'split-right', 'gradient', 'magazine', 'parallax'],
  realestate: ['fullscreen', 'parallax', 'slideshow', 'split-left', 'magazine'],
  fitness: ['fullscreen', 'parallax', 'split-video', 'gradient', 'cards-overlay'],
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

function buildNavigation(
  biz: BusinessSample,
  pages: string[],
  category: string = 'business',
  mood?: ThemeMood,
  language?: string,
): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const SLUG_LABELS: Record<string, string> = {
    '/': i18n.navigation.home,
    'about': i18n.navigation.about,
    'services': i18n.navigation.services,
    'contact': i18n.navigation.contact,
  }
  const links = pages.map((p) => {
    const slug = p === '/' ? '/' : p.replace(/^\/+/, '').toLowerCase()
    const label = SLUG_LABELS[slug] ?? (p.charAt(0).toUpperCase() + p.slice(1))
    return { label, url: p === '/' ? '/' : `/${slug}` }
  })
  return {
    blockType: 'navigation',
    logoText: biz.name,
    links,
    ctaButton: { show: true, label: resolveCTA(mood, category, 'primary'), url: resolveNavCtaUrl(pages) },
    ariaLabel: `${biz.name} main navigation`,
    breadcrumbConfig: { showOnAllPages: true, homeLabel: i18n.navigation.home, separator: '/' },
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

  return {
    blockType: 'hero',
    variant,
    headline,
    subheadline,
    ctaButtons: [
      { label: resolveCTA(mood, category, 'primary'), url: '/contact', style: 'primary' },
      { label: resolveCTA(mood, category, 'secondary'), url: '/about', style: 'outline' },
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

// Category-tuned TITLE templates for product-derived feature cards. `{P}` is
// replaced with the capitalized product name, and templates rotate by index
// so 3 cards never share the same suffix. Matches the spec example format:
// "Ramen Specialties / Fresh Sushi / Handmade Gyoza".
const FEATURE_TITLE_TEMPLATES: Record<string, string[]> = {
  restaurant: ['{P} Specialties', 'Fresh {P}', 'Handmade {P}', 'Signature {P}', 'House {P}', 'Authentic {P}'],
  fnb: ['Signature {P}', 'Our {P}', 'Fresh {P}', 'House {P}', 'Artisan {P}', 'Daily {P}'],
  ecommerce: ['Premium {P}', 'Best-Selling {P}', '{P} Collection', '{P} Essentials', 'Curated {P}', 'Exclusive {P}'],
  beauty: ['Signature {P}', 'Custom {P}', 'Premium {P}', '{P} Treatment', 'Expert {P}', 'Luxury {P}'],
  health: ['{P} Service', 'Expert {P}', 'Comprehensive {P}', 'Specialist {P}', 'Trusted {P}'],
  fitness: ['{P} Program', 'Signature {P}', 'Expert {P}', 'Personal {P}', 'Group {P}'],
  education: ['{P} Program', '{P} Course', 'Comprehensive {P}', 'Expert {P}', 'Intensive {P}'],
  tech: ['{P} Platform', 'Enterprise {P}', 'Scalable {P}', 'Advanced {P}', 'Cloud {P}'],
  creative: ['{P} Service', 'Signature {P}', 'Premium {P}', 'Custom {P}', 'Award-winning {P}'],
  business: ['{P} Advisory', 'Strategic {P}', '{P} Consulting', 'Expert {P}', 'Bespoke {P}'],
  realestate: ['Featured {P}', 'Exclusive {P}', 'Premium {P}', 'Curated {P}', 'Signature {P}'],
  events: ['{P} Package', 'Signature {P}', 'Custom {P}', 'Luxury {P}', 'Bespoke {P}'],
  blog: ['{P} Stories', '{P} Coverage', '{P} Insights', 'Latest {P}', 'In-depth {P}'],
  travel: ['{P} Experience', 'Guided {P}', 'Signature {P}', 'Curated {P}', 'Adventure {P}'],
}

// Category-tuned body copy template for a product. `{product}` is replaced
// with the product name as provided by the user (first letter capitalized).
// Kept short, benefit-oriented, Malaysia-audience friendly.
const FEATURE_BODY_TEMPLATES: Record<string, string> = {
  restaurant: 'Our signature {product} is crafted from scratch with locally sourced ingredients — a guest favorite.',
  fnb: 'Enjoy our house {product} — freshly made every day using premium ingredients.',
  ecommerce: 'Shop our best-selling {product} — quality you can feel, delivered across Malaysia.',
  beauty: 'Experience our signature {product} treatment — personalized for your skin type and goals.',
  health: 'Our {product} service is delivered by licensed practitioners with modern equipment.',
  fitness: 'Train smarter with our {product} program — structured for real, lasting results.',
  education: 'Our {product} program is designed for measurable progress and exam-ready confidence.',
  tech: 'Ship faster with our {product} — production-ready, battle-tested, fully supported.',
  creative: 'Our {product} service blends strategy and craft — delivered on time, on brand.',
  business: 'Our {product} engagement is tailored to your goals, timelines, and budget.',
  realestate: 'Browse our {product} — hand-picked listings across the Klang Valley.',
  events: 'Let us handle your {product} — from planning to day-of coordination, covered.',
  blog: 'Dive into our {product} coverage — curated stories that actually move the needle.',
  travel: 'Join our {product} experience — local expertise, insider routes, zero guesswork.',
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
): { icon: string; title: string; description: string }[] {
  const icons = PRODUCT_FEATURE_ICONS[category] ?? PRODUCT_FEATURE_ICONS['business']!
  const titleTpls = FEATURE_TITLE_TEMPLATES[category] ?? FEATURE_TITLE_TEMPLATES['business']!
  const bodyTpl = FEATURE_BODY_TEMPLATES[category] ?? FEATURE_BODY_TEMPLATES['business']!

  return products.slice(0, maxCards).map((product, idx) => {
    const capitalized = capitalizeFirst(product)
    return {
      icon: icons[idx % icons.length]!,
      title: titleTpls[idx % titleTpls.length]!.replace('{P}', capitalized),
      description: bodyTpl.replace('{product}', product),
    }
  })
}

export function buildFeatures(biz: BusinessSample, category: string, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  type FItem = { icon: string; title: string; description: string; title_ms?: string; description_ms?: string }
  const featureMap: Record<string, FItem[]> = {
    restaurant: [
      { icon: 'Utensils', title: 'Authentic Recipes', description: 'Traditional recipes passed down through generations, using only the freshest local ingredients.', title_ms: 'Resipi Autentik', description_ms: 'Resipi tradisional yang diwarisi turun-temurun, menggunakan bahan-bahan tempatan yang paling segar.' },
      { icon: 'Award', title: 'Halal Certified', description: 'All our ingredients and preparation methods are JAKIM halal-certified for your peace of mind.', title_ms: 'Bersijil Halal', description_ms: 'Semua bahan dan kaedah penyediaan kami bersijil halal JAKIM untuk ketenangan minda anda.' },
      { icon: 'Truck', title: 'Fast Delivery', description: 'Available on GrabFood, Foodpanda, and direct ordering with free delivery within 5km.', title_ms: 'Penghantaran Pantas', description_ms: 'Tersedia di GrabFood, Foodpanda, dan tempahan terus dengan penghantaran percuma dalam radius 5km.' },
    ],
    ecommerce: [
      { icon: 'ShieldCheck', title: 'Secure Payment', description: 'Pay safely with FPX, credit card, or e-wallets. All transactions are encrypted and protected.', title_ms: 'Pembayaran Selamat', description_ms: 'Bayar dengan selamat menggunakan FPX, kad kredit, atau e-dompet. Semua transaksi dienkripsi dan dilindungi.' },
      { icon: 'Truck', title: 'Free Shipping', description: 'Enjoy free shipping on orders above RM 150. Express delivery available for RM 10.', title_ms: 'Penghantaran Percuma', description_ms: 'Nikmati penghantaran percuma untuk pesanan melebihi RM 150. Penghantaran ekspres tersedia pada RM 10.' },
      { icon: 'RefreshCcw', title: '30-Day Returns', description: 'Not satisfied? Return within 30 days for a full refund. No questions asked.', title_ms: 'Pulangan 30 Hari', description_ms: 'Tidak berpuas hati? Pulangkan dalam masa 30 hari untuk bayaran balik penuh. Tanpa soal jawab.' },
    ],
    beauty: [
      { icon: 'Sparkles', title: 'Premium Products', description: 'We use only halal-certified, dermatologist-tested products from Korea and Japan.', title_ms: 'Produk Premium', description_ms: 'Kami hanya menggunakan produk bersijil halal yang diuji oleh dermatologi dari Korea dan Jepun.' },
      { icon: 'Clock', title: 'Easy Booking', description: 'Book your appointment online 24/7. Walk-ins welcome but booking guarantees your slot.', title_ms: 'Tempahan Mudah', description_ms: 'Tempah temujanji anda dalam talian 24/7. Pelawat tanpa temu janji dialu-alukan tetapi tempahan menjamin slot anda.' },
      { icon: 'Heart', title: 'Personalised Care', description: 'Every treatment is customised to your skin type and concerns for the best results.', title_ms: 'Penjagaan Peribadi', description_ms: 'Setiap rawatan disesuaikan dengan jenis kulit dan kebimbangan anda untuk hasil terbaik.' },
    ],
    tech: [
      { icon: 'Zap', title: 'Lightning Fast', description: 'Our infrastructure delivers sub-100ms response times with 99.9% uptime SLA.', title_ms: 'Laju Seperti Kilat', description_ms: 'Infrastruktur kami memberikan masa tindak balas bawah 100ms dengan SLA masa aktif 99.9%.' },
      { icon: 'Shield', title: 'Enterprise Security', description: 'Bank-grade encryption, SOC 2 compliance, and regular penetration testing.', title_ms: 'Keselamatan Perusahaan', description_ms: 'Enkripsi tahap bank, pematuhan SOC 2, dan ujian penembusan berkala.' },
      { icon: 'Headphones', title: '24/7 Support', description: 'Our Malaysian support team is available round the clock via chat, email, and phone.', title_ms: 'Sokongan 24/7', description_ms: 'Pasukan sokongan Malaysia kami sedia membantu sepanjang masa melalui sembang, e-mel, dan telefon.' },
    ],
    health: [
      { icon: 'Stethoscope', title: 'Expert Doctors', description: 'Our team of experienced doctors provide comprehensive healthcare for your whole family.', title_ms: 'Doktor Pakar', description_ms: 'Pasukan doktor berpengalaman kami menyediakan penjagaan kesihatan menyeluruh untuk seluruh keluarga anda.' },
      { icon: 'CreditCard', title: 'Insurance Accepted', description: 'We accept all major insurance panels including Great Eastern, AIA, and Prudential.', title_ms: 'Insurans Diterima', description_ms: 'Kami menerima semua panel insurans utama termasuk Great Eastern, AIA, dan Prudential.' },
      { icon: 'Clock', title: 'Minimal Wait Time', description: 'Our efficient scheduling ensures you spend less time waiting and more time getting care.', title_ms: 'Masa Menunggu Minimum', description_ms: 'Penjadualan kami yang cekap memastikan anda menghabiskan lebih sedikit masa menunggu dan lebih banyak masa mendapat penjagaan.' },
    ],
    education: [
      { icon: 'GraduationCap', title: 'Proven Results', description: 'Over 90% of our students achieve A grades in their subjects. Results speak for themselves.', title_ms: 'Keputusan Terbukti', description_ms: 'Lebih 90% pelajar kami mencapai gred A dalam mata pelajaran mereka. Keputusan berbicara sendiri.' },
      { icon: 'Users', title: 'Small Class Sizes', description: 'Maximum 15 students per class ensures personal attention and better learning outcomes.', title_ms: 'Saiz Kelas Kecil', description_ms: 'Maksimum 15 pelajar setiap kelas memastikan perhatian peribadi dan hasil pembelajaran yang lebih baik.' },
      { icon: 'BookOpen', title: 'Updated Curriculum', description: 'Our materials follow the latest KSSM/KBSM syllabus and SPM exam format.', title_ms: 'Kurikulum Terkini', description_ms: 'Bahan kami mengikuti silibus KSSM/KBSM terkini dan format peperiksaan SPM.' },
    ],
    realestate: [
      { icon: 'Home', title: 'Premium Listings', description: 'Curated selection of the finest properties in KL, PJ, and the Klang Valley.', title_ms: 'Penyenaraian Premium', description_ms: 'Pilihan hartanah terbaik yang dikurasi di KL, PJ, dan Lembah Klang.' },
      { icon: 'Shield', title: 'Trusted Agent', description: 'Licensed REN with over 10 years of experience and 500+ successful transactions.', title_ms: 'Ejen Dipercayai', description_ms: 'REN berlesen dengan pengalaman lebih 10 tahun dan 500+ transaksi berjaya.' },
      { icon: 'TrendingUp', title: 'Market Insights', description: 'Get data-driven property valuations and investment advice from our expert team.', title_ms: 'Pandangan Pasaran', description_ms: 'Dapatkan penilaian hartanah berasaskan data dan nasihat pelaburan daripada pasukan pakar kami.' },
    ],
    fitness: [
      { icon: 'Dumbbell', title: 'Expert Trainers', description: 'Certified personal trainers with specialisation in body transformation and sports performance.', title_ms: 'Jurulatih Pakar', description_ms: 'Jurulatih peribadi bertauliah dengan pengkhususan dalam transformasi badan dan prestasi sukan.' },
      { icon: 'Users', title: 'Group Classes', description: 'Over 30 group classes per week including HIIT, yoga, spin, and boxing.', title_ms: 'Kelas Berkumpulan', description_ms: 'Lebih 30 kelas berkumpulan seminggu termasuk HIIT, yoga, spin, dan tinju.' },
      { icon: 'Clock', title: 'Flexible Hours', description: 'Open from 6 AM to 11 PM daily. Train on your schedule, not ours.', title_ms: 'Waktu Fleksibel', description_ms: 'Buka dari 6 pagi hingga 11 malam setiap hari. Berlatih mengikut jadual anda, bukan jadual kami.' },
    ],
    creative: [
      { icon: 'Palette', title: 'Award-Winning Design', description: 'Our team has won multiple design awards and delivered for 200+ brands across Malaysia.', title_ms: 'Reka Bentuk Pemenang Anugerah', description_ms: 'Pasukan kami telah memenangi pelbagai anugerah reka bentuk dan berkhidmat untuk 200+ jenama di seluruh Malaysia.' },
      { icon: 'Layers', title: 'Full-Service Agency', description: 'From branding to web design to packaging — we handle everything under one roof.', title_ms: 'Agensi Perkhidmatan Penuh', description_ms: 'Dari penjenamaan hingga reka bentuk web dan pembungkusan — kami menguruskan segalanya di bawah satu bumbung.' },
      { icon: 'Zap', title: 'Fast Turnaround', description: 'Logo in 5 days, brand identity in 2 weeks. We respect your timeline.', title_ms: 'Penyelesaian Pantas', description_ms: 'Logo dalam 5 hari, identiti jenama dalam 2 minggu. Kami menghormati jadual masa anda.' },
    ],
    business: [
      { icon: 'BarChart', title: 'Data-Driven Strategy', description: 'Our consulting approach combines market data with decades of industry experience.', title_ms: 'Strategi Berasaskan Data', description_ms: 'Pendekatan perundingan kami menggabungkan data pasaran dengan dekad pengalaman industri.' },
      { icon: 'Globe', title: 'Regional Expertise', description: 'Deep knowledge of ASEAN markets with offices in KL, Singapore, and Jakarta.', title_ms: 'Kepakaran Serantau', description_ms: 'Pengetahuan mendalam tentang pasaran ASEAN dengan pejabat di KL, Singapura, dan Jakarta.' },
      { icon: 'Handshake', title: 'Trusted Advisor', description: 'Confidential, objective advice from experienced C-suite professionals.', title_ms: 'Penasihat Dipercayai', description_ms: 'Nasihat sulit dan objektif daripada profesional C-suite yang berpengalaman.' },
    ],
    fnb: [
      { icon: 'Coffee', title: 'Quality Ingredients', description: 'We source premium beans and ingredients to deliver the authentic taste you love.', title_ms: 'Bahan Berkualiti', description_ms: 'Kami mendapatkan kacang dan bahan premium untuk menyampaikan rasa autentik yang anda sukai.' },
      { icon: 'Wifi', title: 'Work-Friendly Space', description: 'Free Wi-Fi, power outlets at every table, and a quiet corner for focused work.', title_ms: 'Ruang Mesra Kerja', description_ms: 'Wi-Fi percuma, soket kuasa di setiap meja, dan sudut yang tenang untuk kerja berfokus.' },
      { icon: 'Heart', title: 'Made with Love', description: 'Every drink and dish is prepared fresh, following recipes perfected over decades.', title_ms: 'Dibuat dengan Penuh Kasih', description_ms: 'Setiap minuman dan hidangan disediakan segar, mengikut resipi yang telah disempurnakan selama berdekad.' },
    ],
    events: [
      { icon: 'Calendar', title: 'Flawless Planning', description: 'From venue selection to day-of coordination, we handle every detail so you can enjoy the moment.', title_ms: 'Perancangan Sempurna', description_ms: 'Dari pemilihan lokasi hingga penyelarasan hari majlis, kami menguruskan setiap butiran supaya anda boleh menikmati setiap detik.' },
      { icon: 'Users', title: 'Experienced Team', description: 'Over 500 events delivered across weddings, corporate functions, and private celebrations.', title_ms: 'Pasukan Berpengalaman', description_ms: 'Lebih 500 acara telah disampaikan merangkumi perkahwinan, fungsi korporat, dan sambutan peribadi.' },
      { icon: 'Star', title: 'Custom Packages', description: 'Tailored packages from intimate gatherings of 20 to grand celebrations of 500+ guests.', title_ms: 'Pakej Disesuaikan', description_ms: 'Pakej yang disesuaikan daripada perhimpunan intim 20 orang hingga perayaan besar 500+ tetamu.' },
    ],
    blog: [
      { icon: 'PenTool', title: 'Expert Writers', description: 'Our team of experienced writers and editors deliver well-researched, engaging content daily.', title_ms: 'Penulis Pakar', description_ms: 'Pasukan penulis dan editor berpengalaman kami menyampaikan kandungan yang dikaji dengan baik dan menarik setiap hari.' },
      { icon: 'TrendingUp', title: 'Trending Topics', description: 'Stay ahead with the latest insights, trends, and stories that matter to Malaysians.', title_ms: 'Topik Semasa', description_ms: 'Sentiasa terkini dengan pandangan, trend, dan cerita terbaru yang penting bagi rakyat Malaysia.' },
      { icon: 'Mail', title: 'Weekly Newsletter', description: 'Get the best stories delivered to your inbox every week. Join 10,000+ subscribers.', title_ms: 'Surat Berita Mingguan', description_ms: 'Dapatkan cerita terbaik dihantar ke peti masuk anda setiap minggu. Sertai 10,000+ pelanggan.' },
    ],
    travel: [
      { icon: 'Map', title: 'Local Expertise', description: 'Born and raised in Malaysia — we know the hidden gems, best routes, and insider tips.', title_ms: 'Kepakaran Tempatan', description_ms: 'Lahir dan dibesarkan di Malaysia — kami mengetahui permata tersembunyi, laluan terbaik, dan tip eksklusif.' },
      { icon: 'Shield', title: 'Safe & Insured', description: 'All tours include travel insurance and are led by licensed, first-aid certified guides.', title_ms: 'Selamat & Dilindungi', description_ms: 'Semua lawatan termasuk insurans perjalanan dan dipimpin oleh pemandu berlesen dan bertauliah pertolongan cemas.' },
      { icon: 'DollarSign', title: 'Best Price Guarantee', description: 'Competitive RM pricing with no hidden fees. Price match guarantee on all packages.', title_ms: 'Jaminan Harga Terbaik', description_ms: 'Harga RM yang kompetitif tanpa caj tersembunyi. Jaminan padanan harga untuk semua pakej.' },
    ],
  }

  const localizeFeature = (item: FItem) => ({
    icon: item.icon,
    title: (language === 'ms' && item.title_ms) ? item.title_ms : item.title,
    description: (language === 'ms' && item.description_ms) ? item.description_ms : item.description,
  })

  const canned = featureMap[category] ?? featureMap['business']!
  // Plan 260414-2249 phase-01: when user supplies ≥2 products, emit
  // product-derived cards instead of canned. Keeps canned count so layout
  // variants (grid-3, grid-4) still render cleanly.
  const userProducts = biz.products ?? []
  const features =
    userProducts.length >= 2
      ? featuresFromProducts(userProducts, category, canned.length)
      : canned.map(localizeFeature)
  return {
    blockType: 'features',
    variant: 'grid-3',
    headline: i18n.features.headlineWhyChoose(biz.name),
    subheadline: biz.tagline,
    features,
  }
}

export function buildTestimonials(content: CategoryContent, bizName?: string, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  const headlineFull = bizName ? i18n.testimonials.headlineWithBiz(bizName) : i18n.testimonials.headline
  // Emit up to 6 so masonry/grid-4 variants have enough data (was slicing to 3 → masonry empty).
  return {
    blockType: 'testimonials',
    variant: 'cards',
    headline: headlineFull,
    subheadline: i18n.testimonials.subheadline,
    testimonials: content.testimonials.slice(0, 6).map((t) => ({
      quote: (language === 'ms' && t.quote_ms) ? t.quote_ms
           : (language === 'vi' && t.quote_vi) ? t.quote_vi
           : t.quote,
      name: t.name,
      title: t.title,
      company: t.company,
      rating: t.rating,
      // Next-wins plan 260419-0034 phase-02: static avatar fallback for all.
      // Real photo URLs come from media-injector trong production gen.
      avatarUrl: AVATAR_FALLBACK_SVG,
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

function buildFooter(biz: BusinessSample, pages: string[]): Record<string, unknown> {
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

  const exploreLinks = pages.map((p) => ({
    label: p === '/' ? 'Home' : p.charAt(0).toUpperCase() + p.slice(1),
    url: p === '/' ? '/' : `/${p}`,
  }))

  const companyLinks = [
    { label: 'About Us', url: '/about' },
    { label: 'Contact', url: '/contact' },
    { label: 'Careers', url: '/careers' },
  ].filter((l) => isLiveLink(l.url))

  const supportLinks = [
    { label: 'Help Center', url: '/help' },
    { label: 'FAQ', url: '/faq' },
    { label: 'Get in Touch', url: `mailto:${biz.email}` },
  ].filter((l) => isLiveLink(l.url))

  const legalLinks = [
    { label: 'Privacy Policy', url: '/privacy' },
    { label: 'Terms of Service', url: '/terms' },
    { label: 'Cookie Policy', url: '/cookies' },
  ].filter((l) => isLiveLink(l.url))

  const linkColumns = [
    { title: 'Explore', links: exploreLinks },
    ...(companyLinks.length > 0 ? [{ title: 'Company', links: companyLinks }] : []),
    ...(supportLinks.length > 0 ? [{ title: 'Support', links: supportLinks }] : []),
    ...(legalLinks.length > 0 ? [{ title: 'Legal', links: legalLinks }] : []),
  ]
  return {
    blockType: 'footer',
    variant: 'mega',
    logoText: biz.name,
    tagline: biz.tagline,
    columns: linkColumns,
    copyrightText: `© 2026 ${biz.name}. All rights reserved.`,
    contactEmail: biz.email,
    contactPhone: biz.phone,
    socials: [
      { platform: 'facebook', url: '#' },
      { platform: 'instagram', url: '#' },
      { platform: 'whatsapp', url: '#' },
    ],
  }
}

export function buildStats(category: string, language?: string): Record<string, unknown> {
  const statsMap: Record<string, { value: string; label: string; suffix?: string }[]> = {
    restaurant: [
      { value: '15', label: 'Years Serving', suffix: '+' },
      { value: '50000', label: 'Customers Served', suffix: '+' },
      { value: '4.8', label: 'Google Rating' },
      { value: '200', label: 'Menu Items', suffix: '+' },
    ],
    ecommerce: [
      { value: '10000', label: 'Products', suffix: '+' },
      { value: '50000', label: 'Happy Customers', suffix: '+' },
      { value: '99', label: 'Satisfaction Rate', suffix: '%' },
      { value: '24', label: 'Hour Delivery', suffix: 'h' },
    ],
    beauty: [
      { value: '5000', label: 'Clients Served', suffix: '+' },
      { value: '50', label: 'Treatments Available', suffix: '+' },
      { value: '4.9', label: 'Rating' },
      { value: '8', label: 'Years Experience', suffix: '+' },
    ],
    tech: [
      { value: '99.9', label: 'Uptime', suffix: '%' },
      { value: '500', label: 'Clients', suffix: '+' },
      { value: '50', label: 'Team Members', suffix: '+' },
      { value: '24', label: 'Support', suffix: '/7' },
    ],
    health: [
      { value: '20', label: 'Years Experience', suffix: '+' },
      { value: '15000', label: 'Patients Treated', suffix: '+' },
      { value: '10', label: 'Specialist Doctors' },
      { value: '4.9', label: 'Patient Rating' },
    ],
    education: [
      { value: '3000', label: 'Students Taught', suffix: '+' },
      { value: '90', label: 'A-Grade Rate', suffix: '%' },
      { value: '15', label: 'Years Teaching', suffix: '+' },
      { value: '50', label: 'Subjects Offered', suffix: '+' },
    ],
    realestate: [
      { value: '500', label: 'Properties Sold', suffix: '+' },
      { value: '2', label: 'Total Sales Value', suffix: 'B+' },
      { value: '10', label: 'Years Experience', suffix: '+' },
      { value: '98', label: 'Client Satisfaction', suffix: '%' },
    ],
    fitness: [
      { value: '2000', label: 'Members', suffix: '+' },
      { value: '30', label: 'Classes Per Week', suffix: '+' },
      { value: '15', label: 'Expert Trainers' },
      { value: '4.8', label: 'Member Rating' },
    ],
    creative: [
      { value: '200', label: 'Projects Delivered', suffix: '+' },
      { value: '50', label: 'Brand Identities', suffix: '+' },
      { value: '12', label: 'Awards Won' },
      { value: '98', label: 'Client Retention', suffix: '%' },
    ],
    business: [
      { value: '150', label: 'Clients Served', suffix: '+' },
      { value: '500', label: 'Projects Completed', suffix: '+' },
      { value: '25', label: 'Years Experience', suffix: '+' },
      { value: '5', label: 'ASEAN Countries' },
    ],
    fnb: [
      { value: '10000', label: 'Cups Served Monthly', suffix: '+' },
      { value: '4.7', label: 'Google Rating' },
      { value: '20', label: 'Years Heritage', suffix: '+' },
      { value: '30', label: 'Menu Items', suffix: '+' },
    ],
  }
  const i18n = getBlockStrings(language)
  return {
    blockType: 'stats',
    variant: 'row',
    headline: i18n.stats.headline,
    stats: statsMap[category] ?? statsMap['business']!,
  }
}

function buildGallery(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'gallery',
    variant: 'grid',
    headline: `Gallery — ${biz.name}`,
    images: [
      { image: { url: NEUTRAL_FALLBACK_SVG, alt: `${biz.name} photo 1` } },
      { image: { url: NEUTRAL_FALLBACK_SVG, alt: `${biz.name} photo 2` } },
      { image: { url: NEUTRAL_FALLBACK_SVG, alt: `${biz.name} photo 3` } },
      { image: { url: NEUTRAL_FALLBACK_SVG, alt: `${biz.name} photo 4` } },
      { image: { url: NEUTRAL_FALLBACK_SVG, alt: `${biz.name} photo 5` } },
      { image: { url: NEUTRAL_FALLBACK_SVG, alt: `${biz.name} photo 6` } },
    ],
  }
}

export function buildFAQ(content: CategoryContent, bizName?: string, language?: string): Record<string, unknown> {
  const i18n = getBlockStrings(language)
  return {
    blockType: 'faq',
    variant: 'accordion',
    headline: bizName ? i18n.faq.headlineWithBiz(bizName) : i18n.faq.headline,
    items: content.faqItems.map((f) => ({ question: f.question, answer: f.answer })),
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

export function buildPricing(category: string, language?: string): Record<string, unknown> {
  const pricingMap: Record<string, { name: string; price: string; period: string; features: string[]; highlighted: boolean }[]> = {
    tech: [
      { name: 'Starter', price: 'RM 99', period: '/month', features: ['1 Website', '5 GB Storage', 'SSL Certificate', 'Email Support'], highlighted: false },
      { name: 'Business', price: 'RM 299', period: '/month', features: ['5 Websites', '50 GB Storage', 'SSL Certificate', '24/7 Support', 'Load Balancing'], highlighted: true },
      { name: 'Enterprise', price: 'RM 499', period: '/month', features: ['Unlimited Sites', '200 GB Storage', 'Dedicated Infra', 'SLA Guarantee', 'Priority Support'], highlighted: false },
    ],
    education: [
      { name: 'Single Subject', price: 'RM 200', period: '/month', features: ['1 Subject', 'Weekly Classes', 'Printed Notes', 'WhatsApp Support'], highlighted: false },
      { name: 'SPM Package', price: 'RM 500', period: '/month', features: ['3 Subjects', 'Weekly Classes', 'Practice Papers', 'Monthly Tests', 'Parent Reports'], highlighted: true },
      { name: 'Premium', price: 'RM 800', period: '/month', features: ['5 Subjects', 'Daily Classes', 'Mock Exams', '1-on-1 Tutoring', 'Guaranteed Results'], highlighted: false },
    ],
    fitness: [
      { name: 'Basic', price: 'RM 120', period: '/month', features: ['Gym Access', 'Locker Room', 'Basic Equipment'], highlighted: false },
      { name: 'Premium', price: 'RM 250', period: '/month', features: ['Gym + Classes', 'Personal Locker', 'Sauna Access', 'Free Towels'], highlighted: true },
      { name: 'VIP', price: 'RM 450', period: '/month', features: ['All Access', '4 PT Sessions', 'Nutrition Plan', 'Recovery Room', 'Guest Pass'], highlighted: false },
    ],
    beauty: [
      { name: 'Basic Facial', price: 'RM 120', period: '/session', features: ['Deep Cleansing', 'Mask Treatment', 'Moisturising'], highlighted: false },
      { name: 'Glow Package', price: 'RM 350', period: '/session', features: ['Deep Cleansing', 'Microdermabrasion', 'LED Therapy', 'Premium Mask', 'Serum Treatment'], highlighted: true },
      { name: 'Bridal Package', price: 'RM 800', period: '/package', features: ['6 Sessions', 'All Treatments', 'Bridal Makeup Trial', 'Wedding Day Makeup', 'Emergency Kit'], highlighted: false },
    ],
    health: [
      { name: 'Basic Check-up', price: 'RM 250', period: '/visit', features: ['Physical Exam', 'Blood Test', 'BMI Analysis', 'Doctor Consultation'], highlighted: false },
      { name: 'Comprehensive', price: 'RM 550', period: '/visit', features: ['Full Blood Panel', 'ECG', 'X-Ray', 'Ultrasound', 'Specialist Review'], highlighted: true },
      { name: 'Executive', price: 'RM 1200', period: '/visit', features: ['All Tests', 'CT Scan', 'Stress Test', 'Cancer Markers', 'VIP Room', 'Report Delivery'], highlighted: false },
    ],
    business: [
      { name: 'Advisory', price: 'RM 500', period: '/hour', features: ['Strategy Consultation', 'Market Analysis', 'Action Plan'], highlighted: false },
      { name: 'Project', price: 'RM 25,000', period: '/project', features: ['Full Strategy', 'Market Research', 'Implementation Plan', 'Monthly Reviews'], highlighted: true },
      { name: 'Retainer', price: 'RM 10,000', period: '/month', features: ['Board Advisory', 'Unlimited Consults', 'Quarterly Reports', 'Priority Access'], highlighted: false },
    ],
    creative: [
      { name: 'Logo Design', price: 'RM 800', period: '/project', features: ['3 Concepts', '2 Revisions', 'Final Files', 'Brand Guidelines'], highlighted: false },
      { name: 'Brand Identity', price: 'RM 3,500', period: '/project', features: ['Logo + Stationery', 'Brand Book', 'Social Templates', 'Unlimited Revisions'], highlighted: true },
      { name: 'Full Agency', price: 'RM 8,000', period: '/month', features: ['All Design Work', 'Web Design', 'Social Content', 'Monthly Reports', 'Dedicated Designer'], highlighted: false },
    ],
    restaurant: [
      { name: 'Set Lunch', price: 'RM 28', period: '/pax', features: ['2-course meal', 'Soft drink', 'Weekday 12-3pm', 'Dine-in only'], highlighted: false },
      { name: 'Chef\'s Tasting', price: 'RM 128', period: '/pax', features: ['6-course menu', 'Wine pairing option', 'Seasonal ingredients', 'Reservation required'], highlighted: true },
      { name: 'Private Event', price: 'RM 2,500', period: '/booking', features: ['Full restaurant buyout', 'Custom menu', '20-40 pax', 'Dedicated host', 'Valet parking'], highlighted: false },
    ],
    fnb: [
      { name: 'Retail Box', price: 'RM 35', period: '/pack', features: ['12 pieces', 'Freshly baked', 'Self-collect at outlet', 'Walk-in welcome'], highlighted: false },
      { name: 'Party Platter', price: 'RM 180', period: '/tray', features: ['60 pieces mixed', '48h pre-order', 'Delivery available', 'Halal certified'], highlighted: true },
      { name: 'Corporate Catering', price: 'RM 18', period: '/pax', features: ['Minimum 30 pax', 'Buffet setup', 'Full service staff', 'KL & Selangor delivery'], highlighted: false },
    ],
    ecommerce: [
      { name: 'Starter', price: 'RM 0', period: '/forever', features: ['Free shipping over RM 150', 'Standard 3-5 day delivery', 'Returns within 14 days', 'Email support'], highlighted: false },
      { name: 'Member', price: 'RM 88', period: '/year', features: ['Free shipping all orders', 'Priority 1-2 day delivery', 'Exclusive member sales', 'WhatsApp concierge', 'Early access drops'], highlighted: true },
      { name: 'VIP', price: 'RM 288', period: '/year', features: ['All Member perks', 'Birthday gift box', 'Personal styling session', 'Free alterations', 'Dedicated account manager'], highlighted: false },
    ],
    realestate: [
      { name: 'Consultation', price: 'RM 0', period: '/session', features: ['Area market briefing', 'Property viewing tour', 'Price negotiation tips', 'No obligation'], highlighted: false },
      { name: 'Full Service', price: '2%', period: 'of sale price', features: ['Unlimited viewings', 'Professional photos', 'Rumah123 + PropertyGuru listing', 'SPA & legal support', 'Loan application help'], highlighted: true },
      { name: 'Premium Marketing', price: '2.5%', period: 'of sale price', features: ['All Full Service items', 'Drone + video tour', 'Social media campaign', 'Featured placement', 'International listings', 'Open house events'], highlighted: false },
    ],
    events: [
      { name: 'Intimate Gathering', price: 'RM 3,500', period: '/event', features: ['Up to 30 pax', 'Venue coordination', 'Decor setup', 'Photography 2 hours'], highlighted: false },
      { name: 'Wedding Package', price: 'RM 18,000', period: '/event', features: ['Up to 200 pax', 'Full planning + execution', 'Decor + flowers', 'MC + entertainment', 'Photography + videography', 'Bridal car'], highlighted: true },
      { name: 'Corporate Gala', price: 'RM 35,000', period: '/event', features: ['Up to 500 pax', 'Full production', 'AV + staging', 'Live band', 'Catering coordination', 'RSVP management'], highlighted: false },
    ],
    travel: [
      { name: 'Day Trip', price: 'RM 180', period: '/pax', features: ['8-hour itinerary', 'English/Malay guide', 'Transport + entry tickets', 'Lunch included'], highlighted: false },
      { name: 'Weekend Escape', price: 'RM 680', period: '/pax', features: ['3D2N package', 'Hotel + meals', 'Airport transfer', 'Licensed tour guide', 'Cultural experiences'], highlighted: true },
      { name: 'Custom Itinerary', price: 'RM 1,500', period: '/pax', features: ['Tailored 5-7 day plan', 'Premium hotels', 'Private vehicle', 'Dedicated guide', 'Flexible schedule', '24/7 concierge'], highlighted: false },
    ],
    blog: [
      { name: 'Newsletter Free', price: 'RM 0', period: '/forever', features: ['Weekly newsletter', 'Public articles', 'Basic archive access'], highlighted: false },
      { name: 'Member', price: 'RM 19', period: '/month', features: ['All premium articles', 'Monthly deep-dives', 'Member-only podcast', 'Comment access', 'Ad-free reading'], highlighted: true },
      { name: 'Founding Reader', price: 'RM 190', period: '/year', features: ['All Member perks', 'Early access content', 'Direct reply channel', 'Merchandise discount', 'Annual live event invite'], highlighted: false },
    ],
  }

  const defaultPlans = [
    { name: 'Basic', price: 'RM 99', period: '/month', features: ['Core Features', 'Email Support', 'Standard SLA'], highlighted: false },
    { name: 'Professional', price: 'RM 299', period: '/month', features: ['All Features', '24/7 Support', 'Priority SLA', 'Analytics'], highlighted: true },
    { name: 'Enterprise', price: 'Custom', period: '', features: ['Custom Solution', 'Dedicated Team', 'Custom SLA', 'On-site Support'], highlighted: false },
  ]

  // Plan 260415 fix-500 — Payload Pages.ts pricing.plans[].features schema
  // requires `[{text: string, included: boolean}]`, but the composer maps
  // above declare features as raw `string[]`. When apply-template or page
  // save runs the plan through Payload, it throws
  //   TypeError: Cannot create property 'text' on string 'Core Features'
  // because Payload tries to `feature.text = ...` on each item assuming it
  // is an object. Normalize to the required shape here so downstream code
  // paths don't have to branch on string vs object.
  const i18n = getBlockStrings(language)
  const plans = (pricingMap[category] ?? defaultPlans).map((p) => ({
    ...p,
    features: (p.features ?? []).map((f) =>
      typeof f === 'string' ? { text: f, included: true } : f,
    ),
    isPopular: p.highlighted,
    ctaLabel: p.highlighted ? i18n.pricing.getStarted : i18n.pricing.learnMore,
    ctaUrl: '/contact',
  }))

  return {
    blockType: 'pricing',
    variant: 'cards',
    headline: i18n.pricing.headline,
    subheadline: i18n.pricing.subheadline,
    plans,
  }
}

export function buildTeam(category: string, language?: string): Record<string, unknown> {
  const teamMap: Record<string, { name: string; role: string; bio: string }[]> = {
    health: [
      { name: 'Dr. Tan Wei Ming', role: 'General Practitioner', bio: 'MBBS (UM), 15 years experience in family medicine.' },
      { name: 'Dr. Aishah Binti Ahmad', role: 'Dental Surgeon', bio: 'BDS (USM), specialising in cosmetic dentistry and orthodontics.' },
      { name: 'Dr. Priya Nair', role: 'Specialist Physician', bio: 'MRCP (UK), internal medicine with focus on diabetes management.' },
    ],
    tech: [
      { name: 'Ahmad Razif', role: 'CTO', bio: '10+ years building scalable cloud infrastructure for Malaysian enterprises.' },
      { name: 'Mei Ling Tan', role: 'Lead Developer', bio: 'Full-stack engineer with expertise in React, Node.js, and AWS.' },
      { name: 'Raju Krishnan', role: 'Head of Support', bio: 'Ensuring 24/7 uptime and client satisfaction for 500+ businesses.' },
    ],
    creative: [
      { name: 'Farid Ismail', role: 'Creative Director', bio: 'Award-winning designer with 12 years leading brand campaigns.' },
      { name: 'Sarah Lim', role: 'Senior Designer', bio: 'Specialises in packaging and brand identity for F&B and lifestyle brands.' },
      { name: 'Vikram Patel', role: 'Motion Designer', bio: 'Creates stunning animations and video content for digital campaigns.' },
    ],
    business: [
      { name: 'Dato\' Rahman', role: 'Managing Partner', bio: '25 years of C-suite advisory across ASEAN markets.' },
      { name: 'Jennifer Ooi', role: 'Strategy Director', bio: 'Former McKinsey consultant with deep expertise in market entry.' },
      { name: 'Harith bin Yusof', role: 'Operations Lead', bio: 'Operational excellence specialist with manufacturing and logistics background.' },
    ],
    restaurant: [
      { name: 'Chef Azman Yusof', role: 'Executive Chef', bio: 'Trained at Le Cordon Bleu Paris, 18 years running Malaysian fine-dining kitchens.' },
      { name: 'Nurul Izzati', role: 'Restaurant Manager', bio: 'Former front-of-house at Shangri-La KL, service obsessed and fluent in BM/EN/CN.' },
      { name: 'Pak Samad', role: 'Head of Sourcing', bio: 'Builds relationships with Cameron Highlands farmers and Tanjung Sepat fishermen for daily fresh ingredients.' },
    ],
    fnb: [
      { name: 'Cikgu Aminah', role: 'Master Baker', bio: '30 years of heritage kuih recipes passed down from her grandmother in Melaka.' },
      { name: 'Jonathan Lim', role: 'Operations Manager', bio: 'Scaled 12 outlets across Klang Valley, JAKIM halal certification specialist.' },
      { name: 'Priya Devi', role: 'Catering Lead', bio: 'Orchestrates corporate catering for 500+ PAX events with 100% satisfaction record.' },
    ],
    beauty: [
      { name: 'Jessica Wong', role: 'Principal Aesthetician', bio: 'CIDESCO certified, specialist in Korean skincare protocols and anti-ageing treatments.' },
      { name: 'Sofia Binti Hassan', role: 'Lash & Brow Artist', bio: '8 years shaping brows for KL\'s top influencers. Natural-look expert.' },
      { name: 'Tan Hui Ling', role: 'Senior Nail Artist', bio: 'Gelish Malaysia brand ambassador with a 5-week booking waitlist.' },
    ],
    education: [
      { name: 'Mr. David Koh', role: 'Founder & Head Tutor', bio: 'First-class MSc Maths (UM), 20+ years SPM coaching with 95% A-grade record.' },
      { name: 'Pn. Siti Hawa', role: 'Head of Bahasa Melayu', bio: 'Former SBP senior teacher, sets past-year SPM model answers used by 30+ tuition centres.' },
      { name: 'Dr. Raymond Teh', role: 'Science Coordinator', bio: 'PhD Chemistry (Monash), simplifies the hardest concepts for Form 4-5 students.' },
    ],
    realestate: [
      { name: 'Michelle Lau REN', role: 'Principal Agent', bio: 'REN 45822. Closed 80+ KLCC/Mont Kiara transactions. Mandarin, English, Cantonese.' },
      { name: 'Firdaus Abdullah', role: 'Landed Property Specialist', bio: 'REN 39117. Shah Alam and Subang expert, helps young families find their first home.' },
      { name: 'Shalini Murugan', role: 'Investment Consultant', bio: 'Bank-negara licensed financial planner. Advises on property loan structuring and ROI analysis.' },
    ],
    fitness: [
      { name: 'Coach Adam Razak', role: 'Head Trainer', bio: 'Former national weightlifting athlete. NASM-CPT certified. 12 years coaching experience.' },
      { name: 'Yasmin Tan', role: 'Yoga & Pilates Lead', bio: '500-hour RYT, specialises in prenatal, postnatal, and injury rehabilitation.' },
      { name: 'Daniel Mok', role: 'Strength Coach', bio: 'Powerlifting silver medallist SEA Games 2023. Programs natural lifters for competition.' },
    ],
    ecommerce: [
      { name: 'Rachel Chen', role: 'Founder & Buyer', bio: 'Curates each piece personally from Seoul, Tokyo and Milan factory partners.' },
      { name: 'Izzah Latiff', role: 'Head of Customer Experience', bio: 'Runs the WhatsApp concierge, 2-hour response guarantee 7 days a week.' },
      { name: 'Aaron Koh', role: 'Logistics Manager', bio: 'Pos Laju + DHL account manager, optimises 2-day Peninsular Malaysia delivery.' },
    ],
    events: [
      { name: 'Natasha Zulkifli', role: 'Creative Director', bio: 'Styled 200+ weddings and galas. Featured in MingleMingle and Her World Brides.' },
      { name: 'Kumar Raju', role: 'Production Manager', bio: 'AV + staging specialist for corporate events up to 2000 PAX. Handles KLCC, PWTC venues.' },
      { name: 'Elaine Fong', role: 'Client Relations', bio: 'Bilingual wedding planner fluent in Mandarin and English. 0% complaint rate in 4 years.' },
    ],
    travel: [
      { name: 'Hakim bin Rosli', role: 'Lead Tour Guide', bio: 'Licensed by Tourism Malaysia (PE2341). Expert on KL heritage and Melaka historical sites.' },
      { name: 'Wei Ling Chua', role: 'Trip Designer', bio: 'Plans custom itineraries across Peninsular and East Malaysia. 8 years in outbound travel.' },
      { name: 'Joseph Tan', role: 'Adventure Coordinator', bio: 'PADI dive master, certified jungle trek guide for Taman Negara and Mulu Caves.' },
    ],
    blog: [
      { name: 'Aaron Siah', role: 'Editor in Chief', bio: 'Former features writer at The Edge Malaysia. Covers startups, tech and Malaysian economy.' },
      { name: 'Lina Razak', role: 'Senior Writer', bio: 'Longform investigative journalist. Published in R.AGE and Malaysiakini.' },
      { name: 'Kevin Ng', role: 'Podcast Producer', bio: 'Produces weekly interview shows with founders. 50k+ monthly listeners.' },
    ],
  }

  const defaultTeam = [
    { name: 'Founder', role: 'CEO & Founder', bio: 'Passionate about building great products and serving Malaysian businesses.' },
    { name: 'Operations Lead', role: 'Head of Operations', bio: 'Ensuring smooth operations and excellent customer experience every day.' },
    { name: 'Marketing Lead', role: 'Head of Marketing', bio: 'Growing the brand through digital marketing and community building.' },
  ]

  const i18n = getBlockStrings(language)
  return {
    blockType: 'team',
    variant: 'grid',
    headline: i18n.team.headline,
    subheadline: i18n.team.subheadline,
    members: (teamMap[category] ?? defaultTeam).map((m) => ({
      name: m.name,
      role: m.role,
      bio: m.bio,
    })),
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

// GH-1024: menu-display hidden — use menu-food (schema: price: string, tag?: string, no dietaryTags).
function buildMenuFood(content: CategoryContent): Record<string, unknown> {
  const industryBlock = content.industryBlocks.find((b) => b.blockType === 'menu-food')
  return {
    blockType: 'menu-food',
    variant: 'classic',
    headline: (industryBlock?.title as string) ?? 'Our Menu',
    categories: [
      {
        name: 'Nasi & Rice',
        items: [
          { name: 'Nasi Lemak Special', description: 'Coconut rice with sambal, egg, and fried chicken', price: 'RM 12', tag: 'halal' },
          { name: 'Nasi Goreng Kampung', description: 'Village-style fried rice with anchovies', price: 'RM 10', tag: 'spicy' },
          { name: 'Chicken Rice', description: 'Hainanese-style steamed chicken with fragrant rice', price: 'RM 11', tag: 'halal' },
        ],
      },
      {
        name: 'Roti & Bread',
        items: [
          { name: 'Roti Canai', description: 'Crispy flatbread with dhal curry', price: 'RM 3', tag: 'vegetarian' },
          { name: 'Roti Telur', description: 'Flatbread stuffed with egg', price: 'RM 4', tag: 'halal' },
        ],
      },
      {
        name: 'Beverages',
        items: [
          { name: 'Teh Tarik', description: 'Pulled milk tea', price: 'RM 3.50', tag: 'vegetarian' },
          { name: 'Kopi O', description: 'Traditional black coffee', price: 'RM 3', tag: 'vegetarian' },
        ],
      },
    ],
  }
}

function buildBookingWidget(content: CategoryContent, category: string): Record<string, unknown> {
  const servicesMap: Record<string, { name: string; duration: number; price: number; description: string }[]> = {
    beauty: [
      { name: 'Hydrating Facial', duration: 60, price: 120, description: 'Deep hydration treatment with Korean products' },
      { name: 'Acne Treatment', duration: 45, price: 150, description: 'Targeted treatment for acne-prone skin' },
      { name: 'Mani-Pedi Combo', duration: 90, price: 75, description: 'Classic manicure and pedicure set' },
    ],
    health: [
      { name: 'General Consultation', duration: 30, price: 80, description: 'Consultation with our general practitioner' },
      { name: 'Health Screening', duration: 60, price: 250, description: 'Comprehensive health check-up' },
      { name: 'Dental Check-up', duration: 45, price: 150, description: 'Routine dental examination and cleaning' },
    ],
    fitness: [
      { name: 'Personal Training', duration: 60, price: 80, description: 'One-on-one training session with a certified trainer' },
      { name: 'Body Assessment', duration: 30, price: 50, description: 'Full body composition and fitness assessment' },
      { name: 'Yoga Class', duration: 60, price: 35, description: 'Group yoga class for all levels' },
    ],
    restaurant: [
      { name: 'Table for 2', duration: 90, price: 0, description: 'Intimate dining for two' },
      { name: 'Family Table (4-6)', duration: 120, price: 0, description: 'Perfect for family gatherings' },
      { name: 'Private Room (10+)', duration: 150, price: 200, description: 'Private dining room with deposit' },
    ],
  }
  return {
    blockType: 'booking-widget',
    variant: 'inline',
    headline: 'Book an Appointment',
    subheadline: 'Choose a service and pick your preferred time slot.',
    services: servicesMap[category] ?? servicesMap['health']!,
    availableDays: [1, 2, 3, 4, 5, 6],
    timeSlotInterval: 30,
    startTime: '09:00',
    endTime: '18:00',
    showPrice: true,
  }
}

function buildClassSchedule(): Record<string, unknown> {
  return {
    blockType: 'class-schedule',
    variant: 'grid',
    headline: 'Weekly Schedule',
    showCapacity: true,
    highlightToday: true,
    classes: [
      { name: 'HIIT Burn', instructor: 'Coach Amir', day: 1, startTime: '07:00', endTime: '08:00', capacity: 20, enrolled: 15, category: 'Cardio', level: 'Intermediate' },
      { name: 'Yoga Flow', instructor: 'Sarah', day: 1, startTime: '09:00', endTime: '10:00', capacity: 15, enrolled: 12, category: 'Yoga', level: 'All Levels' },
      { name: 'Spin Class', instructor: 'Coach Danny', day: 2, startTime: '07:00', endTime: '07:45', capacity: 25, enrolled: 20, category: 'Cardio', level: 'Advanced' },
      { name: 'Pilates', instructor: 'Sarah', day: 3, startTime: '10:00', endTime: '11:00', capacity: 12, enrolled: 8, category: 'Pilates', level: 'Beginner' },
      { name: 'Boxing Fit', instructor: 'Coach Amir', day: 4, startTime: '18:00', endTime: '19:00', capacity: 20, enrolled: 18, category: 'Combat', level: 'Intermediate' },
      { name: 'Stretch & Recover', instructor: 'Sarah', day: 5, startTime: '09:00', endTime: '10:00', capacity: 15, enrolled: 6, category: 'Recovery', level: 'All Levels' },
    ],
  }
}

function buildReviewCards(content: CategoryContent): Record<string, unknown> {
  return {
    blockType: 'review-cards',
    variant: 'grid',
    headline: 'Customer Reviews',
    subheadline: 'See what people are saying about us.',
    showAverage: true,
    totalReviewCount: 150,
    reviews: content.testimonials.slice(0, 4).map((t, i) => ({
      name: t.name,
      rating: t.rating,
      text: t.quote,
      date: `2026-0${i + 1}-15`,
      verified: true,
      source: 'Google',
    })),
  }
}

function buildVideoShowcase(): Record<string, unknown> {
  return {
    blockType: 'video-showcase',
    variant: 'grid',
    headline: 'Watch & Learn',
    subheadline: 'Explore our video content.',
    showCategories: true,
    autoplay: false,
    videos: [
      { title: 'Getting Started Guide', videoUrl: 'https://www.youtube.com/watch?v=k2maqlyUuVw', category: 'Tutorial', duration: '5:30', description: 'Learn the basics in just 5 minutes.' },
      { title: 'Customer Success Story', videoUrl: 'https://www.youtube.com/watch?v=k2maqlyUuVw', category: 'Testimonial', duration: '3:15', description: 'Hear how we helped transform a business.' },
      { title: 'Behind the Scenes', videoUrl: 'https://www.youtube.com/watch?v=k2maqlyUuVw', category: 'About Us', duration: '4:00', description: 'A peek into our daily operations.' },
    ],
  }
}

function buildDoctorProfile(content: CategoryContent): Record<string, unknown> {
  return {
    blockType: 'doctor-profile',
    variant: 'cards',
    headline: 'Our Medical Team',
    subheadline: 'Experienced healthcare professionals dedicated to your wellbeing.',
    doctors: [
      { name: 'Dr. Tan Wei Ming', specialisation: 'General Practice', qualifications: ['MBBS (UM)', 'MRCP (UK)'], availableDays: [1, 2, 3, 4, 5], languages: 'English, Malay, Mandarin', consultationFee: 'RM 80', bio: '15 years of experience in family medicine.' },
      { name: 'Dr. Aishah Ahmad', specialisation: 'Dental Surgery', qualifications: ['BDS (USM)', 'Fellowship in Cosmetic Dentistry'], availableDays: [1, 3, 5], languages: 'English, Malay', consultationFee: 'RM 150', bio: 'Specialising in cosmetic dentistry and orthodontics.' },
      { name: 'Dr. Rajesh Kumar', specialisation: 'Orthopaedics', qualifications: ['MS Ortho (UKM)', 'FRCS (Edinburgh)'], availableDays: [2, 4, 6], languages: 'English, Malay, Tamil', consultationFee: 'RM 200', bio: 'Expert in sports injuries and joint replacement.' },
    ],
  }
}

function buildPropertyCard(): Record<string, unknown> {
  return {
    blockType: 'property-card',
    variant: 'grid',
    headline: 'Featured Properties',
    subheadline: 'Discover your dream home in the Klang Valley.',
    showMap: false,
    currency: 'RM',
    properties: [
      { title: 'Luxury Condo in KLCC', price: 1200000, location: 'KLCC, Kuala Lumpur', bedrooms: 3, bathrooms: 2, area: 1200, type: 'sale' as const, description: 'Modern luxury condo with stunning twin tower views.' },
      { title: 'Semi-D in Shah Alam', price: 850000, location: 'Seksyen 7, Shah Alam', bedrooms: 4, bathrooms: 3, area: 2200, type: 'sale' as const, description: 'Spacious family home in quiet neighbourhood.' },
      { title: 'Studio in Mont Kiara', price: 2500, location: 'Mont Kiara, Kuala Lumpur', bedrooms: 1, bathrooms: 1, area: 550, type: 'rent' as const, description: 'Fully furnished studio, walking distance to MRT.' },
    ],
  }
}

// Canned product-quick-view items. Used as fallback + padded when user supplies
// fewer than 3 products (extracted so buildProductQuickView can reuse them).
const CANNED_QUICK_VIEW_PRODUCTS = [
  { name: 'Baju Kurung Moden', price: 89, originalPrice: 120, imageUrls: [PORTRAIT_FALLBACK_SVG], description: 'Elegant modern baju kurung in premium cotton.', variants: ['S', 'M', 'L', 'XL'], badge: 'Sale', ctaLabel: 'Add to Cart', ctaUrl: '#' },
  { name: 'Wireless Earbuds Pro', price: 199, imageUrls: [PORTRAIT_FALLBACK_SVG], description: 'Active noise cancellation with 30-hour battery life.', variants: ['Black', 'White'], badge: 'New', ctaLabel: 'Add to Cart', ctaUrl: '#' },
  { name: 'Organic Honey (500g)', price: 45, imageUrls: [PORTRAIT_FALLBACK_SVG], description: 'Pure Malaysian kelulut honey from Cameron Highlands.', ctaLabel: 'Add to Cart', ctaUrl: '#' },
  { name: 'Batik Silk Scarf', price: 65, originalPrice: 85, imageUrls: [PORTRAIT_FALLBACK_SVG], description: 'Handmade batik silk scarf in traditional Malaysian motifs.', badge: 'Sale', ctaLabel: 'Add to Cart', ctaUrl: '#' },
] as const

/**
 * Turn user-supplied products into product-quick-view items, padded with
 * canned items when fewer than 3 provided. Placeholder imageUrl is used —
 * the downstream Unsplash pipeline replaces these based on deriveKeywords.
 */
function quickViewItemsFromProducts(
  products: string[],
  category: string,
): Record<string, unknown>[] {
  const userItems: Record<string, unknown>[] = products.map((product) => ({
    name: capitalizeFirst(product),
    price: 0, // unknown — storefront can edit later
    imageUrls: [PORTRAIT_FALLBACK_SVG],
    description: (FEATURE_BODY_TEMPLATES[category] ?? FEATURE_BODY_TEMPLATES['business']!).replace('{product}', product),
    ctaLabel: 'Shop Now',
    ctaUrl: '#',
  }))
  // Pad to 3 minimum from canned so grid variants don't collapse.
  if (userItems.length >= 3) return userItems
  for (const canned of CANNED_QUICK_VIEW_PRODUCTS) {
    if (userItems.length >= 3) break
    userItems.push({ ...canned })
  }
  return userItems
}

function buildProductQuickView(biz: BusinessSample, category: string): Record<string, unknown> {
  const userProducts = biz.products ?? []
  const products =
    userProducts.length >= 1
      ? quickViewItemsFromProducts(userProducts, category)
      : (CANNED_QUICK_VIEW_PRODUCTS as readonly unknown[]).map((p) => ({ ...(p as object) }))
  return {
    blockType: 'product-quick-view',
    variant: 'grid',
    headline: userProducts.length > 0 ? `Shop ${biz.name}` : 'Best Sellers',
    subheadline: userProducts.length > 0 ? 'Our most loved picks.' : 'Shop our most popular items.',
    columns: 4 as const,
    showQuickView: true,
    currency: 'RM',
    products,
  }
}

function buildPortfolioGrid(): Record<string, unknown> {
  return {
    blockType: 'portfolio-grid',
    variant: 'masonry',
    headline: 'Our Work',
    subheadline: 'A selection of projects we are proud of.',
    projects: [
      { title: 'Brand Identity — Nasi Kandar Chain', description: 'Complete brand redesign for a national F&B chain.', imageUrl: NEUTRAL_FALLBACK_SVG, category: 'Branding' },
      { title: 'E-commerce Website', description: 'Full e-commerce platform for a fashion brand.', imageUrl: NEUTRAL_FALLBACK_SVG, category: 'Web Design' },
      { title: 'Product Packaging', description: 'Packaging design for artisan coffee brand.', imageUrl: NEUTRAL_FALLBACK_SVG, category: 'Packaging' },
      { title: 'Corporate Video', description: 'Brand story video for a tech startup.', imageUrl: NEUTRAL_FALLBACK_SVG, category: 'Video' },
      { title: 'Social Media Campaign', description: 'Instagram campaign that reached 500K impressions.', imageUrl: NEUTRAL_FALLBACK_SVG, category: 'Digital' },
      { title: 'Annual Report Design', description: 'Clean, modern annual report for a public company.', imageUrl: NEUTRAL_FALLBACK_SVG, category: 'Print' },
    ],
  }
}

export function buildServiceCards(biz: BusinessSample, category: string, language?: string): Record<string, unknown> {
  type SItem = { title: string; description: string; icon: string; price?: string; priceUnit?: string; title_ms?: string; description_ms?: string }
  const servicesMap: Record<string, SItem[]> = {
    business: [
      { title: 'Strategy Consulting', description: 'C-suite advisory and market strategy development.', icon: 'BarChart', price: 'RM 500', priceUnit: '/hour', title_ms: 'Perundingan Strategi', description_ms: 'Penasihat C-suite dan pembangunan strategi pasaran.' },
      { title: 'Market Entry', description: 'Comprehensive market research and entry planning for ASEAN.', icon: 'Globe', price: 'From RM 25,000', priceUnit: '/project', title_ms: 'Kemasukan Pasaran', description_ms: 'Penyelidikan pasaran menyeluruh dan perancangan kemasukan untuk ASEAN.' },
      { title: 'M&A Advisory', description: 'Due diligence and deal structuring for mergers and acquisitions.', icon: 'Handshake', price: 'From RM 50,000', priceUnit: '/project', title_ms: 'Penasihat M&A', description_ms: 'Due diligence dan penstrukturan perjanjian untuk penggabungan dan pemerolehan.' },
    ],
    beauty: [
      { title: 'Facial Treatment', description: 'Customised facials for every skin type and concern.', icon: 'Sparkles', price: 'From RM 120', priceUnit: '/session', title_ms: 'Rawatan Muka', description_ms: 'Rawatan muka yang disesuaikan untuk setiap jenis kulit dan kebimbangan.' },
      { title: 'Nail Art', description: 'Classic to creative nail designs using premium products.', icon: 'Palette', price: 'From RM 45', priceUnit: '/session', title_ms: 'Seni Kuku', description_ms: 'Reka bentuk kuku klasik hingga kreatif menggunakan produk premium.' },
      { title: 'Lash Extensions', description: 'Natural to dramatic lash looks that last 3-4 weeks.', icon: 'Eye', price: 'From RM 120', priceUnit: '/set', title_ms: 'Sambungan Bulu Mata', description_ms: 'Penampilan bulu mata semula jadi hingga dramatik yang tahan 3-4 minggu.' },
    ],
    health: [
      { title: 'General Consultation', description: 'Doctor consultation for acute and chronic conditions, all age groups.', icon: 'Stethoscope', price: 'From RM 80', priceUnit: '/visit', title_ms: 'Perundingan Umum', description_ms: 'Perundingan doktor untuk keadaan akut dan kronik, semua kumpulan umur.' },
      { title: 'Health Screening', description: 'Comprehensive blood panel, ECG and imaging with specialist review.', icon: 'Activity', price: 'From RM 550', priceUnit: '/package', title_ms: 'Saringan Kesihatan', description_ms: 'Panel darah menyeluruh, ECG dan pengimejan dengan ulasan pakar.' },
      { title: 'Minor Procedures', description: 'Wound dressing, vaccinations, IV drip and nebuliser therapy.', icon: 'Syringe', price: 'From RM 60', priceUnit: '/procedure', title_ms: 'Prosedur Kecil', description_ms: 'Pembalutan luka, vaksinasi, titisan IV dan terapi nebulizer.' },
    ],
    tech: [
      { title: 'Managed Hosting', description: '99.9% uptime SLA on AWS Singapore + KL redundancy.', icon: 'Server', price: 'From RM 299', priceUnit: '/month', title_ms: 'Pengehosan Terurus', description_ms: 'SLA masa aktif 99.9% pada AWS Singapura + redundansi KL.' },
      { title: 'DevOps Setup', description: 'CI/CD pipelines, observability stack and on-call runbook.', icon: 'GitBranch', price: 'From RM 8,000', priceUnit: '/project', title_ms: 'Persediaan DevOps', description_ms: 'Saluran CI/CD, tumpukan kebolehperhatian dan buku panduan on-call.' },
      { title: '24/7 Support', description: 'Dedicated account engineer with 15-minute response SLA.', icon: 'Headphones', price: 'From RM 2,500', priceUnit: '/month', title_ms: 'Sokongan 24/7', description_ms: 'Jurutera akaun khusus dengan SLA tindak balas 15 minit.' },
    ],
    education: [
      { title: 'Group Classes', description: 'Small-group SPM and UPSR tuition, max 8 students per class.', icon: 'Users', price: 'From RM 200', priceUnit: '/month', title_ms: 'Kelas Berkumpulan', description_ms: 'Tuisyen kumpulan kecil SPM dan UPSR, maksimum 8 pelajar setiap kelas.' },
      { title: '1-on-1 Tutoring', description: 'Personalised coaching with weekly progress reports to parents.', icon: 'User', price: 'From RM 120', priceUnit: '/hour', title_ms: 'Pengajaran 1-lawan-1', description_ms: 'Bimbingan peribadi dengan laporan kemajuan mingguan kepada ibu bapa.' },
      { title: 'Exam Bootcamp', description: 'Intensive revision programme in the month before major exams.', icon: 'GraduationCap', price: 'From RM 800', priceUnit: '/bootcamp', title_ms: 'Kem Latihan Peperiksaan', description_ms: 'Program ulang kaji intensif dalam sebulan sebelum peperiksaan utama.' },
    ],
    fitness: [
      { title: 'Personal Training', description: 'Customised 1-on-1 strength + cardio programming with nutrition plan.', icon: 'Dumbbell', price: 'From RM 150', priceUnit: '/session', title_ms: 'Latihan Peribadi', description_ms: 'Program kekuatan + kardio 1-lawan-1 yang disesuaikan dengan pelan pemakanan.' },
      { title: 'Group Classes', description: 'HIIT, yoga, pilates and spin classes every morning and evening.', icon: 'Users', price: 'From RM 250', priceUnit: '/month', title_ms: 'Kelas Berkumpulan', description_ms: 'Kelas HIIT, yoga, pilates dan spin setiap pagi dan petang.' },
      { title: 'Sports Rehab', description: 'Physiotherapy and injury recovery for weekend warriors and athletes.', icon: 'HeartPulse', price: 'From RM 180', priceUnit: '/session', title_ms: 'Pemulihan Sukan', description_ms: 'Fisioterapi dan pemulihan kecederaan untuk atlet dan pejuang hujung minggu.' },
    ],
    creative: [
      { title: 'Brand Identity', description: 'Logo, colour system, typography and full brand guidelines.', icon: 'Palette', price: 'From RM 3,500', priceUnit: '/project', title_ms: 'Identiti Jenama', description_ms: 'Logo, sistem warna, tipografi dan panduan jenama penuh.' },
      { title: 'Web Design', description: 'Conversion-focused website design with UX audit and wireframes.', icon: 'Monitor', price: 'From RM 5,500', priceUnit: '/project', title_ms: 'Reka Bentuk Web', description_ms: 'Reka bentuk laman web berfokus penukaran dengan audit UX dan rangka kawat.' },
      { title: 'Content Creation', description: 'Monthly social media content, photography and short-form video.', icon: 'Camera', price: 'From RM 2,800', priceUnit: '/month', title_ms: 'Penciptaan Kandungan', description_ms: 'Kandungan media sosial bulanan, fotografi dan video format pendek.' },
    ],
    restaurant: [
      { title: 'Dine-In Experience', description: 'Curated multi-course menu with seasonal specials and optional wine pairing.', icon: 'Utensils', price: 'From RM 88', priceUnit: '/pax', title_ms: 'Pengalaman Makan Di Tempat', description_ms: 'Menu berbilang hidangan yang dikurasi dengan keistimewaan bermusim dan padanan minuman pilihan.' },
      { title: 'Private Events', description: 'Restaurant buy-out for weddings, birthdays and corporate dinners.', icon: 'Calendar', price: 'From RM 2,500', priceUnit: '/event', title_ms: 'Acara Peribadi', description_ms: 'Pembelian restoran untuk perkahwinan, hari jadi dan makan malam korporat.' },
      { title: 'Catering Service', description: 'Full-service off-site catering for groups of 20-200.', icon: 'Truck', price: 'From RM 45', priceUnit: '/pax', title_ms: 'Perkhidmatan Katering', description_ms: 'Katering luar tapak perkhidmatan penuh untuk kumpulan 20-200 orang.' },
    ],
    fnb: [
      { title: 'Retail Store', description: 'Daily fresh bakes and heritage kuih available at all outlets.', icon: 'Store', price: 'From RM 5', priceUnit: '/item', title_ms: 'Kedai Runcit', description_ms: 'Barang bakar segar harian dan kuih warisan tersedia di semua cawangan.' },
      { title: 'Party Platters', description: 'Pre-order trays and boxes for birthdays, office meetings and family gatherings.', icon: 'Package', price: 'From RM 120', priceUnit: '/tray', title_ms: 'Dulang Parti', description_ms: 'Dulang dan kotak pre-tempahan untuk hari jadi, mesyuarat pejabat dan perhimpunan keluarga.' },
      { title: 'Corporate Catering', description: 'Buffet + plated meal service for offices in Klang Valley.', icon: 'Truck', price: 'From RM 18', priceUnit: '/pax', title_ms: 'Katering Korporat', description_ms: 'Perkhidmatan makan malam buffet dan plated untuk pejabat di Lembah Klang.' },
    ],
    ecommerce: [
      { title: 'Fast Delivery', description: 'Next-day shipping to Klang Valley and 2-day nationwide delivery.', icon: 'Truck', price: 'Free', priceUnit: 'over RM 150', title_ms: 'Penghantaran Pantas', description_ms: 'Penghantaran hari berikutnya ke Lembah Klang dan penghantaran 2 hari ke seluruh negara.' },
      { title: 'Easy Returns', description: 'Hassle-free 14-day return policy with free pickup service.', icon: 'RotateCcw', price: 'Free', priceUnit: 'returns', title_ms: 'Pemulangan Mudah', description_ms: 'Polisi pemulangan 14 hari tanpa kerumitan dengan perkhidmatan kutipan percuma.' },
      { title: 'WhatsApp Concierge', description: 'Personal shopping assistance and styling advice on demand.', icon: 'MessageCircle', price: 'Free', priceUnit: 'all customers', title_ms: 'Concierge WhatsApp', description_ms: 'Bantuan membeli-belah peribadi dan nasihat gaya atas permintaan.' },
    ],
    realestate: [
      { title: 'Property Viewing', description: 'Guided viewings with market briefing and neighbourhood tour.', icon: 'Home', price: 'Free', priceUnit: 'consultation', title_ms: 'Tontonan Hartanah', description_ms: 'Tontonan berpandu dengan taklimat pasaran dan lawatan kejiranan.' },
      { title: 'Sale & Purchase', description: 'End-to-end transaction handling: negotiation, SPA, loan and legal.', icon: 'FileText', price: '2%', priceUnit: 'of sale price', title_ms: 'Jual Beli', description_ms: 'Pengendalian transaksi dari awal hingga akhir: rundingan, SPA, pinjaman dan undang-undang.' },
      { title: 'Investment Advisory', description: 'ROI analysis, rental yield forecasting and portfolio structuring.', icon: 'TrendingUp', price: 'From RM 500', priceUnit: '/session', title_ms: 'Penasihat Pelaburan', description_ms: 'Analisis ROI, ramalan hasil sewa dan penstrukturan portfolio.' },
    ],
    events: [
      { title: 'Wedding Planning', description: 'Full-service wedding coordination from proposal to reception.', icon: 'Heart', price: 'From RM 8,000', priceUnit: '/wedding', title_ms: 'Perancangan Perkahwinan', description_ms: 'Penyelarasan perkahwinan perkhidmatan penuh dari lamaran hingga majlis.' },
      { title: 'Corporate Events', description: 'Product launches, galas and team-building for 50-1000 PAX.', icon: 'Briefcase', price: 'From RM 15,000', priceUnit: '/event', title_ms: 'Acara Korporat', description_ms: 'Pelancaran produk, gala dan pembinaan pasukan untuk 50-1000 pax.' },
      { title: 'Décor & Styling', description: 'Floral design, lighting and stage setup for any celebration.', icon: 'Sparkles', price: 'From RM 3,500', priceUnit: '/event', title_ms: 'Dekorasi & Penggayaan', description_ms: 'Reka bentuk bunga, pencahayaan dan persediaan pentas untuk sebarang perayaan.' },
    ],
    travel: [
      { title: 'Day Tours', description: 'Half-day and full-day curated experiences in KL, Penang and Melaka.', icon: 'Map', price: 'From RM 180', priceUnit: '/pax', title_ms: 'Lawatan Sehari', description_ms: 'Pengalaman dikurasi separuh hari dan sehari penuh di KL, Pulau Pinang dan Melaka.' },
      { title: 'Multi-Day Packages', description: 'Peninsular and East Malaysia itineraries with hotels and transport.', icon: 'Backpack', price: 'From RM 680', priceUnit: '/pax', title_ms: 'Pakej Berbilang Hari', description_ms: 'Itinerari Semenanjung dan Malaysia Timur dengan hotel dan pengangkutan.' },
      { title: 'Custom Itineraries', description: 'Tailor-made trips designed around your schedule and interests.', icon: 'Compass', price: 'From RM 1,500', priceUnit: '/pax', title_ms: 'Itinerari Tersuai', description_ms: 'Perjalanan yang dibuat khas mengikut jadual dan minat anda.' },
    ],
    blog: [
      { title: 'Sponsored Articles', description: 'Long-form branded features published on our main blog.', icon: 'FileText', price: 'From RM 2,500', priceUnit: '/article', title_ms: 'Artikel Tajaan', description_ms: 'Ciri jenama bentuk panjang yang diterbitkan di blog utama kami.' },
      { title: 'Newsletter Placements', description: 'Featured slot in our weekly newsletter reaching 20k+ readers.', icon: 'Mail', price: 'From RM 800', priceUnit: '/placement', title_ms: 'Penempatan Surat Berita', description_ms: 'Slot utama dalam surat berita mingguan kami yang mencapai 20k+ pembaca.' },
      { title: 'Podcast Interviews', description: 'Guest spot on our flagship podcast with cross-promotion.', icon: 'Mic', price: 'From RM 1,500', priceUnit: '/episode', title_ms: 'Temu Bual Podcast', description_ms: 'Slot tetamu dalam podcast unggulan kami dengan promosi silang.' },
    ],
  }

  const localizeService = (s: SItem) => ({
    ...s,
    title: (language === 'ms' && s.title_ms) ? s.title_ms : s.title,
    description: (language === 'ms' && s.description_ms) ? s.description_ms : s.description,
  })

  const i18n = getBlockStrings(language)
  const canned = servicesMap[category] ?? servicesMap['business']!

  // Plan 260414-2249 phase-01: when user supplies ≥2 products, emit them as
  // service cards (title = product, description = category template, icon =
  // rotated from PRODUCT_FEATURE_ICONS). Leaves price empty — storefront can
  // add pricing later via the editor.
  const userProducts = biz.products ?? []
  const services =
    userProducts.length >= 2
      ? featuresFromProducts(userProducts, category, canned.length).map((card) => ({
          title: card.title,
          description: card.description,
          icon: card.icon,
          cta: { label: i18n.serviceCards.ctaLabel, url: '/contact' },
        }))
      : canned.map(localizeService).map((s) => ({
          ...s,
          cta: { label: i18n.serviceCards.ctaLabel, url: '/contact' },
        }))

  return {
    blockType: 'service-cards',
    variant: 'grid',
    headline: i18n.serviceCards.headline,
    subheadline: i18n.serviceCards.subheadline(biz.name),
    services,
  }
}

function buildClientLogos(category?: string, seed = 0): Record<string, unknown> {
  // Plan 260417-0837 item 1.4 — real MY brand names instead of Client A..E stubs.
  // URL omitted until logo asset pipeline ships; renderers fall back to name-only
  // badge when url missing (safer than broken <img>).
  const picks = pickLogosByCategory(category, 6, seed)
  return {
    blockType: 'client-logos',
    variant: 'scroll',
    headline: 'Trusted By',
    logos: picks.map((l) => ({
      name: l.name,
      alt: l.name,
      ...(l.url ? { url: l.url } : {}),
    })),
  }
}

function buildFeatureComparison(): Record<string, unknown> {
  return {
    blockType: 'feature-comparison',
    variant: 'table',
    headline: 'Compare Plans',
    products: [
      { name: 'Starter', highlighted: false },
      { name: 'Professional', highlighted: true },
      { name: 'Enterprise', highlighted: false },
    ],
    features: [
      { name: 'Hosting', values: [true, true, true] },
      { name: 'SSL Certificate', values: [true, true, true] },
      { name: 'Load Balancing', values: [false, true, true] },
      { name: 'Dedicated Infra', values: [false, false, true] },
      { name: '24/7 Support', values: [false, true, true] },
      { name: 'SLA Guarantee', values: [false, false, true] },
    ],
  }
}

function buildPricingTable(): Record<string, unknown> {
  return {
    blockType: 'pricing-table',
    variant: 'columns',
    headline: 'Detailed Pricing',
    subheadline: 'Everything you need to know about our plans.',
    billingToggle: 'monthly',
    plans: [
      { name: 'Starter', price: 'RM 99', currency: 'RM', description: 'Perfect for getting started', features: ['1 User', '5 GB Storage', '1,000 API Calls', 'Email Support'], cta: { label: 'Get Started', url: '/contact' }, popular: false },
      { name: 'Professional', price: 'RM 299', currency: 'RM', description: 'For growing businesses', features: ['10 Users', '50 GB Storage', '50,000 API Calls', 'Chat + Email Support'], cta: { label: 'Get Started', url: '/contact' }, popular: true },
      { name: 'Enterprise', price: 'RM 499', currency: 'RM', description: 'For large organisations', features: ['Unlimited Users', '500 GB Storage', 'Unlimited API Calls', 'Dedicated Support'], cta: { label: 'Contact Sales', url: '/contact' }, popular: false },
    ],
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
      return buildMenuFood(content)
    case 'booking-widget':
      return buildBookingWidget(content, category)
    case 'class-schedule':
      return buildClassSchedule()
    case 'review-cards':
      return buildReviewCards(content)
    // case 'video-showcase': // temporarily hidden (aiVisible: false, archived)
    //   return buildVideoShowcase()
    case 'doctor-profile': {
      const items = Array.from({ length: 4 }, (_, i) => ({
        name: `Dr. ${['Aisha', 'Rahman', 'Mei Ling', 'Kumar', 'Siti', 'Jonathan'][i % 6]} ${['Tan', 'Lee', 'Wong', 'Patel', 'Ismail', 'Lim'][i % 6]}`,
        title: ['Consultant Physician', 'Senior Specialist', 'Chief Medical Officer', 'Head of Department'][i % 4],
        specialty: ['Cardiology', 'Pediatrics', 'General Practice', 'Dermatology'][i % 4],
        image: AVATAR_FALLBACK_SVG,
        bio: `Experienced medical professional at ${biz.name}.`,
        experience: `${10 + i} years`,
      }))
      return {
        blockType: 'doctor-profile',
        variant: 'cards',
        headline: 'Meet Our Specialists',
        subheadline: `Expert care at ${biz.name}`,
        items,
      }
    }
    case 'property-card':
      return buildPropertyCard()
    case 'product-quick-view':
      return buildProductQuickView(biz, category)
    case 'portfolio-grid': {
      const items = Array.from({ length: 6 }, (_, i) => ({
        title: `${biz.name} Project ${i + 1}`,
        category: ['Branding', 'Web Design', 'Photography', 'Illustration'][i % 4],
        image: NEUTRAL_FALLBACK_SVG,
        description: `Creative project showcasing ${biz.tagline ?? 'our craft'}.`,
      }))
      return {
        blockType: 'portfolio-grid',
        variant: 'masonry',
        headline: 'Our Work',
        subheadline: biz.tagline ?? 'Selected projects',
        items,
      }
    }
    case 'service-cards':
      return buildServiceCards(biz, category)
    case 'client-logos':
      return buildClientLogos(category)
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
    middleBlocks.push({ ...buildStats(category), variant: getVariant('stats', 'row') })
    middleBlocks.push({ ...buildGallery(biz), variant: getVariant('gallery', 'grid') })
  }

  if (variant === 'professional' || variant === 'premium') {
    middleBlocks.push({ ...buildStats(category), variant: getVariant('stats', 'row') })
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
  const finalTestimonialsVariant = enforceMinContent('testimonials', testimonialsVariant, content.testimonials.length)
  middleBlocks.push({ ...buildTestimonials(content, biz.name), variant: finalTestimonialsVariant })

  if (variant === 'professional' || variant === 'premium') {
    middleBlocks.push({ ...buildFAQ(content, biz.name), variant: getVariant('faq', 'accordion') })
    middleBlocks.push({ ...buildCTA(biz), variant: getVariant('cta', 'banner') })
  }

  if (variant === 'premium') {
    middleBlocks.push({ ...buildPricing(category), variant: getVariant('pricing', 'cards') })
    middleBlocks.push({ ...buildTeam(category), variant: getVariant('team', 'grid') })
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
      buildStats(category),
      buildTeam(category),
      buildTestimonials(content, biz.name),
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

  blocks.push(buildPricing(category))
  blocks.push(buildFAQ(content, biz.name))
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

import type { TemplatePreset, BlockSpec } from './template-definitions'
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
          const contentFields = ['features', 'testimonials', 'items', 'plans', 'members', 'images', 'stats', 'logos']
          let count = 0
          for (const field of contentFields) {
            const v = block[field]
            if (Array.isArray(v) && v.length > count) count = v.length
          }
          block.variant = count > 0 ? enforceMinContent(blockType, picked, count) : picked
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
): Record<string, unknown> {
  // Auto-select variant if not specified in blueprint and seed is available
  const resolvedVariant = spec.variant ?? (compositionSeed != null ? selectVariant(spec.blockType, compositionSeed, category, disabledSet) : undefined)
  switch (spec.blockType) {
    case 'navigation':
      return { ...buildNavigation(biz, pageNames, category, mood), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'hero':
      return {
        ...buildHero(biz, category, 0, mood),
        ...(resolvedVariant ? { variant: resolvedVariant } : {}),
        ...(spec.overrides ?? {}),
      }
    case 'features': {
      const fb = buildFeatures(biz, category) as Record<string, unknown>
      const fbCount = Array.isArray(fb.features) ? (fb.features as unknown[]).length : 0
      const finalVariant = resolvedVariant ? enforceMinContent('features', resolvedVariant, fbCount) : undefined
      return { ...fb, ...(finalVariant ? { variant: finalVariant } : {}) }
    }
    case 'testimonials':
      return { ...buildTestimonials(content, biz.name), ...(resolvedVariant ? { variant: resolvedVariant } : {}), ...(spec.count ? { items: content.testimonials.slice(0, spec.count) } : {}) }
    case 'contact':
      return { ...buildContact(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'footer':
      return { ...buildFooter(biz, pageNames), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'stats':
      return { ...buildStats(category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'gallery':
      return { ...buildGallery(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'faq':
      return { ...buildFAQ(content, biz.name), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'cta':
      return { ...buildCTA(biz, category, mood), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'about':
      return { ...buildAbout(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'pricing':
      return { ...buildPricing(category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'team':
      return { ...buildTeam(category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'newsletter':
      return { ...buildNewsletter(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'logo-cloud':
    case 'client-logos':
      return { ...buildClientLogos(category, compositionSeed ?? 0), blockType: spec.blockType, ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    // Industry-specific blocks
    case 'menu-food':
      return buildMenuFood(content)
    case 'booking-widget':
      return buildBookingWidget(content, category)
    case 'class-schedule':
      return buildClassSchedule()
    case 'review-cards':
      return buildReviewCards(content)
    // case 'video-showcase': // temporarily hidden (aiVisible: false, archived)
    //   return buildVideoShowcase()
    // doctor-profile handled below (line ~1188) with items
    case 'property-card':
      return buildPropertyCard()
    case 'product-quick-view':
      return buildProductQuickView(biz, category)
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
      return buildServiceCards(biz, category)
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
        reviews: content.testimonials.slice(0, 3).map((t) => ({
          author: t.name,
          content: t.quote ?? '',
          rating: t.rating ?? 5,
        })),
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
    if (!hasFaq) {
      const insertIdx = contactPage.layout.findIndex(
        (b) => (b as Record<string, unknown>).blockType === 'footer',
      )
      const beforeFooter = insertIdx >= 0 ? insertIdx : contactPage.layout.length
      contactPage.layout.splice(beforeFooter, 0, {
        blockType: 'faq',
        variant: 'accordion',
        headline: 'Visit Us',
        items: [
          { question: 'What are your opening hours?', answer: 'We are open 9:00 AM to 9:00 PM daily. See our Google Maps listing for real-time updates.' },
          { question: 'Do you offer walk-ins or is booking required?', answer: 'Walk-ins welcome for most services. For peak hours and specific requests, booking is recommended.' },
          { question: 'Is parking available?', answer: 'Yes — street parking and nearby covered parking are both within a 2-minute walk.' },
        ],
      } as unknown as Record<string, unknown>)
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

  const biz: BusinessSample = bizOverride
    ? { ...structuredClone(baseBiz), ...bizOverride }
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

  // Template path content language — defaults to 'en' since template content
  // in src/lib/ai/content/*.ts is pre-curated. Phase 04 wires the SAME
  // content-rules validator used by the AI path, so any blocked CTA in the
  // hand-authored template content is caught + fixed uniformly.
  const templateLang: ContentLang = 'en'

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
        // Filter out unsupported block types before building
        .filter((spec) => !isUnsupportedBlock(spec.blockType))
        .map((spec) => {
          const block = buildBlockFromSpec(spec, content, biz, preset.category, pageNames, seed, mood, disabledSet)
          return applyContentValidation(block, templateLang)
        }),
    }
  })

  // Plan 260414-2249 phase-05: enrich sub-pages to 5-page completeness standard.
  // - Ensure Blog page exists with seeded posts from content/blog-seeds.ts
  // - Ensure About page hero subheadline weaves user biz.description when present
  // - Ensure Contact page has google-maps + opening-hours FAQ when user provides address
  // Mutates `pages` in place via helper — adds missing pages, updates existing.
  enrichSubPages(pages, biz, preset.category, seed)

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

