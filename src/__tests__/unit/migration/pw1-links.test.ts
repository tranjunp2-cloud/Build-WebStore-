import { describe, it, expect } from 'vitest'
import { createSourceLinkResolver, rewriteSourceHtmlLinks } from '@/lib/migration/pw1-links'

describe('[TC-F35.M42] source links stay within their migrated store', () => {
    it('maps known pages across HTTP/HTTPS, retaining query/hash and first duplicate route', () => {
        const warnings: string[] = []
        const resolve = createSourceLinkResolver('https://shop.example', [
            {sourcePath: '/', destinationPath: '/'},
            {sourcePath: '/about', destinationPath: '/about'},
            {sourcePath: '/about', destinationPath: '/about-pw1-2'},
        ], warnings)
        expect(resolve('http://shop.example/about/?utm_source=old#team')).toBe('/about?utm_source=old#team')
        expect(resolve('//shop.example/')).toBe('/')
        expect(resolve('https://other.example/about')).toBe('https://other.example/about')
        expect(resolve('mailto:a@shop.example')).toBe('mailto:a@shop.example')
        expect(warnings).toEqual([])
    })
    it('does not invent entity mappings or silently send missing pages to home', () => {
        const warnings: string[] = []
        const resolve = createSourceLinkResolver('https://shop.example', [{sourcePath:'/products',destinationPath:'/products'}], warnings)
        const url = 'https://shop.example/products?category=42'
        expect(resolve(url)).toBe(url)
        expect(resolve(url)).toBe(url)
        expect(resolve('https://shop.example/missing')).toBe('https://shop.example/missing')
        expect(warnings).toHaveLength(2)
    })
    it('rewrites only anchor destinations, preserving image sources and external links', () => {
        const resolve = createSourceLinkResolver('https://shop.example', [{sourcePath:'/about',destinationPath:'/about'}], [])
        const html = '<p><a href="https://shop.example/about?a=1&amp;b=2#team">About</a><img src="https://shop.example/about"><a href="https://other.example">Other</a></p>'
        const result = rewriteSourceHtmlLinks(html, resolve)
        expect(result).toContain('href="/about?a=1&amp;b=2#team"')
        expect(result).toContain('src="https://shop.example/about"')
        expect(result).toContain('href="https://other.example"')
        expect(rewriteSourceHtmlLinks('<p>Unchanged</p>', resolve)).toBe('<p>Unchanged</p>')
    })
})

describe('[TC-F35.M42] reviewed source corrections', () => {
    it('applies only exact reviewed URLs and preserves other stores', () => {
        const resolve = createSourceLinkResolver('https://shop.example', [], [], [], [{from:'/products-services',destinationPath:'/product-service'}])
        expect(resolve('/products-services')).toBe('/product-service')
        expect(resolve('https://other.example/products-services')).toBe('https://other.example/products-services')
    })
    it('removes empty editor anchors but retains image links and named anchors', () => {
        const result = rewriteSourceHtmlLinks('<a href="/x">&nbsp;</a><a href="/x"><img src="x" alt="X"></a><a id="section" href="/x"></a>', value=>value)
        expect(result.match(/<a /g)).toHaveLength(2)
        expect(result).toContain('id="section"')
    })
})

describe('[TC-F35.M42] legacy image-only link names',()=>{
    it('labels unnamed map links while preserving existing accessible names',()=>{
        const result=rewriteSourceHtmlLinks('<a href="https://maps.app.goo.gl/location"><img src="map.png"></a><a href="https://maps.app.goo.gl/other"><img alt="Office map" src="office.png"></a>',value=>value)
        expect(result).toContain('aria-label="View location on Google Maps"')
        expect(result.match(/aria-label=/g)).toHaveLength(1)
        expect(result).toContain('alt="Office map"')
        expect(rewriteSourceHtmlLinks('<a class="citation" href="https://example.test/article"><span></span></a>',value=>value)).toContain('aria-label="Open link to example.test"')
    })
})
