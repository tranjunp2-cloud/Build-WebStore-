import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { operationalIssues } from '@/lib/migration/pw1-export/validate-master'
import { mapContent } from '@/lib/migration/pw1-export/mappers/content'
import { rawRow, settings } from '@/lib/migration/pw1-export/mappers/raw'
import { blogSchema } from '@/lib/migration/pw1-export/mappers/content-schemas'
function fixture(extra: Record<string, Row[]> = {}) {
  const config = sourceConfigSchema.parse({
    version: 1,
    sourceInstance: 'fixture',
    sourceDatabase: 'fixture',
    sourceInstanceToken: 'fixture',
    snapshotId: 'one',
    asOf: '2026-01-01T00:00:00Z',
    utcOffset: '+00:00',
    sourcePlatformSuffix: 'old.test',
    targetPlatformSuffix: 'new.test',
    tables: { stores: 'stores.csv' },
    deletedStores: 'review',
  })
  const output = emptyStore()
  output.sites.push({ _ref: '@sites:stores:10' })
  output.users.push({ _ref: '@users:users:20', tenants: [{ tenant: '@tenants:stores:10', role: 'editor' }] })
  return new SourceIndex({
    stores: [{ id: '10', name: 'Example' }],
    ...extra,
  }).context(config, '10', output, [], [])
}
describe('PW1 content and raw preservation', () => {
  it('TC-F42-EXP-112: retains deleted Page timestamps and settings with raw fallback', () => {
    // Arrange
    const ctx = fixture({
      pages: [
        {
          id: '30',
          store_id: '10',
          name: 'Old',
          deleted_at: '2020-01-01 10:00:00',
          position: '2',
        },
      ],
      model_settings: [
        {
          id: '40',
          store_id: '10',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          key: 'title',
          value: 'Original',
        },
        {
          id: '41',
          store_id: '11',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          key: 'title',
          value: 'Foreign',
        },
        {
          id: '42',
          store_id: '10',
          model_type: 'App\\Models\\Store',
          model_id: '30',
          key: 'title',
          value: 'Other',
        },
      ],
    })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.pages[0]).toMatchObject({
      deleted_at: '2020-01-01 10:00:00',
      model_settings: [ctx.tables.model_settings[0]],
    })
    expect(ctx.output.pages[0]).not.toHaveProperty('layout')
    expect(ctx.diagnostics.filter(item => item.table === 'model_settings')).toEqual([])
    expect(ctx.contributions.filter(item => item.table === 'model_settings').map(item => item.sourceId)).toEqual(['40', '42'])
    expect(ctx.output.sites[0].raw_model_settings).toEqual([ctx.tables.model_settings[2]])
  })
  it('TC-F42-EXP-012: preserves source image markup and relative links without media extraction', () => {
    // Arrange
    const ctx = fixture({
      blog_posts: [
        {
          id: '50',
          store_id: '10',
          name: 'Article',
          slug: 'article',
          status: '1',
          created_by: '20',
          created_at: '2025-01-01 00:00:00',
          updated_at: '2025-01-02 00:00:00',
          content:
            '<p>Hello <strong>world</strong><a href="../other">next</a><img src="https://example.test/a.png" alt="Alt"></p>',
        },
      ],
    })
    // Act
    mapContent(ctx)
    // Assert
    expect(blogSchema.safeParse(ctx.output.blogs[0]).success).toBe(true)
    expect(JSON.stringify(ctx.output.blogs[0].content)).toContain('../other')
    expect(ctx.output.media).toEqual([])
    expect(ctx.output.blogs[0].content).toMatchObject({ root: { children: [{ children: [{ text: ctx.tables.blog_posts[0].content }] }] } })
  })
  it('TC-F42-EXP-013: excludes nested secrets, credential URLs and unknown settings without logging values', () => {
    // Arrange
    const ctx = fixture()
    // Act
    const row = rawRow(
      ctx,
      'stores',
      {
        id: '10',
        dns_token: 'secret-value',
        social_channel: '{"token":"hidden-value"}',
        logo: 'https://example.test/image?custom=private',
      },
      'sites.pw1_source.store',
    )
    const setting = rawRow(
      ctx,
      'model_settings',
      { id: '1', key: 'unknown', value: 'opaque-private' },
      'settings',
    )
    // Assert
    expect(row).toEqual({ id: '10' })
    expect(setting).toEqual({ id: '1', key: 'unknown', value: 'opaque-private' })
    expect(JSON.stringify(ctx.diagnostics)).not.toMatch(
      /secret-value|hidden-value|private/,
    )
  })
  it('TC-F42-EXP-112: preserves verified, invalid and secret-like setting values without logging them', () => {
    // Arrange
    const ctx = fixture()
    const values: [string, string][] = [
      ['animation', 'auto'],
      ['timing_animation', '3'],
      ['list_type', 'fixed'],
      ['order_by', 'created_at'],
      ['per_page', '20'],
      ['criteria', '{"category":1,"price":0}'],
      ['others', '{"display_out_of_stock":1}'],
      ['show_created_at_article_listing', '1'],
    ]
    // Act
    const preserved = values.map(([key, value]) =>
      rawRow(
        ctx,
        'model_settings',
        { id: '1', key, value, name: 'UI label' },
        'settings',
      ),
    )
    const invalid = [
      { key: 'per_page', value: 'twenty' },
      { key: 'title', field: 'api_key', value: 'opaque' },
      { key: 'criteria', value: '{"category":"password=hidden"}' },
      { key: 'unknown', field: 'title', value: 'opaque' },
      { key: 'criteria', value: '{"secret":1}' },
    ].map((row) =>
      rawRow(ctx, 'model_settings', { id: '2', ...row }, 'settings'),
    )
    // Assert
    expect(preserved.map(row => [row.key, row.value])).toEqual(values)
    expect(invalid.map(row => row.value)).toEqual(['twenty', 'opaque', '{"category":"password=hidden"}', 'opaque', '{"secret":1}'])
    expect(ctx.diagnostics).toEqual([])
    expect(ctx.contributions.length).toBeGreaterThan(0)
  })
  it('TC-F42-EXP-013: preserves component definitions as opaque source content', () => {
    // Arrange
    const ctx = fixture()
    const config =
      '{"animation":{"required":0,"type":"radio","option":[{"value":"auto","label":"Auto","selected":1}]},"criteria":{"required_if":{"list_type":"fixed"}}}'
    // Act
    const definition = rawRow(
      ctx,
      'frontend_components',
      { id: '1', config },
      'component',
    )
    const store = rawRow(
      ctx,
      'stores',
      { id: '10', social_channel: config },
      'store',
    )
    const secret = rawRow(
      ctx,
      'frontend_components',
      { id: '2', config: '{"animation":{"token":"hidden"}}' },
      'component',
    )
    // Assert
    expect(definition.config).toBe(config)
    expect(store).not.toHaveProperty('social_channel')
    expect(secret.config).toBe('{"animation":{"token":"hidden"}}')
  })
  it('TC-F42-EXP-013: retains source-defined banner, menu, page and checkout UI data without widening other fields', () => {
    // Arrange
    const ctx = fixture()
    const cases = [
      [
        'banners',
        'button',
        '{"status":1,"mode":{"default":{"bold":1,"text_color":"#fff"},"hover":{"underline":0}}}',
      ],
      ['menus', 'config', '{"cart_status":1,"search_status":0}'],
      ['pages', 'config', '{"show_created_at_article_detail":1}'],
    ]
    // Act
    const rows = cases.map(([table, field, value]) =>
      rawRow(ctx, table, { id: '1', [field]: value }, 'raw'),
    )
    const settingsRows = [
      { key: 'theme.primary_color', value: '#fff' },
      {
        key: 'receiver_information',
        value: '{"fullname":1,"note_for_delivery":0}',
      },
      { key: 'checkout_button_text', value: 'Checkout' },
    ].map((row) => rawRow(ctx, 'model_settings', { id: '1', ...row }, 'raw'))
    const rejected = [
      rawRow(ctx, 'stores', { id: '1', social_channel: cases[1][2] }, 'raw'),
      rawRow(
        ctx,
        'banners',
        { id: '1', button: '{"mode":{"token":"hidden"}}' },
        'raw',
      ),
      rawRow(
        ctx,
        'model_settings',
        { id: '1', key: 'receiver_information', value: '{"unknown":1}' },
        'raw',
      ),
      rawRow(
        ctx,
        'model_settings',
        {
          id: '1',
          key: 'theme.primary_color',
          value: 'https://example.test/?token=hidden',
        },
        'raw',
      ),
    ]
    // Assert
    cases.forEach(([, field, value], index) =>
      expect(rows[index][field]).toBe(value),
    )
    expect(settingsRows.map(row => row.value)).toEqual(['#fff', '{"fullname":1,"note_for_delivery":0}', 'Checkout'])
    expect(rejected).toEqual([
      { id: '1' },
      { id: '1', button: '{"mode":{"token":"hidden"}}' },
      { id: '1', key: 'receiver_information', value: '{"unknown":1}' },
      { id: '1', key: 'theme.primary_color', value: 'https://example.test/?token=hidden' },
    ])
  })
  it('TC-F42-EXP-112: preserves all MenuLine dotted settings regardless of key', () => {
    // Arrange
    const ctx = fixture()
    const model_type = 'App\\Models\\MenuLine'
    // Act
    const valid = [
      'id',
      'position',
      'url',
      'size',
      'type',
      'image',
      'signature',
    ].map((field) =>
      rawRow(
        ctx,
        'model_settings',
        { id: '1', model_type, key: `items.0.${field}`, value: 'source-value' },
        'raw',
      ),
    )
    const invalid = [
      { model_type, key: 'items.0.api_key' },
      { model_type, key: 'items.0.srcUpload' },
      { model_type, key: 'items.0.idEdit' },
      { model_type: 'App\\Models\\Store', key: 'items.0.image' },
    ].map((row) =>
      rawRow(
        ctx,
        'model_settings',
        { id: '1', ...row, value: 'source-value' },
        'raw',
      ),
    )
    // Assert
    for (const row of [...valid, ...invalid]) expect(row.value).toBe('source-value')
    expect(ctx.diagnostics).toEqual([])
    expect(ctx.contributions.length).toBeGreaterThan(0)
  })
  it('TC-F42-EXP-112: settings infer missing direct Store from the requested parent and reject foreign Store', () => {
    // Arrange
    const ctx = fixture({
      model_settings: [
        {
          id: '1',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          store_id: '',
          key: 'header',
          value: 'Hello',
        },
        {
          id: '2',
          model_type: 'App\\Models\\Page',
          model_id: '30',
          store_id: '11',
          key: 'header',
          value: 'Hello',
        },
      ],
    })
    // Act
    const output = settings(ctx, 'Page', '30', 'settings')
    // Assert
    expect(output).toEqual([ctx.tables.model_settings[0]])
    expect(ctx.diagnostics).toEqual([])
    expect(ctx.contributions.length).toBeGreaterThan(0)
  })
  it('TC-F42-EXP-020: raw Site source omits five excluded media arrays', () => {
    // Arrange
    const ctx = fixture({
      medias: [{ id: '1', store_id: '10' }],
      product_images: [{ id: '2', store_id: '10' }],
    })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.sites[0]).not.toHaveProperty('pw1_source')
  })
  it('TC-F42-056: cross-tenant category slug is valid and missing author without a verified tenant owner remains blocked', () => {
    // Arrange
    const time = {
      created_at: '2025-01-01 00:00:00',
      updated_at: '2025-01-02 00:00:00',
    }
    const ctx = fixture({
      blog_categories: [
        {
          id: '1',
          store_id: '10',
          name: 'A',
          slug: 'same',
          status: '1',
          ...time,
        },
        {
          id: '2',
          store_id: '11',
          name: 'B',
          slug: 'same',
          status: '1',
          ...time,
        },
      ],
      blog_posts: [
        {
          id: '3',
          store_id: '10',
          name: 'Post',
          slug: 'post',
          status: '1',
          created_by: '999',
          content: '<p>Hello</p>',
          ...time,
        },
      ],
    })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blog_categories).toHaveLength(1)
    expect(ctx.output.blog_categories[0]).toMatchObject({ slug: 'same', tenant: '@tenants:stores:10' })
    expect(ctx.output.blogs).toEqual([])
    expect(ctx.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['BLOG_AUTHOR_UNRESOLVED']),
    )
  })
  it('TC-F42-EXP-093: Blog content is preserved verbatim without filtering HTML', () => {
    // Arrange
    const ctx = fixture({
      blog_posts: [
        {
          id: '50',
          store_id: '10',
          name: 'Article',
          slug: 'article',
          status: '1',
          created_by: '20',
          created_at: '2025-01-01 00:00:00',
          updated_at: '2025-01-02 00:00:00',
          content:
            '<table><tr><td>Cell</td></tr></table><a href="javascript:alert(1)">Label</a><script>alert(1)</script>',
        },
      ],
    })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blogs[0].content).toMatchObject({ root: { children: [{ children: [{ text: ctx.tables.blog_posts[0].content }] }] } })
    expect(ctx.output.media).toEqual([])
    expect(ctx.diagnostics).toEqual([])
  })
  it('TC-F42-EXP-012: preserves each email locale and flags empty fallback without inventing updatedBy', () => {
    // Arrange
    const ctx = fixture({
      store_email_templates: [
        {
          id: '60',
          store_id: '10',
          type_id: '1',
          status: '1',
          subject: 'Hello',
          subject_ms: '',
          created_by: '20',
          created_at: '2025-01-01 00:00:00',
          updated_at: '2025-01-02 00:00:00',
        },
      ],
    })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output['email-template-settings'][0]).toMatchObject({
      contentEn: { subject: 'Hello' },
      contentMs: { subject: '' },
      enabled: true,
      templateType: 'order-confirmation',
    })
    expect(ctx.output['email-template-settings'][0]).not.toHaveProperty(
      'updatedBy',
    )
    expect(ctx.diagnostics.map((item) => item.code)).toContain(
      'EMAIL_EMPTY_LOCALE_FALLBACK',
    )
  })
})


describe('[TC-F42-056] tenant scoped blog source collisions', () => {
  const time = { created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }
  for (const table of ['blog_posts', 'blog_categories']) {
    for (const sameTenant of [false, true]) {
      it(`${table}: ${sameTenant ? 'quarantines same-tenant duplicates' : 'preserves cross-tenant slugs'}`, () => {
        // Arrange
        const row = { name: 'Post', slug: 'same', status: '1', created_by: '20', content: '<p>Hello</p>', ...time }
        const ctx = fixture({ [table]: [
          { ...row, id: '1', store_id: '10' },
          { ...row, id: '2', store_id: sameTenant ? '10' : '11' },
        ] })
        // Act
        mapContent(ctx)
        // Assert
        const output = table === 'blog_posts' ? ctx.output.blogs : ctx.output.blog_categories
        expect(output).toHaveLength(sameTenant ? 0 : 1)
        expect(ctx.diagnostics.filter(item => item.code === 'BLOG_SLUG_COLLISION')).toHaveLength(sameTenant ? 2 : 0)
      })
    }
  }
})


describe('[TC-F42-056] normalized blog collision quarantine', () => {
  for (const table of ['blog_posts', 'blog_categories']) {
    it.each(['NEWS', ' news '])(`${table}: rejects only conflicting records for %s`, (collisionSlug) => {
      // Arrange
      const base = { store_id: '10', name: 'Post', status: '1', created_by: '20', content: '<p>Hello</p>',
        created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }
      const ctx = fixture({ [table]: [
        { ...base, id: '1', slug: 'news' },
        { ...base, id: '2', slug: collisionSlug },
        { ...base, id: '3', slug: 'retained' },
        { ...base, id: '4', store_id: '11', slug: 'retained' },
      ] })
      ctx.output.tenants.push({ _ref: '@tenants:stores:10', metaData: { pw1StoreId: '10' } })
      // Act
      mapContent(ctx)
      const issues = operationalIssues([ctx.output])
      // Assert
      const output = table === 'blog_posts' ? ctx.output.blogs : ctx.output.blog_categories
      expect(output.map((doc) => doc.slug)).toEqual(['retained'])
      expect(ctx.diagnostics.filter((item) => item.code === 'BLOG_SLUG_COLLISION').map((item) => item.sourceId)).toEqual(['1', '2'])
      expect(issues).toEqual([])
      expect(ctx.output.tenants).toHaveLength(1)
    })
  }
})

it('TC-F42-EXP-091: preserves opaque Product description fields in raw classification without relaxing other fields', () => {
  // Arrange
  const ctx = fixture()
  const source = '<script>secret=CANARY</script>{invalid JSON}<img src="javascript:example()">'
  // Act
  const result = rawRow(ctx, 'products', { id: '1', description: source, description_ms: source, name: '{invalid JSON' }, 'sites.pw1_source.products')
  // Assert
  expect(result.description).toBe(source)
  expect(result.description_ms).toBe(source)
  expect(ctx.diagnostics.some(d => ['description', 'description_ms'].includes(d.field ?? ''))).toBe(false)
  expect(ctx.diagnostics.some(d => d.field === 'name' && d.code === 'RAW_VALUE_UNVERIFIED')).toBe(true)
})


describe('[TC-F42-EXP-092] Blog author fallback to tenant owner', () => {
  function blogContext(createdBy: string | null) {
    return fixture({ blog_posts: [{ id: '3', store_id: '10', name: 'Post', slug: 'post', status: '1', created_by: createdBy,
      content: '<p>Hello</p>', created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }] })
  }
  it.each([null, '', '999'])('uses emitted tenant owner when source author %j cannot resolve', createdBy => {
    // Arrange
    const ctx = blogContext(createdBy)
    ctx.output.users[0].tenants = [{ tenant: '@tenants:stores:10', role: 'owner' }]
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blogs).toHaveLength(1)
    expect(ctx.output.blogs[0].author).toBe('@users:users:20')
    expect(ctx.diagnostics.some(d => d.code === 'BLOG_AUTHOR_UNRESOLVED')).toBe(false)
  })
  it('keeps a resolved author rather than replacing it with the owner', () => {
    // Arrange
    const ctx = blogContext('21')
    ctx.output.users[0].tenants = [{ tenant: '@tenants:stores:10', role: 'owner' }]
    ctx.output.users.push({ _ref: '@users:users:21', tenants: [{ tenant: '@tenants:stores:10', role: 'editor' }] })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blogs[0].author).toBe('@users:users:21')
  })
  it.each(['foreign', 'ambiguous'])('does not guess an owner when %s', kind => {
    // Arrange
    const ctx = blogContext(null)
    ctx.output.users[0].tenants = [{ tenant: kind === 'foreign' ? '@tenants:stores:11' : '@tenants:stores:10', role: 'owner' }]
    if (kind === 'ambiguous') ctx.output.users.push({ _ref: '@users:users:21', tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }] })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blogs).toEqual([])
    expect(ctx.diagnostics.some(d => d.code === 'BLOG_AUTHOR_UNRESOLVED')).toBe(true)
  })
})


describe('[TC-F42-EXP-093] Opaque Blog content', () => {
  it.each(['', '  \r\nTiếng Việt 🛒 &amp;\t', '{invalid JSON', '<img src="javascript:x"><style>p{color:red}</style><script>canary()</script>'])('preserves raw Blog fields %j', source => {
    // Arrange
    const ctx = fixture()
    // Act
    const doc = rawRow(ctx, 'blog_posts', { id: '1', content: source, content_ms: source }, 'sites.pw1_source.blog_posts')
    // Assert
    expect(doc.content).toBe(source)
    expect(doc.content_ms).toBe(source)
    expect(ctx.diagnostics).toEqual([])
  })
})


describe('[TC-F42-EXP-097] Skip inactive Blog categories', () => {
  const dates = { created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }
  const category = { id: '1', store_id: '10', name: 'Old', slug: 'same', status: '0', ...dates }
  const blog = { id: '3', store_id: '10', name: 'Post', slug: 'post', status: '1', created_by: '20', blog_category_id: '1', content: 'Original <b>content</b>', ...dates }
  it.each(['0', '1'])('keeps Blog status %s and content without its inactive category', status => {
    // Arrange
    const ctx = fixture({ blog_categories: [category, { ...category, id: '2', status: '1' }], blog_posts: [{ ...blog, status }] })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blog_categories.map(row => row._ref)).toEqual(['@blog_categories:blog_categories:2'])
    expect(ctx.output.blogs).toHaveLength(1)
    expect(ctx.output.blogs[0]).not.toHaveProperty('category')
    expect(ctx.output.blogs[0]).toMatchObject({ status: status === '1' ? 'published' : 'draft', author: '@users:users:20', content: { root: { children: [{ children: [{ text: blog.content }] }] } } })
    expect(ctx.diagnostics.filter(d => ['BLOG_CATEGORY_INACTIVE', 'BLOG_CATEGORY_UNRESOLVED', 'BLOG_SLUG_COLLISION'].includes(d.code))).toEqual([])
  })
  it.each([
    { categories: [] },
    { categories: [{ ...category, deleted_at: '2025-01-01 00:00:00' }] },
    { categories: [{ ...category, store_id: '11' }] },
    { categories: [{ ...category, status: '2' }] },
  ])('retains unresolved relationship for missing/deleted/foreign/unknown category %#', ({ categories }) => {
    // Arrange
    const ctx = fixture({ blog_categories: categories, blog_posts: [blog] })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BLOG_CATEGORY_UNRESOLVED', sourceId: '3' })]))
  })
  it('does not validate inactive category content destined only for the source CSV', () => {
    // Arrange
    const ctx = fixture({ blog_categories: [{ ...category, slug: '/', name: '{invalid JSON' }] })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blog_categories).toEqual([])
    expect(ctx.diagnostics.filter(d => d.table === 'blog_categories')).toEqual([])
    expect(ctx.contributions).toEqual(expect.arrayContaining([expect.objectContaining({ table: 'blog_categories', sourceId: '1', rule: 'MASTER-4.1-EXTERNAL-CSV-ARCHIVE' })]))
  })
})


describe('[TC-F42-EXP-099] Default path preserves source slugs', () => {
  it('does not silently trim Blog/category slugs when draft normalization is disabled', () => {
    // Arrange
    const dates = { created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' }
    const ctx = fixture({ blog_categories: [{ id: '1', store_id: '10', name: 'Category', slug: ' category ', status: '1', ...dates }], blog_posts: [{ id: '2', store_id: '10', name: 'Blog', slug: ' blog ', status: '1', created_by: '20', blog_category_id: '1', content: 'Original', ...dates }] })
    // Act
    mapContent(ctx)
    // Assert
    expect(ctx.output.blog_categories[0].slug).toBe(' category ')
    expect(ctx.output.blogs[0].slug).toBe(' blog ')
  })
})

it('TC-F42-EXP-012: preserves opaque Page content and its template without interpreting embedded markers', () => {
  // Arrange
  const original = '  {broken JSON <a href="javascript:test()">Password: original</a>  '
  const ctx = fixture({
    stores: [{ id: '10', frontend_template_id: '9' }],
    frontend_templates: [{ id: '9', config: original, future_column: 'unchanged' }],
    pages: [{ id: '30', store_id: '10', content: original, future_column: original }],
  })
  // Act
  mapContent(ctx)
  // Assert
  expect(ctx.output.pages[0]).toMatchObject({ content: original, future_column: original })
  expect(ctx.output.sites[0].raw_frontend_template).toEqual({ id: '9', config: original, future_column: 'unchanged' })
  expect(ctx.diagnostics.filter(d => ['RAW_VALUE_UNVERIFIED', 'RAW_FIELD_UNVERIFIED'].includes(d.code))).toEqual([])
})

it('TC-F42-EXP-012: skips raw validation of deleted Products while checking live Products', () => {
  // Arrange
  const ctx = fixture({ products: [
    { id: '5341', store_id: '10', deleted_at: '2022-06-17 00:00:00', featured_description: 'Password: source' },
    { id: '5342', store_id: '10', deleted_at: null, featured_description: 'Password: source' },
  ] })
  // Act
  mapContent(ctx)
  // Assert
  expect(ctx.diagnostics.some(d => d.sourceId === '5341' && d.code === 'RAW_VALUE_UNVERIFIED')).toBe(false)
  expect(ctx.diagnostics.some(d => d.sourceId === '5342' && d.code === 'RAW_VALUE_UNVERIFIED')).toBe(true)
})
