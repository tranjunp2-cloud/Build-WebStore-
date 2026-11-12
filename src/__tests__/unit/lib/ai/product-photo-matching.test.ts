/**
 * TC-AIAUD-031 — products get a pool photo only when its tags match the product (#2103 A3).
 * Pure function, real relevance gate (photoMatchesTerms) — no mocks.
 */
import { describe, it, expect } from 'vitest'
import { matchPoolPhotosToProducts } from '@/lib/ai/generate-sample-products'

const photos = [
  { id: 'p-cake', alt: 'cake, cakes, dessert, sweet' },
  { id: 'p-shirt', alt: 'shirt, fashion, clothes' },
  { id: 'p-cookie', alt: 'cookies, biscuit, tin, festive' },
  { id: 'p-cake-2', alt: 'cake, birthday, candles' },
]
const uploaded = new Map([['p-cake', 11], ['p-shirt', 12], ['p-cookie', 13], ['p-cake-2', 14]])

describe('matchPoolPhotosToProducts (TC-AIAUD-031)', () => {
  it('assigns by relevance (AI keyword or merchant name), never by position', () => {
    // Arrange
    const products = [
      { name: 'Kek lapis', imageKeyword: 'layer cake' },
      { name: 'kuih raya box', imageKeyword: 'cookie tin' },
    ]
    // Act
    const ids = matchPoolPhotosToProducts(products, photos, uploaded)
    // Assert — cake photo and cookie photo, not the shirt that sits second in the pool
    expect(ids).toEqual([11, 13])
  })

  it('uses each photo once and leaves a product without a match WITHOUT a photo', () => {
    const products = [
      { name: 'Cake A', imageKeyword: 'cake' },
      { name: 'Cake B', imageKeyword: 'cake' },
      { name: 'Cake C', imageKeyword: 'cake' }, // only two cake photos exist
      { name: 'Laptop stand', imageKeyword: 'laptop stand' }, // nothing relevant in the pool
    ]
    const ids = matchPoolPhotosToProducts(products, photos, uploaded)
    expect(ids).toEqual([11, 14, undefined, undefined])
  })

  it('skips photos that were never uploaded and products with no usable term', () => {
    expect(matchPoolPhotosToProducts([{ name: 'Cake', imageKeyword: 'cake' }], photos, new Map())).toEqual([undefined])
    expect(matchPoolPhotosToProducts([{ name: '   ' }], photos, uploaded)).toEqual([undefined])
  })
})

/**
 * TC-AIAUD-168..169 — a product photo must show the product's KIND (serum, cream, cake, toner …);
 * an ingredient overlap ("vitamin c", "orange", "rose", "honey") is never enough (#2103 A3: Vitamin C Serum got an orange).
 */
import { photoMatchesProductType, productTypeWords } from '@/lib/ai/product-type-match'

describe('product type gate (TC-AIAUD-168)', () => {
  const pool = [
    { id: 'orange', alt: 'orange, fruit, citrus, vitamin c, juice' },
    { id: 'rose', alt: 'rose, flower, petals, pink' },
    { id: 'serum', alt: 'serum, dropper, skincare, bottle' },
    { id: 'cream', alt: 'cream, moisturizer, jar, skincare' },
    { id: 'toner', alt: 'toner, mist, skincare' },
    { id: 'honey', alt: 'honey, jar, bees' },
    { id: 'cake', alt: 'cake, dessert, birthday' },
    { id: 'shirt', alt: 'shirt, fashion, clothes' },
  ]
  const up = new Map(pool.map((p, i) => [p.id, i + 1]))

  it('TC-AIAUD-168: "Vitamin C Serum" never gets the orange photo, even when the AI keyword is the ingredient', () => {
    const ids = matchPoolPhotosToProducts([{ name: 'Vitamin C Serum', imageKeyword: 'orange' }], pool, up)
    expect(ids).toEqual([up.get('serum')])
  })

  it('TC-AIAUD-168: with only the ingredient photos in the pool the product gets no image', () => {
    const ingredientOnly = pool.filter((p) => ['orange', 'rose', 'honey'].includes(p.id))
    const ids = matchPoolPhotosToProducts(
      [
        { name: 'Vitamin C Serum', imageKeyword: 'orange vitamin c' },
        { name: 'Rose Water Toner', imageKeyword: 'rose' },
        { name: 'Honey Rose Soap', imageKeyword: 'honey' },
      ],
      ingredientOnly,
      up,
    )
    expect(ids).toEqual([undefined, undefined, undefined])
  })

  it('TC-AIAUD-168: the product form wins over the ingredient ("Chocolate Cake" is a cake, "Honey Rose Soap" a soap)', () => {
    expect(productTypeWords({ name: 'Chocolate Cake' })).toContain('cake')
    expect(productTypeWords({ name: 'Chocolate Cake' })).not.toContain('chocolate')
    expect(productTypeWords({ name: 'Honey Rose Soap' })).toContain('soap')
    expect(productTypeWords({ name: 'Raw Honey' })).toContain('honey')
    expect(productTypeWords({ name: 'Kek coklat' })).toContain('kek')
  })

  it('TC-AIAUD-168: type words match plurals, compounds and synonyms in the tags', () => {
    expect(photoMatchesProductType('serums, dropper', { name: 'Brightening Serum' })).toBe(true)
    expect(photoMatchesProductType('cupcakes, frosting', { name: 'Vanilla Cake' })).toBe(true)
    expect(photoMatchesProductType('moisturizer, jar', { name: 'Night Cream' })).toBe(true)
    // a different kind of product is not a match
    expect(photoMatchesProductType('cream, moisturizer', { name: 'Vitamin C Serum' })).toBe(false)
    expect(photoMatchesProductType('cake, dessert', { name: 'Rose Toner' })).toBe(false)
  })

  it('TC-AIAUD-169: a name outside the lexicon needs its head noun in the tags; no usable name means no image', () => {
    expect(productTypeWords({ name: 'Leather Wallet Gift Set' })).toContain('wallet')
    expect(productTypeWords({ name: 'Laptop stand' })).toEqual(['stand'])
    expect(productTypeWords({ name: 'Brightening Serum with Vitamin C' })).toContain('serum')
    expect(productTypeWords({ name: 'Phone case' })).toEqual(['case'])
    expect(productTypeWords({ name: 'Standing desk bundle' })).toEqual(['desk'])
    expect(photoMatchesProductType('stand, desk, laptop', { name: 'Laptop stand' })).toBe(true)
    expect(photoMatchesProductType('laptop, keyboard', { name: 'Laptop stand' })).toBe(false)
    expect(photoMatchesProductType('cake', { name: '   ' })).toBe(false)
    expect(photoMatchesProductType(null, { name: 'Serum' })).toBe(false)
  })

  it('TC-AIAUD-169: keeps the existing relevant matches (cake, cookie tin, shirt) working', () => {
    const ids = matchPoolPhotosToProducts(
      [{ name: 'Kek lapis', imageKeyword: 'layer cake' }, { name: 'Cotton Shirt', imageKeyword: 'shirt' }],
      pool,
      up,
    )
    expect(ids).toEqual([up.get('cake'), up.get('shirt')])
  })
})

// GH-1611 round 3: sản phẩm "bánh" (tiếng Việt) không có ảnh → block hiển thị ảnh steak mẫu.
describe('Vietnamese product names (TC-GH1611-41..43)', () => {
  const pool = [
    { id: 'v-shirt', alt: 'shirt, fashion, clothes' },
    { id: 'v-muffin', alt: 'muffins, cupcake, bakery' },
    { id: 'v-bread', alt: 'bread, baguette, bakery' },
    { id: 'v-candy', alt: 'candy, sweets, colorful' },
    { id: 'v-engine', alt: 'engine, motorbike, repair' },
  ]
  const ids = new Map(pool.map((p, i) => [p.id, 100 + i]))

  it('TC-GH1611-41: maps VN bakery names to EN type words, bánh mì stays bread', () => {
    expect(productTypeWords({ name: 'bánh' })).toEqual(expect.arrayContaining(['cake', 'cupcake', 'muffin', 'pastry']))
    expect(productTypeWords({ name: 'Bánh Kem Dâu' })).toContain('cake')
    expect(productTypeWords({ name: 'banh ngot' })).toContain('pastry')
    expect(productTypeWords({ name: 'bánh mì' })).toContain('bread')
    expect(productTypeWords({ name: 'bánh mì' })).not.toContain('cake')
    expect(productTypeWords({ name: 'kẹo' })).toContain('candy')
    // bare "bánh" is not matched inside a savory dish name; English names are unchanged
    expect(productTypeWords({ name: 'bánh canh' })).not.toContain('cake')
    expect(productTypeWords({ name: 'Kek lapis' })).toContain('cake')
  })

  it('TC-GH1611-42: "bánh" gets a bakery photo, never clothing — with or without an AI keyword', () => {
    const withKeyword = matchPoolPhotosToProducts([{ name: 'bánh', imageKeyword: 'cake' }], pool, ids)
    const nameOnly = matchPoolPhotosToProducts([{ name: 'bánh' }], pool, ids)
    expect(withKeyword).toEqual([ids.get('v-muffin')])
    expect(nameOnly).toEqual([ids.get('v-muffin')])
  })

  it('TC-GH1611-43: unrecognised VN product with no matching photo gets none', () => {
    expect(matchPoolPhotosToProducts([{ name: 'linh kiện xe', imageKeyword: 'motorbike part' }], [pool[0]!, pool[1]!], ids))
      .toEqual([undefined])
  })

  it('TC-GH1611-44: bakery tools/accessories keep their own type — cake-only pool gives them no photo', () => {
    const cakeOnly = [{ id: 'c1', alt: 'cake, dessert, birthday' }]
    const up = new Map([['c1', 1]])
    expect(matchPoolPhotosToProducts([{ name: 'Khuôn bánh kem', imageKeyword: 'cake mold' }], cakeOnly, up)).toEqual([undefined])
    expect(matchPoolPhotosToProducts([{ name: 'Bánh kem stand', imageKeyword: 'cake stand' }], cakeOnly, up)).toEqual([undefined])
    expect(matchPoolPhotosToProducts([{ name: 'Đế bánh kem' }], cakeOnly, up)).toEqual([undefined])
    // cake as the thing the product is FOR (head noun is not the cake) → no photo
    expect(matchPoolPhotosToProducts([{ name: 'Nến bánh kem', imageKeyword: 'birthday candle' }], cakeOnly, up)).toEqual([undefined])
    expect(matchPoolPhotosToProducts([{ name: 'Hộp đựng bánh kem' }], cakeOnly, up)).toEqual([undefined])
    // filler in front does not change the type
    expect(matchPoolPhotosToProducts([{ name: 'Combo bánh kem mini' }], cakeOnly, up)).toEqual([1])
    // the real cake still matches
    expect(matchPoolPhotosToProducts([{ name: 'Bánh Kem Dâu', imageKeyword: 'cake' }], cakeOnly, up)).toEqual([1])
  })

  it('TC-GH1611-45: unaccented names and "bánh quy"/"kẹo" reach the matcher too', () => {
    const mixed = [
      { id: 'm-pastry', alt: 'pastry, tart' },
      { id: 'm-cookie', alt: 'cookies, biscuit' },
      { id: 'm-candy', alt: 'candy, sweets' },
      { id: 'm-shirt', alt: 'shirt, fashion' },
    ]
    const up = new Map(mixed.map((p, i) => [p.id, 200 + i]))
    expect(matchPoolPhotosToProducts([{ name: 'banh ngot' }], mixed, up)).toEqual([200])
    expect(matchPoolPhotosToProducts([{ name: 'bánh quy' }], mixed, up)).toEqual([201])
    expect(matchPoolPhotosToProducts([{ name: 'kẹo' }], mixed, up)).toEqual([202])
    expect(matchPoolPhotosToProducts([{ name: 'keo' }], mixed, up)).toEqual([202])
  })
})
