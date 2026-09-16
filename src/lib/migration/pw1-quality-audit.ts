import { writeFile, mkdir, appendFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Client } from 'pg'
import { chromium, type Page } from '@playwright/test'
import type { BatchEntry } from './pw1-batch-input'

export type QualityFinding = { code: string; severity: 'error'|'warning'|'waiting-be'; detail: string; block?: string; viewport?: number }
export function classifySourceLink(href: string, source: string): QualityFinding | undefined {
    let target: URL
    try { target = new URL(href) } catch { return }
    if (target.host !== new URL(source).host) return
    const entity = [...target.searchParams.keys()].some(k=>/^(category|category_id|product|product_id|article|article_id|brand|brand_id)$/i.test(k))
    return {code:entity?'SOURCE_ENTITY_LINK':'SOURCE_PAGE_LINK',severity:entity?'waiting-be':'warning',detail:href}
}
export type AuditPage = {storeId:string;pageId?:number;url?:string;status:'checked'|'skipped'|'failed';findings:QualityFinding[]}

export function inspectAuditDocument() {
                            const block=(el:Element)=>el.closest('[data-block-index]')?.getAttribute('data-block-index') ?? el.closest('[data-source-component]')?.getAttribute('data-source-component') ?? el.closest('header,nav,footer')?.tagName.toLowerCase() ?? undefined
                            const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'}
                            return {
                                overflow:document.documentElement.scrollWidth>innerWidth+2,
                                images:Array.from(document.images).filter(visible).filter(i=>i.complete&&i.naturalWidth===0&&!!i.getAttribute('src')).map(i=>({url:i.currentSrc||i.src,block:block(i)})),
                                controls:Array.from(document.querySelectorAll('button,a')).filter(visible).filter(el=>!((el.textContent??'').trim()||el.getAttribute('aria-label')||el.getAttribute('title')||el.querySelector('img[alt]:not([alt=""]),svg title')||el.getAttribute('aria-labelledby'))).map(el=>({tag:el.tagName,block:block(el)})),
                                links:Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map(a=>({url:a.href,block:block(a)})),
                                incomplete:scrollY+innerHeight<document.documentElement.scrollHeight-2,
                            }

}

/** tsx/esbuild may emit __name calls inside a serialized browser function.
 * Keep its compatibility helper local to our expression, never on the website global. */
export async function inspectAuditPage(page: Page) {
    return page.evaluate<ReturnType<typeof inspectAuditDocument>>(`(() => { const __name = (fn) => fn; return (${inspectAuditDocument.toString()})(); })()`)
}

/** Public, read-only QA. Never publishes, clicks controls, or follows links back to PW1. */
export async function auditPw1Websites(entries: BatchEntry[], baseUrl: string, output: string) {
    const base = new URL(baseUrl)
    if (!['http:','https:'].includes(base.protocol) || base.username || base.password || base.pathname!=='/' || base.search || base.hash) throw Error('Audit base URL must be an HTTP(S) origin without credentials/path/query')
    const client = new Client({connectionString:process.env.DATABASE_URI||process.env.DATABASE_URL})
    await client.connect()
    type Row = {source_store_id:string;site_id:number;site_status:string;tenant_slug:string;id:number;slug:string;is_homepage:boolean}
    let rows:Row[]
    try {
        rows=(await client.query<Row>(`SELECT m.source_store_id,m.site_id,s.status site_status,t.slug tenant_slug,p.id,p.slug,p.is_homepage
            FROM pw1_migration_stores m JOIN sites s ON s.id=m.site_id JOIN tenants t ON t.id=m.tenant_id
            LEFT JOIN pages p ON p.site_id=s.id AND p.deleted_at IS NULL AND p.slug<>'404'
            WHERE m.source_store_id=ANY($1::text[]) ORDER BY m.source_store_id,p.id`,[entries.map(e=>e.sourceStoreId)])).rows
    } finally { await client.end() }
    const pages:AuditPage[]=[]
    const jobs=rows.filter(r=>r.site_status==='published' && r.id)
    for(const entry of entries) if(!jobs.some(r=>r.source_store_id===entry.sourceStoreId)) pages.push({storeId:entry.sourceStoreId,status:'skipped',findings:[{code:'NOT_PUBLIC',severity:'warning',detail:'No published mapped site/pages; public QA not performed'}]})
    await mkdir(dirname(output),{recursive:true})
    await writeFile(output+'.jsonl','',{mode:0o600})
    await writeFile(output,JSON.stringify({status:'running',startedAt:new Date().toISOString(),baseUrl:base.origin}),{mode:0o600})
    const browser=await chromium.launch({headless:true})
    const linkChecks=new Map<string,Promise<number>>()
    let cursor=0
    try {
        await Promise.all([0,1].map(async()=>{
            const context=await browser.newContext({serviceWorkers:'block'})
            try { while(cursor<jobs.length){
                const row=jobs[cursor++], entry=entries.find(e=>e.sourceStoreId===row.source_store_id)!
                const prefix=`/sites/${encodeURIComponent(row.tenant_slug)}`
                const url=new URL(`${prefix}${row.is_homepage?'':'/'+row.slug.replace(/^\//,'')}`,base).href
                const result:AuditPage={storeId:row.source_store_id,pageId:row.id,url,status:'checked',findings:[]}
                const add=(finding:QualityFinding)=>{if(!result.findings.some(f=>JSON.stringify(f)===JSON.stringify(finding)))result.findings.push(finding)}
                const page=await context.newPage()
                page.on('pageerror',error=>add({code:'RUNTIME_ERROR',severity:'error',detail:error.message.slice(0,500)}))
                try {
                    for(const width of [1440,390]){
                        await page.setViewportSize({width,height:900})
                        const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
                        if(!response || response.status()>=400){add({code:'PAGE_HTTP',severity:'error',detail:String(response?.status()??'no response'),viewport:width});break}
                        if(new URL(page.url()).origin!==base.origin || !(new URL(page.url()).pathname===prefix || new URL(page.url()).pathname.startsWith(prefix+'/'))){add({code:'PAGE_REDIRECT',severity:'error',detail:page.url(),viewport:width});break}
                        // Trigger lazy images/scroll animations; bound work for pathological long pages.
                        await page.waitForTimeout(700)
                        let stableBottom = 0, lastHeight = 0
                        for(let step=0;step<160;step++){
                            await page.evaluate(()=>window.scrollBy({top:800,behavior:'instant'}))
                            await page.waitForTimeout(100)
                            const position=await page.evaluate(()=>({end:window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2,height:document.documentElement.scrollHeight}))
                            stableBottom = position.end && position.height === lastHeight ? stableBottom + 1 : 0
                            lastHeight = position.height
                            if(stableBottom >= 3)break
                        }
                        await page.waitForTimeout(700)
                        const snapshot=await inspectAuditPage(page)
                        if(snapshot.incomplete)add({code:'SCAN_LIMIT',severity:'warning',detail:'Page exceeded bounded scroll scan; lower content may not be checked',viewport:width})
                        if(snapshot.overflow)add({code:'HORIZONTAL_OVERFLOW',severity:'error',detail:'Document exceeds viewport width',viewport:width})
                        for(const image of snapshot.images)add({code:'BROKEN_IMAGE',severity:'error',detail:image.url,block:image.block,viewport:width})
                        for(const control of snapshot.controls)add({code:'UNNAMED_CONTROL',severity:'warning',detail:`${control.tag} has no detected accessible label; review manually`,block:control.block,viewport:width})
                        for(const link of snapshot.links){
                            const source=classifySourceLink(link.url,entry.source.websiteUrl)
                            if(source){add({...source,block:link.block});continue}
                            const target=new URL(link.url)
                            if(target.origin!==base.origin || !['http:','https:'].includes(target.protocol))continue
                            if(!(target.pathname===prefix||target.pathname.startsWith(prefix+'/'))){add({code:'OUTSIDE_STORE_LINK',severity:'warning',detail:target.href,block:link.block});continue}
                            target.hash=''
                            if(target.pathname===new URL(url).pathname && !target.search)continue
                            if(!linkChecks.has(target.href)){
                                if(linkChecks.size>=2000){add({code:'LINK_LIMIT',severity:'warning',detail:'Unique link verification limit reached'});continue}
                                linkChecks.set(target.href,context.request.get(target.href,{timeout:15000,maxRedirects:0}).then(async r=>{const status=r.status();await r.dispose();return status}).catch(()=>0))
                            }
                            const status=await linkChecks.get(target.href)!
                            if(status===0||status>=400)add({code:'LINK_HTTP',severity:'error',detail:`${status||'timeout'} ${target.href}`,block:link.block})
                            else if(status>=300)add({code:'LINK_REDIRECT',severity:'warning',detail:`${status} ${target.href}`,block:link.block})
                        }
                    }
                }catch(error){result.status='failed';add({code:'AUDIT_ERROR',severity:'error',detail:error instanceof Error?error.message:String(error)})}
                finally{await page.close();pages.push(result);await appendFile(output+'.jsonl',JSON.stringify(result)+'\n');console.error(`[audit] ${pages.length}/${jobs.length} store=${row.source_store_id} page=${row.id} findings=${result.findings.length}`)}
            }}finally{await context.close()}
        }))
    }finally{await browser.close()}
    pages.sort((a,b)=>Number(a.storeId)-Number(b.storeId)||(a.pageId??0)-(b.pageId??0))
    const findings=pages.flatMap(p=>p.findings)
    const stores=entries.map(entry=>{
        const checked=pages.filter(p=>p.storeId===entry.sourceStoreId)
        const all=checked.flatMap(p=>p.findings)
        const errors=all.filter(f=>f.severity==='error').length, warnings=all.filter(f=>f.severity==='warning').length, waitingBe=all.filter(f=>f.severity==='waiting-be').length
        return {storeId:entry.sourceStoreId,status:checked.some(p=>p.status==='skipped')?'not-checked':errors?'needs-fix':warnings?'needs-review':waitingBe?'waiting-be':'checked',errors,warnings,waitingBe}
    })
    const report={status:'completed',stores,createdAt:new Date().toISOString(),baseUrl:base.origin,summary:{stores:entries.length,pages:jobs.length,checked:pages.filter(p=>p.status==='checked').length,skipped:pages.filter(p=>p.status==='skipped').length,failed:pages.filter(p=>p.status==='failed').length,errors:findings.filter(f=>f.severity==='error').length,warnings:findings.filter(f=>f.severity==='warning').length,waitingBe:findings.filter(f=>f.severity==='waiting-be').length},pages}
    await mkdir(dirname(output),{recursive:true})
    await writeFile(output,JSON.stringify(report,null,2),{mode:0o600})
    const escape=(s:string)=>s.replaceAll('|','\\|').replaceAll('\n',' ')
    await writeFile(output+'.md',`# PW1 migration quality report\n\n${JSON.stringify(report.summary)}\n\n| Store | Page | Severity | Check | Block | Detail |\n|---|---|---|---|---|---|\n`+pages.flatMap(p=>p.findings.map(f=>`| ${p.storeId} | ${p.url ? `[${p.pageId??'-'}](${p.url})` : '-'} | ${f.severity} | ${f.code} | ${f.block??'-'} | ${escape(f.detail)} |`)).join('\n')+'\n',{mode:0o600})
    return report.summary
}
