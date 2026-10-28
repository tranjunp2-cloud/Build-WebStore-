/**
 * F26: resolveInitialActiveLocale — editor reload locale restore
 * TC-IDs: TC-F26-01-02 (locale persist after reload), TC-F26-05 round-trip
 *
 * Regression for the bug where reloading an MS-switched page snapped the header (and
 * the language switcher) back to the base/EN language: the load path ignored the
 * persisted site.locale and always used generationLocale.
 */

import { describe, it, expect } from 'vitest'
import { detectLocaleFromText, resolveInitialActiveLocale } from '@/lib/detect-locale'
import { siteLanguages, siteLanguagesOf } from '@/lib/site-languages'

describe('TC-F26-01-01: detectLocaleFromText distinguishes CJK languages', () => {
    it('Japanese text (kanji + kana) → ja, not zh (the reported bug)', () => {
        // Kanji are shared CJK ideographs; only the kana proves it is Japanese.
        expect(detectLocaleFromText('さくらラーメン 東京の老舗ラーメン店です')).toBe('ja')
    })

    it('katakana-only product line → ja', () => {
        expect(detectLocaleFromText('ラーメン、ギョーザ、ビール')).toBe('ja')
    })

    it('pure Chinese (kanji, no kana) still → zh (regression guard)', () => {
        expect(detectLocaleFromText('北京烤鸭店 我们提供正宗的中华美食')).toBe('zh')
    })

    it('Korean (hangul) → ko, not zh', () => {
        expect(detectLocaleFromText('서울 김치찌개 전문점입니다')).toBe('ko')
    })
})

describe('TC-F26-01-08: plain English input is not misdetected as another language (GH-1442)', () => {
    // franc-min misguesses short, noun-heavy English business text as random Latin
    // languages (fr/es/it/nl/vi…), which used to pop the "did you mean <X>?" modal.
    // Pure-ASCII Latin input must resolve to en (or ms), never a diacritic language.
    const englishBusinessInputs = [
        'Yoga Studio',                 // reported: was misdetected as Italian
        'Yoga Studio classes',
        'Bestie Nail Salon and spa',
        'Sunny Yoga Studio wellness classes',
        'Green Garden landscaping services',
        'Blue Ocean Spa massage therapy',
        'Elite Real Estate agency homes',
        'Royal Tailor custom suits clothing',
        'Tech Solutions software development company',
        'Mike Auto Repair car service center',
    ]
    for (const input of englishBusinessInputs) {
        it(`"${input}" → en`, () => {
            expect(detectLocaleFromText(input)).toBe('en')
        })
    }
})

describe('TC-F26-01-09: genuine non-English input is still detected (no over-correction)', () => {
    it('French with diacritics → fr (ASCII gate does not over-correct diacritic languages)', () => {
        expect(detectLocaleFromText('Restaurant français cuisine traditionnelle plats du terroir')).toBe('fr')
    })
    it('Malay (ASCII) → ms (primary locale, modal skipped)', () => {
        expect(detectLocaleFromText('Kedai runcit menjual barangan keperluan harian')).toBe('ms')
    })
    it('Vietnamese with diacritics → vi', () => {
        expect(detectLocaleFromText('Nhà hàng phở bò truyền thống Hà Nội')).toBe('vi')
    })
})

describe('TC-F26-01-02: resolveInitialActiveLocale restores persisted view locale', () => {
    it('EN-base site switched to MS → reload stays MS (the reported bug)', () => {
        // generationLocale=en (site authored in EN), user switched to ms → site.locale='ms'
        expect(resolveInitialActiveLocale('en', 'ms')).toBe('ms')
    })

    it('MS-base site switched to EN → reload stays EN', () => {
        expect(resolveInitialActiveLocale('ms', 'en')).toBe('en')
    })

    it('EN-base site never switched → reload stays EN', () => {
        expect(resolveInitialActiveLocale('en', 'en')).toBe('en')
    })

    it('MS-base site never switched → reload stays MS', () => {
        expect(resolveInitialActiveLocale('ms', 'ms')).toBe('ms')
    })
})

describe('TC-F26-01-07: resolveInitialActiveLocale fallback when no persisted locale', () => {
    it('undefined persisted locale → falls back to generationLocale', () => {
        expect(resolveInitialActiveLocale('en', undefined)).toBe('en')
        expect(resolveInitialActiveLocale('ms', undefined)).toBe('ms')
    })

    it('non en/ms persisted value is ignored → uses generationLocale', () => {
        expect(resolveInitialActiveLocale('en', 'zh')).toBe('en')
    })
})

describe('TC-F26-02-05: non-standard base language keeps native view', () => {
    it('vi-base site → keeps vi even when site.locale slot is ms', () => {
        // For vi/el sites, site.locale is just the translation target slot, not a view pref.
        expect(resolveInitialActiveLocale('vi', 'ms')).toBe('vi')
    })

    it('el-base site → keeps el regardless of persisted slot', () => {
        expect(resolveInitialActiveLocale('el', 'en')).toBe('el')
    })
})

// TC-AIWB-107 — the site's languages are Quick language's (primary + the added secondary);
// a language last viewed in the editor (Sites.locale) but never added does not open the canvas
describe('TC-AIWB-107: the editor opens only in a language the site has', () => {
    it('lists primary, then the secondary once it was added; the edited header first', () => {
        expect(siteLanguages({ generationLocale: 'en', siteLocale: 'ms' })).toEqual(['en'])
        expect(siteLanguages({ primaryLocale: 'en', secondaryLocale: 'ms' })).toEqual(['en', 'ms'])
        expect(siteLanguages({ primaryLocale: 'ms', secondaryLocale: 'ms' })).toEqual(['ms'])
        expect(siteLanguagesOf({ generationLocale: 'en', locale: 'ms', headerBlock: {} })).toEqual(['en'])
        expect(siteLanguagesOf({ generationLocale: 'en', headerBlock: {}, pendingHeaderBlock: { secondaryLocale: 'ms' } })).toEqual(['en', 'ms'])
    })

    it('falls back to the first language when the saved view is not one of them', () => {
        expect(resolveInitialActiveLocale('en', 'ms', ['en'])).toBe('en')
        expect(resolveInitialActiveLocale('en', 'ms', ['en', 'ms'])).toBe('ms')
        expect(resolveInitialActiveLocale('vi', 'en', ['vi'])).toBe('vi')
    })
})
