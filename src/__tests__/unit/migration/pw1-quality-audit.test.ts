import {groupMigrationWarnings} from '@/lib/migration/pw1-warning-groups'
import {describe,it,expect} from 'vitest'
import {classifySourceLink} from '@/lib/migration/pw1-quality-audit'

describe('[TC-F35.M45] public audit link classification',()=>{
    it('separates BE entity references from other source pages',()=>{
        expect(classifySourceLink('https://old.example/products?category=42','https://old.example')).toMatchObject({code:'SOURCE_ENTITY_LINK',severity:'waiting-be'})
        expect(classifySourceLink('http://old.example/about#team','https://old.example')).toMatchObject({code:'SOURCE_PAGE_LINK',severity:'warning'})
    })
    it('does not mistake external or relative URLs for source links',()=>{
        expect(classifySourceLink('https://old.example.evil.test/products?category=42','https://old.example')).toBeUndefined()
        expect(classifySourceLink('/products?categoryId=70','https://old.example')).toBeUndefined()
        expect(classifySourceLink('mailto:owner@old.example','https://old.example')).toBeUndefined()
    })
})

it('[TC-F35.M45] reports implementation gaps separately from BE waits',()=>{
    const result=groupMigrationWarnings(['BE readiness: no products','Separate filter/sort control mapping is pending','PW1 carousel layout not verified','Unresolved source link retained: https://old.example/about (no migrated page matches)'])
    expect(result.waitingBe).toHaveLength(1)
    expect(result.functionality).toHaveLength(1)
    expect(result.presentation).toHaveLength(1)
    expect(result.links).toHaveLength(1)
})
