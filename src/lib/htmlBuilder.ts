import { renderNav, renderHero, renderSections, THEMES, baseCSS, getGoogleFontsLink, TemplateTheme } from '@/app/api/preview/renderers'
import { setHeroCategory, setHeroImageIndex } from '@/app/api/preview/renderers/hero'
import { setSectionCategory } from '@/app/api/preview/renderers/sections'

export function buildFullHTML(
    blocks: any[],
    theme?: TemplateTheme | any,
    category?: string,
    meta?: { name?: string; description?: string; lang?: string },
    heroImageIndex?: number,
): string {
    const cat = category || 'business'
    const defaultTheme = THEMES[cat] || THEMES.business
    const t: TemplateTheme = {
        primary: theme?.primary || defaultTheme.primary,
        secondary: theme?.secondary || defaultTheme.secondary,
        bg: theme?.bg || defaultTheme.bg,
        text: theme?.text || defaultTheme.text,
        muted: theme?.muted || defaultTheme.muted,
        accent: theme?.accent || defaultTheme.accent,
        fontHeading: theme?.fontHeading || defaultTheme.fontHeading,
        fontBody: theme?.fontBody || defaultTheme.fontBody,
        navStyle: theme?.navStyle || defaultTheme.navStyle,
        heroStyle: theme?.heroStyle || defaultTheme.heroStyle,
    }

    // Extract site info from blocks for SEO
    const heroBlock = blocks.find(b => b.blockType === 'hero')
    const navBlock = blocks.find(b => b.blockType === 'navigation')
    const siteName = meta?.name || navBlock?.logoText || 'Website'
    const siteDesc = meta?.description || heroBlock?.subheadline || `${siteName} — Professional website`
    const lang = meta?.lang || 'en'

    // Set category for image selection in renderers
    setHeroCategory(cat)
    setHeroImageIndex(heroImageIndex ?? 0)
    setSectionCategory(cat)

    // Rewrite nav link URLs → '#' to prevent 404 in preview iframe
    blocks.filter(b => b.blockType === 'navigation').forEach(b => {
        if (Array.isArray(b.links)) {
            b.links.forEach((l: any) => { l.url = '#' })
        }
        if (b.ctaButton) { b.ctaButton.url = '#' }
    })

    // Separate nav/hero from other sections for semantic HTML
    const navHtml = blocks.filter(b => b.blockType === 'navigation').map(b => renderNav(b, t)).join('\n')
    // Rewrite hero + CTA section URLs → '#' to prevent 404 in preview
    blocks.filter(b => ['hero', 'cta'].includes(b.blockType)).forEach(b => {
        if (Array.isArray(b.ctaButtons)) {
            b.ctaButtons.forEach((c: any) => { if (c.url && !c.url.startsWith('http')) c.url = '#' })
        }
        if (b.ctaUrl && !b.ctaUrl.startsWith('http')) b.ctaUrl = '#'
    })
    const heroHtml = blocks.filter(b => b.blockType === 'hero').map(b => renderHero(b, t, cat)).join('\n')
    // Rewrite footer link URLs → '#' to prevent 404 in preview
    blocks.filter(b => b.blockType === 'footer').forEach(b => {
        if (Array.isArray(b.columns)) {
            b.columns.forEach((col: any) => {
                if (Array.isArray(col.links)) {
                    col.links.forEach((l: any) => { if (l.url && !l.url.startsWith('http') && !l.url.startsWith('mailto')) l.url = '#' })
                }
            })
        }
    })
    const footerHtml = blocks.filter(b => b.blockType === 'footer').map(b => renderSections(b, t, cat)).join('\n')
    const mainHtml = blocks
        .filter(b => !['navigation', 'hero', 'footer'].includes(b.blockType))
        .map(b => renderSections(b, t, cat)).join('\n')

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <meta name="description" content="${siteDesc.substring(0, 160)}">
  <meta property="og:title" content="${siteName}">
  <meta property="og:description" content="${siteDesc.substring(0, 160)}">
  <meta property="og:type" content="website">
  <meta name="robots" content="index, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="${getGoogleFontsLink(t)}" rel="stylesheet">
  <style>${baseCSS(t)}</style>
  <script type="application/ld+json">
  ${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": siteName,
        "description": siteDesc.substring(0, 160),
    })}
  </script>
</head>
<body>
  <header role="banner">${navHtml}</header>
  <main role="main">
    ${heroHtml}
    ${mainHtml}
  </main>
  ${footerHtml}
</body>
</html>`
}
