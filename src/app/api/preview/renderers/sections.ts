/**
 * Section renderers — industry-aware content blocks with REAL images.
 * Each block type has a distinct visual treatment with premium quality.
 */
import { TemplateTheme } from './styles'
import { getGalleryImages, getAboutImage, getTeamAvatar } from './images'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'
import { mergeContactInfoWithSite, mergeFooterSocialsWithSite, mergeSocialWidgetLinksWithSite } from '@/lib/site-settings'

// Category for image selection
let _category = 'business'
export function setSectionCategory(cat: string) { _category = cat }

// ── Variant alias mapping ──────────────────────────────────────────────────
// Blueprint presets use various variant names — normalize to renderer-supported ones
const VARIANT_ALIASES: Record<string, string> = {
  // Features
  'icon-grid': 'icon-left',
  'icon-top': 'icon-left',
  'alternating': 'zigzag',
  'two-column': 'zigzag',
  'card-grid': 'icon-left',
  // Testimonials
  'slider': 'carousel',
  'single': 'carousel',
  'featured': 'spotlight',
  'quote': 'spotlight',
  // Gallery
  'fullscreen-image': 'masonry',
  '2-col': 'two-col',
  'grid-2': 'two-col',
  // Pricing
  'three-tier': 'table',
  'tiers': 'table',
  'comparison': 'table',
  'detailed': 'horizontal',
  // FAQ
  'two-column-faq': 'grid',
  'cards-faq': 'grid',
  // CTA
  'split-image': 'banner',
  'overlay': 'banner',
  'fullscreen': 'banner',
  // Team
  'detailed-cards': 'cards',
  'list-team': 'cards',
  // General
  'compact': 'list',
  'counters': 'grid',
  'counter': 'grid',
  'minimal': 'list',
}
function resolveVariant(v: string | undefined): string {
  const raw = v || 'default'
  return VARIANT_ALIASES[raw] || raw
}

export type SocialLink = { platform: string; url: string; enabled?: boolean; [key: string]: unknown }
export type RenderSocialWidgetBlock = Record<string, unknown> & { links?: SocialLink[]; variant?: string; headline?: string }

export type SiteSocialLinks = {
    contactInfo?: { email?: string; phone?: string; address?: string }
    socials?: { platform: string; url: string; enabled?: boolean }[]
    socialLinks?: Record<string, unknown> // Still some internal opaque types but I specified fields above
    logoText?: string
    name?: string
    branding?: { logo?: string }
    [key: string]: unknown
}

export type FeatureItem = { title: string; description?: string; icon?: string }
export type TestimonialItem = { name: string; quote: string; rating?: number; title?: string; avatar?: string }
export type StatItem = { label: string; value: string }
export type PricingPlan = { name: string; price: string; description?: string; features?: (string | { text: string })[]; isPopular?: boolean; ctaUrl?: string; ctaLabel?: string }
export type FaqItem = { question: string; answer: string }
export type MemberItem = { name: string; role?: string; image?: string }
export type FormField = { label: string; fieldType?: string; placeholder?: string }
export type FooterLink = { label: string; url: string }
export type FooterColumn = { title: string; links?: FooterLink[] }

export type RenderBlock = {
    blockType?: string
    features?: FeatureItem[]
    testimonials?: TestimonialItem[]
    stats?: StatItem[]
    plans?: PricingPlan[]
    faqs?: FaqItem[]
    members?: MemberItem[]
    variant?: string
    label?: string
    showLabel?: boolean
    headline?: string
    subtext?: string
    email?: string
    phone?: string
    address?: string
    formFields?: FormField[]
    columns?: FooterColumn[]
    tagline?: string
    copyrightText?: string
    socials?: SocialLink[]
    [key: string]: unknown
}


export function renderSections(block: RenderBlock, t: TemplateTheme, category?: string, site?: SiteSocialLinks): string {
  if (category) _category = category
  switch (block.blockType) {
    case 'features': return renderFeatures(block, t)
    case 'about': return renderAbout(block, t)
    case 'testimonials': return renderTestimonials(block, t)
    case 'contact': return renderContact(block, t, site)
    case 'footer': return renderFooter(block, t, site)
    case 'stats': return renderStats(block, t)
    case 'pricing': return renderPricing(block, t)
    case 'faq': return renderFaq(block, t)
    case 'gallery': return renderGallery(block, t)
    case 'team': return renderTeam(block, t)
    case 'cta': return renderCta(block, t)
    case 'socialWidget': return renderSocialWidget(block, t, site)
    case 'cartWidget': return renderCartWidget(block, t)
    default: return renderGenericBlock(block, t)
  }
}

/** Generic renderer for new block types — shows basic content from block data */
function renderGenericBlock(block: RenderBlock, t: TemplateTheme): string {
  const headline = (block.headline as string) || ''
  const subheadline = (block.subheadline as string) || (block.description as string) || ''
  const rawItems = (block.items as Array<Record<string, unknown>>) || (block.steps as Array<Record<string, unknown>>) || (block.services as Array<Record<string, unknown>>) || (block.reviews as Array<Record<string, unknown>>) || (block.projects as Array<Record<string, unknown>>) || (block.plans as Array<Record<string, unknown>>) || (block.categories as Array<Record<string, unknown>>) || (block.logos as Array<Record<string, unknown>>) || (block.images as Array<Record<string, unknown>>) || []
  const bt = block.blockType || 'section'
  const variant = (block.variant as string) || ''

  // Special renderers for specific new block types
  if (bt === 'google-maps') {
    const embedUrl = (block.embedUrl as string) || ''
    const address = (block.address as string) || ''
    const h = (block.height as number) || 400
    const headPart = headline ? '<h2 style="font-family:\'' + t.fontHeading + '\',sans-serif;font-size:32px;font-weight:700;margin-bottom:24px;color:' + t.text + '">' + headline + '</h2>' : ''
    const mapPart = embedUrl
      ? '<div style="border-radius:16px;overflow:hidden;border:1px solid ' + t.text + '10"><iframe src="' + embedUrl + '" width="100%" height="' + h + '" style="border:0" loading="lazy"></iframe></div>'
      : '<div style="background:#f0f0f0;border-radius:16px;height:300px;display:flex;align-items:center;justify-content:center;color:#999">Add a Google Maps embed URL in settings</div>'
    const addrPart = address ? '<p style="margin-top:12px;color:' + t.muted + ';font-size:14px">' + address + '</p>' : ''
    return '<section style="padding:60px 0"><div class="container">' + headPart + mapPart + addrPart + '</div></section>'
  }

  if (bt === 'divider') {
    const h = (block.height as number) || 40
    if (variant === 'spacer') return '<div style="height:' + h + 'px"></div>'
    if (variant === 'dots') return '<div style="text-align:center;padding:20px 0;color:' + t.muted + ';letter-spacing:12px;font-size:20px">...</div>'
    return '<div style="margin:0 auto;max-width:120px;height:1px;background:' + t.primary + '40"></div>'
  }

  if (bt === 'announcement-bar') {
    // Use ?? 'gradient' (not ||) so null from Payload DB defaults correctly, matching index.tsx behaviour
    const annVariant = ((block.variant as string | null | undefined) ?? 'gradient')
    const message = escapeHtml((block.message as string) || '')
    const linkText = escapeHtml(((block.linkText as string) || '').trim())
    const rawUrl = (block.linkUrl as string) || ''
    // Reject protocol-relative URLs (//host) — route through sanitizeUrl not escapeAttr
    const linkUrl = (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) ? escapeAttr(rawUrl) : sanitizeUrl(rawUrl)
    const bg1 = escapeAttr((block.backgroundColor as string) || t.primary)
    const bg2 = escapeAttr((block.backgroundColor2 as string) || t.secondary)
    const paddingY = (block.paddingY as number) || 12
    const customTextColor = escapeAttr((block.textColor as string) || '')

    let bgStyle: string
    let color = customTextColor || '#fff'
    if (annVariant === 'gradient') {
      bgStyle = 'background:linear-gradient(135deg,' + bg1 + ',' + bg2 + ')'
    } else if (annVariant === 'minimal') {
      bgStyle = 'background:transparent;border-bottom:1px solid ' + escapeAttr(t.primary) + '20'
      color = customTextColor || escapeAttr(t.text)
    } else {
      bgStyle = 'background:' + bg1
    }

    const showLink = (block.showLink as boolean | undefined) !== false
    const linkPart = showLink && linkText && rawUrl
      ? ' <a href="' + linkUrl + '" style="color:inherit;text-decoration:underline;font-weight:600">' + linkText + ' &rarr;</a>'
      : ''

    return '<div style="' + bgStyle + ';color:' + color + ';text-align:center;padding:' + paddingY + 'px 20px;font-size:13px;font-weight:600">' + message + linkPart + '</div>'
  }

  if (bt === 'whatsapp-button') {
    const phone = (block.phoneNumber as string) || ''
    const countryCode = (block.countryCode as string) || '+60'
    const msg = (block.message as string) || ''
    const phoneDigits = phone.replace(/[^0-9]/g, '')
    const dialDigits = countryCode.replace(/[^0-9]/g, '')
    const fullPhone = phoneDigits.startsWith(dialDigits) ? phoneDigits : dialDigits + phoneDigits
    const waUrl = 'https://wa.me/' + fullPhone + (msg ? '?text=' + encodeURIComponent(msg) : '')
    const label = (block.label as string) || 'Chat on WhatsApp'
    if (variant === 'inline') {
      return '<section style="padding:40px 0;text-align:center"><div class="container"><a href="' + waUrl + '" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:#25D366;color:#fff;border-radius:12px;font-weight:600;font-size:16px;text-decoration:none">' + label + '</a></div></section>'
    }
    return '<a href="' + waUrl + '" target="_blank" style="position:fixed;bottom:24px;right:24px;z-index:1000;width:56px;height:56px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;box-shadow:0 4px 12px rgba(0,0,0,.15);text-decoration:none" title="Chat on WhatsApp">💬</a>'
  }

  // Generic fallback — renders headline + items grid
  let html = '<section style="padding:80px 0"><div class="container">'

  if (headline) {
    html += '<div style="text-align:center;margin-bottom:48px">'
    html += '<h2 style="font-family:\'' + t.fontHeading + '\',sans-serif;font-size:36px;font-weight:700;color:' + t.text + ';margin-bottom:12px">' + headline + '</h2>'
    if (subheadline) html += '<p style="font-size:16px;color:' + t.muted + ';max-width:600px;margin:0 auto">' + subheadline + '</p>'
    html += '</div>'
  }

  if (rawItems.length > 0) {
    const cols = rawItems.length <= 2 ? 2 : rawItems.length <= 4 ? rawItems.length : 3
    html += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:24px">'
    for (const item of rawItems) {
      const title = (item.title as string) || (item.name as string) || (item.label as string) || ''
      const desc = (item.description as string) || (item.content as string) || (item.answer as string) || ''
      const icon = (item.icon as string) || ''
      const imgUrl = (item.imageUrl as string) || ''
      html += '<div style="padding:24px;border-radius:12px;border:1px solid ' + t.text + '10;background:' + t.bg + '">'
      if (imgUrl) html += '<img src="' + imgUrl + '" alt="' + title + '" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:16px">'
      if (icon) html += '<div style="font-size:28px;margin-bottom:12px">' + icon + '</div>'
      if (title) html += '<h3 style="font-weight:600;font-size:16px;margin-bottom:8px;color:' + t.text + '">' + title + '</h3>'
      if (desc) html += '<p style="font-size:14px;color:' + t.muted + ';line-height:1.6">' + desc + '</p>'
      html += '</div>'
    }
    html += '</div>'
  } else if (!headline) {
    const blockLabel = bt.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    html += '<div style="text-align:center;padding:40px;border:2px dashed ' + t.text + '20;border-radius:16px;color:' + t.muted + '">'
    html += '<div style="font-size:32px;margin-bottom:8px">🧩</div>'
    html += '<p style="font-size:14px">' + blockLabel + ' block</p>'
    html += '<p style="font-size:12px;opacity:.6">Click to select, then edit in settings panel</p>'
    html += '</div>'
  }

  html += '</div></section>'
  return html
}

function escapeAttr(str: string) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escape for HTML text content (between tags) — avoids over-encoding quotes */
function escapeHtml(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sanitizeUrl(raw: string): string {
    let val = String(raw || '').trim()
    if (!val || val === '#' || val === 'https:///' || val === 'http:///') return '#'
    if (!/^https?:\/\//i.test(val)) val = `https://${val}`
    // Reject URLs with empty hostname (e.g., "https:///")
    if (/^https?:\/\/\//.test(val)) return '#'
    try {
        const parsed = new URL(val)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#'
        if (!parsed.hostname || parsed.hostname.length < 2) return '#'
        return escapeAttr(parsed.href)
    } catch {
        return '#'
    }
}

// Shared utility types are now at the top

function renderSocialWidget(b: RenderSocialWidgetBlock, t: TemplateTheme, site?: SiteSocialLinks) {
  const normalizedBlock = normalizeSocialWidgetConfig(mergeSocialWidgetLinksWithSite(b as Record<string, unknown>, site?.socialLinks as Record<string, unknown>))
  const links = normalizedBlock.links.filter((item: SocialLink) => item?.enabled !== false)
  const isFloating = (normalizedBlock.variant || 'floating') !== 'inline'

  if (links.length === 0) return ''

  const platformMeta: Record<string, { label: string; mark: string; accent: string }> = {
    facebook: { label: 'Facebook', mark: 'f', accent: '#2563eb' },
    whatsapp: { label: 'WhatsApp', mark: 'wa', accent: '#16a34a' },
    instagram: { label: 'Instagram', mark: 'ig', accent: '#db2777' },
    linkedin: { label: 'LinkedIn', mark: 'in', accent: '#0284c7' },
    youtube: { label: 'YouTube', mark: '▶', accent: '#dc2626' },
  }

  const normalizeUrl = (platform: string, value: string) => {
    let raw = String(value || '').trim()
    if (!raw) return '#'
    if (!/^https?:\/\//i.test(raw) && platform !== 'whatsapp') {
      raw = `https://${raw}`
    }
    if (platform === 'whatsapp') {
      const digits = raw.replace(/[^\d]/g, '')
      raw = digits ? `https://wa.me/${digits}` : '#'
    }

    try {
      const parsedUrl = new URL(raw)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return '#'
      }
      return escapeAttr(parsedUrl.href)
    } catch (error: unknown) {
      console.error('URL parse error:', error)
      return '#'
    }
  }

  return `<section style="${isFloating ? 'position:fixed;right:24px;bottom:24px;z-index:50;' : 'padding:40px 0;'}">
    <div class="${isFloating ? '' : 'container'}" style="${isFloating ? 'display:flex;flex-direction:column;align-items:flex-end;gap:12px;' : ''}">
      ${normalizedBlock.headline ? `<p style="font-size:14px;color:${t.muted};font-weight:600;">${normalizedBlock.headline}</p>` : ''}
      <div style="display:flex;${isFloating ? 'flex-direction:column;' : 'flex-wrap:wrap;'}gap:12px;">
        ${links.map((item: SocialLink) => {
          const platform = item.platform || 'social'
          const url = item.url || '#'
          const meta = platformMeta[platform] || { label: platform, mark: '•', accent: t.primary }
          return `<a href="${normalizeUrl(platform, url)}" target="_blank" rel="noreferrer" aria-label="${meta.label}"
            style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;border:1px solid ${meta.accent}33;background:linear-gradient(135deg, ${meta.accent}22, ${t.primary}15);box-shadow:0 14px 32px rgba(15,23,42,0.16);">
            <span style="display:inline-flex;width:36px;height:36px;border-radius:999px;align-items:center;justify-content:center;background:rgba(255,255,255,.92);color:${meta.accent};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;border:1px solid ${meta.accent}22;">${meta.mark}</span>
            ${isFloating ? '' : `<span style="font-size:14px;font-weight:600;color:${t.text};">${meta.label}</span>`}
          </a>`
        }).join('')}
      </div>
    </div>
  </section>`
}

function renderCartWidget(b: RenderBlock, t: TemplateTheme) {
  const isFloating = (b.variant || 'floating') !== 'inline'
  const label = b.label || 'Cart'
  const showLabel = Boolean(b.showLabel)

  return `<section style="${isFloating ? 'position:fixed;left:24px;bottom:24px;z-index:50;' : 'padding:40px 0;'}">
    <div class="${isFloating ? '' : 'container'}">
      <button type="button"
        style="position:relative;display:inline-flex;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:1px solid ${t.primary}55;background:linear-gradient(135deg, ${t.primary}, ${t.secondary});color:#fff;font-weight:600;box-shadow:0 16px 32px rgba(2,6,23,0.22);">
        <span style="font-size:18px;">🛒</span>
        ${showLabel ? `<span>${label}</span>` : ''}
        <span style="position:absolute;right:-8px;top:-8px;display:inline-flex;min-width:24px;min-height:24px;padding:0 6px;align-items:center;justify-content:center;border-radius:999px;background:#fff;color:#0f172a;font-size:12px;font-weight:800;">0</span>
      </button>
    </div>
  </section>`
}

function renderFeatures(b: RenderBlock, t: TemplateTheme) {
  const items = b.features || []
  const variant = resolveVariant(b.variant as string)
  const cardBg = `${t.text}05`
  const cardBorder = `${t.text}08`

  const header = `<div style="text-align:center;margin-bottom:60px;">
    ${b.sectionLabel ? `<div class="section-label fade-up">${b.sectionLabel}</div>` : ''}
    <h2 class="section-title fade-up fade-up-d1">${b.headline || ''}</h2>
    <p class="section-subtitle fade-up fade-up-d2" style="margin:0 auto;">${b.subheadline || ''}</p>
  </div>`

  switch (variant) {
    case 'icon-left':
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:flex;flex-direction:column;gap:20px;max-width:700px;margin:0 auto;">
            ${items.map((f: FeatureItem, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)} card-hover" style="display:flex;gap:20px;align-items:flex-start;padding:24px;background:${cardBg};border:1px solid ${cardBorder};border-radius:14px;">
                <div style="flex-shrink:0;width:52px;height:52px;border-radius:14px;background:${t.primary}15;display:flex;align-items:center;justify-content:center;font-size:24px;">${f.icon || '✦'}</div>
                <div>
                  <h3 style="font-size:17px;font-weight:700;margin-bottom:6px;">${f.title}</h3>
                  <p style="font-size:14px;color:${t.muted};line-height:1.7;">${f.description || ''}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`

    case 'zigzag':
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:flex;flex-direction:column;gap:48px;">
            ${items.map((f: FeatureItem, i: number) => {
              const imgSrc = getAboutImage(_category)
              const isEven = i % 2 === 0
              return `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;">
                <div style="order:${isEven ? 1 : 2};">
                  <div style="width:44px;height:44px;border-radius:12px;background:${t.primary}15;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;">${f.icon || '✦'}</div>
                  <h3 style="font-size:22px;font-weight:700;margin-bottom:10px;">${f.title}</h3>
                  <p style="font-size:15px;color:${t.muted};line-height:1.8;">${f.description || ''}</p>
                </div>
                <div style="order:${isEven ? 2 : 1};aspect-ratio:4/3;border-radius:16px;overflow:hidden;">
                  <img src="${imgSrc}" alt="${f.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />
                </div>
              </div>`
            }).join('')}
          </div>
        </div>
      </section>`

    case 'list':
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="max-width:640px;margin:0 auto;">
            ${items.map((f: FeatureItem, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="padding:20px 0;${i < items.length - 1 ? `border-bottom:1px solid ${t.text}10;` : ''}">
                <h3 style="font-size:17px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
                  <span style="color:${t.primary};font-size:20px;">${f.icon || '✦'}</span> ${f.title}
                </h3>
                <p style="font-size:14px;color:${t.muted};line-height:1.7;padding-left:30px;">${f.description || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`

    default:
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
            ${items.map((f: FeatureItem, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)} card-hover" style="padding:36px 28px;background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;position:relative;overflow:hidden;">
                <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${t.primary},${t.secondary});opacity:0;transition:opacity .3s;"></div>
                <div style="width:52px;height:52px;border-radius:14px;background:${t.primary}15;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;">${f.icon || '✦'}</div>
                <h3 style="font-size:18px;font-weight:700;margin-bottom:10px;">${f.title}</h3>
                <p style="font-size:14px;color:${t.muted};line-height:1.7;">${f.description || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`
  }
}

function renderAbout(b: RenderBlock, t: TemplateTheme) {
  const aboutImg = getAboutImage(_category)
  return `<section class="section" style="background:${t.primary}06;">
    <div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
      <div>
        ${b.sectionLabel ? `<div class="section-label fade-up">${b.sectionLabel}</div>` : ''}
        <h2 class="section-title fade-up fade-up-d1">${b.headline || ''}</h2>
        <p class="fade-up fade-up-d2" style="font-size:16px;color:${t.muted};line-height:1.8;">${b.body || ''}</p>
      </div>
      <div style="aspect-ratio:4/3;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.1);" class="hide-mobile">
        <img src="${aboutImg}" alt="About Us" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .5s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
      </div>
    </div>
  </section>`
}

function renderTestimonials(b: RenderBlock, t: TemplateTheme) {
  const items = b.testimonials || []
  const variant = resolveVariant(b.variant as string)

  const header = `<div style="text-align:center;margin-bottom:60px;">
    <h2 class="section-title fade-up">${b.headline || ''}</h2>
  </div>`

  switch (variant) {
    case 'carousel': {
      const first = items[0]
      if (!first) return `<section class="section"><div class="container">${header}</div></section>`
      const avatar = getTeamAvatar(_category, 0)
      return `<section class="section">
        <div class="container">
          ${header}
          <div class="fade-up" style="max-width:700px;margin:0 auto;text-align:center;padding:48px 40px;background:${t.text}04;border-radius:20px;border:1px solid ${t.text}08;">
            <div style="font-size:64px;line-height:1;color:${t.primary};margin-bottom:16px;">&ldquo;</div>
            <p style="font-size:20px;line-height:1.8;color:${t.text};font-style:italic;margin-bottom:24px;">${first.quote}</p>
            <div style="display:flex;gap:4px;justify-content:center;margin-bottom:20px;">${'⭐'.repeat(first.rating || 5)}</div>
            <img src="${avatar}" alt="${first.name}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin:0 auto 12px;border:3px solid ${t.primary}30;" />
            <div style="font-size:16px;font-weight:700;">${first.name}</div>
            <div style="font-size:13px;color:${t.muted};">${first.title || ''}</div>
            ${items.length > 1 ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:24px;">${items.map((_: TestimonialItem, i: number) => `<span style="width:${i === 0 ? 24 : 8}px;height:8px;border-radius:4px;background:${i === 0 ? t.primary : t.text + '20'};display:inline-block;"></span>`).join('')}</div>` : ''}
          </div>
        </div>
      </section>`
    }

    case 'spotlight': {
      const featured = items[0]
      const rest = items.slice(1, 3)
      if (!featured) return `<section class="section"><div class="container">${header}</div></section>`
      const featAvatar = getTeamAvatar(_category, 0)
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:stretch;">
            <div class="fade-up card-hover" style="padding:40px;background:${t.primary}08;border:2px solid ${t.primary}20;border-radius:20px;display:flex;flex-direction:column;justify-content:center;">
              <div style="font-size:48px;line-height:1;color:${t.primary};margin-bottom:12px;">&ldquo;</div>
              <p style="font-size:18px;line-height:1.8;color:${t.text};font-style:italic;margin-bottom:24px;">${featured.quote}</p>
              <div style="display:flex;gap:4px;margin-bottom:16px;">${'⭐'.repeat(featured.rating || 5)}</div>
              <div style="display:flex;align-items:center;gap:12px;">
                <img src="${featAvatar}" alt="${featured.name}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ${t.primary}30;" />
                <div>
                  <div style="font-size:15px;font-weight:700;">${featured.name}</div>
                  <div style="font-size:13px;color:${t.muted};">${featured.title || ''}</div>
                </div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:24px;">
              ${rest.map((t2: TestimonialItem, i: number) => {
                const av = getTeamAvatar(_category, i + 1)
                return `
                <div class="fade-up fade-up-d${i + 1} card-hover" style="padding:28px;background:${t.text}04;border:1px solid ${t.text}08;border-radius:16px;flex:1;">
                  <p style="font-size:14px;color:${t.muted};line-height:1.7;margin-bottom:16px;font-style:italic;">"${t2.quote}"</p>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${av}" alt="${t2.name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />
                    <div>
                      <div style="font-size:13px;font-weight:700;">${t2.name}</div>
                      <div style="font-size:11px;color:${t.muted};">${t2.title || ''}</div>
                    </div>
                  </div>
                </div>`
              }).join('')}
            </div>
          </div>
        </div>
      </section>`
    }

    default:
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">
            ${items.map((t2: TestimonialItem, i: number) => {
              const avatar = getTeamAvatar(_category, i)
              return `
              <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="padding:32px;background:${t.text}04;border:1px solid ${t.text}08;border-radius:16px;">
                <div style="display:flex;gap:4px;margin-bottom:16px;">${'⭐'.repeat(t2.rating || 5)}</div>
                <p style="font-size:15px;color:${t.muted};line-height:1.7;margin-bottom:20px;font-style:italic;">"${t2.quote}"</p>
                <div style="display:flex;align-items:center;gap:12px;">
                  <img src="${avatar}" alt="${t2.name}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${t.primary}30;" />
                  <div>
                    <div style="font-size:14px;font-weight:700;">${t2.name}</div>
                    <div style="font-size:12px;color:${t.muted};">${t2.title || ''}</div>
                  </div>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>
      </section>`
  }
}

function renderStats(b: RenderBlock, t: TemplateTheme) {
  const items = b.stats || []
  return `<section style="padding:60px 0;background:linear-gradient(135deg,${t.primary}08,${t.secondary}05);">
    <div class="container">
      ${b.headline ? `<h2 style="text-align:center;font-size:24px;font-weight:700;margin-bottom:40px;" class="fade-up">${b.headline}</h2>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:24px;text-align:center;">
        ${items.map((s: StatItem, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="animation:countUp .6s ease both;animation-delay:${i * .15}s;">
            <div style="font-size:clamp(28px,4vw,40px);font-weight:800;color:${t.primary};margin-bottom:4px;">${s.value}</div>
            <div style="font-size:13px;color:${t.muted};font-weight:500;">${s.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`
}

function renderPricing(b: RenderBlock, t: TemplateTheme) {
  const plans = b.plans || []
  const variant = resolveVariant(b.variant as string)

  const header = `<div style="text-align:center;margin-bottom:60px;">
    <h2 class="section-title fade-up">${b.headline || ''}</h2>
    <p class="section-subtitle fade-up fade-up-d1" style="margin:0 auto;">${b.subheadline || ''}</p>
  </div>`

  switch (variant) {
    case 'table': {
      const allFeatures: string[] = []
      plans.forEach((p: PricingPlan) => {
        (p.features || []).forEach((f: string | { text: string }) => {
          const txt = typeof f === 'string' ? f : (f.text || '')
          if (txt && !allFeatures.includes(txt)) allFeatures.push(txt)
        })
      })
      return `<section class="section">
        <div class="container">
          ${header}
          <div class="fade-up" style="overflow-x:auto;max-width:900px;margin:0 auto;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:16px;border-bottom:2px solid ${t.primary};color:${t.muted};font-size:13px;">Features</th>
                  ${plans.map((p: PricingPlan) => `<th style="text-align:center;padding:16px;border-bottom:2px solid ${p.isPopular ? t.primary : t.text + '15'};${p.isPopular ? `background:${t.primary}08;` : ''}">
                    <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${p.name}</div>
                    <div style="font-size:24px;font-weight:800;color:${t.primary};">${p.price}</div>
                  </th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${allFeatures.map((feat: string, i: number) => `
                  <tr style="background:${i % 2 === 0 ? 'transparent' : t.text + '03'};">
                    <td style="padding:12px 16px;border-bottom:1px solid ${t.text}08;color:${t.muted};">${feat}</td>
                    ${plans.map((p: PricingPlan) => {
                      const has = (p.features || []).some((f: string | { text: string }) => (typeof f === 'string' ? f : (f.text || '')) === feat)
                      return `<td style="text-align:center;padding:12px 16px;border-bottom:1px solid ${t.text}08;${p.isPopular ? `background:${t.primary}08;` : ''}"><span style="color:${has ? t.primary : t.text + '20'};font-size:16px;">${has ? '✓' : '—'}</span></td>`
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td style="padding:16px;"></td>
                  ${plans.map((p: PricingPlan) => `<td style="text-align:center;padding:16px;${p.isPopular ? `background:${t.primary}08;` : ''}"><a href="${p.ctaUrl || '#'}" class="${p.isPopular ? 'btn-primary' : 'btn-outline'}" style="display:inline-block;">${p.ctaLabel || 'Choose Plan'}</a></td>`).join('')}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>`
    }

    case 'horizontal':
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:flex;gap:16px;overflow-x:auto;max-width:1000px;margin:0 auto;">
            ${plans.map((p: PricingPlan, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="flex:1;min-width:200px;padding:28px 20px;border-radius:16px;border:${p.isPopular ? `2px solid ${t.primary}` : `1px solid ${t.text}10`};background:${p.isPopular ? `${t.primary}06` : `${t.text}02`};text-align:center;">
                ${p.isPopular ? `<div style="display:inline-block;padding:3px 12px;background:${t.primary};color:#fff;border-radius:100px;font-size:10px;font-weight:700;margin-bottom:10px;">POPULAR</div>` : ''}
                <h3 style="font-size:15px;font-weight:700;margin-bottom:8px;">${p.name}</h3>
                <div style="font-size:28px;font-weight:800;color:${t.primary};margin-bottom:8px;">${p.price}</div>
                <p style="font-size:12px;color:${t.muted};margin-bottom:16px;">${p.description || ''}</p>
                <ul style="list-style:none;margin-bottom:20px;text-align:left;">
                  ${(p.features || []).map((f: string | { text: string }) => `<li style="padding:5px 0;font-size:13px;color:${t.muted};display:flex;align-items:center;gap:6px;"><span style="color:${t.primary};font-size:12px;">✓</span> ${typeof f === 'string' ? f : (f.text || '')}</li>`).join('')}
                </ul>
                <a href="${p.ctaUrl || '#'}" class="${p.isPopular ? 'btn-primary' : 'btn-outline'}" style="display:block;text-align:center;width:100%;font-size:13px;">${p.ctaLabel || 'Choose Plan'}</a>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`

    default:
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;max-width:900px;margin:0 auto;">
            ${plans.map((p: PricingPlan, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="padding:36px 28px;border-radius:20px;border:${p.isPopular ? `2px solid ${t.primary}` : `1px solid ${t.text}10`};background:${p.isPopular ? `${t.primary}08` : `${t.text}03`};position:relative;${p.isPopular ? `box-shadow:0 20px 40px ${t.primary}15;transform:scale(1.03);` : ''}">
                ${p.isPopular ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:4px 16px;background:${t.primary};color:#fff;border-radius:100px;font-size:11px;font-weight:700;">POPULAR</div>` : ''}
                <h3 style="font-size:18px;font-weight:700;margin-bottom:4px;">${p.name}</h3>
                <p style="font-size:13px;color:${t.muted};margin-bottom:16px;">${p.description || ''}</p>
                <div style="font-size:32px;font-weight:800;color:${t.primary};margin-bottom:24px;">${p.price}</div>
                <ul style="list-style:none;margin-bottom:28px;">
                  ${(p.features || []).map((f: string | { text: string }) => `<li style="padding:8px 0;font-size:14px;color:${t.muted};border-bottom:1px solid ${t.text}06;display:flex;align-items:center;gap:8px;"><span style="color:${t.primary};">✓</span> ${typeof f === 'string' ? f : (f.text || '')}</li>`).join('')}
                </ul>
                <a href="${p.ctaUrl || '#'}" class="${p.isPopular ? 'btn-primary' : 'btn-outline'}" style="display:block;text-align:center;width:100%;">${p.ctaLabel || 'Choose Plan'}</a>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`
  }
}

function renderFaq(b: RenderBlock, t: TemplateTheme) {
  const items = b.faqs || []
  const variant = resolveVariant(b.variant as string)

  switch (variant) {
    case 'grid':
      return `<section class="section">
        <div class="container">
          <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;max-width:900px;margin:0 auto;">
            ${items.map((f: FaqItem, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)} card-hover" style="padding:24px;background:${t.text}04;border:1px solid ${t.text}08;border-radius:14px;">
                <h3 style="font-size:15px;font-weight:700;margin-bottom:10px;color:${t.text};">${f.question}</h3>
                <p style="font-size:14px;color:${t.muted};line-height:1.7;">${f.answer}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`

    default:
      return `<section class="section">
        <div class="container" style="max-width:700px;">
          <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
          ${items.map((f: FaqItem, i: number) => `
            <div class="fade-up fade-up-d${Math.min(i + 1, 3)}" style="border-bottom:1px solid ${t.text}10;padding:24px 0;">
              <h3 style="font-size:16px;font-weight:600;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">${f.question} <span style="color:${t.primary};font-size:20px;">+</span></h3>
              <p style="font-size:14px;color:${t.muted};line-height:1.7;">${f.answer}</p>
            </div>
          `).join('')}
        </div>
      </section>`
  }
}

function renderGallery(b: RenderBlock, t: TemplateTheme) {
  const variant = resolveVariant(b.variant as string)
  const header = `<h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>`

  switch (variant) {
    case 'masonry': {
      const galleryImages = getGalleryImages(_category, 6)
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;grid-auto-rows:180px;">
            ${galleryImages.map((imgUrl: string, i: number) => {
              const tall = i === 0 || i % 3 === 0
              return `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="${tall ? 'grid-row:span 2;' : ''}border-radius:12px;overflow:hidden;position:relative;cursor:pointer;">
                <img src="${imgUrl}" alt="Gallery ${i + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .5s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'" />
                <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(0,0,0,.3));opacity:0;transition:opacity .3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"></div>
              </div>`
            }).join('')}
          </div>
        </div>
      </section>`
    }

    case 'two-col': {
      const galleryImages = getGalleryImages(_category, 2)
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            ${galleryImages.map((imgUrl: string, i: number) => `
              <div class="fade-up fade-up-d${i + 1}" style="aspect-ratio:3/2;border-radius:16px;overflow:hidden;position:relative;cursor:pointer;">
                <img src="${imgUrl}" alt="Gallery ${i + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .5s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'" />
                <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(0,0,0,.25));opacity:0;transition:opacity .3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"></div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`
    }

    default: {
      const galleryImages = getGalleryImages(_category, 6)
      return `<section class="section">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
            ${galleryImages.map((imgUrl: string, i: number) => `
              <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="aspect-ratio:${i % 3 === 0 ? '4/3' : '1/1'};border-radius:12px;overflow:hidden;position:relative;cursor:pointer;">
                <img src="${imgUrl}" alt="Gallery ${i + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .5s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'" />
                <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 60%,rgba(0,0,0,.3));opacity:0;transition:opacity .3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"></div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`
    }
  }
}

function renderTeam(b: RenderBlock, t: TemplateTheme) {
  const members = b.members || []
  const variant = resolveVariant(b.variant as string)

  const header = `<h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>`

  switch (variant) {
    case 'cards':
      return `<section class="section" style="background:${t.primary}04;">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;max-width:900px;margin:0 auto;">
            ${members.map((m: MemberItem, i: number) => {
              const avatar = getTeamAvatar(_category, i)
              return `
              <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="background:${t.bg};border:1px solid ${t.text}10;border-radius:16px;overflow:hidden;">
                <div style="aspect-ratio:4/3;overflow:hidden;">
                  <img src="${avatar}" alt="${m.name}" style="width:100%;height:100%;object-fit:cover;transition:transform .5s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
                </div>
                <div style="padding:20px;">
                  <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">${m.name}</h3>
                  <p style="font-size:13px;color:${t.muted};">${m.role || ''}</p>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>
      </section>`

    default:
      return `<section class="section" style="background:${t.primary}04;">
        <div class="container">
          ${header}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:800px;margin:0 auto;">
            ${members.map((m: MemberItem, i: number) => {
              const avatar = getTeamAvatar(_category, i)
              return `
              <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="text-align:center;padding:32px 20px;background:${t.text}04;border-radius:16px;border:1px solid ${t.text}06;">
                <img src="${avatar}" alt="${m.name}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 16px;border:3px solid ${t.primary}25;" />
                <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">${m.name}</h3>
                <p style="font-size:13px;color:${t.muted};">${m.role || ''}</p>
              </div>`
            }).join('')}
          </div>
        </div>
      </section>`
  }
}

function renderCta(b: RenderBlock, t: TemplateTheme) {
  const variant = resolveVariant(b.variant as string)

  switch (variant) {
    case 'banner':
      return `<section style="padding:0;">
        <div class="fade-up" style="background:linear-gradient(135deg,${t.primary},${t.secondary});padding:40px 0;">
          <div class="container" style="display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <h2 style="font-size:clamp(20px,2.5vw,28px);font-weight:800;color:#fff;margin-bottom:8px;">${b.headline || ''}</h2>
              <p style="font-size:15px;color:rgba(255,255,255,.8);">${b.subheadline || ''}</p>
            </div>
            <a href="${b.ctaUrl || '#'}" class="btn-primary" style="flex-shrink:0;display:inline-flex;padding:14px 36px;background:#fff;color:${t.primary};border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 8px 24px rgba(0,0,0,.15);">${b.ctaLabel || 'Get Started'}</a>
          </div>
        </div>
      </section>`

    default: {
      const img = getAboutImage(_category)
      return `<section style="padding:80px 0;">
        <div class="container">
          <div class="fade-up" style="text-align:center;padding:64px 40px;border-radius:24px;position:relative;overflow:hidden;">
            <img src="${img}" alt="CTA Background" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
            <div style="position:absolute;inset:0;background:linear-gradient(135deg,${t.primary}e6,${t.secondary}cc);"></div>
            <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;color:#fff;margin-bottom:12px;position:relative;z-index:1;">${b.headline || ''}</h2>
            <p style="font-size:16px;color:rgba(255,255,255,.85);margin-bottom:32px;position:relative;z-index:1;">${b.subheadline || ''}</p>
            <a href="${b.ctaUrl || '#'}" style="display:inline-flex;padding:14px 36px;background:#fff;color:${t.primary};border-radius:12px;font-weight:700;font-size:15px;position:relative;z-index:1;transition:all .2s;box-shadow:0 8px 24px rgba(0,0,0,.2);">${b.ctaLabel || 'Get Started'}</a>
          </div>
        </div>
      </section>`
    }
  }
}

function renderContact(b: RenderBlock, t: TemplateTheme, site?: SiteSocialLinks) {
  const mergedBlock = mergeContactInfoWithSite(b, site?.contactInfo) as RenderBlock
  return `<section class="section">
    <div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start;">
      <div>
        <h2 class="section-title fade-up">${mergedBlock.headline || ''}</h2>
        <p class="fade-up fade-up-d1" style="font-size:15px;color:${t.muted};margin-bottom:32px;">${mergedBlock.subtext || ''}</p>
        <div style="display:flex;flex-direction:column;gap:20px;">
          ${[
      { icon: '📧', label: 'Email', value: mergedBlock.email },
      { icon: '📞', label: 'Phone', value: mergedBlock.phone },
      { icon: '📍', label: 'Address', value: mergedBlock.address },
    ].filter(c => c.value).map((c, i) => `
            <div class="fade-up fade-up-d${i + 2} card-hover" style="display:flex;align-items:center;gap:16px;padding:16px;background:${t.text}04;border-radius:12px;border:1px solid ${t.text}06;">
              <div style="width:44px;height:44px;border-radius:10px;background:${t.primary}12;display:flex;align-items:center;justify-content:center;font-size:20px;">${c.icon}</div>
              <div><div style="font-size:12px;color:${t.muted};margin-bottom:2px;">${c.label}</div><div style="font-size:14px;font-weight:600;">${c.value}</div></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="fade-up fade-up-d2" style="padding:32px;background:${t.text}04;border:1px solid ${t.text}08;border-radius:20px;">
        ${(mergedBlock.formFields || []).map((f: FormField) => `
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">${f.label}</label>
            ${f.fieldType === 'textarea'
        ? `<textarea placeholder="${f.placeholder || ''}" style="width:100%;padding:12px;border:1px solid ${t.text}12;border-radius:10px;background:transparent;color:${t.text};font-size:14px;resize:vertical;min-height:80px;font-family:inherit;"></textarea>`
        : `<input type="${f.fieldType || 'text'}" placeholder="${f.placeholder || ''}" style="width:100%;padding:12px;border:1px solid ${t.text}12;border-radius:10px;background:transparent;color:${t.text};font-size:14px;" />`
      }
          </div>
        `).join('')}
        <button class="btn-primary" style="width:100%;">Send Message</button>
      </div>
    </div>
  </section>`
}

function renderFooter(b: RenderBlock, t: TemplateTheme, site?: SiteSocialLinks) {
  const mergedBlock = mergeFooterSocialsWithSite(b, site) as RenderBlock
  const cols = mergedBlock.columns || []
  return `<footer style="padding:60px 0 30px;background:${t.text}04;border-top:1px solid ${t.text}08;">
    <div class="container">
      <div style="display:grid;grid-template-columns:2fr ${cols.map(() => '1fr').join(' ')};gap:40px;margin-bottom:40px;">
        <div>
          <div style="font-family:'${t.fontHeading}',serif;font-size:22px;font-weight:700;margin-bottom:12px;color:${t.primary};">${mergedBlock.logoText || ''}</div>
          <p style="font-size:14px;color:${t.muted};max-width:280px;line-height:1.7;">${mergedBlock.tagline || ''}</p>
          ${mergedBlock.socials && mergedBlock.socials.length > 0 ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;">${mergedBlock.socials.map((social: SocialLink) => `<a href="${sanitizeUrl(social.url)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:${t.primary}10;border:1px solid ${t.primary}15;color:${t.primary};font-size:12px;font-weight:800;text-transform:uppercase;">${(social.platform || '•').slice(0,2)}</a>`).join('')}</div>` : ''}
        </div>
        ${cols.map((c: FooterColumn) => `
          <div>
            <h4 style="font-size:14px;font-weight:700;margin-bottom:16px;">${c.title}</h4>
            ${(c.links || []).map((l: FooterLink) => `<div style="margin-bottom:10px;"><a href="${sanitizeUrl(l.url)}" style="font-size:13px;color:${t.muted};transition:color .2s;">${l.label}</a></div>`).join('')}
          </div>
        `).join('')}
      </div>
      <div style="border-top:1px solid ${t.text}08;padding-top:20px;text-align:center;">
        <p style="font-size:12px;color:${t.muted};">${mergedBlock.copyrightText || ''}</p>
      </div>
    </div>
  </footer>`
}
