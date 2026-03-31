/**
 * Hero renderers — 9 distinct styles with REAL images.
 * Uses curated Unsplash photos per industry for premium visual quality.
 */
import { TemplateTheme } from './styles'
import { getHeroImage } from './images'

// Category is injected at render time
export type RenderHeroBlock = Record<string, unknown> & {
  headline?: string;
  subheadline?: string;
  ctaButtons?: { label?: string; url?: string; style?: string }[];
  variant?: string;
  image?: { url?: string; alt?: string };
  alignment?: string;
  fullWidth?: boolean;
  showRating?: boolean;
  extraText?: string;
  smallText?: string;
  tags?: string;
  highlightText?: string;
}

let _category = 'business'
export function setHeroCategory(cat: string) { _category = cat }

export function renderHero(block: RenderHeroBlock, t: TemplateTheme, category?: string): string {
  if (category) _category = category
  const h = block.headline || ''
  const sub = block.subheadline || ''
  const ctas = block.ctaButtons || []
  const btn1 = ctas[0] ? `<a href="${ctas[0].url || '#'}" class="btn-primary">${ctas[0].label}</a>` : ''
  const btn2 = ctas[1] ? `<a href="${ctas[1].url || '#'}" class="btn-outline">${ctas[1].label}</a>` : ''

  switch (t.heroStyle) {
    case 'split': return heroSplit(h, sub, btn1, btn2, t)
    case 'slider': return heroSlider(h, sub, btn1, btn2, t)
    case 'video-bg': return heroVideoBg(h, sub, btn1, btn2, t)
    case 'gradient-mockup': return heroGradientMockup(h, sub, btn1, btn2, t)
    case 'centered': return heroCentered(h, sub, btn1, btn2, t)
    case 'fullscreen-search': return heroFullscreenSearch(h, sub, btn1, btn2, t)
    case 'diagonal': return heroDiagonal(h, sub, btn1, btn2, t)
    case 'masonry': return heroMasonry(h, sub, btn1, btn2, t)
    case 'geometric': return heroGeometric(h, sub, btn1, btn2, t)
    default: return heroCentered(h, sub, btn1, btn2, t)
  }
}

function heroSplit(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr;position:relative;overflow:hidden;">
    <div style="display:flex;flex-direction:column;justify-content:center;padding:80px 60px 80px 80px;position:relative;z-index:2;">
      <div class="fade-up" style="font-size:13px;font-weight:600;color:${t.primary};text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;">✨ Welcome</div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,4.5vw,56px);font-weight:800;line-height:1.08;margin-bottom:24px;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:17px;color:${t.muted};line-height:1.7;margin-bottom:36px;max-width:480px;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;">${btn1} ${btn2}</div>
    </div>
    <div style="position:relative;overflow:hidden;" class="hide-mobile">
      <img src="${img}" alt="Hero" loading="eager" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" />
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,${t.bg} 0%,transparent 30%);"></div>
    </div>
  </section>`
}

function heroSlider(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="position:relative;min-height:90vh;overflow:hidden;">
    <img src="${img}" alt="Hero Background" loading="eager" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,${t.bg}e6 40%,${t.bg}80 100%);"></div>
    <div class="container" style="display:flex;align-items:center;min-height:90vh;position:relative;z-index:2;">
      <div style="max-width:600px;">
        <div class="fade-up" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:100px;background:${t.primary}20;color:${t.primary};font-size:13px;font-weight:600;margin-bottom:24px;backdrop-filter:blur(10px);">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.primary};animation:pulse 2s infinite;"></span> NEW COLLECTION
        </div>
        <h1 class="fade-up fade-up-d1" style="font-size:clamp(40px,5vw,64px);font-weight:800;line-height:1.05;margin-bottom:20px;">${h}</h1>
        <p class="fade-up fade-up-d2" style="font-size:18px;color:${t.muted};margin-bottom:36px;max-width:500px;">${sub}</p>
        <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:40px;">${btn1} ${btn2}</div>
        <div class="fade-up fade-up-d4" style="display:flex;gap:24px;">
          ${['🚚 Free Shipping', '🔄 Easy Returns', '✅ Authentic'].map(i => `<span style="font-size:13px;color:${t.muted};display:flex;align-items:center;gap:4px;">${i}</span>`).join('')}
        </div>
      </div>
    </div>
  </section>`
}

function heroVideoBg(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="position:relative;min-height:85vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;">
    <img src="${img}" alt="Hero Background" loading="eager" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${t.bg}cc,${t.bg}e6);"></div>
    <div class="container" style="position:relative;z-index:2;max-width:700px;">
      <div class="fade-up" style="font-size:12px;font-weight:600;color:${t.primary};letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;">✦ Premium Experience ✦</div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,5vw,58px);font-weight:300;line-height:1.15;margin-bottom:24px;letter-spacing:-0.01em;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:17px;color:${t.muted};margin-bottom:40px;max-width:500px;margin-left:auto;margin-right:auto;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">${btn1} ${btn2}</div>
    </div>
  </section>`
}

function heroGradientMockup(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="position:relative;min-height:100vh;overflow:hidden;display:flex;align-items:center;">
    <div style="position:absolute;top:-200px;right:-150px;width:600px;height:600px;border-radius:50%;background:${t.primary};filter:blur(150px);opacity:.12;"></div>
    <div style="position:absolute;bottom:-200px;left:-150px;width:500px;height:500px;border-radius:50%;background:${t.accent};filter:blur(120px);opacity:.08;"></div>
    <div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;position:relative;z-index:2;">
      <div>
        <div class="fade-up" style="display:inline-flex;padding:6px 14px;border-radius:6px;background:${t.primary}15;color:${t.accent};font-size:12px;font-weight:600;margin-bottom:20px;">🚀 New Release</div>
        <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,4.5vw,54px);font-weight:800;margin-bottom:20px;background:linear-gradient(135deg,${t.text},${t.accent});-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${h}</h1>
        <p class="fade-up fade-up-d2" style="font-size:17px;color:${t.muted};margin-bottom:36px;max-width:480px;">${sub}</p>
        <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;">${btn1} ${btn2}</div>
        <div class="fade-up fade-up-d4" style="display:flex;gap:24px;margin-top:40px;">
          ${['500+ Clients', '99.9% Uptime', '24/7 Support'].map(s => `<div style="text-align:left;"><div style="font-size:20px;font-weight:800;color:${t.accent};">${s.split(' ')[0]}</div><div style="font-size:11px;color:${t.muted};">${s.split(' ').slice(1).join(' ')}</div></div>`).join('')}
        </div>
      </div>
      <div style="position:relative;" class="hide-mobile">
        <div style="width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.25);border:1px solid ${t.primary}20;">
          <img src="${img}" alt="Product Preview" loading="eager" style="width:100%;height:100%;object-fit:cover;" />
        </div>
        <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:${t.primary}15;animation:float 3s ease-in-out infinite;"></div>
        <div style="position:absolute;bottom:-15px;left:-15px;width:60px;height:60px;border-radius:12px;background:${t.accent}10;animation:float 5s ease-in-out infinite;"></div>
      </div>
    </div>
  </section>`
}

function heroCentered(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  const isDark = t.bg.startsWith('#0') || t.bg.startsWith('#1')
  return `<section style="position:relative;min-height:85vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;">
    <img src="${img}" alt="Hero Background" loading="eager" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.15;" />
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 30%,${t.bg} 80%);"></div>
    <div class="container" style="position:relative;z-index:2;max-width:800px;">
      <div class="fade-up" style="display:inline-flex;padding:8px 20px;border-radius:100px;background:${isDark ? t.primary + '15' : t.primary + '10'};color:${t.primary};font-size:13px;font-weight:600;margin-bottom:24px;gap:8px;align-items:center;backdrop-filter:blur(10px);">
        <span style="width:6px;height:6px;border-radius:50%;background:${t.primary};"></span> Trusted Choice
      </div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,5vw,60px);font-weight:800;margin-bottom:20px;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:18px;color:${t.muted};margin-bottom:40px;max-width:580px;margin-left:auto;margin-right:auto;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">${btn1} ${btn2}</div>
    </div>
  </section>`
}

function heroFullscreenSearch(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;">
    <img src="${img}" alt="Hero Background" loading="eager" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,${t.bg}dd 0%,${t.bg}ee 100%);"></div>
    <div class="container" style="position:relative;z-index:2;">
      <h1 class="fade-up" style="font-size:clamp(40px,5.5vw,68px);font-weight:800;margin-bottom:16px;">${h}</h1>
      <p class="fade-up fade-up-d1" style="font-size:18px;color:${t.muted};margin-bottom:40px;max-width:560px;margin-left:auto;margin-right:auto;">${sub}</p>
      <div class="fade-up fade-up-d2" style="max-width:700px;margin:0 auto 40px;background:${t.text}08;border:1px solid ${t.text}10;border-radius:16px;padding:8px;display:flex;gap:8px;flex-wrap:wrap;backdrop-filter:blur(10px);">
        <input type="text" placeholder="🔍 Search projects, areas..." style="flex:1;min-width:200px;border:none;background:transparent;padding:14px 16px;color:${t.text};font-size:15px;outline:none;" />
        <select style="padding:14px 16px;border:none;background:${t.primary}10;color:${t.primary};border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
          <option>Property Type</option><option>Apartment</option><option>Villa</option><option>Land</option>
        </select>
        <button style="padding:14px 28px;background:${t.primary};color:#fff;border:none;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;">Search</button>
      </div>
      <div class="fade-up fade-up-d3" style="display:flex;gap:32px;justify-content:center;flex-wrap:wrap;">
        ${['200+ Projects', '10,000+ Clients', '15 Years Experience'].map(s => `<span style="font-size:13px;color:${t.muted};">✓ ${s}</span>`).join('')}
      </div>
    </div>
  </section>`
}

function heroDiagonal(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="position:relative;min-height:100vh;overflow:hidden;">
    <img src="${img}" alt="Hero Background" loading="eager" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.7),rgba(0,0,0,.4));"></div>
    <div class="container" style="position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;min-height:100vh;padding-top:100px;">
      <div>
        <div class="fade-up" style="display:inline-block;padding:6px 16px;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:100px;font-size:12px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;">💪 TRANSFORM YOUR LIFE</div>
        <h1 class="fade-up fade-up-d1" style="font-size:clamp(42px,5vw,72px);font-weight:900;color:#fff;line-height:1.0;text-transform:uppercase;margin-bottom:20px;">${h}</h1>
        <p class="fade-up fade-up-d2" style="font-size:17px;color:rgba(255,255,255,.8);margin-bottom:36px;max-width:460px;">${sub}</p>
        <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;">
          ${btn1.replace('btn-primary', 'btn-primary')} ${btn2.replace('btn-outline', 'btn-outline')}
        </div>
      </div>
      <div style="position:relative;" class="hide-mobile">
        <div style="width:300px;height:380px;border-radius:24px;background:rgba(255,255,255,.1);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.2);margin-left:auto;padding:30px;display:flex;flex-direction:column;gap:16px;animation:float 4s ease-in-out infinite;">
          ${['💪 Gym 500m²', '🧘 Yoga Studio', '🏊 Swimming Pool', '🧖 Spa & Sauna'].map((item, i) => `<div style="padding:14px 18px;background:rgba(255,255,255,.1);border-radius:12px;font-size:14px;font-weight:600;color:#fff;animation:slideIn .5s ease both;animation-delay:${i * .1}s;">${item}</div>`).join('')}
        </div>
      </div>
    </div>
  </section>`
}

function heroMasonry(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  const img2 = getHeroImage(_category, 1)
  const img3 = getHeroImage(_category, 2)
  return `<section style="min-height:90vh;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;">
    <div style="display:flex;flex-direction:column;justify-content:center;padding:80px 60px;">
      <div class="fade-up" style="font-size:13px;font-weight:700;color:${t.primary};text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Portfolio</div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,4vw,52px);font-weight:800;margin-bottom:20px;line-height:1.08;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:16px;color:${t.muted};margin-bottom:36px;max-width:440px;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;">${btn1} ${btn2}</div>
      <div class="fade-up fade-up-d4" style="display:flex;gap:20px;margin-top:48px;">
        ${['150+ Projects', '80+ Clients', '8 Years Exp'].map(s => {
    const [val, ...rest] = s.split(' ')
    return `<div><div style="font-size:22px;font-weight:800;color:${t.primary};">${val}</div><div style="font-size:11px;color:${t.muted};">${rest.join(' ')}</div></div>`
  }).join('')}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr 1fr;gap:8px;padding:20px 20px 20px 0;" class="hide-mobile">
      <div style="grid-row:1/3;border-radius:12px;overflow:hidden;"><img src="${img}" alt="Project 1" style="width:100%;height:100%;object-fit:cover;" /></div>
      <div style="border-radius:12px;overflow:hidden;"><img src="${img2}" alt="Project 2" style="width:100%;height:100%;object-fit:cover;" /></div>
      <div style="border-radius:12px;overflow:hidden;"><img src="${img3}" alt="Project 3" style="width:100%;height:100%;object-fit:cover;" /></div>
      <div style="grid-column:1/3;border-radius:12px;overflow:hidden;"><img src="${img}" alt="Project 4" style="width:100%;height:100%;object-fit:cover;" /></div>
    </div>
  </section>`
}

function heroGeometric(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const img = getHeroImage(_category, 0)
  return `<section style="position:relative;min-height:85vh;display:flex;align-items:center;overflow:hidden;">
    <div style="position:absolute;right:0;top:0;bottom:0;width:45%;overflow:hidden;" class="hide-mobile">
      <img src="${img}" alt="Hero" loading="eager" style="width:100%;height:100%;object-fit:cover;" />
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,${t.bg} 0%,transparent 40%);"></div>
    </div>
    <div class="container" style="position:relative;z-index:2;display:grid;grid-template-columns:1.1fr .9fr;gap:60px;align-items:center;">
      <div>
        <div class="fade-up" style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border:1px solid ${t.primary}30;border-radius:6px;font-size:12px;font-weight:600;color:${t.primary};margin-bottom:24px;">⭐ Trusted Partner</div>
        <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,4.5vw,52px);font-weight:800;margin-bottom:20px;">${h}</h1>
        <p class="fade-up fade-up-d2" style="font-size:17px;color:${t.muted};margin-bottom:36px;max-width:500px;">${sub}</p>
        <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:40px;">${btn1} ${btn2}</div>
        <div class="fade-up fade-up-d4" style="display:flex;gap:4px;">
          ${[1, 2, 3, 4].map(() => `<div style="width:40px;height:40px;border-radius:50%;background:${t.primary}15;border:2px solid ${t.bg};margin-left:-8px;display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>`).join('')}
          <span style="margin-left:8px;font-size:13px;color:${t.muted};display:flex;align-items:center;">100+ Partners</span>
        </div>
      </div>
      <div class="hide-mobile"></div>
    </div>
  </section>`
}
