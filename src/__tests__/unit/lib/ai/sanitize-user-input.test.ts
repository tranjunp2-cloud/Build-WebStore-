/**
 * TC-F01-AI-SANITIZE-01..06 — user input sanitizer guards against the
 * intermittent staging bug "400 We could not parse JSON body" that happens
 * when pasted content carries broken Unicode (lone surrogates, NUL bytes).
 */

import { describe, it, expect } from 'vitest'
import {
    sanitizeForPrompt,
    sanitizeBusinessInfo,
} from '@/lib/ai/sanitize-user-input'

describe('sanitizeForPrompt', () => {
    it('TC-F01-AI-SANITIZE-01 — passes through clean ASCII unchanged', () => {
        expect(sanitizeForPrompt('Hello World')).toBe('Hello World')
    })

    it('TC-F01-AI-SANITIZE-02 — preserves valid emoji surrogate pairs', () => {
        // 😀 (U+1F600) is represented as high+low surrogate pair in UTF-16.
        expect(sanitizeForPrompt('cafe 😀 open')).toBe('cafe 😀 open')
        expect(sanitizeForPrompt('😀')).toBe('😀')
    })

    it('TC-F01-AI-SANITIZE-03 — drops lone high surrogate', () => {
        // \uD800 is a lone high surrogate without a matching low surrogate.
        const broken = 'broken\uD800 text'
        const cleaned = sanitizeForPrompt(broken)
        expect(cleaned).toBe('broken text')
        // No lone surrogates remain.
        expect(cleaned!.charCodeAt(6)).not.toBeGreaterThanOrEqual(0xd800)
    })

    it('TC-F01-AI-SANITIZE-04 — drops lone low surrogate', () => {
        // \uDC00 is a lone low surrogate.
        const broken = 'x\uDC00y'
        expect(sanitizeForPrompt(broken)).toBe('xy')
    })

    it('TC-F01-AI-SANITIZE-05 — strips NUL bytes', () => {
        expect(sanitizeForPrompt('before\x00after')).toBe('beforeafter')
    })

    it('TC-F01-AI-SANITIZE-06 — normalizes CRLF and bare CR to LF', () => {
        expect(sanitizeForPrompt('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
    })

    it('TC-F01-AI-SANITIZE-07 — handles undefined and null', () => {
        expect(sanitizeForPrompt(undefined)).toBeUndefined()
        expect(sanitizeForPrompt(null)).toBeUndefined()
    })

    it('TC-F01-AI-SANITIZE-08 — output is always valid JSON-serializable', () => {
        const inputs = [
            'normal',
            '\uD800lone-high',
            '\uDC00lone-low',
            '\uD83D\uDE00valid-pair',
            'nul\x00byte',
            'crlf\r\nhere',
            '😀🎉',
        ]
        for (const input of inputs) {
            const cleaned = sanitizeForPrompt(input)!
            // JSON.stringify must not throw and must round-trip.
            expect(() => JSON.parse(JSON.stringify({ content: cleaned }))).not.toThrow()
        }
    })
})

describe('sanitizeBusinessInfo', () => {
    it('TC-F01-AI-SANITIZE-10 — sanitizes every string field', () => {
        const raw = {
            businessName: 'Shop\uD800',
            shortDescription: 'Line 1\r\nLine 2',
            industry: 'retail',
            products: 'A\x00B',
            extraField: 'clean',
        }
        const cleaned = sanitizeBusinessInfo(raw)
        expect(cleaned.businessName).toBe('Shop')
        expect(cleaned.shortDescription).toBe('Line 1\nLine 2')
        expect(cleaned.products).toBe('AB')
        expect(cleaned.extraField).toBe('clean')
    })

    it('TC-F01-AI-SANITIZE-11 — leaves non-string fields untouched', () => {
        const raw = {
            businessName: 'x',
            count: 42,
            tags: ['a', 'b'],
            nested: { key: 'value' },
        }
        const cleaned = sanitizeBusinessInfo(raw)
        expect(cleaned.count).toBe(42)
        expect(cleaned.tags).toEqual(['a', 'b'])
        expect(cleaned.nested).toEqual({ key: 'value' })
    })

    it('TC-F01-AI-SANITIZE-12 — does not mutate input', () => {
        const raw = { businessName: '\uD800broken' }
        const copy = { ...raw }
        sanitizeBusinessInfo(raw)
        expect(raw).toEqual(copy)
    })
})
