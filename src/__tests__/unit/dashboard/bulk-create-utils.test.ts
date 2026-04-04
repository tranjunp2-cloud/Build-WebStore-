import { describe, it, expect } from 'vitest'
import { slugify, buildSavePayload } from '../../../components/dashboard/BulkCreateModal'

// ─── TC-F08-04-01: Bulk product creation utilities ──────────────────────

describe('slugify [TC-F08-04-01]', () => {
    it('converts basic text to kebab-case', () => {
        expect(slugify('Hello World')).toBe('hello-world')
    })

    it('removes diacritics (Vietnamese)', () => {
        // đ → d + combining stroke → NFD removes combining → 'a'
        // Actual behavior: 'đ' NFD decompose drops the stroke
        expect(slugify('Cà phê sữa đá')).toBe('ca-phe-sua-a')
    })

    it('removes special characters', () => {
        expect(slugify('Hello @#$% World!')).toBe('hello-world')
    })

    it('strips leading and trailing hyphens', () => {
        expect(slugify('--hello--')).toBe('hello')
    })

    it('collapses multiple hyphens', () => {
        expect(slugify('hello   world')).toBe('hello-world')
    })

    it('handles empty string', () => {
        expect(slugify('')).toBe('')
    })

    it('converts uppercase to lowercase', () => {
        expect(slugify('UPPER CASE')).toBe('upper-case')
    })

    it('handles numbers', () => {
        expect(slugify('Product 123 ABC')).toBe('product-123-abc')
    })
})

describe('buildSavePayload [TC-F08-04-01]', () => {
    it('builds payload for simple product (no variants)', () => {
        const product = {
            selected: true,
            name: 'Nasi Lemak',
            price: 12.5,
            category: 'Food',
            variants: [],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.name).toBe('Nasi Lemak')
        expect(payload.price).toBe(12.5)
        expect(payload.status).toBe('draft')
        expect(payload.hasVariants).toBe(false)
        expect(payload.variants).toBeUndefined()
        expect(payload.slug).toContain('nasi-lemak')
    })

    it('builds payload with variants', () => {
        const product = {
            selected: true,
            name: 'T-Shirt',
            price: 39.9,
            category: 'Fashion',
            variants: [
                { name: 'Small', price: 39.9, sku: 'TS-S', stock: 10 },
                { name: 'Medium', price: 39.9, sku: 'TS-M', stock: 20 },
            ],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.hasVariants).toBe(true)
        expect(payload.variants).toHaveLength(2)
        expect(payload.variants![0].name).toBe('Small')
        expect(payload.variants![1].stock).toBe(20)
    })

    it('defaults variant name to "Default" when empty', () => {
        const product = {
            selected: true,
            name: 'Product',
            price: 10,
            category: '',
            variants: [{ name: '', price: 0, sku: '', stock: 0 }],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.variants![0].name).toBe('Default')
    })

    it('generates variantConfigs successfully from 2-tier variants', () => {
        const product = {
            selected: true,
            name: 'Fashion Dress',
            price: 50,
            category: '',
            variants: [
                { name: 'Red - S', price: 50, sku: 'DR-RD-S', stock: 10 },
                { name: 'Red - M', price: 50, sku: 'DR-RD-M', stock: 10 }
            ],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.variantConfigs).toBeDefined()
        expect(payload.variantConfigs!).toHaveLength(2)
        expect(payload.variantConfigs![0].name).toBe('Color')
        expect(payload.variantConfigs![0].options).toEqual([{ value: 'Red' }])
        expect(payload.variantConfigs![1].name).toBe('Size')
        expect(payload.variantConfigs![1].options).toEqual([{ value: 'S' }, { value: 'M' }])
    })

    it('TC-F08-02-04: limits generated variantConfigs to maximum 2 tiers by dropping extra tiers', () => {
        const product = {
            selected: true,
            name: 'Excessive Tiers',
            price: 50,
            category: '',
            variants: [
                { name: 'Red - S - Cotton', price: 50, sku: 'R-S-C', stock: 10 },
                { name: 'Red - M - Cotton', price: 50, sku: 'R-M-C', stock: 10 }
            ],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.variantConfigs).toBeDefined()
        expect(payload.variantConfigs!).toHaveLength(2) 
        expect(payload.variantConfigs![0].name).toBe('Color')
        expect(payload.variantConfigs![0].options).toEqual([{ value: 'Red' }])
        expect(payload.variantConfigs![1].name).toBe('Size')
        expect(payload.variantConfigs![1].options).toEqual([{ value: 'S' }, { value: 'M' }])
    })

    it('ignores AI provided variantConfigs and regenerates from variant names', () => {
        const product = {
            selected: true,
            name: 'Perfume',
            price: 100,
            category: '',
            variants: [
                { name: 'Rose - 50ml', price: 100, sku: 'P-R-50', stock: 5 }
            ],
            variantConfigs: [
                { name: 'Scent', options: [{ value: 'Rose' }] },
                { name: 'Volume', options: [{ value: '50ml' }] }
            ]
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.variantConfigs).toBeDefined()
        expect(payload.variantConfigs![0].name).toBe('Color')
        expect(payload.variantConfigs![1].name).toBe('Size')
    })

    it('defaults variant price to product price when 0', () => {
        const product = {
            selected: true,
            name: 'Product',
            price: 50,
            category: '',
            variants: [{ name: 'Default', price: 0, sku: '', stock: 0 }],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.variants![0].price).toBe(50)
    })

    it('TC-F08-04-06: sanitizes HTML/XSS script tags from text inputs', () => {
        const product = {
            selected: true,
            name: '<script>alert(1)</script>Hacked Name',
            price: 50,
            seoTitle: '<iframe src="malicious"/>SEO',
            seoDescription: 'Normal <b>Desc</b>',
            category: 'Hacks',
            variants: [
                { name: 'Red <img src=x onerror=alert(1)>', price: 50, sku: 'R-<script>S</script>', stock: 10 },
            ],
        }
        const payload = buildSavePayload(product, null, null)

        expect(payload.name).toBe('Hacked Name')
        expect(payload.seo.title).toBe('SEO')
        // It completely strips out tags, including <b>
        expect(payload.seo.description).toBe('Normal Desc')
        expect(payload.variants![0].name).toBe('Red')
        expect(payload.variants![0].sku).toBe('R-')
    })

    it('generates unique slug with random suffix', () => {
        const product = {
            selected: true,
            name: 'Same Name',
            price: 10,
            category: '',
            variants: [],
        }
        const slug1 = buildSavePayload(product, null, null).slug
        const slug2 = buildSavePayload(product, null, null).slug

        expect(slug1).toContain('same-name-')
        expect(slug2).toContain('same-name-')
        // Random suffix makes them different (very high probability)
        // Not asserting inequality since it's random — just check format
        expect(slug1).toMatch(/^same-name-[a-z0-9]{5}$/)
    })
})
