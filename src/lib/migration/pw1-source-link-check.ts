import { adaptWebsiteInput } from './pw2-website-input'
import type { MigrationDestination } from './pw1-destination'
import { lookup } from 'node:dns/promises'
import { publicBrandAddress } from './pw1-brand-scan'
import type { SourceLinkFinding } from './pw1-links'

export type SourceLinkCheck = {
    url: string; checkedAt: string; status: 'broken' | 'retained'; reason: string; httpStatus?: number; finalUrl?: string; inventory?: SourcePageInventory
}
export type SourcePageInventory = { storeId:string; paths:string[] }
/** Only accept a complete, nonempty, single-store response; incomplete pagination is not absence evidence. */
export function verifiedSourceInventory(value: unknown, storeId: string): SourcePageInventory | undefined {
    if (!value || typeof value !== 'object') return
    const body = value as {data?:unknown;meta?:{pagination?:{total?:unknown;count?:unknown;current_page?:unknown;total_pages?:unknown}}}
    const rows = body.data, pagination = body.meta?.pagination
    if (!Array.isArray(rows) || !rows.length || rows.length > 500 || !pagination ||
        pagination.current_page !== 1 || pagination.total_pages !== 1 || pagination.total !== rows.length || pagination.count !== rows.length) return
    const paths:string[] = []
    for (const row of rows) {
        if (!row || typeof row !== 'object' || String(row.store_id) !== storeId || typeof row.url !== 'string' || !row.url.startsWith('/') || row.url.startsWith('//') || row.url.includes('\\')) return
        const url = new URL(row.url, 'https://source.invalid')
        if (url.origin !== 'https://source.invalid' || url.search || url.hash) return
        paths.push(url.pathname.replace(/\/$/, '') || '/')
    }
    return {storeId,paths}
}
export function sourceLinkResponse(url: string, httpStatus: number, finalUrl: string, evidence?: {inventory?:SourcePageInventory;renderedNotFound?:boolean}): SourceLinkCheck {
    const sameHost = new URL(url).host === new URL(finalUrl).host
    const path = new URL(url).pathname.replace(/\/$/, '') || '/'
    const finalPath = new URL(finalUrl).pathname.replace(/\/$/, '') || '/'
    const missing = evidence?.inventory && !evidence.inventory.paths.includes(path) && !evidence.inventory.paths.includes(finalPath)
    const rendered = evidence?.renderedNotFound
    const broken = sameHost && ([404, 410].includes(httpStatus) || (httpStatus === 200 && (missing || rendered)))
    return { url, checkedAt: new Date().toISOString(), httpStatus, status: broken ? 'broken' : 'retained',
        reason: !sameHost ? 'redirect-outside-source' : broken ? [404,410].includes(httpStatus) ? `source-http-${httpStatus}` : missing ? 'absent-from-complete-source-page-inventory' : 'source-rendered-not-found' : `source-http-${httpStatus}-no-mapped-page` }
}

export function inspectSourceNotFound(): boolean {
    const visible = (el:Element) => { const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden' }
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,[role="heading"]')).filter(visible).map(el=>el.textContent?.trim() ?? '')
    const missingHeading = headings.some(text=>/^(?:404(?:\s+Page)?|(?:404\s+Page\s+)?Page Not Found[!]?|Page[ -]Not[ -]Found)$/i.test(text))
    const home = Array.from(document.querySelectorAll('a,button')).some(el=>visible(el)&&/back to home/i.test(el.textContent ?? ''))
    return missingHeading && home
}

/** CLI-only, bounded verification of missing page links. Never probes BE/entity or external links.
 * Unreachable sources and SPA HTTP 200 shells are not proof of a deleted page.
 */
export async function checkMissingSourceLinks(sourceUrl: string, findings: readonly SourceLinkFinding[], signal?: AbortSignal, storeId?: string): Promise<SourceLinkCheck[]> {
    const source = new URL(sourceUrl)
    const urls = [...new Set(findings.filter(f => f.reason === 'missing-page').map(f => f.url))]
    if (!urls.length) return []
    const retained = (url: string, reason: string): SourceLinkCheck => ({ url, reason, status: 'retained', checkedAt: new Date().toISOString() })
    let browser: import('playwright').Browser | undefined
    const close = () => { void browser?.close().catch(() => undefined) }
    let timer: ReturnType<typeof setTimeout> | undefined
    const results: SourceLinkCheck[] = []
    try {
        signal?.throwIfAborted()
        const { chromium } = await import('playwright')
        browser = await chromium.launch({ timeout: 10000 })
        signal?.throwIfAborted()
        signal?.addEventListener('abort', close, { once: true })
        timer = setTimeout(close, 60000)
        const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', acceptDownloads: false })
        await context.route('**/*', async route => {
            try {
                const target = new URL(route.request().url())
                if (!['http:', 'https:'].includes(target.protocol) || (route.request().isNavigationRequest() && target.host !== source.host) || target.username || target.password || target.port || ['media','websocket'].includes(route.request().resourceType())) return await route.abort()
                const addresses = await lookup(target.hostname, { all: true })
                if (!addresses.length || addresses.some(a => !publicBrandAddress(a.address))) return await route.abort()
                await route.continue()
            } catch { await route.abort().catch(() => undefined) }
        })
        for (const url of urls.slice(0, 10)) {
            signal?.throwIfAborted()
            const target = new URL(url)
            if (target.host !== source.host || target.username || target.password || target.port) { results.push(retained(url, 'unsupported-source-url')); continue }
            let page = await context.newPage()
            let inventory: SourcePageInventory | undefined
            const reads: Promise<void>[] = []
            const observe = (response: import('playwright').Response) => {
                if (!storeId || new URL(response.url()).pathname !== '/pages' || response.status() !== 200 ||
                    !['xhr','fetch'].includes(response.request().resourceType())) return
                reads.push((async()=>{
                    try {
                        const body = await response.json()
                        const verified = verifiedSourceInventory(body, storeId)
                        if (verified) inventory = verified
                    } catch { /* An unreadable response supplies no inventory evidence. */ }
                })())
            }
            page.on('response',observe)
            try {
                let response: import('playwright').Response | null
                try { response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 7000 }) }
                catch(error) {
                    signal?.throwIfAborted()
                    // Fresh page avoids Chrome's pending TLS-error navigation cancelling HTTP fallback.
                    if (target.protocol !== 'https:' || !/ERR_SSL|ERR_CERT|certificate/i.test(error instanceof Error ? error.message : '')) throw error
                    await page.close()
                    page = await context.newPage()
                    page.on('response',observe)
                    const fallback = new URL(url); fallback.protocol='http:'
                    response = await page.goto(fallback.href,{waitUntil:'domcontentloaded',timeout:7000})
                }
                if (!response) { results.push(retained(url,'no-source-response')); continue }
                if (response.status() === 200) {
                    // Allow PW1 SPA bootstrap to resolve its page inventory and not-found view.
                    await page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>undefined)
                    await page.waitForTimeout(1000)
                    await Promise.race([Promise.all(reads),new Promise(resolve=>setTimeout(resolve,1000))])
                }
                const renderedNotFound = await page.evaluate<boolean>('(() => { const __name = (fn) => fn; return (' + inspectSourceNotFound.toString() + ')(); })()')
                const check = sourceLinkResponse(url,response.status(),page.url(),{inventory,renderedNotFound})
                results.push({...check,...(inventory ? {inventory} : {}),finalUrl:page.url()})
            } catch (error) {
                signal?.throwIfAborted()
                const message = error instanceof Error ? error.message : ''
                results.push(retained(url, /ERR_SSL|ERR_CERT|certificate/i.test(message) ? 'source-tls-error' : /Timeout/i.test(message) ? 'source-timeout' : 'source-unreachable-or-redirect-blocked'))
            }
            finally { await page.close().catch(() => undefined) }
        }
    } catch (error) {
        if (signal?.aborted) throw signal.reason ?? error
        // Scanner failure must not turn an unverified source link into a destructive edit.
    } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', close)
        await browser?.close().catch(() => undefined)
    }
    for (const url of urls) if (!results.some(r => r.url === url)) results.push(retained(url, 'verification-unavailable-or-budget-exhausted'))
    return results
}

/** Shared by the batch runner and read-only verification; never edits destination data. */
export async function prepareSourceLinks(input: unknown, categories: MigrationDestination['productCategories'] = [], signal?: AbortSignal) {
    const initial = adaptWebsiteInput(input, categories)
    const sourceLinkChecks = await checkMissingSourceLinks(initial.contract.source.url, initial.report.linkFindings, signal, initial.contract.source.storeId)
    const adapted = adaptWebsiteInput(input, categories, sourceLinkChecks.filter(check => check.status === 'broken').map(check => check.url))
    return { adapted, sourceLinkChecks }
}
