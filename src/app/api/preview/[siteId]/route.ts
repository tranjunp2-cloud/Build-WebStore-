import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/preview/[siteId]
 * Generates premium HTML for the site's homepage.
 * Returns standalone HTML with modern CSS — gradients, glassmorphism, animations.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const payload = await getPayload({ config })

    const site = await payload.findByID({ collection: 'sites', id: siteId })
    if (!site) return new NextResponse('Site not found', { status: 404 })

    const numericSiteId = Number(siteId)
    let pagesResult = await payload.find({
      collection: 'pages',
      where: { site: { equals: numericSiteId }, isHomepage: { equals: true } },
      limit: 1,
    })
    if (pagesResult.docs.length === 0) {
      pagesResult = await payload.find({
        collection: 'pages',
        where: { site: { equals: numericSiteId } },
        limit: 1,
      })
    }

    const page = pagesResult.docs[0]
    if (!page) return new NextResponse('Homepage not found', { status: 404 })

    const theme = {
      primaryColor: (site as any).theme?.primaryColor || '#3B82F6',
      secondaryColor: (site as any).theme?.secondaryColor || '#8B5CF6',
      fontHeading: (site as any).theme?.fontHeading || 'Outfit',
      fontBody: (site as any).theme?.fontBody || 'Inter',
      colorMode: (site as any).theme?.colorMode || 'dark',
    }

    const blocks: any[] = (page as any).layout || []
    const html = buildFullHTML(site.name || 'Preview', blocks, theme)

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  } catch (error: any) {
    console.error('[Preview Error]', error)
    return new NextResponse(`<html><body style="background:#09090b;color:#fff;font-family:sans-serif;padding:4rem;text-align:center"><h1>Error</h1><p>${error.message}</p></body></html>`, {
      status: 500, headers: { 'Content-Type': 'text/html' },
    })
  }
}

// ─── Shared HTML builder (exported for template preview) ───────────────
export function buildFullHTML(title: string, blocks: any[], theme: any): string {
  const isDark = theme.colorMode === 'dark'
  const bg = isDark ? '#09090b' : '#fafafa'
  const text = isDark ? '#fafafa' : '#171717'
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const p = theme.primaryColor
  const s = theme.secondaryColor

  const blocksHtml = blocks.map(b => renderBlock(b, theme, { isDark, bg, text, muted, cardBg, border, p, s })).join('\n')

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${theme.fontHeading.replace(/ /g, '+')}:wght@400;600;700;900&family=${theme.fontBody.replace(/ /g, '+')}:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root { --p: ${p}; --s: ${s}; --bg: ${bg}; --text: ${text}; --muted: ${muted}; --card: ${cardBg}; --border: ${border}; --fh: '${theme.fontHeading}', sans-serif; --fb: '${theme.fontBody}', sans-serif; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: var(--fb); background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
    h1, h2, h3, h4 { font-family: var(--fh); line-height: 1.2; }
    .mx { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
    img { max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.875rem 2rem; border-radius: 0.875rem; font-weight: 600; font-size: 0.9375rem; transition: all 0.3s ease; cursor: pointer; border: none; font-family: var(--fb); }
    .btn-p { background: linear-gradient(135deg, var(--p), var(--s)); color: #fff; box-shadow: 0 4px 20px ${p}40; }
    .btn-p:hover { transform: translateY(-2px); box-shadow: 0 8px 30px ${p}50; }
    .btn-o { border: 2px solid ${p}60; color: var(--p); background: transparent; }
    .btn-o:hover { background: ${p}15; border-color: var(--p); }

    /* Inputs */
    input, textarea, select { width: 100%; padding: 0.875rem 1.125rem; border-radius: 0.75rem; border: 1.5px solid var(--border); background: var(--card); color: var(--text); font-family: var(--fb); font-size: 0.875rem; transition: border 0.2s, box-shadow 0.2s; }
    input:focus, textarea:focus { outline: none; border-color: var(--p); box-shadow: 0 0 0 3px ${p}20; }

    /* Label badge */
    .label { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 1rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; background: ${p}15; color: var(--p); border: 1px solid ${p}30; }

    /* Glass card */
    .glass { background: var(--card); border: 1px solid var(--border); border-radius: 1.25rem; transition: all 0.3s ease; }
    .glass:hover { border-color: ${p}30; transform: translateY(-4px); box-shadow: 0 12px 40px ${p}08; }

    /* Section spacing */
    .sec { padding: 6rem 0; position: relative; }

    /* Gradient blob */
    .blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.12; pointer-events: none; }

    /* Animations */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .anim { animation: fadeInUp 0.8s ease both; }
    .anim-d1 { animation-delay: 0.1s; } .anim-d2 { animation-delay: 0.2s; } .anim-d3 { animation-delay: 0.3s; } .anim-d4 { animation-delay: 0.4s; }

    /* Grid helpers */
    .g2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
    .g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
    @media (max-width: 768px) { .g2, .g3, .g4 { grid-template-columns: 1fr; } }

    /* Stars */
    .stars { color: var(--p); letter-spacing: 2px; }
  </style>
</head>
<body>
${blocksHtml}
</body>
</html>`
}

// ─── Block Router ──────────────────────────────────────────────────────
function renderBlock(b: any, t: any, c: any): string {
  const r: Record<string, (b: any, t: any, c: any) => string> = {
    navigation: renderNav, hero: renderHero, about: renderAbout,
    features: renderFeatures, testimonials: renderTestimonials,
    contact: renderContact, gallery: renderGallery, footer: renderFooter,
    stats: renderStats, pricing: renderPricing, faq: renderFaq,
    team: renderTeam, cta: renderCTA,
  }
  return (r[b.blockType] || (() => ''))(b, t, c)
}

// ─── Navigation ────────────────────────────────────────────────────────
function renderNav(b: any, t: any, c: any): string {
  const links = (b.links || []).map((l: any) =>
    `<a href="${l.url}" style="font-size:0.875rem;font-weight:500;color:${c.muted};transition:color 0.2s" onmouseover="this.style.color='${c.text}'" onmouseout="this.style.color='${c.muted}'">${l.label}</a>`
  ).join('')
  const cta = b.ctaButton?.show
    ? `<a href="${b.ctaButton.url || '#'}" class="btn btn-p" style="padding:0.625rem 1.5rem;font-size:0.8125rem;border-radius:9999px">${b.ctaButton.label}</a>`
    : ''
  return `<nav style="position:sticky;top:0;z-index:50;border-bottom:1px solid ${c.border};background:${c.isDark ? 'rgba(9,9,11,0.8)' : 'rgba(255,255,255,0.85)'};backdrop-filter:blur(20px) saturate(180%)">
  <div class="mx" style="height:4.5rem;display:flex;align-items:center;justify-content:space-between">
    <div style="font-weight:800;font-size:1.375rem;font-family:var(--fh);background:linear-gradient(135deg,${c.p},${c.s});-webkit-background-clip:text;-webkit-text-fill-color:transparent">${b.logoText || ''}</div>
    <div style="display:flex;align-items:center;gap:2rem">${links}</div>
    ${cta}
  </div>
</nav>`
}

// ─── Hero ──────────────────────────────────────────────────────────────
function renderHero(b: any, t: any, c: any): string {
  const badge = b.badge?.show ? `<div class="label anim" style="margin-bottom:1.5rem">${b.badge.text}</div>` : ''
  const btns = (b.ctaButtons || []).map((btn: any, i: number) =>
    `<a href="${btn.url}" class="btn ${btn.style === 'outline' ? 'btn-o' : 'btn-p'} anim anim-d${i + 2}">${btn.label}</a>`
  ).join('')

  return `<section style="min-height:92vh;display:flex;align-items:center;position:relative;overflow:hidden">
  <div class="blob" style="width:600px;height:600px;background:${c.p};top:-200px;right:-100px"></div>
  <div class="blob" style="width:400px;height:400px;background:${c.s};bottom:-100px;left:-100px"></div>
  <div class="mx" style="text-align:center;max-width:52rem;margin:0 auto;position:relative;z-index:1">
    ${badge}
    <h1 class="anim" style="font-size:clamp(2.5rem,5vw,4.25rem);font-weight:800;letter-spacing:-0.02em;margin-bottom:1.5rem;background:linear-gradient(135deg,${c.text},${c.muted});-webkit-background-clip:text;-webkit-text-fill-color:transparent">${b.headline || ''}</h1>
    ${b.subheadline ? `<p class="anim anim-d1" style="font-size:1.25rem;color:${c.muted};max-width:38rem;margin:0 auto 2.5rem">${b.subheadline}</p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center">${btns}</div>
  </div>
</section>`
}

// ─── Features ──────────────────────────────────────────────────────────
function renderFeatures(b: any, t: any, c: any): string {
  const cols = Math.min((b.features || []).length, 4)
  const items = (b.features || []).map((f: any, i: number) => `
    <div class="glass anim anim-d${(i % 4) + 1}" style="padding:2rem">
      ${f.icon ? `<div style="width:3rem;height:3rem;border-radius:0.75rem;background:linear-gradient(135deg,${c.p}20,${c.s}20);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin-bottom:1rem">${f.icon}</div>` : ''}
      <h3 style="font-size:1.125rem;font-weight:700;margin-bottom:0.625rem">${f.title}</h3>
      <p style="color:${c.muted};font-size:0.9375rem;line-height:1.6">${f.description}</p>
    </div>`).join('')

  return `<section class="sec" style="overflow:hidden">
  <div class="mx">
    <div style="text-align:center;max-width:36rem;margin:0 auto 3.5rem">
      ${b.sectionLabel ? `<div class="label anim" style="margin-bottom:1rem">${b.sectionLabel}</div>` : ''}
      <h2 class="anim anim-d1" style="font-size:2.5rem;font-weight:800;margin-bottom:1rem">${b.headline || ''}</h2>
      ${b.subheadline ? `<p class="anim anim-d2" style="color:${c.muted};font-size:1.0625rem">${b.subheadline}</p>` : ''}
    </div>
    <div class="g${cols > 3 ? 4 : cols}">${items}</div>
  </div>
</section>`
}

// ─── About ─────────────────────────────────────────────────────────────
function renderAbout(b: any, t: any, c: any): string {
  let bodyText = ''
  if (typeof b.body === 'string') bodyText = b.body
  else if (b.body?.root?.children) {
    bodyText = b.body.root.children.map((n: any) =>
      n.children ? n.children.map((ch: any) => ch.text || '').join('') : ''
    ).join(' ')
  }
  return `<section class="sec" style="overflow:hidden">
  <div class="blob" style="width:500px;height:500px;background:${c.p};right:-200px;top:50%;transform:translateY(-50%)"></div>
  <div class="mx" style="max-width:48rem;text-align:center;position:relative;z-index:1">
    ${b.sectionLabel ? `<div class="label anim" style="margin-bottom:1rem">${b.sectionLabel}</div>` : ''}
    <h2 class="anim anim-d1" style="font-size:2.5rem;font-weight:800;margin-bottom:1.5rem">${b.headline || ''}</h2>
    ${bodyText ? `<p class="anim anim-d2" style="color:${c.muted};font-size:1.0625rem;line-height:1.8">${bodyText}</p>` : ''}
  </div>
</section>`
}

// ─── Testimonials ─────────────────────────────────────────────────────
function renderTestimonials(b: any, t: any, c: any): string {
  const items = (b.testimonials || []).map((tm: any, i: number) => `
    <div class="glass anim anim-d${(i % 4) + 1}" style="padding:2rem">
      <div class="stars" style="margin-bottom:1rem;font-size:0.875rem">${'★'.repeat(tm.rating || 5)}</div>
      <p style="color:${c.muted};margin-bottom:1.5rem;font-style:italic;font-size:0.9375rem;line-height:1.7">"${tm.quote}"</p>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:linear-gradient(135deg,${c.p},${c.s});display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.75rem">${(tm.name || '?')[0]}</div>
        <div>
          <p style="font-weight:600;font-size:0.9375rem">${tm.name}</p>
          ${tm.title ? `<p style="font-size:0.8125rem;color:${c.muted}">${tm.title}</p>` : ''}
        </div>
      </div>
    </div>`).join('')

  return `<section class="sec">
  <div class="mx">
    <h2 class="anim" style="font-size:2.5rem;font-weight:800;text-align:center;margin-bottom:3.5rem">${b.headline || 'Testimonials'}</h2>
    <div class="g2">${items}</div>
  </div>
</section>`
}

// ─── Contact ──────────────────────────────────────────────────────────
function renderContact(b: any, t: any, c: any): string {
  const fields = (b.formFields || []).map((f: any) =>
    f.fieldType === 'textarea'
      ? `<div><label style="display:block;font-size:0.8125rem;font-weight:600;color:${c.muted};margin-bottom:0.375rem">${f.label}</label><textarea rows="4" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}></textarea></div>`
      : `<div><label style="display:block;font-size:0.8125rem;font-weight:600;color:${c.muted};margin-bottom:0.375rem">${f.label}</label><input type="${f.fieldType || 'text'}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} /></div>`
  ).join('')

  const info = [
    b.email ? `<div class="glass" style="padding:1.25rem;display:flex;align-items:center;gap:0.75rem"><span style="font-size:1.25rem">📧</span><span style="font-size:0.9375rem">${b.email}</span></div>` : '',
    b.phone ? `<div class="glass" style="padding:1.25rem;display:flex;align-items:center;gap:0.75rem"><span style="font-size:1.25rem">📞</span><span style="font-size:0.9375rem">${b.phone}</span></div>` : '',
    b.address ? `<div class="glass" style="padding:1.25rem;display:flex;align-items:center;gap:0.75rem"><span style="font-size:1.25rem">📍</span><span style="font-size:0.9375rem">${b.address}</span></div>` : '',
  ].filter(Boolean).join('')

  return `<section class="sec">
  <div class="mx">
    <div style="text-align:center;margin-bottom:3.5rem">
      <h2 class="anim" style="font-size:2.5rem;font-weight:800;margin-bottom:0.75rem">${b.headline || 'Liên Hệ'}</h2>
      ${b.subtext ? `<p class="anim anim-d1" style="color:${c.muted};font-size:1.0625rem">${b.subtext}</p>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;max-width:56rem;margin:0 auto">
      <div style="display:flex;flex-direction:column;gap:1rem">
        ${info}
      </div>
      <form class="glass anim anim-d2" style="padding:2rem;display:flex;flex-direction:column;gap:1rem" onsubmit="event.preventDefault()">
        ${fields}
        <button type="submit" class="btn btn-p" style="width:100%;justify-content:center;margin-top:0.5rem">Gửi Tin Nhắn</button>
      </form>
    </div>
  </div>
</section>`
}

// ─── Gallery ──────────────────────────────────────────────────────────
function renderGallery(b: any, t: any, c: any): string {
  const imgs = (b.images || []).map((item: any, i: number) => {
    const hasUrl = item.image?.url
    return hasUrl
      ? `<div class="glass anim anim-d${(i % 4) + 1}" style="overflow:hidden;border-radius:1rem"><img src="${item.image.url}" alt="${item.caption || ''}" style="width:100%;aspect-ratio:4/3;object-fit:cover;transition:transform 0.3s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" /></div>`
      : `<div class="glass anim anim-d${(i % 4) + 1}" style="aspect-ratio:4/3;background:linear-gradient(135deg,${c.p}15,${c.s}15);display:flex;align-items:center;justify-content:center;color:${c.muted};font-size:0.875rem">${item.caption || `Hình ${i + 1}`}</div>`
  }).join('')
  return `<section class="sec">
  <div class="mx">
    ${b.headline ? `<h2 class="anim" style="font-size:2.5rem;font-weight:800;text-align:center;margin-bottom:3.5rem">${b.headline}</h2>` : ''}
    <div class="g3">${imgs}</div>
  </div>
</section>`
}

// ─── Footer ───────────────────────────────────────────────────────────
function renderFooter(b: any, t: any, c: any): string {
  const cols = (b.columns || []).map((col: any) => {
    const links = (col.links || []).map((l: any) =>
      `<li style="margin-bottom:0.625rem"><a href="${l.url}" style="font-size:0.875rem;color:${c.muted};transition:color 0.2s" onmouseover="this.style.color='${c.text}'" onmouseout="this.style.color='${c.muted}'">${l.label}</a></li>`
    ).join('')
    return `<div><h4 style="font-weight:700;margin-bottom:1rem;font-size:0.9375rem">${col.title}</h4><ul style="list-style:none">${links}</ul></div>`
  }).join('')

  return `<footer style="padding:4rem 0;position:relative">
  <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${c.p}60,${c.s}60,transparent)"></div>
  <div class="mx">
    <div style="display:grid;grid-template-columns:2fr ${(b.columns || []).map(() => '1fr').join(' ')};gap:3rem;margin-bottom:3rem">
      <div>
        <div style="font-weight:800;font-size:1.5rem;font-family:var(--fh);background:linear-gradient(135deg,${c.p},${c.s});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.75rem">${b.logoText || ''}</div>
        ${b.tagline ? `<p style="color:${c.muted};font-size:0.875rem;max-width:20rem">${b.tagline}</p>` : ''}
      </div>
      ${cols}
    </div>
    ${b.copyrightText ? `<div style="padding-top:2rem;border-top:1px solid ${c.border};font-size:0.8125rem;color:${c.muted};text-align:center">${b.copyrightText}</div>` : ''}
  </div>
</footer>`
}

// ─── Stats ────────────────────────────────────────────────────────────
function renderStats(b: any, t: any, c: any): string {
  const items = (b.stats || []).map((s: any, i: number) => `
    <div class="anim anim-d${(i % 4) + 1}" style="text-align:center;padding:2rem">
      <div style="font-size:3rem;font-weight:800;font-family:var(--fh);background:linear-gradient(135deg,${c.p},${c.s});-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem">${s.value}</div>
      <div style="font-size:0.875rem;color:${c.muted};font-weight:500;text-transform:uppercase;letter-spacing:0.05em">${s.label}</div>
    </div>`).join('')
  return `<section class="sec" style="background:var(--card);border-top:1px solid ${c.border};border-bottom:1px solid ${c.border}">
  <div class="mx">
    ${b.headline ? `<h2 class="anim" style="font-size:2rem;font-weight:800;text-align:center;margin-bottom:3rem">${b.headline}</h2>` : ''}
    <div class="g4">${items}</div>
  </div>
</section>`
}

// ─── Pricing ──────────────────────────────────────────────────────────
function renderPricing(b: any, t: any, c: any): string {
  const plans = (b.plans || []).map((p: any, i: number) => {
    const feats = (p.features || []).map((f: any) =>
      `<li style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid ${c.border}"><span style="color:${c.p}">✓</span><span style="font-size:0.9375rem">${typeof f === 'string' ? f : f.text}</span></li>`
    ).join('')
    const popular = p.isPopular ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,${c.p},${c.s});color:#fff;padding:0.25rem 1rem;border-radius:9999px;font-size:0.75rem;font-weight:700">Phổ Biến</div>` : ''
    return `<div class="glass anim anim-d${(i % 3) + 1}" style="padding:2.5rem 2rem;position:relative;${p.isPopular ? `border-color:${c.p}40;box-shadow:0 0 40px ${c.p}10` : ''}">
      ${popular}
      <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:0.5rem">${p.name}</h3>
      <p style="color:${c.muted};font-size:0.875rem;margin-bottom:1.5rem">${p.description || ''}</p>
      <div style="font-size:2.5rem;font-weight:800;font-family:var(--fh);margin-bottom:2rem;background:linear-gradient(135deg,${c.p},${c.s});-webkit-background-clip:text;-webkit-text-fill-color:transparent">${p.price}</div>
      <ul style="list-style:none;margin-bottom:2rem">${feats}</ul>
      <a href="${p.ctaUrl || '#'}" class="btn ${p.isPopular ? 'btn-p' : 'btn-o'}" style="width:100%;justify-content:center">${p.ctaLabel || 'Chọn Gói'}</a>
    </div>`
  }).join('')

  return `<section class="sec">
  <div class="mx">
    <div style="text-align:center;margin-bottom:3.5rem">
      <h2 class="anim" style="font-size:2.5rem;font-weight:800;margin-bottom:1rem">${b.headline || 'Bảng Giá'}</h2>
      ${b.subheadline ? `<p class="anim anim-d1" style="color:${c.muted};font-size:1.0625rem">${b.subheadline}</p>` : ''}
    </div>
    <div class="g3">${plans}</div>
  </div>
</section>`
}

// ─── FAQ ──────────────────────────────────────────────────────────────
function renderFaq(b: any, t: any, c: any): string {
  const items = (b.faqs || []).map((f: any, i: number) => `
    <details class="glass anim anim-d${(i % 4) + 1}" style="padding:1.5rem 2rem;cursor:pointer">
      <summary style="font-weight:700;font-size:1rem;list-style:none;display:flex;justify-content:space-between;align-items:center">${f.question}<span style="color:${c.p};font-size:1.25rem;transition:transform 0.3s">+</span></summary>
      <p style="margin-top:1rem;color:${c.muted};font-size:0.9375rem;line-height:1.7">${f.answer}</p>
    </details>`).join('')

  return `<section class="sec">
  <div class="mx" style="max-width:48rem">
    <h2 class="anim" style="font-size:2.5rem;font-weight:800;text-align:center;margin-bottom:3.5rem">${b.headline || 'FAQ'}</h2>
    <div style="display:flex;flex-direction:column;gap:0.75rem">${items}</div>
  </div>
</section>`
}

// ─── Team ─────────────────────────────────────────────────────────────
function renderTeam(b: any, t: any, c: any): string {
  const members = (b.members || []).map((m: any, i: number) => `
    <div class="glass anim anim-d${(i % 4) + 1}" style="padding:2rem;text-align:center">
      <div style="width:5rem;height:5rem;border-radius:50%;background:linear-gradient(135deg,${c.p},${c.s});margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:700">${(m.name || '?')[0]}</div>
      <h3 style="font-size:1.125rem;font-weight:700;margin-bottom:0.375rem">${m.name}</h3>
      <p style="color:${c.muted};font-size:0.875rem">${m.role || ''}</p>
    </div>`).join('')

  return `<section class="sec">
  <div class="mx">
    <h2 class="anim" style="font-size:2.5rem;font-weight:800;text-align:center;margin-bottom:3.5rem">${b.headline || 'Đội Ngũ'}</h2>
    <div class="g3">${members}</div>
  </div>
</section>`
}

// ─── CTA ──────────────────────────────────────────────────────────────
function renderCTA(b: any, t: any, c: any): string {
  return `<section class="sec" style="overflow:hidden">
  <div class="mx">
    <div class="anim" style="position:relative;border-radius:1.5rem;background:linear-gradient(135deg,${c.p}15,${c.s}15);border:1px solid ${c.p}20;padding:4rem 3rem;text-align:center;overflow:hidden">
      <div class="blob" style="width:300px;height:300px;background:${c.p};top:-100px;right:-50px"></div>
      <h2 style="font-size:2rem;font-weight:800;margin-bottom:1rem;position:relative;z-index:1">${b.headline || ''}</h2>
      ${b.subheadline ? `<p style="color:${c.muted};font-size:1.0625rem;margin-bottom:2rem;position:relative;z-index:1">${b.subheadline}</p>` : ''}
      <a href="${b.ctaUrl || '#'}" class="btn btn-p" style="position:relative;z-index:1">${b.ctaLabel || 'Bắt Đầu'}</a>
    </div>
  </div>
</section>`
}
