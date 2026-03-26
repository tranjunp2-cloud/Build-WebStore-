/**
 * Section renderers — industry-aware content blocks with REAL images.
 * Each block type has a distinct visual treatment with premium quality.
 */
import { TemplateTheme } from './styles'
import { getGalleryImages, getAboutImage, getTeamAvatar } from './images'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'

// Category for image selection
let _category = 'business'
export function setSectionCategory(cat: string) { _category = cat }

export function renderSections(block: any, t: TemplateTheme, category?: string): string {
  if (category) _category = category
  switch (block.blockType) {
    case 'features': return renderFeatures(block, t)
    case 'about': return renderAbout(block, t)
    case 'testimonials': return renderTestimonials(block, t)
    case 'contact': return renderContact(block, t)
    case 'footer': return renderFooter(block, t)
    case 'stats': return renderStats(block, t)
    case 'pricing': return renderPricing(block, t)
    case 'faq': return renderFaq(block, t)
    case 'gallery': return renderGallery(block, t)
    case 'team': return renderTeam(block, t)
    case 'cta': return renderCta(block, t)
    case 'socialWidget': return renderSocialWidget(block, t)
    case 'cartWidget': return renderCartWidget(block, t)
    default: return ''
  }
}

function renderSocialWidget(b: any, t: TemplateTheme) {
  const normalizedBlock = normalizeSocialWidgetConfig(b)
  const links = normalizedBlock.links.filter((item: any) => item?.enabled !== false)
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
    const trimmed = String(value || '').trim()
    if (!trimmed) return '#'
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (platform === 'whatsapp') {
      const digits = trimmed.replace(/[^\d]/g, '')
      return digits ? `https://wa.me/${digits}` : '#'
    }
    return `https://${trimmed}`
  }

  return `<section style="${isFloating ? 'position:fixed;right:24px;bottom:24px;z-index:50;' : 'padding:40px 0;'}">
    <div class="${isFloating ? '' : 'container'}" style="${isFloating ? 'display:flex;flex-direction:column;align-items:flex-end;gap:12px;' : ''}">
      ${normalizedBlock.headline ? `<p style="font-size:14px;color:${t.muted};font-weight:600;">${normalizedBlock.headline}</p>` : ''}
      <div style="display:flex;${isFloating ? 'flex-direction:column;' : 'flex-wrap:wrap;'}gap:12px;">
        ${links.map((item: any) => {
          const meta = platformMeta[item.platform] || { label: item.platform || 'Social', mark: '•', accent: t.primary }
          return `<a href="${normalizeUrl(item.platform, item.url)}" target="_blank" rel="noreferrer" aria-label="${meta.label}"
            style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;border:1px solid ${meta.accent}33;background:linear-gradient(135deg, ${meta.accent}22, ${t.primary}15);box-shadow:0 14px 32px rgba(15,23,42,0.16);">
            <span style="display:inline-flex;width:36px;height:36px;border-radius:999px;align-items:center;justify-content:center;background:rgba(255,255,255,.92);color:${meta.accent};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;border:1px solid ${meta.accent}22;">${meta.mark}</span>
            ${isFloating ? '' : `<span style="font-size:14px;font-weight:600;color:${t.text};">${meta.label}</span>`}
          </a>`
        }).join('')}
      </div>
    </div>
  </section>`
}

function renderCartWidget(b: any, t: TemplateTheme) {
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

function renderFeatures(b: any, t: TemplateTheme) {
  const items = b.features || []
  const cardBg = `${t.text}05`
  const cardBorder = `${t.text}08`
  return `<section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:60px;">
        ${b.sectionLabel ? `<div class="section-label fade-up">${b.sectionLabel}</div>` : ''}
        <h2 class="section-title fade-up fade-up-d1">${b.headline || ''}</h2>
        <p class="section-subtitle fade-up fade-up-d2" style="margin:0 auto;">${b.subheadline || ''}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
        ${items.map((f: any, i: number) => `
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

function renderAbout(b: any, t: TemplateTheme) {
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

function renderTestimonials(b: any, t: TemplateTheme) {
  const items = b.testimonials || []
  return `<section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:60px;">
        <h2 class="section-title fade-up">${b.headline || ''}</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;">
        ${items.map((t2: any, i: number) => {
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

function renderStats(b: any, t: TemplateTheme) {
  const items = b.stats || []
  return `<section style="padding:60px 0;background:linear-gradient(135deg,${t.primary}08,${t.secondary}05);">
    <div class="container">
      ${b.headline ? `<h2 style="text-align:center;font-size:24px;font-weight:700;margin-bottom:40px;" class="fade-up">${b.headline}</h2>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:24px;text-align:center;">
        ${items.map((s: any, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="animation:countUp .6s ease both;animation-delay:${i * .15}s;">
            <div style="font-size:clamp(28px,4vw,40px);font-weight:800;color:${t.primary};margin-bottom:4px;">${s.value}</div>
            <div style="font-size:13px;color:${t.muted};font-weight:500;">${s.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`
}

function renderPricing(b: any, t: TemplateTheme) {
  const plans = b.plans || []
  return `<section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:60px;">
        <h2 class="section-title fade-up">${b.headline || ''}</h2>
        <p class="section-subtitle fade-up fade-up-d1" style="margin:0 auto;">${b.subheadline || ''}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;max-width:900px;margin:0 auto;">
        ${plans.map((p: any, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 3)} card-hover" style="padding:36px 28px;border-radius:20px;border:${p.isPopular ? `2px solid ${t.primary}` : `1px solid ${t.text}10`};background:${p.isPopular ? `${t.primary}08` : `${t.text}03`};position:relative;${p.isPopular ? `box-shadow:0 20px 40px ${t.primary}15;transform:scale(1.03);` : ''}">
            ${p.isPopular ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:4px 16px;background:${t.primary};color:#fff;border-radius:100px;font-size:11px;font-weight:700;">POPULAR</div>` : ''}
            <h3 style="font-size:18px;font-weight:700;margin-bottom:4px;">${p.name}</h3>
            <p style="font-size:13px;color:${t.muted};margin-bottom:16px;">${p.description || ''}</p>
            <div style="font-size:32px;font-weight:800;color:${t.primary};margin-bottom:24px;">${p.price}</div>
            <ul style="list-style:none;margin-bottom:28px;">
              ${(p.features || []).map((f: any) => `<li style="padding:8px 0;font-size:14px;color:${t.muted};border-bottom:1px solid ${t.text}06;display:flex;align-items:center;gap:8px;"><span style="color:${t.primary};">✓</span> ${f.text || f}</li>`).join('')}
            </ul>
            <a href="${p.ctaUrl || '#'}" class="${p.isPopular ? 'btn-primary' : 'btn-outline'}" style="display:block;text-align:center;width:100%;">${p.ctaLabel || 'Choose Plan'}</a>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`
}

function renderFaq(b: any, t: TemplateTheme) {
  const items = b.faqs || []
  return `<section class="section">
    <div class="container" style="max-width:700px;">
      <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
      ${items.map((f: any, i: number) => `
        <div class="fade-up fade-up-d${Math.min(i + 1, 3)}" style="border-bottom:1px solid ${t.text}10;padding:24px 0;">
          <h3 style="font-size:16px;font-weight:600;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">${f.question} <span style="color:${t.primary};font-size:20px;">+</span></h3>
          <p style="font-size:14px;color:${t.muted};line-height:1.7;">${f.answer}</p>
        </div>
      `).join('')}
    </div>
  </section>`
}

function renderGallery(b: any, t: TemplateTheme) {
  const galleryImages = getGalleryImages(_category, 6)
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

function renderTeam(b: any, t: TemplateTheme) {
  const members = b.members || []
  return `<section class="section" style="background:${t.primary}04;">
    <div class="container">
      <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:800px;margin:0 auto;">
        ${members.map((m: any, i: number) => {
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

function renderCta(b: any, t: TemplateTheme) {
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

function renderContact(b: any, t: TemplateTheme) {
  return `<section class="section">
    <div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start;">
      <div>
        <h2 class="section-title fade-up">${b.headline || ''}</h2>
        <p class="fade-up fade-up-d1" style="font-size:15px;color:${t.muted};margin-bottom:32px;">${b.subtext || ''}</p>
        <div style="display:flex;flex-direction:column;gap:20px;">
          ${[
      { icon: '📧', label: 'Email', value: b.email },
      { icon: '📞', label: 'Phone', value: b.phone },
      { icon: '📍', label: 'Address', value: b.address },
    ].filter(c => c.value).map((c, i) => `
            <div class="fade-up fade-up-d${i + 2} card-hover" style="display:flex;align-items:center;gap:16px;padding:16px;background:${t.text}04;border-radius:12px;border:1px solid ${t.text}06;">
              <div style="width:44px;height:44px;border-radius:10px;background:${t.primary}12;display:flex;align-items:center;justify-content:center;font-size:20px;">${c.icon}</div>
              <div><div style="font-size:12px;color:${t.muted};margin-bottom:2px;">${c.label}</div><div style="font-size:14px;font-weight:600;">${c.value}</div></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="fade-up fade-up-d2" style="padding:32px;background:${t.text}04;border:1px solid ${t.text}08;border-radius:20px;">
        ${(b.formFields || []).map((f: any) => `
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

function renderFooter(b: any, t: TemplateTheme) {
  const cols = b.columns || []
  return `<footer style="padding:60px 0 30px;background:${t.text}04;border-top:1px solid ${t.text}08;">
    <div class="container">
      <div style="display:grid;grid-template-columns:2fr ${cols.map(() => '1fr').join(' ')};gap:40px;margin-bottom:40px;">
        <div>
          <div style="font-family:'${t.fontHeading}',serif;font-size:22px;font-weight:700;margin-bottom:12px;color:${t.primary};">${b.logoText || ''}</div>
          <p style="font-size:14px;color:${t.muted};max-width:280px;line-height:1.7;">${b.tagline || ''}</p>
        </div>
        ${cols.map((c: any) => `
          <div>
            <h4 style="font-size:14px;font-weight:700;margin-bottom:16px;">${c.title}</h4>
            ${(c.links || []).map((l: any) => `<div style="margin-bottom:10px;"><a href="${l.url || '#'}" style="font-size:13px;color:${t.muted};transition:color .2s;">${l.label}</a></div>`).join('')}
          </div>
        `).join('')}
      </div>
      <div style="border-top:1px solid ${t.text}08;padding-top:20px;text-align:center;">
        <p style="font-size:12px;color:${t.muted};">${b.copyrightText || ''}</p>
      </div>
    </div>
  </footer>`
}
