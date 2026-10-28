import { describe, it, expect } from 'vitest'
import { isPublicIp } from '@/lib/sso/avatar-sync/is-public-ip'

// TC-F23-SSO-08: the SSRF guard only lets globally routable unicast addresses through
describe('isPublicIp (GH-1723)', () => {
    it.each([
        '8.8.8.8',
        '52.219.128.1',
        '1.1.1.1',
        '172.15.255.255', // just below 172.16/12
        '172.32.0.1', // just above 172.16/12
        '100.63.255.255', // just below CGNAT 100.64/10
        '2606:4700:4700::1111',
        '2a00:1450:4001:81b::200e',
        '::ffff:8.8.8.8', // IPv4-mapped public
        '::ffff:0:808:808', // IPv4-translated public
        '64:ff9b::808:808', // NAT64 → public
        '2001:4860:4860::8888', // public Google DNS (2001:4860 is not an ORCHID/Teredo range)
    ])('allows public address %s', (ip) => {
        expect(isPublicIp(ip)).toBe(true)
    })

    it.each([
        ['0.0.0.0', 'this network'],
        ['10.0.0.1', 'private 10/8'],
        ['127.0.0.1', 'loopback'],
        ['127.255.255.254', 'loopback range'],
        ['100.64.0.1', 'CGNAT'],
        ['169.254.169.254', 'link-local / cloud metadata'],
        ['172.16.0.1', 'private 172.16/12 start'],
        ['172.31.255.255', 'private 172.16/12 end'],
        ['192.168.0.1', 'private 192.168/16'],
        ['192.0.0.1', 'IETF protocol assignments'],
        ['198.18.0.1', 'benchmarking'],
        ['203.0.113.5', 'documentation'],
        ['192.88.99.1', '6to4 relay anycast'],
        ['224.0.0.1', 'multicast'],
        ['255.255.255.255', 'broadcast'],
        ['::', 'unspecified'],
        ['::1', 'IPv6 loopback'],
        ['fe80::1', 'IPv6 link-local'],
        ['fd12:3456:789a::1', 'IPv6 unique-local'],
        ['fc00::1', 'IPv6 unique-local fc00'],
        ['ff02::1', 'IPv6 multicast'],
        ['2001:db8::1', 'IPv6 documentation'],
        ['2001:0:4136:e378:8000:63bf:3fff:fdd2', 'IPv6 Teredo'],
        ['fec0::1', 'IPv6 site-local'],
        ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
        ['::ffff:10.0.0.1', 'IPv4-mapped private'],
        ['::ffff:a9fe:a9fe', 'IPv4-mapped metadata (hex form)'],
        ['64:ff9b::7f00:1', 'NAT64 → loopback'],
        ['2002:7f00:1::1', '6to4 → loopback'],
        ['::ffff:0:7f00:1', 'IPv4-translated → loopback'],
        ['::ffff:0:a00:1', 'IPv4-translated → private 10/8'],
        ['64:ff9b:1::1', 'local-use NAT64'],
        ['100::1', 'discard-only 100::/64'],
        ['2001:10::1', 'ORCHID 2001:10::/28'],
        ['2001:2f::1', 'ORCHIDv2 2001:20::/28 end'],
    ])('blocks %s (%s)', (ip) => {
        expect(isPublicIp(ip)).toBe(false)
    })

    it.each(['', 'not-an-ip', '999.1.1.1', '1.2.3', '1.2.3.4.5', '12345::1', 'example.com'])('rejects malformed input %j', (value) => {
        expect(isPublicIp(value)).toBe(false)
    })
})
