/**
 * Section renderers — industry-aware content blocks.
 * Each block type has a distinct visual treatment.
 */
import { TemplateTheme } from './styles'

export function renderSections(block: any, t: TemplateTheme): string {
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
        default: return ''
    }
}

function renderFeatures(b: any, t: TemplateTheme) {
    const items = b.features || []
    const isDark = t.bg.startsWith('#0') || t.bg.startsWith('#1') || t.bg === '#FFFFFF'
    const cardBg = isDark ? `${t.text}05` : `${t.text}03`
    const cardBorder = `${t.text}08`
    return `<section class="section">
    <div class="container">
      <div style="text-align:center;margin-bottom:60px;">
        ${b.sectionLabel ? `<div class="section-label fade-up">${b.sectionLabel}</div>` : ''}
        <h2 class="section-title fade-up fade-up-d1">${b.headline || ''}</h2>
        <p class="section-subtitle fade-up fade-up-d2" style="margin:0 auto;">${b.subheadline || ''}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;">
        ${items.map((f: any, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="padding:36px 28px;background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;transition:all .3s;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${t.primary},${t.secondary});opacity:0;transition:opacity .3s;"></div>
            <div style="width:48px;height:48px;border-radius:12px;background:${t.primary}12;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px;">${f.icon || '✦'}</div>
            <h3 style="font-size:18px;font-weight:700;margin-bottom:10px;">${f.title}</h3>
            <p style="font-size:14px;color:${t.muted};line-height:1.7;">${f.description || ''}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`
}

function renderAbout(b: any, t: TemplateTheme) {
    return `<section class="section" style="background:${t.primary}06;">
    <div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;">
      <div>
        ${b.sectionLabel ? `<div class="section-label fade-up">${b.sectionLabel}</div>` : ''}
        <h2 class="section-title fade-up fade-up-d1">${b.headline || ''}</h2>
        <p class="fade-up fade-up-d2" style="font-size:16px;color:${t.muted};line-height:1.8;">${b.body || ''}</p>
      </div>
      <div style="aspect-ratio:4/3;border-radius:20px;background:linear-gradient(135deg,${t.primary}15,${t.secondary}20);display:flex;align-items:center;justify-content:center;" class="hide-mobile">
        <div style="font-size:64px;opacity:.4;">🏢</div>
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
        ${items.map((t2: any, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 3)}" style="padding:32px;background:${t.text}04;border:1px solid ${t.text}08;border-radius:16px;">
            <div style="display:flex;gap:4px;margin-bottom:16px;">${'⭐'.repeat(t2.rating || 5)}</div>
            <p style="font-size:15px;color:${t.muted};line-height:1.7;margin-bottom:20px;font-style:italic;">"${t2.quote}"</p>
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,${t.primary},${t.secondary});display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">${(t2.name || '?').charAt(0)}</div>
              <div>
                <div style="font-size:14px;font-weight:700;">${t2.name}</div>
                <div style="font-size:12px;color:${t.muted};">${t2.title || ''}</div>
              </div>
            </div>
          </div>
        `).join('')}
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
          <div class="fade-up fade-up-d${Math.min(i + 1, 3)}" style="padding:36px 28px;border-radius:20px;border:${p.isPopular ? `2px solid ${t.primary}` : `1px solid ${t.text}10`};background:${p.isPopular ? `${t.primary}08` : `${t.text}03`};position:relative;${p.isPopular ? `box-shadow:0 20px 40px ${t.primary}15;transform:scale(1.03);` : ''}">
            ${p.isPopular ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);padding:4px 16px;background:${t.primary};color:#fff;border-radius:100px;font-size:11px;font-weight:700;">PHỔ BIẾN</div>` : ''}
            <h3 style="font-size:18px;font-weight:700;margin-bottom:4px;">${p.name}</h3>
            <p style="font-size:13px;color:${t.muted};margin-bottom:16px;">${p.description || ''}</p>
            <div style="font-size:32px;font-weight:800;color:${t.primary};margin-bottom:24px;">${p.price}</div>
            <ul style="list-style:none;margin-bottom:28px;">
              ${(p.features || []).map((f: any) => `<li style="padding:8px 0;font-size:14px;color:${t.muted};border-bottom:1px solid ${t.text}06;display:flex;align-items:center;gap:8px;"><span style="color:${t.primary};">✓</span> ${f.text || f}</li>`).join('')}
            </ul>
            <a href="${p.ctaUrl || '#'}" class="${p.isPopular ? 'btn-primary' : 'btn-outline'}" style="display:block;text-align:center;width:100%;">${p.ctaLabel || 'Chọn Gói'}</a>
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
    const count = Math.min((b.images || []).length || 6, 8)
    return `<section class="section">
    <div class="container">
      <h2 class="section-title fade-up" style="text-align:center;margin-bottom:48px;">${b.headline || ''}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
        ${Array.from({ length: count }, (_, i) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 4)}" style="aspect-ratio:${i % 3 === 0 ? '4/3' : '1/1'};border-radius:12px;background:linear-gradient(${135 + i * 20}deg,${t.primary}${12 + i * 3},${t.secondary}${15 + i * 3});overflow:hidden;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:32px;opacity:.3;">📷</span>
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
        ${members.map((m: any, i: number) => `
          <div class="fade-up fade-up-d${Math.min(i + 1, 3)}" style="text-align:center;padding:32px 20px;background:${t.text}04;border-radius:16px;">
            <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,${t.primary},${t.secondary});margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;">${(m.name || '?').charAt(0)}</div>
            <h3 style="font-size:16px;font-weight:700;margin-bottom:4px;">${m.name}</h3>
            <p style="font-size:13px;color:${t.muted};">${m.role || ''}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`
}

function renderCta(b: any, t: TemplateTheme) {
    return `<section style="padding:80px 0;">
    <div class="container">
      <div class="fade-up" style="text-align:center;padding:64px 40px;border-radius:24px;background:linear-gradient(135deg,${t.primary},${t.secondary});position:relative;overflow:hidden;">
        <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.1);"></div>
        <div style="position:absolute;bottom:-60px;left:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.08);"></div>
        <h2 style="font-size:clamp(24px,3vw,36px);font-weight:800;color:#fff;margin-bottom:12px;position:relative;z-index:1;">${b.headline || ''}</h2>
        <p style="font-size:16px;color:rgba(255,255,255,.85);margin-bottom:32px;position:relative;z-index:1;">${b.subheadline || ''}</p>
        <a href="${b.ctaUrl || '#'}" style="display:inline-flex;padding:14px 36px;background:#fff;color:${t.primary};border-radius:12px;font-weight:700;font-size:15px;position:relative;z-index:1;transition:all .2s;">${b.ctaLabel || 'Bắt đầu'}</a>
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
            { icon: '📞', label: 'Điện thoại', value: b.phone },
            { icon: '📍', label: 'Địa chỉ', value: b.address },
        ].filter(c => c.value).map((c, i) => `
            <div class="fade-up fade-up-d${i + 2}" style="display:flex;align-items:center;gap:16px;padding:16px;background:${t.text}04;border-radius:12px;">
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
        <button class="btn-primary" style="width:100%;">Gửi tin nhắn</button>
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
