import { describe, expect, it } from 'vitest'
import { resolveWebsiteCategoryMappings, WebsiteCategoryMappingsSchema } from '@/lib/migration/pw1-website-category-mapping'

describe('[TC-F35.M27] website category mapping JSON', () => {
    it('records mapped, unavailable and unverified identities without inventing IDs', () => {
        const references = WebsiteCategoryMappingsSchema.parse([
            {sourceId:'1',sourcePath:'/products',status:'pending'},
            {sourceId:'2',sourcePath:'/products',status:'unavailable'},
            {sourceId:'3',sourcePath:'/products',status:'pending'},
        ])
        const actual = resolveWebsiteCategoryMappings(references, [{sourceId:'1',sourcePath:'/products',destinationId:42,listingPageId:'7'}])
        expect(actual).toEqual([
            {sourceId:'1',sourcePath:'/products',status:'mapped',destinationId:42,listingPageId:'7'},
            {sourceId:'2',sourcePath:'/products',status:'unavailable',destinationId:null},
            {sourceId:'3',sourcePath:'/products',status:'unverified',destinationId:null},
        ])
    })
    it('uses verified mappings when BE now supplies a previously unavailable category', () => {
        const actual = resolveWebsiteCategoryMappings([{sourceId:'2',sourcePath:'/products',status:'unavailable'}], [{sourceId:'2',sourcePath:'/products',destinationId:43,listingPageId:'7'}])
        expect(actual[0]).toMatchObject({status:'mapped',destinationId:43})
    })
    it('rejects duplicate references and destination IDs in unverified input', () => {
        const row = {sourceId:'1',sourcePath:'/products',status:'pending'}
        expect(WebsiteCategoryMappingsSchema.safeParse([row,row]).success).toBe(false)
        expect(WebsiteCategoryMappingsSchema.safeParse([{...row,destinationId:42}]).success).toBe(false)
    })
})
