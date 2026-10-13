/** TC-F35.M49: real browser layout, actual image decode, no destination mutations. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { readCarouselFrames } from '../../src/lib/migration/pw1-carousel-evidence'
async function main() {
    const browser=await chromium.launch()
    try {
        const page=await browser.newPage({viewport:{width:1440,height:900}})
        await page.route('https://fixture.test/**',route=>{
            if (route.request().url().includes('broken')) return route.fulfill({status:404,body:'missing'})
            const width=route.request().url().includes('large')?1200:300
            const height=route.request().url().includes('different-ratio')?1200:width/2
            return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="green"/></svg>`})
        })
        await page.setContent(`<style>.swiper,.slick-list{width:1000px;overflow:hidden}.swiper-wrapper,.slick-track{display:flex;gap:20px}.swiper-slide,.slick-slide{flex:0 0 320px}img,.bg{display:block;width:320px;height:160px;object-fit:cover}.bg{background:url(https://fixture.test/bg.svg) center/contain}</style>
            <div class="swiper"><div class="swiper-wrapper">${[1,2,3].map(i=>`<div class="swiper-slide"><img src="https://fixture.test/${i}.svg" srcset="https://fixture.test/${i}.svg 300w, https://fixture.test/large-${i}.svg 1200w" sizes="300px"></div>`).join('')}</div></div>
            <div class="slick-list"><div class="slick-track">${[1,2,3].map(()=>'<div class="slick-slide"><div class="bg"></div></div>').join('')}</div></div>`)
        await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode())))
        const frames=await readCarouselFrames(page)
        assert.equal(frames.length,6)
        assert.ok(frames.every(f=>f.slidesPerView===3&&f.aspectRatio===2))
        assert.ok(frames.slice(0,3).every(f=>f.imageUrl.includes('large-')&&f.naturalWidth===1200))
        assert.ok(frames.slice(3).every(f=>f.imageFit==='contain'&&f.naturalWidth===300))
        await page.setContent(`<style>.swiper{width:600px}.swiper-wrapper{display:flex}.swiper-slide{flex:0 0 300px}img{width:300px;height:150px;object-fit:cover}</style><div class="swiper"><div class="swiper-wrapper">
            <div class="swiper-slide"><img src="https://fixture.test/base.svg" srcset="https://fixture.test/base.svg 300w, https://fixture.test/large-different-ratio.svg 1200w" sizes="300px"></div>
            <div class="swiper-slide"><img src="https://fixture.test/base2.svg" srcset="https://fixture.test/base2.svg 300w, https://fixture.test/large-broken.svg 1200w" sizes="300px"></div>
            </div></div>`)
        await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode())))
        const rejected=await readCarouselFrames(page)
        assert.deepEqual(rejected.map(f=>f.imageUrl),['https://fixture.test/base.svg','https://fixture.test/base2.svg'])
        console.log('PASS: unavailable or different-ratio alternatives retain the original image')
        console.log('PASS: gapped Swiper, Slick backgrounds, loaded declared srcset upgrades')
    } finally { await browser.close() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
