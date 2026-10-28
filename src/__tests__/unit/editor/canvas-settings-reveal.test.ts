// @vitest-environment jsdom
/**
 * TC-AIWB-64 — inside the preview and the Settings panel, the exact thing a reveal points at:
 * a button by its text (the whole button, not its label span), the n-th picture by the path's
 * index, a picture by its file name, the box around a gallery, the section when nothing finer
 * matches; in Settings the marked field first, else the input showing the value.
 * Real: findRevealElement, findSettingsField. Faked: nothing (jsdom DOM).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { findRevealElement } from '@/lib/editor/reveal/canvas-reveal'
import { findSettingsField } from '@/lib/editor/reveal/settings-reveal'

let section: HTMLElement

beforeEach(() => {
    document.body.innerHTML = `
      <section data-block-index="1" id="hero">
        <h1>Bộ sưu tập mới</h1>
        <p>Áo dài, khăn trùm đầu chất lượng cao dành cho phụ nữ hiện đại.</p>
        <a href="/collections/new" id="cta"><span>Khám phá bộ sưu tập</span></a>
        <div id="grid"><img src="/media/a.jpg" alt=""><img src="/media/b.jpg" alt=""><img src="/media/hijab.jpg" alt=""></div>
      </section>`
    section = document.getElementById('hero')!
})

describe('canvas reveal [TC-AIWB-64]', () => {
    it('a button by its text: the whole link', () => {
        expect(findRevealElement(section, { text: 'Khám phá bộ sưu tập', path: 'ctaButtons.0.label' }).id).toBe('cta')
    })

    it('a cut preview ("…") still finds its text', () => {
        expect(findRevealElement(section, { text: 'Áo dài, khăn trùm đầu chất lượng cao…' }).tagName).toBe('P')
    })

    it('pictures: by file name, by the path index, a whole gallery as its box', () => {
        expect(findRevealElement(section, { src: 'https://cdn.example/media/hijab.jpg' }).getAttribute('src')).toBe('/media/hijab.jpg')
        expect(findRevealElement(section, { path: 'images.1.image' }).getAttribute('src')).toBe('/media/b.jpg')
        expect(findRevealElement(section, { path: 'images' }).id).toBe('grid')
    })

    it('nothing finer matches: the section', () => {
        expect(findRevealElement(section, { text: 'Không có trên trang' })).toBe(section)
        expect(findRevealElement(section, {})).toBe(section)
    })
})

describe('settings reveal [TC-AIWB-64]', () => {
    it('the marked field first, else the input showing the value', () => {
        document.body.innerHTML = `
          <div id="panel">
            <input value="Bộ sưu tập mới">
            <input id="cta" value="Khám phá bộ sưu tập">
            <textarea id="desc">Baju kurung berkualiti</textarea>
            <input id="seo" data-settings-focus="seoTitle" value="x">
          </div>`
        const panel = document.getElementById('panel')!

        expect(findSettingsField(panel, { focus: 'seoTitle', value: 'Khám phá bộ sưu tập' })?.id).toBe('seo')
        expect(findSettingsField(panel, { value: 'Khám phá bộ sưu tập' })?.id).toBe('cta')
        expect(findSettingsField(panel, { value: 'Baju kurung…' })?.id).toBe('desc')
        expect(findSettingsField(panel, { value: 'x' })).toBeNull()
    })
})
