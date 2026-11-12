// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderBlogContent } from '@/lib/blog/render-content'

const lexical = (text: string) => ({ root: { type: 'root', version: 1, children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text, format: 0, mode: 'normal' }] }] } })
describe('[TC-F35.M54] Imported blog content', () => {
    it('renders imported HTML and removes executable attributes', () => {
        const input = lexical('<h2>Flooring</h2><p>Article body</p><img src="/image.jpg" onerror="alert(1)"><script>alert(1)</script>')
        const output = renderBlogContent(input)
        expect(output).toContain('<h2>Flooring</h2>')
        expect(output).toContain('<p>Article body</p>')
        expect(output).not.toMatch(/onerror|<script/)
    })
    it('supports existing HTML strings and native Lexical text', () => {
        const html = '<p>Existing content</p>'
        expect(renderBlogContent(html)).toBe(html)
        expect(renderBlogContent(lexical('Native content'))).toContain('Native content')
        expect(renderBlogContent(null)).toBe('')
    })
})
