import { describe, expect, it } from 'vitest'
import { parseMigrationInput } from '@/lib/migration/pw1-collection-input'
function fixture() {
    const component = (id: string, status: string, html: string) => ({ id, page_id: '10', status, position: id, frontend_component: { name: 'rich_text', default_config_values: '{}' }, model_settings: [{key:'content',value:html,status:'1',store_id:'205'}] })
    return [{
        tenants: [{_ref:'@tenants:stores:205',metaData:{pw1StoreId:'205'}}],
        users: [{_ref:'@users:users:517',email:'owner@example.com',firstName:'Owner',tenants:[{tenant:'@tenants:stores:205',role:'owner',status:'active'}]}],
        sites: [{tenant:'@tenants:stores:205',name:'Shop',domain:'shop.example',locale:'ms',branding:{logo:'https://shop.example/logo.jpg'},menus:[{id:'1',type:'1',status:'1',menu_items:[{id:'1',name:'Deleted',model_type:'App\\Models\\Page',model_id:'11',menu_lines:[{id:'2',model_settings:[{key:'name',value:'Home'},{key:'model_type',value:'App\\Models\\Page'},{key:'model_id',value:'10'}]}]}]}]}],
        pages: [
            {id:'10',store_id:'205',name:'Home',name_ms:'Laman',type:'1',slug:'home',status:'1',components:[component('1','1','<p>Keep</p>'),component('2','0','<p>Disabled</p>'),component('3','1','<p>&nbsp;</p>')]},
            {id:'11',store_id:'205',name:'Deleted',type:'7',slug:'old',status:'1',deleted_at:'2025-01-01',components:[]},
        ],
        orders:[{secretSentinel:'do-not-project'}],
    }]
}
describe('[TC-F35.M27] BE collection input', () => {
    it('projects source content and locale, excludes disabled/empty/deleted data and promotes valid child links', () => {
        const input = fixture(), original = JSON.stringify(input)
        const {entries,reports} = parseMigrationInput(input)
        expect(entries[0].website.locale).toBe('ms')
        expect(entries[0].website.pages).toHaveLength(1)
        expect(entries[0].website.pages[0].components.map(c=>c.sourceId)).toEqual(['1'])
        expect(entries[0].website.navigation).toEqual([{label:'Home',pageId:'10'}])
        expect(reports[0].excluded).toEqual(expect.arrayContaining([
            {id:'11',kind:'page',reason:'disabled-or-deleted'},
            {id:'2',kind:'component',reason:'disabled-or-deleted'},
            {id:'3',kind:'component',reason:'empty-rich-text'},
        ]))
        expect(JSON.stringify(entries)).not.toContain('do-not-project')
        expect(JSON.stringify(input)).toBe(original)
    })
    it('rejects ambiguous owners and cross-store settings before any generation', () => {
        const input = fixture()
        input[0].users.push({...input[0].users[0],_ref:'@users:users:518'})
        expect(()=>parseMigrationInput(input)).toThrow('exactly one active owner')
        input[0].users.pop()
        input[0].pages[0].components[0].model_settings[0].store_id='999'
        expect(()=>parseMigrationInput(input)).toThrow('another store')
    })
})
