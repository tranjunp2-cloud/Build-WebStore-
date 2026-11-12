/**
 * GH-1611 — QA reject: a flower/bakery merchant on a generic category still got
 * canned fashion/grocery/electronics sample identity (Nurul Modest Fashion,
 * FreshBox Grocer, Wireless Earbuds…). The merchant's own data must win; this
 * pins that the library sample never leaks into blocks built for a real merchant.
 *
 * TC-GH1611-36
 */
import { describe, it, expect } from 'vitest'
import { buildBlockFromLibrary } from '@/lib/ai/content-injection'

const CANNED = /Nurul|FreshBox|Baju Kurung|Earbuds|Organic Honey|Batik|Wei Liang|Kampung Crafts|Aisyah/i
const BLOCKS = ['hero', 'about', 'contact', 'footer', 'cta'] as const

describe('TC-GH1611-36 — generic category never leaks another industry\'s sample identity', () => {
    it.each(['ecommerce', 'business'])('category=%s with a real merchant', (category) => {
        for (let seed = 0; seed < 12; seed++) {
            for (const blockType of BLOCKS) {
                const block = buildBlockFromLibrary(blockType, category, {
                    seed,
                    businessName: 'Tiệm Hoa Mai',
                    userBiz: {
                        name: 'Tiệm Hoa Mai',
                        description: 'Hoa hồng, hoa cúc, hoa tươi giao tận nơi.',
                        products: ['hoa hồng', 'hoa cúc'],
                    },
                })
                expect(JSON.stringify(block ?? {})).not.toMatch(CANNED)
            }
        }
    })
})
