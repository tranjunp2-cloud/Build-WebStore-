/** CLI-only source inspection. Source paths come from the input, never generated PW2 slugs. */
import { lookup } from 'node:dns/promises'
import { publicBrandAddress } from './pw1-brand-scan'
import { readCarouselFrames, type CarouselFrame } from './pw1-carousel-evidence'
import { MigrationMutex } from './pw1-concurrency'

const gate = new MigrationMutex()
export type CarouselTarget = { pageId:string; path:string }
export type CarouselScan = { frames:CarouselFrame[]; pages:Array<{pageId:string;url:string;status:string}> }
export async function scanPw1Carousels(sourceUrl:string, targets:CarouselTarget[], signal?:AbortSignal):Promise<CarouselScan> {
    return gate.run(async()=>{
        const result:CarouselScan = {frames:[],pages:[]}
        if (!targets.length) return result
        const source = new URL(sourceUrl)
        let browser:import('playwright').Browser|undefined
        const close = () => { void browser?.close().catch(()=>undefined) }
        let timer:ReturnType<typeof setTimeout>|undefined
        try {
            if (!['https:','http:'].includes(source.protocol) || source.username || source.password || source.port) throw Error('Unsupported source URL')
            signal?.throwIfAborted()
            const {chromium} = await import('playwright')
            browser = await chromium.launch({timeout:10000})
            signal?.throwIfAborted()
            signal?.addEventListener('abort',close,{once:true})
            timer=setTimeout(close,60000)
            const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true,serviceWorkers:'block',acceptDownloads:false})
            await context.route('**/*',async route=>{
                try {
                    const request=route.request(),url=new URL(request.url())
                    if (!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||['media','websocket'].includes(request.resourceType()) ||
                        (request.isNavigationRequest() && url.host!==source.host)) return await route.abort()
                    const addresses=await lookup(url.hostname,{all:true})
                    if (!addresses.length||addresses.some(a=>!publicBrandAddress(a.address))) return await route.abort()
                    await route.continue()
                } catch { await route.abort().catch(()=>undefined) }
            })
            const page=await context.newPage()
            for (const target of targets.slice(0,12)) {
                signal?.throwIfAborted()
                const url=new URL(target.path,source)
                if (url.origin!==source.origin||url.username||url.password) { result.pages.push({pageId:target.pageId,url:url.href,status:'unsupported-source-path'}); continue }
                try {
                    const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:7000})
                    if (!response?.ok()) throw Error('Source HTTP failure')
                    await page.waitForLoadState('networkidle',{timeout:2000}).catch(()=>undefined)
                    await page.waitForSelector('.swiper-slide img, .slick-slide, .owl-item, .carousel-item',{timeout:2000}).catch(()=>undefined)
                    for(let step=0;step<16;step++) {
                        const end=await page.evaluate(()=>{window.scrollBy({top:700,behavior:'instant'});return scrollY+innerHeight>=document.documentElement.scrollHeight-2})
                        await page.waitForTimeout(100)
                        if(end)break
                    }
                    const frames=await readCarouselFrames(page)
                    result.frames.push(...frames.map(frame=>({...frame,pageId:target.pageId})))
                    result.pages.push({pageId:target.pageId,url:url.href,status:frames.length?'observed':'no-verifiable-frames'})
                } catch(error) {
                    signal?.throwIfAborted()
                    result.pages.push({pageId:target.pageId,url:url.href,status:error instanceof Error?error.message.split('\n')[0].slice(0,160):'scan-failed'})
                    if (!browser.isConnected()) break
                }
            }
        } catch(error) {
            signal?.throwIfAborted()
            result.pages.push({pageId:'',url:source.href,status:error instanceof Error?error.message:'scan-unavailable'})
        } finally {
            if(timer)clearTimeout(timer)
            signal?.removeEventListener('abort',close)
            await browser?.close().catch(()=>undefined)
        }
        for(const target of targets)if(!result.pages.some(p=>p.pageId===target.pageId))result.pages.push({pageId:target.pageId,url:new URL(target.path,source).href,status:'scan-budget-exhausted'})
        return result
    })
}
