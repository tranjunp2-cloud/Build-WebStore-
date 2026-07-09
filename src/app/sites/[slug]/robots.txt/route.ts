import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

// AI-assistant crawlers: default-allow, governed by the site's `aiCrawlersEnabled` toggle (US-F37-03).
const AI_ASSISTANT_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'CCBot']
// Scraper/training bots: always blocked regardless of the toggle (out of scope for US-F37-03).
const BLOCKED_SCRAPER_BOTS = ['Amazonbot', 'Applebot-Extended', 'Bytespider', 'CloudflareBrowserRenderingCrawler', 'meta-externalagent']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params
        const payload = await getPayload({ config })

        let tenant;
        let hostname = '';

        if (slug === 'custom') {
            hostname = _req.headers.get('x-tenant-hostname') || ''
            if (!hostname) return new Response('Not found', { status: 404 })
            const tenantsResult = await payload.find({
                collection: 'tenants',
                where: { 'customDomains.domain': { equals: hostname } },
                limit: 1,
            })
            tenant = tenantsResult.docs[0]
        } else {
            const tenantsResult = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: slug } },
                limit: 1,
            })
            tenant = tenantsResult.docs[0]
        }

        if (!tenant) {
            return new Response('Not found', { status: 404 })
        }

        const siteResults = await payload.find({
            collection: 'sites',
            where: {
                and: [
                    { tenant: { equals: tenant.id } },
                    { status: { equals: 'published' } },
                ],
            },
            limit: 1,
        })
        const [site] = siteResults.docs
        // Missing/unpublished site defaults to allow (BR-03 default-allow).
        const allowAiCrawlers = site?.aiCrawlersEnabled !== false

        const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        const baseUrl = slug === 'custom' ? `https://${hostname}` : `https://${slug}.${rootDomain}`

        const aiBotLines = AI_ASSISTANT_BOTS.flatMap(bot => [
            `User-agent: ${bot}`,
            allowAiCrawlers ? 'Allow: /' : 'Disallow: /',
            '',
        ])
        const scraperBotLines = BLOCKED_SCRAPER_BOTS.flatMap(bot => [
            `User-agent: ${bot}`,
            'Disallow: /',
            '',
        ])

        const body = [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            'Disallow: /admin/',
            // NOTE: functional routes (checkout, orders, order confirm) are NOT
            // Disallowed here on purpose — they carry a `noindex` robots meta, and
            // Disallowing them would block the crawl that lets Google see that meta.
            // (Disallow + noindex are mutually defeating.)
            '',
            ...aiBotLines,
            ...scraperBotLines,
            `Sitemap: ${baseUrl}/sitemap.xml`,
        ].join('\n')

        return new Response(body, {
            headers: {
                'Content-Type': 'text/plain',
                // Shorter than before (was 1h/24h stale): AI_ASSISTANT_BOTS Allow/Disallow now
                // depends on the seller-facing aiCrawlersEnabled toggle, so propagation speed
                // matters (e.g. compliance opt-out) — not just static content.
                'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600',
            },
        })
    } catch (error) {
        console.error('[Robots Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}
