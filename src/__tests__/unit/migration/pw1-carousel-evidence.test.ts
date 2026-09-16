import {describe,it,expect} from 'vitest'
import {applyCarouselEvidence} from '@/lib/migration/pw1-carousel-evidence'
import type {WebsiteBlueprint} from '@/lib/migration/pw1-contract'
function fixture():WebsiteBlueprint {
    return {storeId:'1',siteName:'Test',description:'',pages:[],nativeContract:{format:'pw2-reconstruction-contract',version:'1.0.0',source:{storeId:'1',url:'https://example.test',capturedAt:'',dumpHash:''},site:{name:'Test',navigation:{},footer:{}},reconciliation:[],pages:[{sourceId:'1',title:'Home',slug:'home',isHomepage:true,components:[{sourceId:'2',position:0,kind:'banner',block:{sourceLayout:{size:'small'},slides:[{image:{url:'https://example.test/a.jpg'}}]}}]}]}}
}
describe('[TC-F35.M41] observed source frames',()=>{
    it('binds exact source media while preserving explicit input values',()=>{
        const blueprint=fixture()
        const result=applyCarouselEvidence(blueprint,[{imageUrl:'https://example.test/a.jpg',aspectRatio:2,imageFit:'contain',slidesPerView:2}])
        expect(result[0].status).toBe('observed-source-frame')
        expect(blueprint.nativeContract.pages[0].components[0].block.sourceLayout).toMatchObject({aspectRatio:2,imageFit:'contain',slidesPerView:2})
    })
    it('does not guess from missing or conflicting frame evidence',()=>{
        const blueprint=fixture()
        const a={imageUrl:'https://example.test/a.jpg',aspectRatio:2,imageFit:'cover' as const,slidesPerView:1}
        expect(applyCarouselEvidence(blueprint,[a,{...a,aspectRatio:1}])[0].status).toBe('unverified')
        expect(blueprint.nativeContract.pages[0].components[0].block.sourceLayout).toEqual({size:'small'})
    })
})
