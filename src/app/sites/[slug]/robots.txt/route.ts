import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'

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

        const rootDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        const baseUrl = slug === 'custom' ? `https://${hostname}` : `https://${slug}.${rootDomain}`

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
            'User-agent: Amazonbot',
            'Disallow: /',
            '',
            'User-agent: Applebot-Extended',
            'Disallow: /',
            '',
            'User-agent: Bytespider',
            'Disallow: /',
            '',
            'User-agent: CCBot',
            'Disallow: /',
            '',
            'User-agent: ClaudeBot',
            'Disallow: /',
            '',
            'User-agent: CloudflareBrowserRenderingCrawler',
            'Disallow: /',
            '',
            'User-agent: Google-Extended',
            'Disallow: /',
            '',
            'User-agent: GPTBot',
            'Disallow: /',
            '',
            'User-agent: meta-externalagent',
            'Disallow: /',
            '',
            `Sitemap: ${baseUrl}/sitemap.xml`,
        ].join('\n')

        return new Response(body, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
            },
        })
    } catch (error) {
        console.error('[Robots Error]', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}
