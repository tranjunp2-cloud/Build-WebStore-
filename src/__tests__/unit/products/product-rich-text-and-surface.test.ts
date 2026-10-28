/**
 * TC-AIREL-182/183 — the markdown the copilot reads and writes for a product description (Lexical in Payload),
 * and the page → module / record mapping the dock pins on this deployment.
 */
import { describe, expect, it } from 'vitest'
import { lexicalToMarkdown, markdownToLexical } from '@/lib/products/product-rich-text'
import { entityForPath, moduleForPath } from '@/lib/ai-platform/shop-surface'

describe('product description markdown [TC-AIREL-182]', () => {
    it('round-trips headings, paragraphs, lists, bold and italic', () => {
        const markdown = ['## Care', '', 'Hand wash **cold** and *dry flat*.', '', '- Cotton', '- Hand-printed', '', '1. Wash', '2. Dry'].join('\n')

        expect(lexicalToMarkdown(markdownToLexical(markdown))).toBe(markdown)
    })

    it('writes Lexical nodes the editor understands', () => {
        const { root } = markdownToLexical('# Title\n\nSome **bold** text\n\n- one\n- two')

        expect(root.children?.map((node) => node.type)).toEqual(['heading', 'paragraph', 'list'])
        // the product name is the page title: a description heading starts at h2
        expect(root.children?.[0]?.tag).toBe('h2')
        const list = root.children?.[2]
        expect(list).toMatchObject({ listType: 'bullet', tag: 'ul' })
        expect(list?.children?.map((item) => item.type)).toEqual(['listitem', 'listitem'])
        const bold = root.children?.[1]?.children?.[1]
        expect(bold).toMatchObject({ text: 'bold', format: 1 })
    })

    it('keeps HTML as literal text and joins wrapped lines', () => {
        const { root } = markdownToLexical('<script>alert(1)</script>\nsecond line')

        expect(root.children).toHaveLength(1)
        expect(root.children?.[0]?.children?.[0]?.text).toBe('<script>alert(1)</script> second line')
    })

    it('reads nothing from empty or non-Lexical values, and plain strings as they are', () => {
        expect(lexicalToMarkdown(null)).toBeNull()
        expect(lexicalToMarkdown({})).toBeNull()
        expect(lexicalToMarkdown({ root: { type: 'root', children: [] } })).toBeNull()
        expect(lexicalToMarkdown('  plain text ')).toBe('plain text')
    })

    it('reads a link as its text and an old plain paragraph with several runs', () => {
        const doc = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'See ' }, { type: 'link', children: [{ type: 'text', text: 'our guide' }] }] }] } }

        expect(lexicalToMarkdown(doc)).toBe('See our guide')
    })
})

describe('dock pin on this deployment [TC-AIREL-183]', () => {
    it('/products is module products and /products/:id is a product', () => {
        expect(moduleForPath('/products')).toBe('products')
        expect(moduleForPath('/products/42')).toBe('products')
        expect(entityForPath('/products/42')).toEqual({ kind: 'product', id: '42' })
        expect(entityForPath('/products/42?tab=seo')).toEqual({ kind: 'product', id: '42' })
    })

    it('has no record on the list, the new-product form or the categories page', () => {
        for (const path of ['/products', '/products/new', '/products/categories', '/orders/5']) expect(entityForPath(path)).toBeUndefined()
        expect(moduleForPath('/')).toBe('dashboard')
        expect(moduleForPath('/orders/5')).toBe('orders')
    })

    it('keeps /blog/:id as a post', () => {
        expect(entityForPath('/blog/7')).toEqual({ kind: 'blog_post', id: '7' })
    })
})
