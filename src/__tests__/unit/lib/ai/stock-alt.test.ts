/**
 * TC-AIAUD-001..005 — buildStockAlt (#2103 A5): readable, deduped, ≤120-char alt text for stock photos.
 */
import { describe, it, expect } from 'vitest'
import { buildStockAlt, MAX_STOCK_ALT_LENGTH } from '@/lib/ai/stock-alt'

const RAW_PIXABAY_TAGS =
  'cake, cakes, Cake, dessert, desserts, sweet, birthday cake, birthday, party, candles, chocolate cake, food, baking, bakery, pastry, cream, icing, delicious, homemade, celebration, cakes, cake'

describe('buildStockAlt (TC-AIAUD-001..004)', () => {
  it('TC-AIAUD-001: dedupes tags case- and plural-insensitively', () => {
    // Arrange / Act
    const alt = buildStockAlt('cake, cakes, Cake, dessert, desserts, sweet')
    // Assert
    expect(alt).toBe('cake, dessert, sweet')
  })

  it('TC-AIAUD-002: prefixes the subject and keeps only 2-3 tags', () => {
    const alt = buildStockAlt(RAW_PIXABAY_TAGS, 'Kek lapis')
    expect(alt).toBe('Kek lapis - cake, dessert, sweet')
    // the subject is never repeated as a tag
    expect(buildStockAlt('kek lapis, cake, dessert', 'Kek lapis')).toBe('Kek lapis - cake, dessert')
  })

  it('TC-AIAUD-003: long repeated tag lists stay within 120 characters', () => {
    const longTags = Array.from({ length: 40 }, (_, i) => `extraordinarily-long-tag-number-${i}`).join(', ')
    const alt = buildStockAlt(longTags, 'A very long business name that keeps going and going for quite a while indeed')
    expect(alt.length).toBeLessThanOrEqual(MAX_STOCK_ALT_LENGTH)
    expect(alt.startsWith('A very long business name')).toBe(true)
    // a subject longer than the cap is cut, never overflows
    expect(buildStockAlt('a, b', 'x'.repeat(300)).length).toBe(MAX_STOCK_ALT_LENGTH)
  })

  it('TC-AIAUD-004: idempotent on its own output; empty tags fall back to the subject', () => {
    const once = buildStockAlt(RAW_PIXABAY_TAGS, 'Bakery')
    expect(buildStockAlt(once, 'Bakery')).toBe(once)
    expect(buildStockAlt('', 'Bakery')).toBe('Bakery')
    expect(buildStockAlt(null, null)).toBe('')
    expect(buildStockAlt(['roti', 'Roti', 'bread'], undefined)).toBe('roti, bread')
  })
})
