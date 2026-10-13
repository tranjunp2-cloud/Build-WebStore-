import { describe, expect, it } from 'vitest'
import { load } from 'cheerio'
import { adaptPw1RichTextLayout } from '@/lib/migration/pw1-rich-text-layout'
const figure = (name: string) => `<figure class="image image-style-align-left"><img src="https://source.example/${name}.jpg"><figcaption><a href="/${name}">${name}</a></figcaption></figure>`
describe('[TC-F35.M27] source rich text layout', () => {
    it('groups consecutive captioned images without losing links or order', () => {
        const $ = load(adaptPw1RichTextLayout(figure('one') + figure('two')))
        expect($('[data-pw1-gallery] figure')).toHaveLength(2)
        expect($('a').map((_, a) => $(a).attr('href')).get()).toEqual(['/one', '/two'])
        expect($('[data-pw1-gallery]').attr('style')).toContain('min(100%,220px)')
    })
    it('does not group images across prose or tables', () => {
        const html = adaptPw1RichTextLayout(figure('one') + '<p>Important copy</p><table><tr><td>Data</td></tr></table>' + figure('two'))
        const $ = load(html)
        expect($('[data-pw1-gallery]')).toHaveLength(0)
        expect($('p').text()).toBe('Important copy')
        expect($('td').text()).toBe('Data')
    })
    it('preserves explicit figure width and maps centered alignment', () => {
        const $ = load(adaptPw1RichTextLayout('<figure class="image image-style-align-center" style="width:40%"><img src="/a.jpg"></figure>'))
        expect($('figure').attr('style')).toContain('width:40%')
        expect($('figure').attr('style')).toContain('margin-left:auto')
        expect($('img').attr('style')).toContain('max-width:100%')
    })
})

it('[TC-F35.M27] converts the store 969 direct image pair, preserving linked images and order', () => {
    const html = '<h2>&nbsp;</h2><p><img class="image-style-align-left" src="/logo.png" alt="Logo"><a href="/about"><img class="image-style-align-right" src="/about.jpg" alt="About"></a></p>'
    const $ = load(adaptPw1RichTextLayout(html))
    expect($('[data-pw1-image-pair]')).toHaveLength(1)
    expect($('[data-pw1-image-pair]').attr('style')).toContain('min(100%,360px)')
    expect($('img').map((_, img) => $(img).attr('src')).get()).toEqual(['/logo.png', '/about.jpg'])
    expect($('a').attr('href')).toBe('/about')
    expect($('img').first().attr('style')).toContain('float:none')
})
it('[TC-F35.M27] preserves prose and direct-image widths without grouping', () => {
    const $ = load(adaptPw1RichTextLayout('<p><img class="image-style-align-left" style="width:30%" src="/a.png">Some text<img class="image-style-align-right" src="/b.png"></p>'))
    expect($('[data-pw1-image-pair]')).toHaveLength(0)
    expect($('p').text()).toBe('Some text')
    expect($('img').first().attr('style')).toContain('width:30%')
    expect($('img').last().attr('style')).toContain('float:right')
})
it('[TC-F35.M27] centers a standalone direct image', () => {
    const $ = load(adaptPw1RichTextLayout('<p><img class="image-style-align-center" src="/a.png"></p>'))
    expect($('img').attr('style')).toContain('margin-left:auto;margin-right:auto')
    expect($('[data-pw1-image-pair]')).toHaveLength(0)
})
