/** TC-F35.M50: actual browser visibility and source rendering; no DB changes. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { inspectSourceNotFound } from '../../src/lib/migration/pw1-source-link-check'
async function main() {
    const browser=await chromium.launch()
    try {
        const page=await browser.newPage()
        const check=()=>page.evaluate('(() => { const __name = (fn) => fn; return ('+inspectSourceNotFound.toString()+')(); })()')
        await page.setContent('<h1>404 Page</h1><a href="/">Back to Home</a>')
        assert.equal(await check(),true)
        await page.setContent('<h1>About us</h1><footer><a href="/404">404 Page</a><a href="/">Back to Home</a></footer>')
        assert.equal(await check(),false)
        await page.setContent('<h1 style="display:none">404 Page</h1><a href="/">Back to Home</a>')
        assert.equal(await check(),false)
        await page.setContent('<h1>Loading ...</h1><a href="/">Back to Home</a>')
        assert.equal(await check(),false)
        console.log('PASS: soft404, valid page/footer, hidden template and loading shell')
    } finally { await browser.close() }
}
main().catch(error=>{console.error(error);process.exitCode=1})
