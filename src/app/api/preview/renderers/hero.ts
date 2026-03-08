/**
 * Hero renderers — 9 distinct styles for visual diversity.
 */
import { TemplateTheme } from './styles'

export function renderHero(block: any, t: TemplateTheme): string {
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
  return `<section style="min-height:100vh;display:grid;grid-template-columns:1fr 1fr;position:relative;overflow:hidden;">
    <div style="display:flex;flex-direction:column;justify-content:center;padding:80px 60px 80px 80px;position:relative;z-index:2;">
      <div class="fade-up" style="font-size:13px;font-weight:600;color:${t.primary};text-transform:uppercase;letter-spacing:2px;margin-bottom:20px;">✨ Welcome</div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,4.5vw,56px);font-weight:800;line-height:1.08;margin-bottom:24px;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:17px;color:${t.muted};line-height:1.7;margin-bottom:36px;max-width:480px;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;">${btn1} ${btn2}</div>
    </div>
    <div style="position:relative;background:linear-gradient(135deg,${t.primary}15,${t.secondary}25);display:flex;align-items:center;justify-content:center;">
      <div style="width:320px;height:400px;border-radius:24px;background:linear-gradient(160deg,${t.primary}30,${t.secondary}50);box-shadow:0 40px 80px ${t.primary}20;display:flex;align-items:center;justify-content:center;animation:float 4s ease-in-out infinite;">
        <div style="font-size:80px;opacity:.6;">🏪</div>
      </div>
      <div style="position:absolute;top:20%;left:10%;width:80px;height:80px;border-radius:50%;background:${t.primary}15;animation:float 3s ease-in-out infinite;"></div>
      <div style="position:absolute;bottom:25%;right:15%;width:60px;height:60px;border-radius:16px;background:${t.accent}20;animation:float 5s ease-in-out infinite;"></div>
    </div>
  </section>`
}

function heroSlider(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  return `<section style="position:relative;min-height:90vh;background:linear-gradient(135deg,${t.bg},${t.primary}08);overflow:hidden;">
    <div style="position:absolute;top:-100px;right:-100px;width:500px;height:500px;border-radius:50%;background:${t.primary}10;filter:blur(80px);"></div>
    <div class="container" style="display:flex;align-items:center;min-height:90vh;position:relative;z-index:2;">
      <div style="max-width:600px;">
        <div class="fade-up" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:100px;background:${t.primary}12;color:${t.primary};font-size:13px;font-weight:600;margin-bottom:24px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.primary};animation:pulse 2s infinite;"></span> HOT SALE
        </div>
        <h1 class="fade-up fade-up-d1" style="font-size:clamp(40px,5vw,64px);font-weight:800;line-height:1.05;margin-bottom:20px;">${h}</h1>
        <p class="fade-up fade-up-d2" style="font-size:18px;color:${t.muted};margin-bottom:36px;max-width:500px;">${sub}</p>
        <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:40px;">${btn1} ${btn2}</div>
        <div class="fade-up fade-up-d4" style="display:flex;gap:24px;">
          ${['🚚 Free Shipping', '🔄 30-Day Returns', '✅ 100% Authentic'].map(i => `<span style="font-size:13px;color:${t.muted};display:flex;align-items:center;gap:4px;">${i}</span>`).join('')}
        </div>
      </div>
      <div style="position:absolute;right:60px;top:50%;transform:translateY(-50%);display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="hide-mobile">
        ${[1, 2, 3, 4].map(i => `<div style="width:180px;height:220px;border-radius:16px;background:linear-gradient(${45 + i * 30}deg,${t.primary}${15 + i * 5},${t.secondary}${20 + i * 5});display:flex;align-items:end;padding:16px;animation:fadeUp .7s ease both;animation-delay:${i * .15}s;">
          <span style="font-size:12px;font-weight:600;color:#fff;opacity:.8;">Product ${i}</span>
        </div>`).join('')}
      </div>
    </div>
  </section>`
}

function heroVideoBg(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  return `<section style="position:relative;min-height:85vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;background:linear-gradient(180deg,${t.primary}08,${t.bg});">
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,${t.primary}20,${t.secondary}15);"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:700px;border-radius:50%;border:1px solid ${t.primary}15;animation:pulse 4s infinite;"></div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;border-radius:50%;border:1px solid ${t.primary}10;animation:pulse 4s infinite .5s;"></div>
    <div class="container" style="position:relative;z-index:2;max-width:700px;">
      <div class="fade-up" style="font-size:12px;font-weight:600;color:${t.primary};letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;">✦ Premium Beauty Experience ✦</div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,5vw,58px);font-weight:300;line-height:1.15;margin-bottom:24px;letter-spacing:-0.01em;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:17px;color:${t.muted};margin-bottom:40px;max-width:500px;margin-left:auto;margin-right:auto;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">${btn1} ${btn2}</div>
    </div>
  </section>`
}

function heroGradientMockup(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  return `<section style="position:relative;min-height:100vh;overflow:hidden;display:flex;align-items:center;">
    <div style="position:absolute;top:-200px;right:-150px;width:600px;height:600px;border-radius:50%;background:${t.primary};filter:blur(150px);opacity:.15;"></div>
    <div style="position:absolute;bottom:-200px;left:-150px;width:500px;height:500px;border-radius:50%;background:${t.accent};filter:blur(120px);opacity:.1;"></div>
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
        <div style="width:100%;aspect-ratio:4/3;border-radius:16px;background:linear-gradient(135deg,${t.primary}20,${t.secondary}30);border:1px solid ${t.primary}20;box-shadow:0 30px 60px ${t.primary}15;padding:20px;animation:float 5s ease-in-out infinite;">
          <div style="width:100%;height:24px;border-radius:8px 8px 0 0;background:${t.bg};display:flex;align-items:center;gap:6px;padding:0 10px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>
            <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
            <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>
          </div>
          <div style="background:${t.bg}80;height:calc(100% - 24px);border-radius:0 0 8px 8px;padding:16px;display:grid;grid-template-rows:1fr 1fr;gap:8px;">
            <div style="background:linear-gradient(90deg,${t.primary}15,${t.secondary}10);border-radius:8px;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
              ${[1, 2, 3].map(() => `<div style="background:${t.primary}10;border-radius:6px;"></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`
}

function heroCentered(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  const isDark = t.bg.startsWith('#0') || t.bg.startsWith('#1')
  return `<section style="position:relative;min-height:85vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;">
    <div style="position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:800px;height:400px;border-radius:50%;background:${t.primary};filter:blur(200px);opacity:.08;"></div>
    <div class="container" style="position:relative;z-index:2;max-width:800px;">
      <div class="fade-up" style="display:inline-flex;padding:8px 20px;border-radius:100px;background:${isDark ? t.primary + '15' : t.primary + '10'};color:${t.primary};font-size:13px;font-weight:600;margin-bottom:24px;gap:8px;align-items:center;">
        <span style="width:6px;height:6px;border-radius:50%;background:${t.primary};"></span> Trusted Choice
      </div>
      <h1 class="fade-up fade-up-d1" style="font-size:clamp(36px,5vw,60px);font-weight:800;margin-bottom:20px;">${h}</h1>
      <p class="fade-up fade-up-d2" style="font-size:18px;color:${t.muted};margin-bottom:40px;max-width:580px;margin-left:auto;margin-right:auto;">${sub}</p>
      <div class="fade-up fade-up-d3" style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">${btn1} ${btn2}</div>
    </div>
  </section>`
}

function heroFullscreenSearch(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  return `<section style="position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;background:linear-gradient(180deg,${t.bg},${t.primary}08);">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,${t.primary}10);"></div>
    <div style="position:absolute;top:10%;right:10%;width:300px;height:300px;border-radius:50%;background:${t.primary};filter:blur(150px);opacity:.08;"></div>
    <div class="container" style="position:relative;z-index:2;">
      <h1 class="fade-up" style="font-size:clamp(40px,5.5vw,68px);font-weight:800;margin-bottom:16px;">${h}</h1>
      <p class="fade-up fade-up-d1" style="font-size:18px;color:${t.muted};margin-bottom:40px;max-width:560px;margin-left:auto;margin-right:auto;">${sub}</p>
      <div class="fade-up fade-up-d2" style="max-width:700px;margin:0 auto 40px;background:${t.text}08;border:1px solid ${t.text}10;border-radius:16px;padding:8px;display:flex;gap:8px;flex-wrap:wrap;">
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
  return `<section style="position:relative;min-height:100vh;overflow:hidden;">
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,${t.primary},${t.secondary});clip-path:polygon(0 0,100% 0,100% 65%,0 85%);"></div>
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(0,0,0,.3),rgba(0,0,0,.1));clip-path:polygon(0 0,100% 0,100% 65%,0 85%);"></div>
    <div class="container" style="position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;min-height:100vh;padding-top:100px;">
      <div>
        <div class="fade-up" style="display:inline-block;padding:6px 16px;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);border-radius:100px;font-size:12px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;">💪 TRANSFORM YOUR BODY</div>
        <h1 class="fade-up fade-up-d1" style="font-size:clamp(42px,5vw,72px);font-weight:900;color:#fff;line-height:1.0;text-transform:uppercase;margin-bottom:20px;">${h}</h1>
        <p class="fade-up fade-up-d2" style="font-size:17px;color:rgba(255,255,255,.8);margin-bottom:36px;max-width:460px;">${sub}</p>
        <div class="fade-up fade-up-d3" style="display:flex;gap:14px;flex-wrap:wrap;">
          ${btn1.replace(`background:${t.primary}`, 'background:#fff;color:#111')}
          ${btn2.replace(`color:${t.text}`, 'color:#fff').replace(`border:2px solid ${t.muted}40`, 'border:2px solid rgba(255,255,255,.4)')}
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
      ${[
      { span: 'grid-row:1/3', bg: `linear-gradient(135deg,${t.primary}20,${t.secondary}30)` },
      { span: '', bg: `linear-gradient(135deg,${t.accent}20,${t.primary}15)` },
      { span: '', bg: `linear-gradient(135deg,${t.secondary}25,${t.primary}10)` },
      { span: 'grid-column:1/3', bg: `linear-gradient(90deg,${t.primary}10,${t.accent}15)` },
    ].map((item, i) => `<div style="${item.span};background:${item.bg};border-radius:12px;animation:fadeUp .7s ease both;animation-delay:${i * .1}s;display:flex;align-items:end;padding:16px;">
        <span style="font-size:12px;font-weight:600;color:${t.muted};">Project ${i + 1}</span>
      </div>`).join('')}
    </div>
  </section>`
}

function heroGeometric(h: string, sub: string, btn1: string, btn2: string, t: TemplateTheme) {
  return `<section style="position:relative;min-height:85vh;display:flex;align-items:center;overflow:hidden;">
    <div style="position:absolute;right:0;top:0;bottom:0;width:45%;background:${t.primary};clip-path:polygon(15% 0,100% 0,100% 100%,0 100%);opacity:.06;" class="hide-mobile"></div>
    <div style="position:absolute;right:5%;top:15%;width:200px;height:200px;border:2px solid ${t.primary}20;border-radius:50%;animation:pulse 4s infinite;" class="hide-mobile"></div>
    <div style="position:absolute;right:15%;bottom:20%;width:100px;height:100px;border:2px solid ${t.primary}15;transform:rotate(45deg);animation:float 5s ease-in-out infinite;" class="hide-mobile"></div>
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="hide-mobile">
        ${[{ n: '100+', l: 'Clients', icon: '👥' }, { n: '10+', l: 'Years', icon: '📅' }, { n: '500+', l: 'Projects', icon: '📊' }, { n: '99%', l: 'Satisfied', icon: '⭐' }].map((s, i) =>
    `<div style="padding:28px 20px;background:${t.text}06;border:1px solid ${t.text}08;border-radius:16px;text-align:center;animation:fadeUp .6s ease both;animation-delay:${i * .1}s;">
            <div style="font-size:28px;margin-bottom:8px;">${s.icon}</div>
            <div style="font-size:28px;font-weight:800;color:${t.primary};margin-bottom:4px;">${s.n}</div>
            <div style="font-size:12px;color:${t.muted};">${s.l}</div>
          </div>`
  ).join('')}
      </div>
    </div>
  </section>`
}
