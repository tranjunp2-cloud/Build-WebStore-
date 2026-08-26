import { describe, it, expect } from 'vitest'
import { detectLanguage, resolveDetectedLanguage } from '@/lib/ai/lang-detect'

// GH-1442: plain English business input was generating sites in a random Latin
// language because franc-min misguessed it (e.g. "Yoga Studio" → Italian) and that
// name became GPT's generation-language instruction (gpLang).
describe('GH-1442: detectLanguage generation language for English input', () => {
    const englishInputs = ['Yoga Studio', 'Yoga Studio wellness classes', 'Pizza Place', 'Nail Salon', 'Coffee Shop', 'Auto Repair', 'Fitness Gym', 'Dental Clinic']
    for (const s of englishInputs) {
        it(`"${s}" → gpLang English (not a misdetected Latin language)`, () => {
            const r = detectLanguage(s)
            expect(r.gpLang).toBe('English')
            expect(r.contentLang).toBe('en')
        })
    }
})

describe('GH-1442: genuine non-English still drives correct generation', () => {
    it('Vietnamese (diacritics) → Vietnamese', () => {
        expect(detectLanguage('Phở bò Hà Nội ngon nhất').gpLang).toBe('Vietnamese')
    })
    it('Malay (word list) → Malay', () => {
        expect(detectLanguage('Kedai runcit barangan keperluan').gpLang).toBe('Malay (Bahasa Melayu)')
    })
    it('Japanese (kana) → Japanese', () => {
        expect(detectLanguage('さくらラーメン 東京').gpLang).toBe('Japanese')
    })
    it('Italian WITH diacritics → Italian (not over-corrected)', () => {
        expect(detectLanguage('Ristorante italiano cucina tradizionale qualità è autenticità').gpLang).toBe('Italian')
    })
    it('[TC-F26-11-04] confirmed Italian locale bypasses re-detection and drives block/prompt locale', () => {
        expect(resolveDetectedLanguage('it')).toEqual({
            contentLang: 'en',
            gpLang: 'Italian',
            blockLang: 'it',
        })
    })
})
