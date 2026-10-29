/**
 * TC-F01-CI-CLIENT-LOGOS-01..02 — buildBlockFromLibrary handles client-logos (updated for #2103 A1).
 *
 * The injector still handles the `client-logos` alias (so the Structure Enforcer can inject the
 * mandatory block for recipes `tech-proof` / `biz-proof`), but the logos are only the payment methods
 * the tenant enabled — never the real banks / telcos / retailers the old library listed.
 */

import { describe, it, expect } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'
import { buildGenerationFacts } from '@/lib/ai/generation-facts'

const facts = buildGenerationFacts({
    businessInfo: { businessName: 'Acme' },
    tenant: { payments: { payment_fpx: true, xendit_tng: true, payment_card: false } },
})

describe('buildBlockFromLibrary — client-logos case handler', () => {
    it('TC-F01-CI-CLIENT-LOGOS-01 — returns a logo-cloud block of enabled payment methods', () => {
        const block = buildBlockFromLibrary('client-logos', 'tech', { seed: 42, userBiz: { name: 'Acme', facts } })

        expect(block).not.toBeNull()
        expect(block!.blockType).toBe('logo-cloud')
        expect((block!.logos as Array<{ name: string }>).map((l) => l.name)).toEqual(['FPX', "Touch 'n Go"])
    })

    it('TC-F01-CI-CLIENT-LOGOS-02 — logo items keep the logo-cloud row shape (name-only badges)', () => {
        const block = buildBlockFromLibrary('logo-cloud', 'business', { seed: 7, userBiz: { name: 'Acme', facts } })

        for (const logo of block!.logos as Array<{ name: string; logo: { url: string; alt: string } }>) {
            expect(typeof logo.name).toBe('string')
            expect(logo.name.length).toBeGreaterThan(0)
            expect(logo.logo.url).toBe('')
            expect(logo.logo.alt).toBe(logo.name)
        }
    })

    it('TC-AIAUD-024 — without enabled payment methods no logos are injected (no real brands)', () => {
        expect(buildBlockFromLibrary('client-logos', 'tech', { seed: 42 })).toBeNull()
        expect(buildBlockFromLibrary('logo-cloud', 'business', { seed: 1, userBiz: { name: 'Acme' } })).toBeNull()
    })
})
