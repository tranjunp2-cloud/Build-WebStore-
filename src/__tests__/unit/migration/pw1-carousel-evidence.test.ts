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

describe('[TC-F35.M49] page-scoped carousel preparation',()=>{
    it('does not reuse homepage evidence for another page containing the same image',()=>{
        const blueprint=fixture()
        blueprint.nativeContract.pages[0].isHomepage=false
        const frame={imageUrl:'https://example.test/a.jpg',aspectRatio:2,imageFit:'cover' as const,slidesPerView:3}
        expect(applyCarouselEvidence(blueprint,[frame])[0].status).toBe('unverified')
        expect(applyCarouselEvidence(blueprint,[{...frame,pageId:'99'}])[0].status).toBe('unverified')
        expect(applyCarouselEvidence(blueprint,[{...frame,pageId:'1'}])[0].status).toBe('observed-source-frame')
    })
    it('keeps explicit geometry and selects only a verified declared alternate',()=>{
        const blueprint=fixture()
        blueprint.nativeContract.pages[0].components[0].block.sourceLayout={size:'small',aspectRatio:3,imageFit:'contain',slidesPerView:2}
        const records=applyCarouselEvidence(blueprint,[{pageId:'1',imageUrl:'https://example.test/large.jpg',sourceImageUrls:['https://example.test/a.jpg'],aspectRatio:2,imageFit:'cover',slidesPerView:3,naturalWidth:1200,naturalHeight:600,frameWidth:400,frameHeight:200}])
        expect(blueprint.nativeContract.pages[0].components[0].block).toMatchObject({sourceLayout:{aspectRatio:3,imageFit:'contain',slidesPerView:2},slides:[{image:{url:'https://example.test/large.jpg'}}]})
        expect(records[0]).toMatchObject({pageId:'1',sourceId:'2',status:'explicit-source-config',images:[{sourceUrl:'https://example.test/a.jpg',selectedUrl:'https://example.test/large.jpg'}]})
    })
    it('keeps image and layout unchanged when the same-page frames conflict',()=>{
        const blueprint=fixture(),before=JSON.stringify(blueprint)
        const f={pageId:'1',imageUrl:'https://example.test/large.jpg',sourceImageUrls:['https://example.test/a.jpg'],aspectRatio:2,imageFit:'cover' as const,slidesPerView:3}
        expect(applyCarouselEvidence(blueprint,[f,{...f,slidesPerView:2}])[0].status).toBe('unverified')
        expect(JSON.stringify(blueprint)).toBe(before)
    })
})
