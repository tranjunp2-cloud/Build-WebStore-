import {test,expect} from '@playwright/test'
// Published local PW1 pilot store253; no auth or mocked network.
for (const width of [1440,390]) test(`[TC-F35.M41] source carousel preserves image fit and navigation at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900})
    await page.goto('http://localhost:3000/sites/c39963-ts07-ta1')
    const carousel=page.locator('[data-carousel-viewport]').first()
    await expect(carousel).toBeVisible()
    const image=carousel.locator('img').first()
    await expect(image).toHaveCSS('object-fit','cover')
    const box=await carousel.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(width)
    const track=carousel.locator(':scope > div').first()
    const before=await track.getAttribute('style')
    await carousel.getByRole('button',{name:'Next slide',exact:true}).click()
    await expect(track).not.toHaveAttribute('style',before!)
    expect((await carousel.boundingBox())!.height).toBeCloseTo(box!.height, 0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
