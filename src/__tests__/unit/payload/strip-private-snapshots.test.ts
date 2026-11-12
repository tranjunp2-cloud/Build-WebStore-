/**
 * TC-PERF-139 — pages.locale_content is client JSON stored verbatim. A demo page held a testimonial avatar whose
 * `tenant` was the whole tenant row (Xendit / EasyParcel / ECH keys), served back by GET editor-data and GET pages
 * to every editor of the shop. Reads and writes now strip relation rows and private keys.
 */
import { describe, expect, it } from 'vitest'
import { stripPrivateSnapshots } from '@/lib/payload/safe-populate'

describe('stripPrivateSnapshots [TC-PERF-139]', () => {
    it('turns populated tenant / createdBy rows into ids and drops private keys at any depth', () => {
        // Arrange
        const stored = {
            blockA: { en: { testimonials: [{ name: 'Siti', avatar: { id: 4, url: '/a.jpg', alt: 'Siti',
                tenant: { id: 1, name: 'Kedai', xenditSecretKey: 'xnd_secret', echIntegration: { apiKey: 'ech' } },
                createdBy: { id: 3, otpHash: 'f'.repeat(64), keyString: 'enc' } } }] } },
            blockB: { ms: { note: { magicLinkSecret: 'mls', xenditCallbackToken: 'cb', text: 'Hai' } } },
        }

        // Act
        const clean = stripPrivateSnapshots(stored)

        // Assert
        expect(clean.blockA.en.testimonials[0].avatar).toEqual({ id: 4, url: '/a.jpg', alt: 'Siti', tenant: 1, createdBy: 3 })
        expect(clean.blockB.ms.note).toEqual({ text: 'Hai' })
        expect(JSON.stringify(clean)).not.toMatch(/xnd_secret|"ech"|f{64}|"enc"|mls|"cb"/)
    })

    it('keeps ordinary content untouched (ids, strings, a block field named hash)', () => {
        const content = { hero: { en: { title: 'Hello', tenant: 5, links: [{ hash: '#menu', label: 'Menu' }] } } }
        expect(stripPrivateSnapshots(content)).toEqual(content)
    })
})
