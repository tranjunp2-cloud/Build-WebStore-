import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RichText } from '@/blocks/shared/RichText'
import { decodeHtmlEntities } from '@/lib/utils/rich-text-render'

describe('[TC-F05-richtext] RichText component', () => {
    it('TC-F05-rt-01: renders plain text without wrapper when as=span', () => {
        const { container } = render(<RichText text="Hello world" as="span" />)
        expect(container.textContent).toBe('Hello world')
        // No <span> wrapper for plain text
        expect(container.querySelector('span')).toBeNull()
    })

    it('TC-F05-rt-02: renders plain text with tag when as=h2', () => {
        const { container } = render(<RichText text="Title" as="h2" className="text-3xl" />)
        const h2 = container.querySelector('h2')
        expect(h2).not.toBeNull()
        expect(h2!.textContent).toBe('Title')
        expect(h2!.className).toContain('text-3xl')
    })

    it('TC-F05-rt-03: renders bold formatting via dangerouslySetInnerHTML', () => {
        const { container } = render(<RichText text="<b>Bold text</b>" as="p" />)
        const p = container.querySelector('p')
        expect(p).not.toBeNull()
        expect(p!.querySelector('b')).not.toBeNull()
        expect(p!.textContent).toBe('Bold text')
    })

    it('TC-F05-rt-04: heading wrapper overrides as prop', () => {
        const { container } = render(<RichText text="<h4><b>Title</b></h4>" as="h2" className="font-bold" />)
        // Should render h4, not h2
        const h4 = container.querySelector('h4')
        expect(h4).not.toBeNull()
        expect(h4!.className).toContain('font-bold')
        expect(container.querySelector('h2')).toBeNull()
    })

    it('TC-F05-rt-05: heading override adjusts font-size classes', () => {
        const { container } = render(
            <RichText text="<h4>Small</h4>" as="h2" className="text-3xl md:text-4xl font-bold" />
        )
        const h4 = container.querySelector('h4')
        expect(h4).not.toBeNull()
        // Original h2 size classes replaced with h4 sizes
        expect(h4!.className).toContain('text-xl')
        expect(h4!.className).toContain('md:text-2xl')
        expect(h4!.className).not.toContain('text-3xl')
        expect(h4!.className).toContain('font-bold') // non-size class preserved
    })

    it('TC-F05-rt-06: preserves text-align from heading style', () => {
        const { container } = render(
            <RichText text='<h3 style="text-align:center">Centered</h3>' as="h2" />
        )
        const h3 = container.querySelector('h3')
        expect(h3).not.toBeNull()
        expect(h3!.style.textAlign).toBe('center')
    })

    it('TC-F05-rt-07: returns null for empty/null text', () => {
        const { container: c1 } = render(<RichText text={null} />)
        expect(c1.innerHTML).toBe('')
        const { container: c2 } = render(<RichText text="" />)
        expect(c2.innerHTML).toBe('')
        const { container: c3 } = render(<RichText text={undefined} />)
        expect(c3.innerHTML).toBe('')
    })

    it('TC-F05-rt-08: strips XSS attributes from allowed tags', () => {
        const { container } = render(
            <RichText text='<b onclick="alert(1)">Safe</b>' as="span" />
        )
        const b = container.querySelector('b')
        expect(b).not.toBeNull()
        expect(b!.getAttribute('onclick')).toBeNull()
    })
})

describe('[TC-F05-rte] decodeHtmlEntities', () => {
    it('TC-F05-rte-01: string without & returns unchanged (fast path)', () => {
        expect(decodeHtmlEntities('Hello world')).toBe('Hello world')
        expect(decodeHtmlEntities('')).toBe('')
    })

    it('TC-F05-rte-02: decodes basic entities individually', () => {
        expect(decodeHtmlEntities('&lt;')).toBe('<')
        expect(decodeHtmlEntities('&gt;')).toBe('>')
        expect(decodeHtmlEntities('&quot;')).toBe('"')
        expect(decodeHtmlEntities('&#39;')).toBe("'")
        expect(decodeHtmlEntities('&amp;')).toBe('&')
    })

    it('TC-F05-rte-03: &nbsp; decodes to NBSP (\\u00a0), not ASCII space', () => {
        const result = decodeHtmlEntities('&nbsp;')
        expect(result).toBe('\u00a0')
        expect(result.charCodeAt(0)).toBe(160)
    })

    it('TC-F05-rte-04: &amp;lt; → &lt; — &amp; is decoded last, not double-decoded', () => {
        // Old buggy order would yield '<'; correct order yields '&lt;'
        expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;')
        // Standalone &lt; still decodes normally
        expect(decodeHtmlEntities('&lt;b&gt;')).toBe('<b>')
    })

    it('TC-F05-rte-05: &amp;amp; → &amp; (single decode)', () => {
        expect(decodeHtmlEntities('&amp;amp;')).toBe('&amp;')
    })

    it('TC-F05-rte-06: mixed string with multiple entities', () => {
        expect(decodeHtmlEntities('Price &amp; Quality &lt;100&gt;')).toBe('Price & Quality <100>')
    })
})
