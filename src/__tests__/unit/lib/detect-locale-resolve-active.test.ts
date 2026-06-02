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
