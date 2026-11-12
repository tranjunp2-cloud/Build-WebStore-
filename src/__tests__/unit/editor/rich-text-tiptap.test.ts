// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { RichTextMedia } from '@/components/editor/rich-text-media'
import { normalizePw1RichHtml } from '@/components/editor/normalize-pw1-rich-html'
import { sanitizeRichHtml } from '@/blocks/custom-html/html-safety'
import { colorToHex } from '@/components/editor/rich-text-colors'
import StarterKit from '@tiptap/starter-kit'
import { RichTextImage } from '@/components/editor/rich-text-image'
import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { LegacyAttributes, LegacyContainer, LegacyCaption } from '@/components/editor/rich-text-extensions'

const createEditor = (content: string) => new Editor({
    extensions: [StarterKit, RichTextImage.configure({ inline: true }), TableKit, TextStyleKit,
        TextAlign.configure({ types: ['heading', 'paragraph'] }), LegacyAttributes, LegacyContainer, LegacyCaption, RichTextMedia], content,
})

describe('Tiptap PW1 content compatibility', () => {
    it('[TC-F35-RT-01] preserves layout and structured HTML when text changes', () => {
        const editor = createEditor('<div style="max-width:960px;padding:24px" class="legacy"><h2 style="text-align:center">Title</h2><ul><li><p>Item</p></li></ul><figure class="image"><img src="https://example.com/image.png" alt="Original" width="320"><figcaption>Caption</figcaption></figure><table><tbody><tr><td colspan="2" style="background-color:yellow"><p>Cell</p></td></tr></tbody></table></div>')
        try {
            editor.commands.insertContentAt(3, 'New ')
            const doc = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
            expect(doc.querySelector('.legacy')?.getAttribute('style')).toContain('max-width: 960px')
            expect(doc.querySelector('h2')?.style.textAlign).toBe('center')
            expect(doc.querySelector('li')?.textContent).toBe('Item')
            expect(doc.querySelector('img')?.getAttribute('alt')).toBe('Original')
            expect(doc.querySelector('figcaption')?.textContent).toBe('Caption')
            expect(doc.querySelector('td')?.getAttribute('colspan')).toBe('2')
        } finally { editor.destroy() }
    })
    it('[TC-F35-RT-02] replaces a text color and retains letter spacing', () => {
        const editor = createEditor('<p><span style="color:red;letter-spacing:2px">Hello</span></p>')
        try {
            editor.commands.selectAll()
            editor.commands.setColor('#0000ff')
            const doc = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
            expect(doc.querySelector('span')?.style.color).toBe('rgb(0, 0, 255)')
            expect(doc.querySelector('span')?.style.letterSpacing).toBe('2px')
        } finally { editor.destroy() }
    })
})


describe('[TC-F35-RT-03] Image wrapping', () => {
    it.each(['inline', 'left', 'right', 'standalone'])('persists %s layout and spacing across reload', layout => {
        const editor = createEditor('<p>Before<img src="https://example.com/a.png" width="240" alt="Picture">After</p>')
        try {
            let position = 0
            editor.state.doc.descendants((node, pos) => { if (node.type.name === 'image') position = pos })
            editor.commands.setNodeSelection(position)
            editor.commands.updateAttributes('image', { imageLayout: layout, imageGap: 24 })
            const html = editor.getHTML()
            const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img')!
            expect(img.dataset.imageLayout).toBe(layout)
            expect(img.dataset.imageGap).toBe('24')
            expect(img.style.cssFloat).toBe(['left', 'right'].includes(layout) ? layout : 'none')
            const reloaded = createEditor(html)
            try {
                let attrs: Record<string, unknown> = {}
                reloaded.state.doc.descendants(node => { if (node.type.name === 'image') attrs = node.attrs })
                expect(attrs.imageLayout).toBe(layout)
                expect(attrs.imageGap).toBe(24)
                expect(attrs.width).toBe(240)
            } finally { reloaded.destroy() }
        } finally { editor.destroy() }
    })
    it('imports legacy floated images and can switch wrapping off', () => {
        const editor = createEditor('<p><img src="https://example.com/a.png" style="float:right;margin-left:20px">Text</p>')
        try {
            editor.commands.setNodeSelection(1)
            expect(editor.getAttributes('image').imageLayout).toBe('right')
            editor.commands.updateAttributes('image', { imageLayout: 'inline' })
            const img = new DOMParser().parseFromString(editor.getHTML(), 'text/html').querySelector('img')!
            expect(img.style.cssFloat).toBe('none')
            expect(img.style.marginLeft).toBe('0px')
        } finally { editor.destroy() }
    })
})


describe('[TC-F35-RT-04] PW1 rich features', () => {
    it('retains percent width, image alignment and formatted caption across editing', () => {
        const editor = createEditor(normalizePw1RichHtml('<figure class="image image-style-align-right" style="width:33.69%"><img src="https://example.com/a.png"><figcaption>A <strong>caption</strong></figcaption></figure>'))
        try {
            const doc = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
            const wrapper = doc.querySelector('[data-pw2-image]') as HTMLElement
            expect(wrapper.dataset.imageLayout).toBe('right')
            expect(wrapper.style.width).toBe('33.69%')
            expect(wrapper.querySelector('[data-image-caption] strong')?.textContent).toBe('caption')
            editor.commands.setNodeSelection(1)
            editor.commands.updateAttributes('image', { showCaption: false })
            expect(editor.getHTML()).not.toContain('data-image-caption=""')
            editor.commands.updateAttributes('image', { showCaption: true })
            expect(editor.getHTML()).toContain('<strong>caption</strong>')
        } finally { editor.destroy() }
    })
    it('keeps supported media through sanitize and an editor HTML round trip', () => {
        const source = '<figure class="media"><div style="position:relative;padding-bottom:56.25%;height:0"><iframe src="https://www.youtube.com/embed/abc123" style="position:absolute;width:100%;height:100%"></iframe></div></figure>'
        const editor = createEditor(sanitizeRichHtml(source))
        try {
            editor.commands.insertContentAt(0, '<p>Before</p>')
            const doc = new DOMParser().parseFromString(sanitizeRichHtml(editor.getHTML()), 'text/html')
            expect(doc.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc123')
            expect(doc.querySelector('iframe')?.hasAttribute('sandbox')).toBe(true)
        } finally { editor.destroy() }
    })
    it('removes unsafe iframe destinations, srcdoc and script handlers', () => {
        const html = sanitizeRichHtml('<iframe src="https://evil.example" srcdoc="<script>alert(1)</script>"></iframe><img src="/a.png" onerror="alert(1)">')
        expect(html).not.toContain('iframe')
        expect(html).not.toContain('onerror')
        expect(html).not.toContain('srcdoc')
    })
    it('normalizes source HSL and RGB colors for the picker', () => {
        expect(colorToHex('hsl(150,75%,60%)')).toBe('#4de699')
        expect(colorToHex('rgb(255, 0, 0)')).toBe('#ff0000')
    })
})

describe('[TC-F35-RT-10] Table cells accept text', () => {
    const cellTexts = (editor: Editor) => {
        const out: string[] = []
        editor.state.doc.descendants(node => {
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') out.push(node.textContent)
        })
        return out
    }
    const hasType = (editor: Editor, name: string) => {
        let found = false
        editor.state.doc.descendants(node => { if (node.type.name === name) found = true })
        return found
    }
    it('[TC-F35-RT-10a] insertTable fills every cell with an empty paragraph, not hidden media', () => {
        const editor = createEditor('<p>Start</p>')
        try {
            editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: false })
            const doc = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
            const cells = doc.querySelectorAll('td')
            expect(cells).toHaveLength(9)
            cells.forEach(td => { expect(td.querySelector(':scope > p')).not.toBeNull() })
            expect(editor.getHTML()).not.toContain('<div></div>')
            expect(hasType(editor, 'richTextMedia')).toBe(false)
        } finally { editor.destroy() }
    })
    it('[TC-F35-RT-10b] new row cells and Tab-navigated cells receive typed text', () => {
        const editor = createEditor('<p>Start</p>')
        try {
            editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false })
            editor.commands.addRowAfter()
            editor.commands.insertContent('A')
            editor.commands.goToNextCell()
            editor.commands.insertContent('B')
            expect(cellTexts(editor).filter(Boolean).sort()).toEqual(['A', 'B'])
            expect(hasType(editor, 'richTextMedia')).toBe(false)
        } finally { editor.destroy() }
    })
    it('[TC-F35-RT-10c] a doc ending in a table keeps a paragraph, not an empty media atom', () => {
        const editor = createEditor('<table><tbody><tr><td><p>x</p></td></tr></tbody></table>')
        try {
            editor.commands.addColumnAfter()
            expect(hasType(editor, 'richTextMedia')).toBe(false)
            expect(editor.state.doc.lastChild?.type.name).not.toBe('richTextMedia')
        } finally { editor.destroy() }
    })
})
