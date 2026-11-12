// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Field, SanitizedCollectionConfig } from 'payload'
import { buildEntities, creatorDiagnosticResolved, projectionMatches, resolveData, sourceKey } from '@/lib/migration/pw1-json/projection'
import { COLLECTIONS, type ImportDocument, type ImportStore } from '@/lib/migration/pw1-json/types'
import { DEFAULT_DASHBOARD_BLOCKS } from '@/lib/dashboard-utils'

function fixture(product: ImportDocument = {}) {
  const store: ImportStore = {storeId:'205',collections:Object.fromEntries(COLLECTIONS.map(c=>[c,[]])) as ImportStore['collections']}
  store.collections.tenants=[{_ref:'@tenants:stores:205'}]
  store.collections.sites=[{_ref:'@sites:stores:205',tenant:'@tenants:stores:205',pw1_source:{private:'preserved outside writer'},menus:[]}]
  store.collections.products=[{_ref:'@products:products:1',tenant:'@tenants:stores:205',inventory:0,notes:'@users:users:absent',items:[{quantity:1}],...product}]
  const fields:Record<string,Field[]>={sites:[{name:'tenant',type:'relationship',relationTo:'tenants',required:true}],products:[{name:'tenant',type:'relationship',relationTo:'tenants',required:true},{name:'inventory',type:'number',min:0},{name:'notes',type:'text'},{name:'items',type:'array',fields:[{name:'quantity',type:'number',required:true,min:1}]}]}
  // Pure projection consumes only slug/fields; full Payload sanitization belongs to DB integration.
  const configs=Object.fromEntries(COLLECTIONS.map(c=>[c,{slug:c,fields:fields[c]??[]}])) as Record<string,SanitizedCollectionConfig>
  return {store,configs}
}

describe('[TC-F42-IMP-007/008/009] Mapped projection fidelity',()=>{
  it('[TC-F42-IMP-MEDIA-001] keeps original PW1 external media URL bytes and does not invent upload metadata',()=>{
    // Arrange
    const {store,configs}=fixture()
    const url='https://cdn.example.test/PW1/Photo%20A.JPG?size=Original&sig=A%2Fb'
    store.collections.media=[{_ref:'@media:medias:1252',url,sourceUrl:url,alt:'Original PW1 media'}]
    configs.media.fields=[{name:'url',type:'text'},{name:'sourceUrl',type:'text'},{name:'alt',type:'text',required:true}]
    // Act
    const entity=buildEntities(store,configs,'PW1PROD:snapshot').find(row=>row.collection==='media')!
    // Assert
    expect(entity.data).toMatchObject({url,sourceUrl:url,alt:'Original PW1 media'})
    expect(entity.data).not.toHaveProperty('filename')
    expect(entity.data).not.toHaveProperty('tenant')
    expect(entity.storeId).toBe('205')
    expect(entity.sourceEntity).toBe('media')
  })
  it.each(['Original-Shop.primeweb.my', 'custom.example.test', null, undefined])('TC-F42-IMP-SOURCE-DOMAIN: preserves original Site domain independently of tenant slug: %s', domain => {
    // Arrange
    const { store, configs } = fixture()
    store.collections.tenants[0].slug = 'pw1-205-fallback'
    configs.tenants.fields.push({ name: 'slug', type: 'text', required: true })
    configs.sites.fields.push({ name: 'domain', type: 'text' })
    if (domain !== undefined) store.collections.sites[0].domain = domain
    // Act
    const entities = buildEntities(store, configs, 'source:snapshot', new Set(), false, true, true)
    const site = entities.find(entity => entity.collection === 'sites')!
    // Assert
    expect(site.data.domain).toBe(domain)
    if (domain === undefined) expect(site.data).not.toHaveProperty('domain')
    expect(entities.find(entity => entity.collection === 'tenants')!.data.slug).toBe('pw1-205-fallback')
    expect(resolveData(site, new Map([['@tenants:stores:205', 10]])).data.domain).toBe(domain)
  })
  it('TC-F42-IMP-RAW-SETTINGS: delegates raw settings only under the restored contract', () => {
    // Arrange
    const { store, configs } = fixture()
    const raw = [{ id: '1', value: '<a href="tel:011 1259 5933">Call</a>' }]
    store.collections.sites[0].raw_model_settings = raw
    // Act / Assert
    expect(() => buildEntities(store, configs, 'source:snapshot', new Set(), false, true)).toThrow()
    const entities = buildEntities(store, configs, 'source:snapshot', new Set(), false, true, true)
    expect(entities.find(entity => entity.collection === 'sites')?.data).not.toHaveProperty('raw_model_settings')
    expect(store.collections.sites[0].raw_model_settings).toEqual(raw)
  })
  it('preserves zero and text @ strings, removes raw Site only and gives stable child IDs',()=>{
    // Arrange
    const {store,configs}=fixture()
    // Act
    const first=buildEntities(store,configs,'source:snapshot');const second=buildEntities(store,configs,'source:snapshot')
    const product=first.find(e=>e.collection==='products')!
    const resolved=resolveData(product,new Map([['@tenants:stores:205',100]]))
    // Assert
    expect(first).toEqual(second);expect(product.data.inventory).toBe(0)
    expect(resolved.data.notes).toBe('@users:users:absent');expect(resolved.data.tenant).toBe(100)
    expect((product.data.items as ImportDocument[])[0].id).toMatch(/^[a-f0-9-]{36}$/)
    expect(first.find(e=>e.collection==='sites')!.data).not.toHaveProperty('pw1_source')
    expect(store.collections.sites[0]).toHaveProperty('pw1_source')
  })
  it.each([{inventory:0.5},{inventory:Infinity},{inventory:Number.MAX_SAFE_INTEGER+1},{createdAt:'2026-02-30T00:00:00Z'},{createdAt:'2026-02-01T00:00:00'},{password:'synthetic'},{tenant:'@tenants:stores:999'},{items:[{id:'same',quantity:1},{id:'same',quantity:1}]}])('rejects invalid mapped input %j',data=>{
    // Arrange
    const {store,configs}=fixture(data)
    // Act / Assert
    expect(()=>buildEntities(store,configs,'source:snapshot')).toThrow()
  })
  it('normalizes a valid explicit source offset without taking current time',()=>{
    // Arrange
    const {store,configs}=fixture({createdAt:'2024-02-29T08:01:02+08:00'})
    // Act
    const product=buildEntities(store,configs,'source:snapshot').find(e=>e.collection==='products')!
    // Assert
    expect(product.data.createdAt).toBe('2024-02-29T00:01:02.000Z')
  })
  it('defers an entire optional multi-reference field until all targets exist',()=>{
    // Arrange
    const {store,configs}=fixture();const entity=buildEntities(store,configs,'source:snapshot')[0]
    entity.data={images:['@media:medias:1','@media:medias:2']}
    entity.refs=[{ref:'@media:medias:1',collection:'media',required:false,path:'images'},{ref:'@media:medias:2',collection:'media',required:false,path:'images'}]
    // Act
    const pending=resolveData(entity,new Map([['@media:medias:2',22]]),true)
    const complete=resolveData(entity,new Map([['@media:medias:1',11],['@media:medias:2',22]]),true)
    // Assert
    expect(pending).toEqual({data:{},deferred:true});expect(complete).toEqual({data:{images:[11,22]},deferred:false})
    expect(()=>resolveData(entity,new Map(),false)).toThrow('RELATIONSHIP_NOT_READY')
  })
  it('compares child IDs/order but ignores unrelated target fields',()=>{
    // Arrange
    const expected={rows:[{id:'one',value:0},{id:'two',value:1}]}
    // Act / Assert
    expect(projectionMatches(expected,{...expected,other:'untouched'})).toBe(true)
    expect(projectionMatches(expected,{rows:[...expected.rows].reverse()})).toBe(false)
    expect(projectionMatches(expected,{rows:[{id:'new',value:0},expected.rows[1]]})).toBe(false)
  })
  it('preserves nonzero minor units and rejects fractional minor units',()=>{
    // Arrange
    const {store,configs}=fixture()
    configs.products.fields.push({name:'discountAmount',type:'number'})
    store.collections.products[0].discountAmount=125
    // Act / Assert
    expect(buildEntities(store,configs,'source:snapshot').find(e=>e.collection==='products')!.data.discountAmount).toBe(125)
    store.collections.products[0].discountAmount=1.25
    expect(()=>buildEntities(store,configs,'source:snapshot')).toThrow('INTEGER_REQUIRED')
  })
  it('requires parent-first scheduling even when Category schema parent is optional',()=>{
    // Arrange
    const {store,configs}=fixture()
    configs.categories.fields=[{name:'tenant',type:'relationship',relationTo:'tenants',required:true},{name:'parent',type:'relationship',relationTo:'categories'}]
    store.collections.categories=[{_ref:'@categories:categories:2',tenant:'@tenants:stores:205',parent:'@categories:categories:1'},{_ref:'@categories:categories:1',tenant:'@tenants:stores:205'}]
    // Act
    const entities=buildEntities(store,configs,'source:snapshot')
    // Assert
    expect(entities.find(e=>e.ref==='@categories:categories:2')!.refs.find(r=>r.path==='parent')!.required).toBe(true)
    expect(entities.find(e=>e.ref==='@categories:categories:1')!.refs.some(r=>r.path==='parent')).toBe(false)
  })
  it('keeps legacy media and Site source namespaces',()=>{
    // Arrange / Act / Assert
    expect(sourceKey('@sites:stores:205','sites')).toEqual({sourceEntity:'sites',sourceId:'205'})
    expect(sourceKey('@media:stores:205:logo','media')).toEqual({sourceEntity:'store_logo',sourceId:'205'})
    expect(sourceKey('@media:medias:10','media')).toEqual({sourceEntity:'media',sourceId:'10'})
  })
})


describe('[TC-F42-IMP-007/008] Operational rich text and historical payments', () => {
  it.each(['https://example.test/p', '/products/p', '#details', 'mailto:demo@example.test', 'tel:+123456'])('accepts safe operational links %s', url => {
    // Arrange
    const { store, configs } = fixture({ description: { root: { type: 'root', children: [{ type: 'link', fields: { url }, children: [] }] } } })
    configs.products.fields.push({ name: 'description', type: 'richText' })
    // Act / Assert
    expect(() => buildEntities(store, configs, 'snapshot')).not.toThrow()
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', '//example.test', 'https://u:p@example.test', '/\\example.test', 'https://example.test/\nsecret'])('rejects unsafe operational links %s', url => {
    // Arrange
    const { store, configs } = fixture({ description: { root: { type: 'root', children: [{ type: 'link', fields: { url }, children: [] }] } } })
    configs.products.fields.push({ name: 'description', type: 'richText' })
    // Act / Assert
    expect(() => buildEntities(store, configs, 'snapshot')).toThrow('RICH_TEXT_LINK_INVALID')
  })
  it('preserves an unknown historical payment method as null despite a target default', () => {
    // Arrange
    const { store, configs } = fixture()
    configs.orders.fields = [{ name: 'paymentMethod', type: 'select', options: ['cod', 'card'], defaultValue: 'cod' }]
    store.collections.orders = [{ _ref: '@orders:orders:1' }]
    // Act
    const order = buildEntities(store, configs, 'snapshot').find(entity => entity.collection === 'orders')!
    // Assert
    expect(order.data.paymentMethod).toBeNull()
  })
})


describe('[TC-F42-IMP-PREFS] Legacy dashboard preferences', () => {
  it.each([{}, { widgets: ['orders'] }, 'seo', ['seo', 'orders']])('normalizes non-array target preferences without changing source: %j', preferences => {
    // Arrange
    const { store, configs } = fixture()
    store.collections.tenants[0].settings = { dashboardPreferences: preferences }
    configs.tenants.fields = [{ name: 'settings', type: 'group', fields: [{ name: 'dashboardPreferences', type: 'json' }] }]
    const before = JSON.stringify(store)
    // Act
    const tenant = buildEntities(store, configs, 'test').find(entity => entity.collection === 'tenants')!
    // Assert
    expect(tenant.data.settings).toEqual({ dashboardPreferences: Array.isArray(preferences) ? preferences : DEFAULT_DASHBOARD_BLOCKS })
    expect(JSON.stringify(store)).toBe(before)
  })
})


describe('[TC-F42-IMP-STATUS-001] Preserve mapped publication status', () => {
  it.each([['products', 'active'], ['products', 'draft'], ['blogs', 'published'], ['blogs', 'draft'], ['discounts', 'active'], ['discounts', 'inactive']])('keeps %s status %s through projection and reference resolution', (collection, status) => {
    // Arrange
    const { store, configs } = fixture()
    store.collections.products = []
    const target = collection as 'products' | 'blogs' | 'discounts'
    store.collections[target] = [{ _ref: `@${target}:${target === 'blogs' ? 'blog_posts' : target === 'discounts' ? 'promotion_codes' : 'products'}:1`, tenant: '@tenants:stores:205', status }]
    configs[target].fields = [{ name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true }, { name: 'status', type: 'select', required: true, options: [status] }]
    // Act
    const entity = buildEntities(store, configs, 'source:snapshot').find(e => e.collection === target)!
    const resolved = resolveData(entity, new Map([['@tenants:stores:205', 100]]))
    // Assert
    expect(entity.data.status).toBe(status)
    expect(resolved.data.status).toBe(status)
  })
})


describe('[TC-F42-IMP-ROOT-CREATOR] approved PW1 root creator policy', () => {
  function userFixture(createdBy: unknown) {
    const { store, configs } = fixture()
    configs.users.fields = [
      { name: 'createdBy', type: 'relationship', relationTo: 'users' },
      { name: 'roles', type: 'select', hasMany: true, options: ['tenant-owner'] },
      { name: 'tenants', type: 'array', fields: [{ name: 'tenant', type: 'relationship', relationTo: 'tenants' }] },
    ]
    store.collections.users = [{ _ref: '@users:users:500', createdBy, roles: ['tenant-owner'], tenants: [{ tenant: '@tenants:stores:205' }] }]
    return { store, configs }
  }
  it('projects root creator to explicit null without a binding, preserves source and is replay-stable', () => {
    // Arrange
    const { store, configs } = userFixture('@users:users:1')
    // Act
    const first = buildEntities(store, configs, 'source:snapshot')
    const user = first.find(entity => entity.collection === 'users')!
    const resolved = resolveData(user, new Map([['@tenants:stores:205', 1282]]))
    // Assert
    expect(user.data.createdBy).toBeNull()
    expect(user.refs.some(ref => ref.path === 'createdBy')).toBe(false)
    expect(resolved.data.createdBy).toBeNull()
    expect(creatorDiagnosticResolved(user, new Map())).toBe(true)
    expect(store.collections.users[0].createdBy).toBe('@users:users:1')
    expect(buildEntities(store, configs, 'source:snapshot')).toEqual(first)
    expect(projectionMatches(resolved.data, { ...resolved.data, createdBy: 7 })).toBe(false)
  })
  it('still requires a resolved binding for creator 51 and rejects unknown creators', () => {
    // Arrange
    const { store, configs } = userFixture('@users:users:51')
    // Act
    const user = buildEntities(store, configs, 'source:snapshot', new Set(['@users:users:51'])).find(entity => entity.collection === 'users')!
    // Assert
    expect(user.data.createdBy).toBe('@users:users:51')
    expect(creatorDiagnosticResolved(user, new Map())).toBe(false)
    expect(creatorDiagnosticResolved(user, new Map([['@users:users:51', 7]]))).toBe(true)
    expect(() => buildEntities(store, configs, 'source:snapshot')).toThrow('UNRESOLVED_OR_CROSS_STORE_REFERENCE')
  })
  it('does not discharge a creator diagnostic merely because the input is null', () => {
    // Arrange
    const { store, configs } = userFixture(null)
    // Act
    const user = buildEntities(store, configs, 'source:snapshot').find(entity => entity.collection === 'users')!
    // Assert
    expect(creatorDiagnosticResolved(user, new Map())).toBe(false)
  })
})


describe('[TC-F42-IMP-POLICY-002] Missing source address fidelity', () => {
  it('preserves explicit null country and omitted line1 without filling Malaysia', () => {
    // Arrange
    const { store, configs } = fixture()
    configs.orders.fields = [{ name: 'shippingAddress', type: 'group', fields: [{ name: 'line1', type: 'text' }, { name: 'country', type: 'text', defaultValue: 'Malaysia' }] }]
    store.collections.orders = [{ _ref: '@orders:orders:1', shippingAddress: { country: null } }]
    // Act
    const order = buildEntities(store, configs, 'snapshot').find(entity => entity.collection === 'orders')!
    // Assert
    expect(order.data.shippingAddress).toEqual({ country: null })
    expect(resolveData(order, new Map()).data).toMatchObject({ shippingAddress: { country: null } })
  })
})


describe('[TC-F42-IMP-EMAIL-NORMALIZATION] Payload user email projection', () => {
  it('normalizes target email and checksum without mutating the source document', () => {
    // Arrange
    const {store,configs}=fixture()
    configs.users.fields=[{name:'email',type:'email',required:true},{name:'roles',type:'select',hasMany:true,options:['tenant-owner']},{name:'tenants',type:'array',fields:[{name:'tenant',type:'relationship',relationTo:'tenants'}]}]
    store.collections.users=[{_ref:'@users:users:230',roles:['tenant-owner'],tenants:[{tenant:'@tenants:stores:205'}],email:'  Example@Example.COM  '}]
    // Act
    const first=buildEntities(store,configs,'source:snapshot').find(e=>e.collection==='users')!
    const original=store.collections.users[0].email
    store.collections.users=[{_ref:'@users:users:230',roles:['tenant-owner'],tenants:[{tenant:'@tenants:stores:205'}],email:'example@example.com'}]
    const second=buildEntities(store,configs,'source:snapshot').find(e=>e.collection==='users')!
    // Assert
    expect(first.data.email).toBe('example@example.com')
    expect(original).toBe('  Example@Example.COM  ')
    expect(first.sourceChecksum).toBe(second.sourceChecksum)
    expect(projectionMatches(first.data,{...first.data,email:'example@example.com'})).toBe(true)
    expect(projectionMatches(first.data,{...first.data,email:'other@example.com'})).toBe(false)
  })
})


describe('[TC-F42-IMP-POLICY-003] Invalid source email fidelity', () => {
  it('preserves exact invalid email only with the internal approved policy capability', () => {
    // Arrange
    const { store, configs } = fixture()
    store.collections.users = [{ _ref: '@users:users:9', email: ' Broken@Email ', roles: ['tenant-owner'], tenants: [{ tenant: '@tenants:stores:205', role: 'owner' }] }]
    configs.users.fields = [{ name: 'email', type: 'email', required: true }, { name: 'roles', type: 'select', hasMany: true, options: ['tenant-owner'] }, { name: 'tenants', type: 'array', fields: [{ name: 'tenant', type: 'relationship', relationTo: 'tenants' }, { name: 'role', type: 'text' }] }]
    // Act
    const preserved = buildEntities(store, configs, 'source', new Set(), true).find(e => e.collection === 'users')!
    const ordinary = buildEntities(store, configs, 'source').find(e => e.collection === 'users')!
    // Assert
    expect(preserved.data.email).toBe(' Broken@Email ')
    expect(preserved.preserveInvalidEmail).toBe(true)
    expect(preserved.data).not.toHaveProperty('preserveInvalidEmail')
    expect(ordinary.data.email).toBe('broken@email')
    expect(ordinary.preserveInvalidEmail).toBeUndefined()
    store.collections.users[0].email = 'VALID@example.com'
    expect(buildEntities(store, configs, 'source', new Set(), true).find(e => e.collection === 'users')?.preserveInvalidEmail).toBeUndefined()
  })
})
