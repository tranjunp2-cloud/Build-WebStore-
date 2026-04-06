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
    default: return ''
  }
}

function escapeAttr(str: string) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sanitizeUrl(raw: string): string {
    let val = String(raw || '').trim()
    if (!val || val === '#') return '#'
    if (!/^https?:\/\//i.test(val)) val = `https://${val}`
    try {
        const parsed = new URL(val)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#'
        return escapeAttr(parsed.href)
    } catch (error: unknown) {
        console.error('URL parse error:', error)
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
  const layout = b.variant || 'grid' // grid, cards

  return `<section class="py-24 relative overflow-hidden bg-white/5">
    <div class="container mx-auto px-6 relative z-10">
      <div class="text-center max-w-3xl mx-auto mb-16">
        ${b.sectionLabel ? `<div class="fade-up inline-flex px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6" style="color:${t.primary};background:${t.primary}15;">${b.sectionLabel}</div>` : ''}
        <h2 class="fade-up fade-up-d1 text-4xl md:text-5xl font-bold font-heading mb-6">${b.headline || ''}</h2>
        ${b.subheadline ? `<p class="fade-up fade-up-d2 text-lg opacity-60 leading-relaxed">${b.subheadline}</p>` : ''}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${items.map((f: FeatureItem, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 4)} p-8 rounded-3xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl" style="${layout === 'cards' ? `background:white; border:1px solid ${t.primary}11;` : `border:1px solid ${t.primary}11;`}">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-sm" style="background:${t.primary}15; color:${t.primary};">${f.icon || '✦'}</div>
            <h3 class="text-xl font-bold mb-4 font-heading">${f.title}</h3>
            <p class="opacity-60 leading-relaxed">${f.description || ''}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`
}

function renderAbout(b: RenderBlock, t: TemplateTheme) {
  const aboutImg = (b.image as { url?: string })?.url || getAboutImage(_category)
  const layout = b.variant || 'image-right' // image-right, image-left, centered
  
  const imgHtml = aboutImg ? `<img src="${aboutImg}" alt="${escapeAttr(b.headline || 'About')}" loading="lazy" class="w-full h-auto rounded-3xl shadow-xl" />` : `<div class="w-full aspect-[4/3] rounded-3xl bg-neutral-100 flex items-center justify-center border text-neutral-300">Image missing</div>`
  
  const contentHtml = `
    <div class="${layout === 'centered' ? 'text-center max-w-3xl mx-auto' : ''}">
      ${b.sectionLabel ? `<div class="fade-up inline-flex px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6" style="color:${t.primary};background:${t.primary}15;">${b.sectionLabel}</div>` : ''}
      <h2 class="fade-up fade-up-d1 text-4xl md:text-5xl font-bold font-heading mb-6 leading-tight">${b.headline || ''}</h2>
      ${b.body ? `<div class="fade-up fade-up-d2 opacity-60 leading-relaxed text-lg space-y-4"><p>${typeof b.body === 'string' ? b.body : ''}</p></div>` : ''}
    </div>
  `

  return `<section class="py-24 relative overflow-hidden">
    <div class="absolute bottom-[0%] right-[-10%] w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none" style="background:${t.primary};opacity:0.06;"></div>
    
    <div class="container mx-auto px-6 relative z-10">
      <div class="grid grid-cols-1 ${layout !== 'centered' ? 'lg:grid-cols-2' : ''} gap-14 items-center">
        ${layout === 'image-left' ? `<div class="fade-up">${imgHtml}</div>` : ''}
        ${contentHtml}
        ${(layout === 'image-right' || !layout) ? `<div class="fade-up">${imgHtml}</div>` : ''}
      </div>
    </div>
  </section>`
}

function renderTestimonials(b: RenderBlock, t: TemplateTheme) {
  const items = b.testimonials || []
  return `<section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:60px;">
        <h2 class="section-title fade-up">${b.headline || ''}</h2>
      </div>
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
  return `<section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:60px;">
        <h2 class="section-title fade-up">${b.headline || ''}</h2>
        <p class="section-subtitle fade-up fade-up-d1" style="margin:0 auto;">${b.subheadline || ''}</p>
      </div>
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

function renderFaq(b: RenderBlock, t: TemplateTheme) {
  const items = b.faqs || []
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

function renderGallery(b: RenderBlock, t: TemplateTheme) {
  const galleryImages = (b.images as { url?: string }[])?.map(img => img.url).filter((url): url is string => Boolean(url)) || getGalleryImages(_category, 6)
  return `<section class="section">
    <div class="container">
      <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
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

function renderTeam(b: RenderBlock, t: TemplateTheme) {
  const members = b.members || []
  return `<section class="section" style="background:${t.primary}04;">
    <div class="container">
      <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:800px;margin:0 auto;">
        ${members.map((m: MemberItem, i: number) => {
    const avatar = getTeamAvatar(_category, i)
    return `
          <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="text-align:center;padding:32px 20px;background:${t.text}04;border-radius:16px;border:1px solid ${t.text}06;">
            <img src="${m.image || avatar}" alt="${m.name}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 16px;border:3px solid ${t.primary}25;" />
            <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">${m.name}</h3>
            <p style="font-size:13px;color:${t.muted};">${m.role || ''}</p>
          </div>`
  }).join('')}
      </div>
    </div>
  </section>`
}

function renderCta(b: RenderBlock, t: TemplateTheme) {
  const img = (b.image as { url?: string })?.url || ''
  const layout = b.variant || 'centered'

  return `<section class="py-24 relative overflow-hidden">
    <div class="container mx-auto px-6 relative z-10">
      <div class="fade-up relative overflow-hidden rounded-3xl" style="background: linear-gradient(135deg, ${t.primary}, ${t.secondary});">
        ${img ? `<div class="absolute inset-0 opacity-20"><img src="${img}" alt="CTA Background" class="w-full h-full object-cover mix-blend-overlay" loading="lazy" /></div>` : ''}
        <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(white 1.5px, transparent 1.5px); background-size: 24px 24px;"></div>
        
        <div class="relative z-10 px-8 py-20 md:p-24 ${layout === 'split' ? 'flex flex-col md:flex-row items-center justify-between gap-12' : 'text-center'}">
          <div class="${layout === 'split' ? 'md:max-w-xl text-left' : 'max-w-3xl mx-auto'} text-white">
            <h2 class="text-4xl md:text-5xl font-bold font-heading mb-6 leading-tight">${b.headline || ''}</h2>
            <p class="text-lg opacity-80 leading-relaxed mb-10">${b.subheadline || ''}</p>
            <div class="${layout === 'split' ? 'flex justify-start' : 'flex justify-center'} gap-4">
              <a href="${b.ctaUrl || '#'}" class="px-8 py-4 bg-white rounded-xl font-bold transition-all duration-300 hover:scale-105 hover:shadow-xl inline-block" style="color: ${t.primary};">${b.ctaLabel || 'Get Started'}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`
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
