import { describe, it, expect } from 'vitest'
import { parseFontSizePx, patchFontSizeMarkers } from '@/components/editor/preview-font-size'

// TC-F05-06-16 — GH-2089: cỡ chữ inline trên vùng chọn phải ra px, không để xxx-large.
function makeRoot(html: string): HTMLElement {
    const root = document.createElement('h1')
    root.innerHTML = html
    return root
}

describe('preview-font-size (GH-2089)', () => {
    it('TC-F05-06-16a: span xxx-large (Chrome styleWithCSS) -> 28px', () => {
        const root = makeRoot('A <span style="font-size: xxx-large;">B</span> C')
        const n = patchFontSizeMarkers(root, 28)
        const span = root.querySelector('span') as HTMLElement
        expect(n).toBe(1)
        expect(span.style.fontSize).toBe('28px')
        expect(root.innerHTML).not.toContain('xxx-large')
    })

    it('TC-F05-06-16b: <font size="7"> -> span 28px, không còn thẻ font', () => {
        const root = makeRoot('A <font size="7"><b>B</b></font> C')
        patchFontSizeMarkers(root, 28)
        expect(root.querySelector('font')).toBeNull()
        const span = root.querySelector('span') as HTMLElement
        expect(span.style.fontSize).toBe('28px')
        expect(span.querySelector('b')?.textContent).toBe('B')
    })

    it('TC-F05-06-16c: -webkit-xxx-large (Safari) -> 28px', () => {
        const root = makeRoot('<span style="font-size: -webkit-xxx-large;">B</span>')
        patchFontSizeMarkers(root, 28)
        const span = root.querySelector('span') as HTMLElement
        expect(span.style.fontSize).toBe('28px')
        expect(root.innerHTML).not.toContain('xxx-large')
    })

    it('TC-F05-06-16d: span lồng có font-size cũ bị dọn để cỡ mới thắng', () => {
        const root = makeRoot('<span style="font-size: xxx-large;">x<span style="font-size: 12px;">y</span></span>')
        patchFontSizeMarkers(root, 28)
        const [outer, inner] = Array.from(root.querySelectorAll('span')) as HTMLElement[]
        expect(outer.style.fontSize).toBe('28px')
        expect(inner.style.fontSize).toBe('')
    })

    it('TC-F05-06-16e: giá trị không hợp lệ không ghi NaNpx', () => {
        expect(parseFontSizePx('abc')).toBeNull()
        expect(parseFontSizePx('0')).toBeNull()
        expect(parseFontSizePx('-4')).toBeNull()
        expect(parseFontSizePx('28')).toBe(28)
    })

    it('TC-F05-06-16f: không có marker -> không đổi DOM', () => {
        const root = makeRoot('<b>plain</b>')
        expect(patchFontSizeMarkers(root, 28)).toBe(0)
        expect(root.innerHTML).toBe('<b>plain</b>')
    })

    it('TC-F05-06-16g: có range -> chỉ patch marker trong vùng chọn, span cũ ngoài vùng giữ nguyên', () => {
        const root = makeRoot('<span id="old" style="font-size: xxx-large;">old</span> mid <font id="new" size="7">new</font>')
        document.body.appendChild(root)
        const range = document.createRange()
        range.selectNodeContents(root.querySelector('#new') as HTMLElement)
        const n = patchFontSizeMarkers(root, 28, range)
        expect(n).toBe(1)
        expect((root.querySelector('#old') as HTMLElement).style.fontSize).toBe('xxx-large')
        expect(root.querySelector('font')).toBeNull()
        root.remove()
    })
})
