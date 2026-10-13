import { reportSchema } from '@/lib/migration/pw1-export/artifact-schemas'
import { describe, expect, it } from 'vitest'
import { mapContent } from '@/lib/migration/pw1-export/mappers/content'
import { mapIdentity } from '@/lib/migration/pw1-export/mappers/identity-site'
import { mapRawContent } from '@/lib/migration/pw1-export/mappers/content-raw'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { emptyStore, type MigrationPolicy, type Row } from '@/lib/migration/pw1-export/contracts'

const basePolicy: MigrationPolicy = {
  decisionEvidence: 'DECISION-TEST-GROUP6',
  siteTypeDefault: 'ecommerce',
  siteTypeOverrides: {},
  shippingPolicy: 'pw2-defaults',
  activeCatalogOnly: false,
  deferEmailTemplates: true,
  allowSparseVariants: false,
  preserveUserCreators: false,
}

function createContext(tables: Record<string, Row[]>, overrides: Partial<MigrationPolicy> = {}) {
  const config = sourceConfigSchema.parse({
    version: 1,
    sourceInstance: 'test',
    sourceDatabase: 'test',
    sourceInstanceToken: 'token',
    snapshotId: 'snap',
    asOf: '2026-01-01T00:00:00.000Z',
    utcOffset: '+08:00',
    sourcePlatformSuffix: 'example.com',
    targetPlatformSuffix: 'primeweb.app',
    tables: { stores: 'stores.csv' },
    deletedStores: 'review',
    migrationPolicy: { ...basePolicy, ...overrides },
  })
  const output = emptyStore()
  return new SourceIndex(tables).context(config, '10', output, [], [])
}

describe('Content, Media & Raw Domain Resolution (Group 6)', () => {
  const store = { id: '10', name: 'Shop', currency_id: '1' }
  const dates = {
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
  }

  it('handles BLOG_MEDIA_UNRESOLVED: blocker by default, warning when allowUnresolvedBlogMedia is true', () => {
    const blogPost: Row = {
      id: '1',
      store_id: '10',
      name: 'Test Article',
      slug: 'test-article',
      status: '1',
      created_by: '101',
      image: 'invalid:not-a-valid-url', // broken image
      content: '<p>Hello world</p>',
      ...dates,
    }
    const user: Row = {
      id: '101',
      name: 'Owner',
      email: 'owner@test.local',
      status: '1',
      ...dates,
    }
    const tables = {
      stores: [store],
      users: [user],
      blog_posts: [blogPost],
      blog_categories: [],
      roles: [{ id: '1', name: 'owner', guard_name: 'api' }],
      model_has_roles: [{ model_type: 'App\\Models\\User', model_id: '101', role_id: '1' }],
    }

    // 1. Strict mode
    const strictCtx = createContext(tables, { allowUnresolvedBlogMedia: false })
    strictCtx.output.users.push({
      _ref: '@users:users:101',
      tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }],
    })
    mapContent(strictCtx)
    const strictIssue = strictCtx.diagnostics.find(d => d.code === 'BLOG_MEDIA_UNRESOLVED')
    expect(strictIssue).toBeDefined()
    expect(strictIssue?.severity).toBe('blocker')

    // 2. Permissive mode
    const permissiveCtx = createContext(tables, { allowUnresolvedBlogMedia: true })
    permissiveCtx.output.users.push({
      _ref: '@users:users:101',
      tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }],
    })
    mapContent(permissiveCtx)
    const permissiveIssue = permissiveCtx.diagnostics.find(d => d.code === 'BLOG_MEDIA_UNRESOLVED')
    expect(permissiveIssue).toBeDefined()
    expect(permissiveIssue?.severity).toBe('warning')
    // Blog post is still exported without thumbnail!
    expect(permissiveCtx.output.blogs).toHaveLength(1)
    expect(permissiveCtx.output.blogs[0].thumbnail).toBeUndefined()
  })

  it('handles BLOG_AUTHOR_UNRESOLVED: falls back to primary owner when fallbackBlogAuthorToOwner is true', () => {
    const blogPost: Row = {
      id: '2',
      store_id: '10',
      name: 'Article with Deleted Author',
      slug: 'deleted-author-article',
      status: '1',
      created_by: '9999', // Non-existent user
      content: '<p>Content</p>',
      ...dates,
    }
    const tables = {
      stores: [store],
      blog_posts: [blogPost],
      blog_categories: [],
    }

    // 1. Strict mode with 2 owners: cannot disambiguate -> blocks
    const strictCtx = createContext(tables, { fallbackBlogAuthorToOwner: false })
    strictCtx.output.users.push(
      { _ref: '@users:users:101', tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }] },
      { _ref: '@users:users:102', tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }] },
    )
    mapContent(strictCtx)
    expect(strictCtx.output.blogs).toHaveLength(0)
    expect(strictCtx.diagnostics.some(d => d.code === 'BLOG_AUTHOR_UNRESOLVED')).toBe(true)

    // 2. Permissive mode: falls back to primary owner
    const permissiveCtx = createContext(tables, { fallbackBlogAuthorToOwner: true })
    permissiveCtx.output.users.push(
      { _ref: '@users:users:101', tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }] },
      { _ref: '@users:users:102', tenants: [{ tenant: '@tenants:stores:10', role: 'owner' }] },
    )
    mapContent(permissiveCtx)
    expect(permissiveCtx.output.blogs).toHaveLength(0)
    expect(permissiveCtx.diagnostics.some(d => d.code === 'BLOG_AUTHOR_UNRESOLVED')).toBe(true)
    permissiveCtx.output.users.pop()
    mapContent(permissiveCtx)
    expect(permissiveCtx.output.blogs[0].author).toBe('@users:users:101')
  })

  it('handles CONTACT_STRUCTURE_UNRESOLVED: extracts hotline from JSON/array, demotes failure to warning', () => {
    // 1. Multilingual hotline: {"en": "+60123456789", "ms": "+60198765432"}
    const storeWithJsonHotline = {
      ...store,
      currency_id: '1',
      selected_delivery_method: '1',
      hotline: JSON.stringify({ en: '+60123456789', ms: '+60198765432' }),
      status: '1',
      ...dates,
    }
    const user = {
      id: '1',
      store_id: '10',
      name: 'Owner',
      email: 'owner@test.local',
      status: '1',
      is_frontend: '0',
      is_store_owner: '1',
      ...dates,
    }
    const tables = {
      stores: [storeWithJsonHotline],
      users: [user],
      currencies: [{ id: '1', code: 'MYR' }],
      delivery_providers: [{ id: '2', code: 'self_delivery', status: '1' }],
      store_deliveries: [
        {
          id: '1',
          store_id: '10',
          delivery_provider_id: '2',
          status: '1',
          config_status: '1',
          shipping_fee_method: 'fixed',
          shipping_fee_config: JSON.stringify({ fee: '10.00' }),
          ...dates,
        },
      ],
      roles: [{ id: '1', name: 'owner', guard_name: 'api' }],
      model_has_roles: [{ model_type: 'App\\Models\\User', model_id: '1', role_id: '1' }],
      store_domains: [{ id: '40', store_id: '10', domain: 'my-store.example.com', is_default: '1', is_main: '1' }],
      store_payments: [{ id: '50', store_id: '10', payment_method_id: '99', status: '1', is_production: '0', is_default: '0' }],
      payment_methods: [{ id: '99', code: 'cod', status: '1' }],
      plans: [{ id: '60', code: 'STANDARD_TM_USER' }],
      plan_subscriptions: [
        {
          id: '70',
          subscribable_type: 'App\\Models\\Store',
          subscribable_id: '10',
          name: 'main',
          plan_id: '60',
          starts_at: '2025-01-01 00:00:00',
          ends_at: '2027-01-01 00:00:00',
          canceled_immediately: '0',
          ...dates,
        },
      ],
    }

    const ctx = createContext(tables, { allowContactStructureGap: true })
    const ok = mapIdentity(ctx)
    expect(ok).toBe(true)
    // Hotline should be parsed to +60123456789 without any error!
    expect(ctx.output.tenants[0]?.whatsappNumber).toBe('+60123456789')
    expect(ctx.diagnostics.some(d => d.code === 'CONTACT_STRUCTURE_UNRESOLVED')).toBe(false)
  })

  it('handles RAW_VALUE_UNVERIFIED: bracketed product name is treated as text, not INVALID_JSON', () => {
    const bracketedProduct: Row = {
      id: '1',
      store_id: '10',
      name: '[Hot Sale] Cotton T-Shirt', // starts with [
      name_ms: '{Baru} Baju T-Shirt',     // starts with {
      status: '1',
      ...dates,
    }
    const tables = {
      stores: [store],
      products: [bracketedProduct],
    }
    const ctx = createContext(tables, { allowBracketedProductNames: true })
    mapRawContent(ctx)
    // Should NOT issue INVALID_JSON for products.name or name_ms
    const invalidJsonIssues = ctx.diagnostics.filter(d => d.code === 'RAW_VALUE_UNVERIFIED' && d.reason === 'INVALID_JSON')
    expect(invalidJsonIssues).toHaveLength(0)
  })
})
