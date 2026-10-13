import { describe, expect, it } from 'vitest'
import { sourceLinkResponse, checkMissingSourceLinks, verifiedSourceInventory } from '@/lib/migration/pw1-source-link-check'

describe('[TC-F35.M47] source link verification', () => {
    it.each([404, 410])('confirms explicit same-source HTTP %s', status => {
        expect(sourceLinkResponse('https://shop.example/about', status, 'https://shop.example/about').status).toBe('broken')
    })
    it.each([200, 301, 403, 429, 500, 503])('retains HTTP %s rather than guessing missing pages', status => {
        expect(sourceLinkResponse('https://shop.example/about', status, 'https://shop.example/about').status).toBe('retained')
    })
    it('does not treat a redirected domain error as source-page evidence', () => {
        expect(sourceLinkResponse('https://shop.example/about', 404, 'https://parked.example/about')).toMatchObject({status:'retained',reason:'redirect-outside-source'})
    })
    it('does not launch network checks for BE mappings', async () => {
        expect(await checkMissingSourceLinks('https://shop.example', [{url:'https://shop.example/products?category=2',location:'navigation',reason:'waiting-be',action:'retained'}])).toEqual([])
    })
})

describe('[TC-F35.M50] complete source inventory and rendered not-found',()=>{
    const body={data:[{store_id:7,url:'/'},{store_id:7,url:'/products'}],meta:{pagination:{total:2,count:2,current_page:1,total_pages:1}}}
    it('accepts only complete pages of the expected store',()=>{
        expect(verifiedSourceInventory(body,'7')).toEqual({storeId:'7',paths:['/','/products']})
        expect(verifiedSourceInventory(body,'8')).toBeUndefined()
        expect(verifiedSourceInventory({...body,meta:{pagination:{...body.meta.pagination,total_pages:2}}},'7')).toBeUndefined()
        expect(verifiedSourceInventory({...body,data:[body.data[0]]},'7')).toBeUndefined()
        expect(verifiedSourceInventory({...body,data:[body.data[0],{store_id:8,url:'/other'}]},'7')).toBeUndefined()
    })
    it('disables an absent destination but retains valid pages and working redirects',()=>{
        const inventory=verifiedSourceInventory(body,'7')
        expect(sourceLinkResponse('https://shop.example/about',200,'https://shop.example/about',{inventory})).toMatchObject({status:'broken',reason:'absent-from-complete-source-page-inventory'})
        expect(sourceLinkResponse('https://shop.example/products/',200,'https://shop.example/products/',{inventory}).status).toBe('retained')
        expect(sourceLinkResponse('https://shop.example/old',200,'https://shop.example/products',{inventory}).status).toBe('retained')
        expect(sourceLinkResponse('https://shop.example/about',503,'https://shop.example/about',{inventory}).status).toBe('retained')
    })
    it('requires successful same-host rendering to classify a soft 404',()=>{
        expect(sourceLinkResponse('https://shop.example/about',200,'https://shop.example/page-not-found',{renderedNotFound:true}).status).toBe('broken')
        expect(sourceLinkResponse('https://shop.example/about',200,'https://other.example/404',{renderedNotFound:true}).status).toBe('retained')
        expect(sourceLinkResponse('https://shop.example/about',200,'https://shop.example/about').status).toBe('retained')
    })
})
