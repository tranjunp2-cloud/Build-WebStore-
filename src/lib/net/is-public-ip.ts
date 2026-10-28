import { isIP } from 'node:net'

/**
 * True only for globally routable unicast addresses. The shared SSRF guard of server-side fetches
 * (SSO avatar download GH-1723, the website scraper `lib/ai/url-scraper.ts`): keeps them away from
 * loopback, private, link-local (cloud metadata 169.254.169.254), CGNAT, multicast and other reserved
 * ranges, including IPv4 embedded in IPv6 (mapped, compatible, NAT64, 6to4). No configuration needed.
 */

function parseIPv4(addr: string): number[] | null {
    const parts = addr.split('.')
    if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return null
    const octets = parts.map(Number)
    return octets.every((n) => n <= 255) ? octets : null
}

function isPublicIPv4([a, b, c]: number[]): boolean {
    if (a === 0 || a === 10 || a === 127) return false // this-network, private, loopback
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT 100.64.0.0/10
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata endpoint
    if (a === 172 && b >= 16 && b <= 31) return false // private
    if (a === 192 && b === 168) return false // private
    if (a === 192 && b === 88 && c === 99) return false // 6to4 relay anycast (deprecated)
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false // IETF protocol / documentation
    if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
    if (a === 198 && b === 51 && c === 100) return false // documentation
    if (a === 203 && b === 0 && c === 113) return false // documentation
    if (a >= 224) return false // multicast, reserved, broadcast
    return true
}

/** Expand an IPv6 literal into eight 16-bit groups, or null when malformed. */
function parseIPv6(input: string): number[] | null {
    let s = input.toLowerCase()
    const zone = s.indexOf('%')
    if (zone >= 0) s = s.slice(0, zone)

    const lastColon = s.lastIndexOf(':')
    const tail = s.slice(lastColon + 1)
    if (tail.includes('.')) {
        const o = parseIPv4(tail)
        if (!o) return null
        s = `${s.slice(0, lastColon + 1)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
    }

    const halves = s.split('::')
    if (halves.length > 2) return null
    const toGroups = (str: string) =>
        str === '' ? [] : str.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
    const head = toGroups(halves[0])
    const rest = halves.length === 2 ? toGroups(halves[1]) : []
    if ([...head, ...rest].some(Number.isNaN)) return null
    if (halves.length === 1) return head.length === 8 ? head : null
    const fill = 8 - head.length - rest.length
    return fill >= 1 ? [...head, ...new Array<number>(fill).fill(0), ...rest] : null
}

const embeddedV4 = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255]

function isPublicIPv6(g: number[]): boolean {
    const zeros = (n: number) => g.slice(0, n).every((x) => x === 0)
    if (zeros(8)) return false // ::
    if (zeros(7) && g[7] === 1) return false // ::1
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): judge by the embedded IPv4
    if (zeros(5) && (g[5] === 0xffff || g[5] === 0)) return isPublicIPv4(embeddedV4(g[6], g[7]))
    // IPv4-translated (::ffff:0:a.b.c.d, ::ffff:0:0/96): judge by the embedded IPv4
    if (zeros(4) && g[4] === 0xffff && g[5] === 0) return isPublicIPv4(embeddedV4(g[6], g[7]))
    // NAT64 64:ff9b::/96 → embedded IPv4
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPublicIPv4(embeddedV4(g[6], g[7]))
    if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return false // local-use NAT64 64:ff9b:1::/48
    if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return false // discard-only 100::/64
    if (g[0] === 0x2002) return isPublicIPv4(embeddedV4(g[1], g[2])) // 6to4 → embedded IPv4
    if ((g[0] & 0xfe00) === 0xfc00) return false // unique local fc00::/7
    if ((g[0] & 0xffc0) === 0xfe80) return false // link-local fe80::/10
    if ((g[0] & 0xffc0) === 0xfec0) return false // site-local fec0::/10 (deprecated)
    if ((g[0] & 0xff00) === 0xff00) return false // multicast
    if (g[0] === 0x2001 && g[1] === 0x0db8) return false // documentation
    if (g[0] === 0x2001 && g[1] === 0) return false // Teredo 2001::/32
    if (g[0] === 0x2001 && g[1] >= 0x10 && g[1] <= 0x2f) return false // ORCHID / ORCHIDv2 2001:10::/28, 2001:20::/28
    return true
}

export function isPublicIp(address: string): boolean {
    const family = isIP(address)
    if (family === 4) {
        const octets = parseIPv4(address)
        return octets !== null && isPublicIPv4(octets)
    }
    if (family === 6) {
        const groups = parseIPv6(address)
        return groups !== null && isPublicIPv6(groups)
    }
    return false
}
