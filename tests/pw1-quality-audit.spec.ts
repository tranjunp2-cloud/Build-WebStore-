import {readCarouselFrames} from '../src/lib/migration/pw1-carousel-evidence'
import {test,expect} from '@playwright/test'
import {createServer,type Server} from 'node:http'
import {inspectAuditPage} from '../src/lib/migration/pw1-quality-audit'

let server:Server,origin:string
test.beforeAll(async()=>{
    server=createServer((req,res)=>{
        if(req.url==='/broken.png'){res.writeHead(404);res.end();return}
        res.setHeader('Content-Type','text/html')
        res.end('<main data-block-index="7"><div style="width:3000px;height:10px"></div><img src="/broken.png" width="100" height="100"><button style="width:40px;height:40px"></button><button aria-label="Next">→</button><a href="https://source.example/products?category=42">Shop</a></main>')
    })
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
    const address=server.address()
    if(!address||typeof address==='string')throw Error('Missing fixture server address')
    origin=`http://127.0.0.1:${address.port}`
})
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))})
test('[TC-F35.M45] browser inspector detects broken image, overflow and empty control with block evidence',async({page})=>{
    await page.setViewportSize({width:390,height:900})
    await page.goto(origin,{waitUntil:'load'})
    const snapshot=await inspectAuditPage(page)
    expect(snapshot.overflow).toBe(true)
    expect(snapshot.images).toEqual([{url:origin+'/broken.png',block:'7'}])
    expect(snapshot.controls).toEqual([{tag:'BUTTON',block:'7'}])
    expect(snapshot.links).toEqual([{url:'https://source.example/products?category=42',block:'7'}])
})

test('[TC-F35.M41] measures source carousel frame rather than intrinsic image size', async({page})=>{
    await page.setContent('<div class="swiper" style="width:600px"><div class="swiper-wrapper" style="display:flex"><div class="swiper-slide" style="width:600px;flex-shrink:0"><img style="width:600px;height:300px;object-fit:contain" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2230%22%3E%3C/svg%3E"></div></div></div>')
    await page.locator('img').evaluate(async image=>{await (image as HTMLImageElement).decode()})
    const frames=await readCarouselFrames(page)
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({aspectRatio:2,imageFit:'contain',slidesPerView:1})
    await page.locator('.swiper-slide').evaluate(slide=>{(slide as HTMLElement).style.width='400px'})
    expect(await readCarouselFrames(page)).toEqual([])
})
