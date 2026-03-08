/**
 * Site Preview API — Renders a site's blocks into premium HTML.
 * Uses industry-aware renderers for true visual diversity.
 */
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { renderNav, renderHero, renderSections, THEMES, baseCSS, getGoogleFontsLink, TemplateTheme } from '../renderers'

function detectCategory(blocks: any[], siteName: string): string {
  const text = JSON.stringify(blocks).toLowerCase() + siteName.toLowerCase()
  if (/nhà hàng|cafe|restaurant|f&b|thực đơn|đặt bàn|menu/i.test(text)) return 'restaurant'
  if (/shop|thời trang|ecommerce|sản phẩm|mua|fashion|cửa hàng/i.test(text)) return 'ecommerce'
  if (/beauty|spa|thẩm mỹ|salon|làm đẹp|chăm sóc da/i.test(text)) return 'beauty'
  if (/tech|saas|startup|công nghệ|phần mềm|ai|api/i.test(text)) return 'tech'
  if (/y tế|nha khoa|clinic|bệnh viện|bác sĩ|sức khỏe|phòng khám/i.test(text)) return 'health'
  if (/giáo dục|đào tạo|khóa học|trường|education|training/i.test(text)) return 'education'
  if (/bất động sản|bds|nhà đất|căn hộ|dự án|real estate/i.test(text)) return 'realestate'
  if (/gym|fitness|yoga|tập|thể dục|workout/i.test(text)) return 'fitness'
  if (/portfolio|freelancer|agency|creative|thiết kế|design/i.test(text)) return 'creative'
  return 'business'
}

export function buildFullHTML(blocks: any[], theme?: TemplateTheme, category?: string): string {
  const cat = category || 'business'
  const t = theme || THEMES[cat] || THEMES.business

  const bodyParts = blocks.map(block => {
    if (block.blockType === 'navigation') return renderNav(block, t)
    if (block.blockType === 'hero') return renderHero(block, t)
    return renderSections(block, t)
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="${getGoogleFontsLink(t)}" rel="stylesheet">
  <style>${baseCSS(t)}</style>
</head>
<body>${bodyParts}</body>
</html>`
}

export async function GET(_req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params
    const payload = await getPayload({ config })
    const site = await payload.findByID({ collection: 'sites', id: Number(siteId) })
    if (!site) return new NextResponse('Not found', { status: 404 })

    const blocks = (site as any).blocks || []
    const cat = detectCategory(blocks, (site as any).name || '')
    const t = THEMES[cat] || THEMES.business
    const html = buildFullHTML(blocks, t, cat)

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e: any) {
    return new NextResponse(`Error: ${e.message}`, { status: 500 })
  }
}
