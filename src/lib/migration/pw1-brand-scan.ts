/** CLI-only browser collection. No browser dependency is imported by the web generator. */
import { readCarouselFrames } from './pw1-carousel-evidence'
import { lookup } from 'node:dns/promises'
import { MigrationMutex } from './pw1-concurrency'
import { rankBrandColors, type BrandEvidence } from './pw1-brand-evidence'

const gate = new MigrationMutex()
const cache = new Map<string, BrandEvidence>()
export function publicBrandAddress(address: string): boolean {
    if (address.includes(':')) return /^[23][0-9a-f]{3}:/i.test(address)
    const [a, b] = address.split('.').map(Number)
    return Number.isInteger(a) && a > 0 && a < 224 && a !== 10 && a !== 127 &&
        !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
        !(a === 192 && b === 168) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && (b === 18 || b === 19))
}
export async function scanPw1Brand(url: string, signal?: AbortSignal, logoUrl?: string): Promise<BrandEvidence> {
    return gate.run(async () => {
        signal?.throwIfAborted()
        const cached = cache.get(url + (logoUrl ?? ''))
        if (cached) return cached
        const capturedAt = new Date().toISOString()
        let browser: import('playwright').Browser | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        const close = () => { void browser?.close().catch(() => undefined) }
        let evidence: BrandEvidence
        try {
            const target = new URL(url)
            if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password || target.port) throw Error('Unsupported source URL')
            const { chromium } = await import('playwright')
            browser = await chromium.launch({ headless: true, timeout: 10000 })
            signal?.throwIfAborted()
            signal?.addEventListener('abort', close, { once: true })
            timer = setTimeout(close, 60000)
            let context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: false })
            const checked = new Map<string, boolean>()
            const guard = async (route: import('playwright').Route) => {
                try {
                    const request = route.request(), u = new URL(request.url())
                    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port || ['media', 'websocket'].includes(request.resourceType())) return await route.abort()
                    let allowed = checked.get(u.hostname)
                    if (allowed === undefined) {
                        const addresses = await lookup(u.hostname, { all: true })
                        allowed = addresses.length > 0 && addresses.every(a => publicBrandAddress(a.address))
                        checked.set(u.hostname, allowed)
                    }
                    if (allowed) await route.continue(); else await route.abort()
                } catch { await route.abort().catch(() => undefined) }
            }
            await context.route('**/*', guard)
            let page = await context.newPage()
            let transport: 'https' | 'https-relaxed' | 'http' = target.protocol === 'https:' ? 'https' : 'http'
            let loaded = false
            let failure = ''
            for (let attempt = 0; attempt < (target.protocol === 'https:' ? 3 : 1); attempt++) {
                if (attempt > 0) {
                    await context.close()
                    context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: false, ignoreHTTPSErrors: attempt === 1 })
                    await context.route('**/*', guard)
                    page = await context.newPage()
                    transport = attempt === 1 ? 'https-relaxed' : 'http'
                }
                try {
                    const address = new URL(target.href)
                    if (attempt === 2) address.protocol = 'http:'
                    const response = await page.goto(address.href, { waitUntil: 'domcontentloaded', timeout: 10000 })
                    if (!response?.ok()) throw Error('Source returned unsuccessful HTTP status')
                    loaded = true; break
                } catch (error) { failure = error instanceof Error ? error.message.split('\n')[0] : 'Navigation failed' }
            }
            if (!loaded) await page.goto('about:blank')
            await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => undefined)
            const samples = await page.evaluate(() => {
                const samples: Array<{ color: string; role: string }> = []
                for (const el of Array.from(document.querySelectorAll('button,a,header,nav,[role="button"],body')).slice(0, 600)) {
                    const rect = el.getBoundingClientRect(), style = getComputedStyle(el)
                    if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') continue
                    const role = el.matches('button,[role="button"]') ? 'cta' : el.closest('header,nav') ? 'navigation' : 'link'
                    samples.push({ color: style.color, role }, { color: style.backgroundColor, role })
                }
                return samples
            })
            const colors = rankBrandColors(samples, true)
            // Bound a tall-page capture so images cannot exhaust runner memory.
            const height = loaded ? await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 6000)) : 0
            const screenshot = loaded ? (await page.screenshot({ type: 'jpeg', quality: 55, clip: { x: 0, y: 0, width: 1280, height: Math.max(900, height) }, fullPage: true, timeout: 5000 })).toString('base64') : undefined
            if (loaded) {
                for (let step = 0; step < 12; step++) {
                    const end = await page.evaluate(() => { window.scrollBy({top:800,behavior:'instant'}); return window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2 })
                    await page.waitForTimeout(100)
                    if (end) break
                }
                await page.waitForTimeout(300)
            }
            const carouselFrames = loaded ? await readCarouselFrames(page) : []
            let logoScreenshot: string | undefined
            if (logoUrl) {
                try {
                    await context.close()
                    context = await browser.newContext({ viewport: { width: 800, height: 600 }, ignoreHTTPSErrors: true, serviceWorkers: 'block', acceptDownloads: false })
                    await context.route('**/*', guard)
                    page = await context.newPage()
                    await page.goto('about:blank')
                    await page.setContent('<html><body style="margin:0;background:#eee;display:grid;place-items:center;height:100vh"><img style="max-width:600px;max-height:400px" /></body></html>')
                    await page.locator('img').evaluate((img, src) => { (img as HTMLImageElement).src = src }, logoUrl)
                    await page.waitForFunction(() => { const i = document.querySelector('img'); return i && i.complete && i.naturalWidth > 0 }, undefined, { timeout: 5000 })
                    logoScreenshot = (await page.locator('img').screenshot({ type: 'jpeg', quality: 80, timeout: 3000 })).toString('base64')
                } catch { failure += '; source logo could not be loaded' }
            }
            evidence = { carouselFrames, status: loaded || logoScreenshot ? 'observed' : 'unavailable', url: target.href, capturedAt, colors, screenshot, logoScreenshot, logoUrl, transport,
                ...(!loaded ? { warning: `PW1 website unavailable: ${failure}; ${logoScreenshot ? 'using source logo' : 'no visual evidence'}` } : transport !== 'https' ? { warning: `PW1 read-only scan used ${transport}` } : {}) }

        } catch (error) {
            signal?.throwIfAborted()
            const reason = error instanceof Error ? error.message.split('\n')[0].slice(0, 200) : 'Browser scan failed'
            evidence = { status: 'unavailable', url, capturedAt, colors: [], warning: `PW1 brand scan unavailable: ${reason}; using contextual AI palette` }
        } finally {
            if (timer) clearTimeout(timer)
            signal?.removeEventListener('abort', close)
            await browser?.close().catch(() => undefined)
        }
        if (cache.size >= 100) cache.delete(cache.keys().next().value!)
        cache.set(url + (logoUrl ?? ''), evidence)
        return evidence
    })
}
