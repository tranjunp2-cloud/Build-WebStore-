import { describe, expect, it, vi } from 'vitest'
import { parseBatchInput, compactInput, batchEntryHash, batchAction, processBatch } from '@/lib/migration/pw1-batch-input'
function fixture(){return {sourceUserId:'517',sourceStoreId:'205',owner:{email:'amelina@yopmail.com',firstName:'Amelina'},source:{websiteUrl:'https://source.example'},website:{name:'Shop',locale:'en',branding:{logoUrl:'https://source.example/logo.jpg'},navigation:[{label:'Home',pageId:'1'}],footer:{copyright:'Shop',columns:[]},pages:[{sourceId:'1',title:'Home',path:'/',components:[{sourceId:'10',type:'rich_text',content:{html:'<p>Original</p>'},config:{}}]}]}}}
describe('[TC-F35.M23] One-array batch migration',()=>{
    it('validates every entry and accepts multiple stores owned by one user',()=>{
        const entries=parseBatchInput([fixture(),{...fixture(),sourceStoreId:'206'}])
        expect(entries).toHaveLength(2)
        expect(compactInput(entries[0]).pages[0].components[0].content.html).toBe('<p>Original</p>')
        expect(()=>parseBatchInput([fixture(),fixture()])).toThrow('Duplicate source store')
        expect(()=>parseBatchInput([fixture(),{...fixture(),sourceStoreId:'206',owner:{email:'another@example.com',firstName:'Other'}}])).toThrow('Conflicting owner')
        expect(()=>parseBatchInput([fixture(),{...fixture(),sourceStoreId:'206',sourceUserId:'518'}])).toThrow('share one destination email')
    })
    it('rejects malformed later entries before processing starts',()=>{
        const bad=fixture();bad.website.navigation[0].pageId='missing'
        expect(()=>parseBatchInput([fixture(),{...bad,sourceStoreId:'206'}])).toThrow()
        expect(()=>parseBatchInput([])).toThrow()
    })
    it('skips unchanged completed stores, retries failures, and requires explicit regeneration for changed completed stores',()=>{
        const [entry]=parseBatchInput([fixture()]);const hash=batchEntryHash(entry)
        expect(batchEntryHash({...entry,website:{...entry.website}})).toBe(hash)
        expect(batchAction({status:'completed',input_hash:hash},hash)).toBe('skip')
        expect(batchAction({status:'failed',input_hash:hash},hash)).toBe('run')
        expect(()=>batchAction({status:'completed',input_hash:'old'},hash)).toThrow('--rerun')
        expect(batchAction({status:'completed',input_hash:hash},hash,true)).toBe('run')
        expect(batchEntryHash({...entry,website:{...entry.website,name:'Changed'}})).not.toBe(hash)
    })
    it('continues after a store failure and persists each result in order',async()=>{
        const entries=parseBatchInput([fixture(),{...fixture(),sourceStoreId:'206'}])
        const operation=vi.fn().mockRejectedValueOnce(new Error('AI failed')).mockResolvedValueOnce({status:'completed'})
        const save=vi.fn().mockResolvedValue(undefined)
        const results=await processBatch(entries,operation,save)
        expect(operation).toHaveBeenCalledTimes(2)
        expect(results).toEqual([{sourceStoreId:'205',error:'AI failed'},{sourceStoreId:'206',result:{status:'completed'}}])
        expect(save).toHaveBeenCalledTimes(2)
    })
})
