/** CLI-only: fetches an image through headless Chromium when the source CDN blocks plain HTTP clients. */
import { lookup } from 'node:dns/promises'
import { publicBrandAddress } from './pw1-brand-scan'

export const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const LIMIT = 30 * 1024 * 1024

export async function fetchImageViaBrowser(url: URL): Promise<{ buffer: Buffer; mimetype: string } | null> {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true, timeout: 10000 })
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false, userAgent: BROWSER_USER_AGENT })
        const checked = new Map<string, boolean>()
        // Same boundary as the brand scan: HTTP(S) only, no credentials/ports, public addresses only
        await context.route('**/*', async route => {
            try {
                const target = new URL(route.request().url())
                if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.port) return await route.abort()
                let allowed = checked.get(target.hostname)
                if (allowed === undefined) {
                    const addresses = await lookup(target.hostname, { all: true })
                    allowed = addresses.length > 0 && addresses.every(a => publicBrandAddress(a.address))
                    checked.set(target.hostname, allowed)
                }
                if (allowed) await route.continue(); else await route.abort()
            } catch { await route.abort().catch(() => undefined) }
        })
        const response = await (await context.newPage()).goto(url.href, { timeout: 30_000 })
        const mimetype = (response?.headers()['content-type'] || '').split(';')[0].trim().toLowerCase()
        if (!response?.ok() || !mimetype.startsWith('image/')) return null
        const buffer = await response.body()
        return buffer.length <= LIMIT ? { buffer, mimetype } : null
    } finally { await browser.close().catch(() => undefined) }
}
