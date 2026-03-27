/**
 * Navigation renderers — 5 distinct styles per industry.
 */
import { TemplateTheme } from './styles'

export function renderNav(block: any, t: TemplateTheme): string {
    const links = (block.links || []).map((l: any) => `<a href="${l.url || '#'}">${l.label}</a>`).join('')
    const cta = block.ctaButton?.show !== false ? `<a href="${block.ctaButton?.url || '#'}" class="nav-cta">${block.ctaButton?.label || 'Contact'}</a>` : ''

    const logoText = block.logoText || 'Logo'
    const logoImage = block.logo?.url
        ? `<img src="${block.logo.url}" alt="${logoText}" style="height:32px;width:auto;object-fit:contain;" />`
        : null

    switch (t.navStyle) {
        case 'transparent': return navTransparent(logoText, logoImage, links, cta, t)
        case 'sticky-dark': return navStickyDark(logoText, logoImage, links, cta, t)
        case 'centered-logo': return navCenteredLogo(logoText, logoImage, links, cta, t)
        case 'minimal': return navMinimal(logoText, logoImage, links, cta, t)
        case 'classic': return navClassic(logoText, logoImage, links, cta, t)
        default: return navClassic(logoText, logoImage, links, cta, t)
    }
}

function navTransparent(logo: string, logoImage: string | null, links: string, cta: string, t: TemplateTheme) {
    return `<nav style="position:absolute;top:0;left:0;right:0;z-index:100;padding:20px 0;">
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;">
      <div style="font-family:'${t.fontHeading}',serif;font-size:24px;font-weight:700;color:${t.primary};display:flex;align-items:center;">${logoImage || logo}</div>
      <div style="display:flex;gap:32px;align-items:center;" class="hide-mobile">
        <div style="display:flex;gap:28px;font-size:14px;font-weight:500;opacity:.85;">${links}</div>
        ${cta}
      </div>
    </div>
  </nav>
  <style>
    .nav-cta { padding:10px 24px; background:${t.primary}; color:#fff !important; border-radius:8px; font-size:13px; font-weight:600; transition:all .2s; }
    .nav-cta:hover { transform:translateY(-1px); box-shadow:0 6px 20px ${t.primary}50; }
    nav a { color: ${t.text}; }
  </style>`
}

function navStickyDark(logo: string, logoImage: string | null, links: string, cta: string, t: TemplateTheme) {
    const isDark = t.bg.startsWith('#0') || t.bg.startsWith('#1')
    const navBg = isDark ? 'rgba(15,15,20,.92)' : 'rgba(255,255,255,.95)'
    const navText = isDark ? '#fff' : '#111'
    return `<nav style="position:sticky;top:0;z-index:100;background:${navBg};backdrop-filter:blur(20px);border-bottom:1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'};padding:0;">
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;height:64px;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${logoImage ? logoImage : `<div style="width:32px;height:32px;background:linear-gradient(135deg,${t.primary},${t.secondary});border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;">${logo.charAt(0)}</div>`}
        <span style="font-weight:700;font-size:17px;color:${navText};">${logo}</span>
      </div>
      <div style="display:flex;gap:28px;align-items:center;" class="hide-mobile">
        <div style="display:flex;gap:24px;font-size:13px;font-weight:500;color:${isDark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.6)'};">${links}</div>
        ${cta}
      </div>
    </div>
  </nav>
  <style>
    .nav-cta { padding:8px 20px; background:${t.primary}; color:#fff !important; border-radius:8px; font-size:13px; font-weight:600; }
    nav a:hover { color: ${t.primary} !important; }
  </style>`
}

function navCenteredLogo(logo: string, logoImage: string | null, links: string, cta: string, t: TemplateTheme) {
    return `<nav style="padding:24px 0;border-bottom:1px solid ${t.text}10;">
    <div class="container" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
      <div style="font-family:'${t.fontHeading}',serif;font-size:30px;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:${t.primary};display:flex;align-items:center;justify-content:center;">${logoImage || logo}</div>
      <div style="display:flex;gap:32px;align-items:center;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${t.muted};" class="hide-mobile">
        ${links} ${cta}
      </div>
    </div>
  </nav>
  <style>
    .nav-cta { padding:8px 24px; border:1.5px solid ${t.primary}; color:${t.primary} !important; border-radius:24px; font-size:11px; letter-spacing:1px; }
    nav a:hover { color: ${t.primary} !important; }
  </style>`
}

function navMinimal(logo: string, logoImage: string | null, links: string, cta: string, t: TemplateTheme) {
    return `<nav style="padding:20px 0;">
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:800;font-size:20px;letter-spacing:-0.5px;display:flex;align-items:center;gap:10px;">${logoImage || `${logo}<span style="color:${t.primary};">.</span>`}</div>
      <div style="display:flex;gap:24px;align-items:center;" class="hide-mobile">
        <div style="display:flex;gap:20px;font-size:14px;color:${t.muted};">${links}</div>
        ${cta}
      </div>
    </div>
  </nav>
  <style>
    .nav-cta { padding:10px 20px; background:${t.text}; color:${t.bg} !important; border-radius:100px; font-size:13px; font-weight:600; }
    nav a:hover { color: ${t.text} !important; }
  </style>`
}

function navClassic(logo: string, logoImage: string | null, links: string, cta: string, t: TemplateTheme) {
    return `<nav style="background:${t.bg};box-shadow:0 1px 3px rgba(0,0,0,.08);padding:0;">
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;height:68px;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${logoImage ? logoImage : `<div style="width:36px;height:36px;background:${t.primary};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px;">+</div>`}
        <span style="font-weight:700;font-size:18px;">${logo}</span>
      </div>
      <div style="display:flex;gap:28px;align-items:center;" class="hide-mobile">
        <div style="display:flex;gap:28px;font-size:14px;font-weight:500;color:${t.muted};">${links}</div>
        ${cta}
      </div>
    </div>
  </nav>
  <style>
    .nav-cta { padding:10px 24px; background:${t.primary}; color:#fff !important; border-radius:8px; font-size:14px; font-weight:600; }
  </style>`
}
