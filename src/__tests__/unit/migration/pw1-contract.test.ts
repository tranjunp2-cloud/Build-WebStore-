import { describe, expect, it } from 'vitest'
import { createNativeBlueprint } from '@/lib/migration/pw1-contract'

function fixture() {
    return {
        format: 'pw2-reconstruction-contract', version: '1.0.0',
        source: { storeId: '205', url: 'https://source.example', capturedAt: '', dumpHash: '' },
        site: { name: 'Shop', navigation: { blockType: 'navigation' }, footer: { blockType: 'footer' } },
        reconciliation: [],
        pages: [{ sourceId: '1', title: 'Home', slug: 'home', isHomepage: true,
            components: [{ sourceId: '2', position: 0, kind: 'rich_text', block: { html: '<p>Source</p>' } }] }],
    }
}

describe('[TC-F35.M26] Native blueprint', () => {
    it('retains the contract without compiling a legacy generated website', () => {
        const input = fixture()
        const result = createNativeBlueprint(input)
        expect(result.nativeContract).toEqual(input)
        expect(result.pages).toEqual([{ sourceId: '1', title: 'Home', slug: 'home', isHomepage: true, kind: 'content' }])
        expect(result).not.toHaveProperty('result')
        expect(result.pages[0]).not.toHaveProperty('blocks')
    })
    it('rejects invalid homepage, duplicate identities and component ordering', () => {
        const input = fixture()
        input.pages[0].isHomepage = false
        expect(() => createNativeBlueprint(input)).toThrow('homepage')
        input.pages[0].isHomepage = true
        input.pages.push({ ...input.pages[0], isHomepage: false })
        expect(() => createNativeBlueprint(input)).toThrow('Duplicate source page')
        input.pages.pop()
        input.pages[0].components.push({ ...input.pages[0].components[0], position: 1 })
        expect(() => createNativeBlueprint(input)).toThrow('Duplicate component')
        input.pages[0].components[1] = { ...input.pages[0].components[1], sourceId: '3', position: 0 }
        expect(() => createNativeBlueprint(input)).toThrow('invalid source order')
    })
})
