import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { storefrontUnavailableFor } from '@/lib/storefront/cached-store-availability'
import { STORE_UNAVAILABLE_HEADERS } from '@/lib/maintenance'
import { hasActiveCustomDomain } from '@/lib/seo/canonical'
import { APPROVED_AI_CRAWLERS_ALLOWED } from '@/lib/seo/public-discovery-facts'

// AI-assistant crawlers are platform-managed and always allowed (US-F37-03 / PR #1677).
// F37-03 → #1312 score handoff: `approvedAiCrawlersAllowed=true` (9 points)
// is a platform invariant and is independent of sitemap/llms.txt availability.
export const AI_ASSISTANT_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'CCBot']
// Scraper/training bots remain blocked (out of scope for the approved assistant policy).
const BLOCKED_SCRAPER_BOTS = ['Amazonbot', 'Applebot-Extended', 'Bytespider', 'CloudflareBrowserRenderingCrawler', 'meta-externalagent']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params
        // #2179: banned or expired store → 503, nothing to crawl
        if (await storefrontUnavailableFor(slug, slug === 'custom' ? _req.headers.get('x-tenant-hostname') : null)) {
            return new Response('Service Unavailable', { status: 503, headers: { ...STORE_UNAVAILABLE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } })
        }
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
            if (!hasActiveCustomDomain(tenant, hostname)) {
                return new Response('Not found', { status: 404 })
            }
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

        const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        const baseUrl = slug === 'custom' ? `https://${hostname}` : `https://${slug}.${rootDomain}`

        // RFC 9309 §2.2.1: a crawler applies only the most specific matching
        // group and ignores `User-agent: *` entirely — so each named bot group
        // must repeat the /api//admin/ exclusions itself, or that bot would be
        // over-permissioned relative to the `*` group when allowed.
        const aiBotLines = APPROVED_AI_CRAWLERS_ALLOWED ? AI_ASSISTANT_BOTS.flatMap(bot => [
            `User-agent: ${bot}`,
            'Allow: /',
            'Disallow: /api/',
            'Disallow: /admin/',
            '',
        ]) : []
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
                // Keep the existing short cache during the platform-policy rollout.
                'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600',
            },
        })
    } catch (error) {
        console.error('[Robots Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}
