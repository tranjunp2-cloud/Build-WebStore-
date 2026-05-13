/**
 * DNS routing check via Cloudflare DNS-over-HTTPS (1.1.1.1).
 *
 * Uses Cloudflare DoH instead of Node.js dns module to avoid false-negatives
 * caused by single-region serverless DNS resolution (issue #975).
 *
 * Check strategy:
 * - Apex domain : A record must include any IP in VERCEL_APEX_A_RECORD
 * - Subdomain   : CNAME must include VERCEL_CNAME_TARGET (direct),
 *                 OR A record fallback (some registrars set A instead of CNAME)
 *
 * Called by verifyCustomDomain after Vercel ownership is confirmed, to ensure
 * traffic actually routes through Vercel before marking the domain active.
 *
 * Env vars read fresh per call (not at module level) so tests can override them.
 */

const DOH_URL = 'https://cloudflare-dns.com/dns-query'
const TIMEOUT_MS = 5000
const HTTPS_TIMEOUT_MS = 10_000

export type DnsRoutingResult = { ok: boolean; message?: string }

interface DoHAnswer { data: string }
interface DoHResponse { Answer?: DoHAnswer[] }

async function queryDoH(name: string, type: 'A' | 'CNAME'): Promise<string[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const res = await fetch(`${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`, {
            headers: { Accept: 'application/dns-json' },
            signal: controller.signal,
            cache: 'no-store',
        })
        if (!res.ok) throw new Error(`DoH HTTP ${res.status}`)
        const data = await res.json() as DoHResponse
        // Normalize: strip trailing dot, lowercase
        return (data.Answer ?? []).map(a => a.data.replace(/\.$/, '').toLowerCase())
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Check DNS routing for a domain after Vercel ownership is confirmed.
 *
 * Apex: A record must resolve to a Vercel IP.
 * Subdomain: CNAME must point to Vercel's CNAME target (direct),
 *            OR A record must resolve to a Vercel IP (registrar fallback).
 */
export async function checkDnsRouting(domain: string, isApex: boolean): Promise<DnsRoutingResult> {
    // Read env vars fresh per call for testability
    const vercelIps = (process.env.VERCEL_APEX_A_RECORD ?? '76.76.21.21')
        .split(',').map(ip => ip.trim()).filter(Boolean)
    const vercelCname = (process.env.VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com').toLowerCase()

    try {
        if (isApex) {
            const aAnswers = await queryDoH(domain, 'A')
            if (aAnswers.some(a => vercelIps.includes(a))) return { ok: true }
            const current = aAnswers.join(', ') || 'none'
            return {
                ok: false,
                message: `A record not pointing to Vercel. Expected: ${vercelIps.join(' or ')} — currently: ${current}`,
            }
        }

        // Subdomain: try CNAME first, then A record fallback
        const cnameAnswers = await queryDoH(domain, 'CNAME')
        if (cnameAnswers.includes(vercelCname)) return { ok: true }

        // Fallback: A record (some registrars don't support CNAME, use A record instead)
        const aAnswers = await queryDoH(domain, 'A')
        if (aAnswers.some(a => vercelIps.includes(a))) return { ok: true }

        const current = cnameAnswers.join(', ') || aAnswers.join(', ') || 'none'
        return {
            ok: false,
            message: `DNS not pointing to Vercel. Expected CNAME: ${vercelCname} — currently: ${current}`,
        }
    } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
            return { ok: false, message: 'DNS routing check timed out. Please try again.' }
        }
        return { ok: false, message: 'DNS routing check failed. Please try again.' }
    }
}

/**
 * Verify domain is actually accessible over HTTPS.
 *
 * Called after Vercel ownership and DNS routing are confirmed (TC-F19.12, TC-F19.13).
 * Any HTTP response — even 4xx/5xx — means SSL is provisioned and Vercel is serving the domain.
 * SSL handshake errors indicate the certificate is still being provisioned by Vercel.
 *
 * @precondition Must only be called after `checkDnsRouting` returns `ok: true`. That check
 * confirms via Cloudflare DoH that the domain resolves to a known Vercel IP, which prevents
 * DNS-based SSRF (a domain resolving to a private/metadata IP would fail the DNS check first).
 * Calling this function directly on an unvalidated domain bypasses that protection.
 */
export async function checkHttpsConnectivity(domain: string): Promise<DnsRoutingResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HTTPS_TIMEOUT_MS)
    try {
        await fetch(`https://${domain}`, {
            method: 'HEAD',
            redirect: 'manual',
            signal: controller.signal,
        })
        return { ok: true }
    } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
            return { ok: false, message: 'Domain connection timed out. Please try again in a few minutes.' }
        }
        const errMsg = String((err as Error)?.message ?? '')
        const causeMsg = String(((err as { cause?: Error })?.cause)?.message ?? '')
        const errCode = String((err as NodeJS.ErrnoException)?.code ?? ((err as { cause?: NodeJS.ErrnoException })?.cause)?.code ?? '')
        const combined = `${errMsg} ${causeMsg} ${errCode}`.toLowerCase()
        if (
            combined.includes('certificate') ||
            combined.includes('ssl') ||
            combined.includes('tls') ||
            combined.includes('cert') ||
            combined.includes('eproto') ||
            combined.includes('err_tls_')
        ) {
            return { ok: false, message: 'SSL certificate is being provisioned. Please try again in 1–2 minutes.' }
        }
        return { ok: false, message: 'Domain is not yet accessible. Please try again in a few minutes.' }
    } finally {
        clearTimeout(timer)
    }
}
