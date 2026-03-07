import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * GET /api/preview/[siteId]
 * Generates full HTML for the site's homepage from block data.
 * Returns standalone HTML that can be loaded in an iframe.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const payload = await getPayload({ config })

    // Fetch site
    const site = await payload.findByID({ collection: 'sites', id: siteId })
    if (!site) {
      return new NextResponse('Site not found', { status: 404 })
    }

    // Fetch homepage — try isHomepage first, then fall back to first page
    const numericSiteId = Number(siteId)
    let pagesResult = await payload.find({
      collection: 'pages',
      where: {
        site: { equals: numericSiteId },
        isHomepage: { equals: true },
      },
      limit: 1,
    })

    // Fallback: get first page if no homepage flag set
    if (pagesResult.docs.length === 0) {
      pagesResult = await payload.find({
        collection: 'pages',
        where: {
          site: { equals: numericSiteId },
        },
        limit: 1,
      })
    }

    const page = pagesResult.docs[0]
    if (!page) {
      return new NextResponse('Homepage not found', { status: 404 })
    }

    const theme = {
      primaryColor: (site as any).theme?.primaryColor || '#0ea5e9',
      secondaryColor: (site as any).theme?.secondaryColor || '#d946ef',
      fontHeading: (site as any).theme?.fontHeading || 'Outfit',
      fontBody: (site as any).theme?.fontBody || 'Inter',
      colorMode: (site as any).theme?.colorMode || 'dark',
    }

    const blocks: any[] = (page as any).layout || []
    const bodyBg = theme.colorMode === 'dark' ? '#09090b' : '#ffffff'
    const textColor = theme.colorMode === 'dark' ? '#fafafa' : '#09090b'

    // Generate HTML for each block
    const blocksHtml = blocks.map(block => renderBlock(block, theme)).join('\n')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${site.name || 'Preview'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${theme.fontHeading.replace(/ /g, '+')}:wght@400;600;700;900&family=${theme.fontBody.replace(/ /g, '+')}:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary: ${theme.primaryColor};
      --secondary: ${theme.secondaryColor};
      --font-heading: '${theme.fontHeading}', sans-serif;
      --font-body: '${theme.fontBody}', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-body);
      background: ${bodyBg};
      color: ${textColor};
      line-height: 1.6;
    }
    h1, h2, h3, h4 { font-family: var(--font-heading); }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
    img { max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; }
    .btn-primary {
      display: inline-block; padding: 1rem 2rem; border-radius: 0.75rem;
      font-weight: 600; color: white; background: var(--primary);
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-outline {
      display: inline-block; padding: 1rem 2rem; border-radius: 0.75rem;
      font-weight: 600; color: var(--primary); border: 2px solid var(--primary);
      transition: all 0.2s;
    }
    .btn-outline:hover { background: var(--primary); color: white; }
    input, textarea {
      width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem;
      border: 1px solid ${theme.primaryColor}30; background: transparent;
      color: inherit; font-family: inherit; font-size: 0.875rem;
    }
    input:focus, textarea:focus { outline: none; border-color: var(--primary); }
  </style>
</head>
<body>
${blocksHtml}
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error: any) {
    console.error('[Preview Error]', error)
    return new NextResponse(`<html><body><h1>Error</h1><p>${error.message}</p></body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

// ─── Block Renderers (HTML string) ─────────────────────────────────────

function renderBlock(block: any, theme: any): string {
  switch (block.blockType) {
    case 'navigation': return renderNavigation(block, theme)
    case 'hero': return renderHero(block, theme)
    case 'about': return renderAbout(block, theme)
    case 'features': return renderFeatures(block, theme)
    case 'testimonials': return renderTestimonials(block, theme)
    case 'contact': return renderContact(block, theme)
    case 'gallery': return renderGallery(block, theme)
    case 'footer': return renderFooter(block, theme)
    default: return ''
  }
}

function renderNavigation(b: any, t: any): string {
  const links = (b.links || []).map((l: any) =>
    `<a href="${l.url}" style="font-size:0.875rem;font-weight:500;opacity:0.7">${l.label}</a>`
  ).join('')
  const cta = b.ctaButton?.show
    ? `<a href="${b.ctaButton.url || '#'}" class="btn-primary" style="padding:0.625rem 1.25rem;font-size:0.875rem">${b.ctaButton.label}</a>`
    : ''
  return `<nav style="position:sticky;top:0;z-index:50;border-bottom:1px solid ${t.primaryColor}20;background:rgba(9,9,11,0.85);backdrop-filter:blur(12px)">
  <div class="container" style="height:4rem;display:flex;align-items:center;justify-content:space-between">
    <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-heading);color:${t.primaryColor}">${b.logoText || ''}</div>
    <div style="display:flex;align-items:center;gap:2rem">${links}</div>
    ${cta}
  </div>
</nav>`
}

function renderHero(b: any, t: any): string {
  const badge = b.badge?.show ? `<div style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-radius:9999px;font-size:0.875rem;font-weight:500;border:1px solid ${t.primaryColor}40;color:${t.primaryColor};background:${t.primaryColor}10;margin-bottom:1.5rem">${b.badge.text}</div>` : ''
  const btns = (b.ctaButtons || []).map((btn: any) =>
    `<a href="${btn.url}" class="${btn.style === 'outline' ? 'btn-outline' : 'btn-primary'}">${btn.label}</a>`
  ).join('')
  return `<section style="min-height:90vh;display:flex;align-items:center;background:linear-gradient(135deg,${t.primaryColor}15 0%,transparent 60%)">
  <div class="container" style="text-align:center;max-width:48rem;margin:0 auto">
    ${badge}
    <h1 style="font-size:3.5rem;font-weight:700;line-height:1.1;margin-bottom:1.5rem">${b.headline || ''}</h1>
    ${b.subheadline ? `<p style="font-size:1.25rem;opacity:0.7;margin-bottom:2.5rem;max-width:36rem;margin-left:auto;margin-right:auto">${b.subheadline}</p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center">${btns}</div>
  </div>
</section>`
}

function renderAbout(b: any, t: any): string {
  let bodyText = ''
  if (b.body?.root?.children) {
    bodyText = b.body.root.children.map((node: any) => {
      if (node.children) return node.children.map((c: any) => c.text || '').join('')
      return ''
    }).join(' ')
  }
  return `<section style="padding:6rem 0">
  <div class="container">
    ${b.sectionLabel ? `<p style="font-size:0.875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:${t.primaryColor};margin-bottom:1rem;text-align:center">${b.sectionLabel}</p>` : ''}
    <h2 style="font-size:2.5rem;font-weight:700;font-family:var(--font-heading);margin-bottom:1.5rem;text-align:center">${b.headline || ''}</h2>
    ${bodyText ? `<p style="opacity:0.8;max-width:42rem;margin:0 auto;text-align:center">${bodyText}</p>` : ''}
  </div>
</section>`
}

function renderFeatures(b: any, t: any): string {
  const items = (b.features || []).map((f: any) => `
    <div style="padding:2rem;border-radius:1rem;border:1px solid ${t.primaryColor}20;background:${t.primaryColor}05">
      ${f.icon ? `<div style="font-size:2rem;margin-bottom:1rem">${f.icon}</div>` : ''}
      <h3 style="font-size:1.25rem;font-weight:700;font-family:var(--font-heading);margin-bottom:0.75rem">${f.title}</h3>
      <p style="opacity:0.7">${f.description}</p>
    </div>`).join('')
  return `<section style="padding:6rem 0">
  <div class="container">
    <div style="text-align:center;max-width:36rem;margin:0 auto 4rem">
      ${b.sectionLabel ? `<p style="font-size:0.875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:${t.primaryColor};margin-bottom:1rem">${b.sectionLabel}</p>` : ''}
      <h2 style="font-size:2.5rem;font-weight:700;font-family:var(--font-heading);margin-bottom:1rem">${b.headline || ''}</h2>
      ${b.subheadline ? `<p style="font-size:1.125rem;opacity:0.7">${b.subheadline}</p>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem">${items}</div>
  </div>
</section>`
}

function renderTestimonials(b: any, t: any): string {
  const items = (b.testimonials || []).map((tm: any) => `
    <div style="padding:1.5rem;border-radius:1rem;border:1px solid ${t.primaryColor}20">
      <div style="display:flex;gap:0.25rem;margin-bottom:1rem;color:${t.primaryColor}">${'★'.repeat(tm.rating || 5)}</div>
      <p style="opacity:0.8;margin-bottom:1.5rem;font-style:italic">"${tm.quote}"</p>
      <div>
        <p style="font-weight:600">${tm.name}</p>
        ${tm.title ? `<p style="font-size:0.875rem;opacity:0.6">${tm.title}</p>` : ''}
      </div>
    </div>`).join('')
  return `<section style="padding:6rem 0">
  <div class="container">
    <h2 style="font-size:2.5rem;font-weight:700;font-family:var(--font-heading);text-align:center;margin-bottom:4rem">${b.headline || 'Testimonials'}</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem">${items}</div>
  </div>
</section>`
}

function renderContact(b: any, t: any): string {
  const fields = (b.formFields || []).map((f: any) =>
    f.fieldType === 'textarea'
      ? `<div><label style="display:block;font-size:0.875rem;font-weight:500;opacity:0.8;margin-bottom:0.25rem">${f.label}</label><textarea rows="4" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}></textarea></div>`
      : `<div><label style="display:block;font-size:0.875rem;font-weight:500;opacity:0.8;margin-bottom:0.25rem">${f.label}</label><input type="${f.fieldType || 'text'}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''} /></div>`
  ).join('')
  const info = [
    b.email ? `<p>📧 ${b.email}</p>` : '',
    b.phone ? `<p>📞 ${b.phone}</p>` : '',
    b.address ? `<p>📍 ${b.address}</p>` : '',
  ].filter(Boolean).join('')
  return `<section style="padding:6rem 0">
  <div class="container" style="max-width:36rem;text-align:center">
    <h2 style="font-size:2.5rem;font-weight:700;font-family:var(--font-heading);margin-bottom:1rem">${b.headline || 'Contact'}</h2>
    ${b.subtext ? `<p style="opacity:0.7;margin-bottom:2.5rem">${b.subtext}</p>` : ''}
    <form style="display:flex;flex-direction:column;gap:1rem;text-align:left" onsubmit="event.preventDefault()">
      ${fields}
      <button type="submit" class="btn-primary" style="width:100%;padding:1rem;text-align:center;border:none;cursor:pointer;font-size:1rem">Send Message</button>
    </form>
    ${info ? `<div style="margin-top:3rem;opacity:0.7;display:flex;flex-direction:column;gap:0.5rem">${info}</div>` : ''}
  </div>
</section>`
}

function renderGallery(b: any, t: any): string {
  const imgs = (b.images || []).map((item: any) =>
    `<img src="${item.image?.url || ''}" alt="${item.caption || ''}" style="width:100%;border-radius:0.75rem" />`
  ).join('')
  return `<section style="padding:6rem 0">
  <div class="container">
    ${b.headline ? `<h2 style="font-size:2.5rem;font-weight:700;font-family:var(--font-heading);text-align:center;margin-bottom:3rem">${b.headline}</h2>` : ''}
    <div style="columns:3;gap:1rem">${imgs}</div>
  </div>
</section>`
}

function renderFooter(b: any, t: any): string {
  const cols = (b.columns || []).map((col: any) => {
    const links = (col.links || []).map((l: any) =>
      `<li style="margin-bottom:0.5rem"><a href="${l.url}" style="font-size:0.875rem;opacity:0.6">${l.label}</a></li>`
    ).join('')
    return `<div><h4 style="font-weight:600;margin-bottom:1rem">${col.title}</h4><ul style="list-style:none">${links}</ul></div>`
  }).join('')
  return `<footer style="padding:4rem 0;border-top:1px solid ${t.primaryColor}20">
  <div class="container">
    <div style="display:grid;grid-template-columns:repeat(${Math.min((b.columns || []).length + 1, 4)},1fr);gap:2rem;margin-bottom:3rem">
      <div>
        <div style="font-weight:700;font-size:1.5rem;font-family:var(--font-heading);color:${t.primaryColor};margin-bottom:0.75rem">${b.logoText || ''}</div>
        ${b.tagline ? `<p style="opacity:0.6;font-size:0.875rem">${b.tagline}</p>` : ''}
      </div>
      ${cols}
    </div>
    ${b.copyrightText ? `<div style="padding-top:2rem;border-top:1px solid ${t.primaryColor}20;font-size:0.875rem;opacity:0.5;text-align:center">${b.copyrightText}</div>` : ''}
  </div>
</footer>`
}
