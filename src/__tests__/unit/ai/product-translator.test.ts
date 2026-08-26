/**
 * Unit tests for product-translator.
 *
 * Coverage: TC-F01-W.06b — Malay/Vietnamese product terms → English Unsplash query.
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import { describe, it, expect } from 'vitest'
import {
  translateProductTerm,
  translateKnownProductTerm,
  translateKnownProductTerms,
  translatePrimaryProduct,
  VI_MS_TO_EN,
} from '@/lib/ai/product-translator'

describe('TC-F01-W.06b — product-translator', () => {
  describe('translateProductTerm — dict hits', () => {
    it('translates "nasi lemak" → "malaysian coconut rice"', () => {
      expect(translateProductTerm('nasi lemak')).toBe('malaysian coconut rice')
    })

    it('translates "phở" (with diacritic) → "vietnamese pho noodle soup"', () => {
      expect(translateProductTerm('phở')).toBe('vietnamese pho noodle soup')
    })

    it('translates "pho" (without diacritic) → "vietnamese pho noodle soup"', () => {
      expect(translateProductTerm('pho')).toBe('vietnamese pho noodle soup')
    })

    it('is case-insensitive', () => {
      expect(translateProductTerm('Nasi Lemak')).toBe('malaysian coconut rice')
      expect(translateProductTerm('NASI LEMAK')).toBe('malaysian coconut rice')
    })

    it('trims whitespace before lookup', () => {
      expect(translateProductTerm('  teh tarik  ')).toBe('malaysian pulled milk tea')
    })

    it('translates the Malay product phrases from a failed AI translation', () => {
      expect(translateProductTerm('Kopi gula Melaka')).toBe('malaysian palm sugar coffee')
      expect(translateProductTerm('Roti bakar kaya')).toBe('malaysian kaya toast')
      expect(translateProductTerm('Nasi lemak pandan')).toBe('malaysian pandan coconut rice')
    })

    it('recognizes a known phrase inside a longer product label', () => {
      expect(translateKnownProductTerm('Signature nasi lemak pandan set')).toBe('malaysian pandan coconut rice')
    })
  })

  describe('translateKnownProductTerms', () => {
    it('returns only known English translations and removes duplicates', () => {
      expect(translateKnownProductTerms([
        'Kopi gula Melaka',
        'unknown seasonal special',
        'kopi gula melaka',
        'Roti bakar kaya',
      ])).toEqual([
        'malaysian palm sugar coffee',
        'malaysian kaya toast',
      ])
    })
  })

  describe('translateProductTerm — pass-through', () => {
    it('passes through plain English terms', () => {
      expect(translateProductTerm('ramen')).toBe('ramen')
      expect(translateProductTerm('sushi')).toBe('sushi')
      expect(translateProductTerm('cheeseburger')).toBe('cheeseburger')
    })

    it('passes through unknown Vietnamese food terms', () => {
      // Term that isn't in the dict — safer to pass through than guess.
      expect(translateProductTerm('cơm chiên dương châu')).toBe('cơm chiên dương châu')
    })

    it('passes through short strings (franc unreliable < 3 chars)', () => {
      expect(translateProductTerm('ab')).toBe('ab')
      expect(translateProductTerm('a')).toBe('a')
    })

    it('returns empty for empty/whitespace input', () => {
      expect(translateProductTerm('')).toBe('')
      expect(translateProductTerm('   ')).toBe('')
    })

    it('handles undefined/null-ish gracefully', () => {
      // TypeScript guards, but runtime sanity check:
      expect(translateProductTerm(undefined as unknown as string)).toBe(undefined)
      expect(translateProductTerm(null as unknown as string)).toBe(null)
    })
  })

  describe('translatePrimaryProduct', () => {
    it('translates first element', () => {
      expect(translatePrimaryProduct(['nasi lemak', 'teh tarik'])).toBe('malaysian coconut rice')
    })

    it('returns empty for empty/undefined list', () => {
      expect(translatePrimaryProduct([])).toBe('')
      expect(translatePrimaryProduct(undefined)).toBe('')
    })

    it('passes through English first element', () => {
      expect(translatePrimaryProduct(['ramen', 'sushi'])).toBe('ramen')
    })
  })

  describe('VI_MS_TO_EN dictionary', () => {
    it('contains at least 50 entries', () => {
      expect(Object.keys(VI_MS_TO_EN).length).toBeGreaterThanOrEqual(50)
    })

    it('has all lowercase keys', () => {
      for (const key of Object.keys(VI_MS_TO_EN)) {
        expect(key).toBe(key.toLowerCase())
      }
    })

    it('has non-empty English values', () => {
      for (const value of Object.values(VI_MS_TO_EN)) {
        expect(value.length).toBeGreaterThan(0)
      }
    })
  })
})
