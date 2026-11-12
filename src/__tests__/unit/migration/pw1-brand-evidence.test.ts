import { describe, expect, it } from 'vitest'
import { rankBrandColors } from '@/lib/migration/pw1-brand-evidence'
import { publicBrandAddress, scanPw1Brand } from '@/lib/migration/pw1-brand-scan'

describe('TC-F35.M39 legacy brand evidence', () => {
    it('prioritizes CTA over links and excludes neutral/transparent colors', () => {
        const colors = rankBrandColors([
            { color: 'rgb(10, 100, 180)', role: 'cta' },
            { color: 'rgb(200, 30, 20)', role: 'link' },
            { color: 'rgb(255, 255, 255)', role: 'cta' },
            { color: 'rgba(10, 100, 180, 0)', role: 'cta' },
        ])
        expect(colors).toEqual([{ color: '#0a64b4', score: 5, roles: ['cta'] }, { color: '#c81e14', score: 1, roles: ['link'] }])
    })
    it('rejects internal network addresses and mapped IPv6', () => {
        for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1']) expect(publicBrandAddress(ip)).toBe(false)
        expect(publicBrandAddress('8.8.8.8')).toBe(true)
    })
    it('returns a nonfatal warning for unsupported domains and honors cancellation', async () => {
        const result = await scanPw1Brand('file:///tmp/private')
        expect(result.status).toBe('unavailable')
        expect(result.warning).toContain('Unsupported source URL')
        const controller = new AbortController(); controller.abort()
        await expect(scanPw1Brand('https://example.com', controller.signal)).rejects.toThrow()
    })
})
