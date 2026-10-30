import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DENIED_ENDPOINT_FRAGMENTS,
  evaluateTargetGuard,
} from '../../../../scripts/prod-seed-clean-qc-data-guard'
import {
  classifyTenant,
  classifyUser,
  isQcEmail,
  maskEmail,
  type Verdict,
} from '../../../../scripts/prod-seed-clean-qc-data-classify'
import {
  blockingEdges,
  mapOnDelete,
  orderChildrenFirst,
  effectiveOnDelete,
  planTenantDeletes,
  planUserDeletes,
  quoteIdent,
  wipeEscapes,
  type FkEdge,
} from '../../../../scripts/prod-seed-clean-qc-data-plan'

const NEON_BRANCH = 'postgres://u:p@ep-cool-prod-seed-123456.ap-southeast-1.aws.neon.tech/neondb'

describe('[TC-F42-PSC-001] target guard', () => {
  it('accepts a fresh Neon branch with the prod-seed label', () => {
    const result = evaluateTargetGuard({ databaseUri: NEON_BRANCH, targetLabel: 'prod-seed' })
    expect(result).toEqual({ ok: true, host: 'ep-cool-prod-seed-123456.ap-southeast-1.aws.neon.tech', pooled: false })
  })

  it('refuses without the exact target label', () => {
    for (const label of [undefined, '', 'staging', 'Prod-Seed']) {
      const result = evaluateTargetGuard({ databaseUri: NEON_BRANCH, targetLabel: label })
      expect(result.ok).toBe(false)
    }
  })

  it('refuses the staging main endpoint, direct and pooled', () => {
    for (const host of ['ep-blue-king-a1qufqjg.ap-southeast-1.aws.neon.tech', 'ep-blue-king-a1qufqjg-pooler.ap-southeast-1.aws.neon.tech']) {
      const result = evaluateTargetGuard({ databaseUri: `postgres://u:p@${host}/neondb`, targetLabel: 'prod-seed' })
      expect(result.ok).toBe(false)
    }
  })

  it('refuses a URI that names the production project id anywhere', () => {
    const uri = `${NEON_BRANCH}?options=project%3Ddark-glitter-99257254`
    const result = evaluateTargetGuard({ databaseUri: uri, targetLabel: 'prod-seed' })
    expect(result.ok).toBe(false)
  })

  it('refuses a target sharing an endpoint with a forbidden staging or production URI', () => {
    const pooledTwin = 'postgres://u:p@ep-cool-prod-seed-123456-pooler.ap-southeast-1.aws.neon.tech/neondb'
    const result = evaluateTargetGuard({ databaseUri: NEON_BRANCH, targetLabel: 'prod-seed', forbiddenUris: [undefined, pooledTwin] })
    expect(result.ok).toBe(false)
  })

  it('refuses non-Neon remote hosts, staging/production keywords and unparseable URIs', () => {
    const cases = [
      'postgres://u:p@db.internal.example.com/neondb',
      'postgres://u:p@ep-x-staging.ap-southeast-1.aws.neon.tech/neondb',
      'postgres://u:p@ep-x.production.neon.tech/neondb',
      'not a uri',
      undefined,
    ]
    for (const databaseUri of cases) {
      expect(evaluateTargetGuard({ databaseUri, targetLabel: 'prod-seed' }).ok).toBe(false)
    }
  })

  it('flags pooled endpoints but still allows them', () => {
    const uri = 'postgres://u:p@ep-cool-123456-pooler.ap-southeast-1.aws.neon.tech/neondb'
    const result = evaluateTargetGuard({ databaseUri: uri, targetLabel: 'prod-seed' })
    expect(result.ok && result.pooled).toBe(true)
  })

  it('keeps the denylist in sync with every host listed in qc-guard.ts', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/qc-guard.ts'), 'utf8')
    const block = /KNOWN_NON_QC_HOSTS: readonly string\[\] = \[([\s\S]*?)\n\]/.exec(source)?.[1] ?? ''
    const hosts = [...block.split('\n')]
      .filter((line) => !line.trim().startsWith('//'))
      .flatMap((line) => [...line.matchAll(/'([^']+)'/g)].map((m) => m[1]))
    expect(hosts.length).toBeGreaterThan(0)
    for (const host of hosts) expect(DENIED_ENDPOINT_FRAGMENTS).toContain(host)
  })
})

describe('[TC-F42-PSC-002] user and tenant classification', () => {
  const user = (id: number, email: string, roles: string[] = ['tenant-owner'], hasProvenance = false) =>
    ({ id, email, roles, hasProvenance })

  it('recognises QC emails from every seeding convention', () => {
    for (const email of ['qc-owner-3@primeweb.local', 'customer-1-2@qc.primeweb.local', 'f40-e2e-admin@primeweb.local', 'Test@PrimeWeb.app', 'demo@primeweb.app']) {
      expect(isQcEmail(email)).toBe(true)
    }
    for (const email of ['owner@shop.vn', 'sso-service@primeweb.app', 'x@primeweb.local.evil.com']) {
      expect(isQcEmail(email)).toBe(false)
    }
  })

  it('keeps provenance users even when the email looks like QC', () => {
    expect(classifyUser(user(1, 'qc-owner-1@primeweb.local', [], true)).verdict).toBe('keep')
  })

  it('deletes QC users including QC super-admins, keeps human super-admins', () => {
    expect(classifyUser(user(2, 'qc-admin-1@primeweb.local', ['super-admin'])).verdict).toBe('delete')
    expect(classifyUser(user(3, 'ceo@prime.asia', ['super-admin']))).toMatchObject({ verdict: 'keep' })
  })

  it('sends unknown non-provenance users and service accounts to review, never delete', () => {
    expect(classifyUser(user(4, 'someone@gmail.com')).verdict).toBe('review')
    expect(classifyUser(user(5, 'sso-service@primeweb.app', ['editor'])).verdict).toBe('review')
  })

  it('classifies tenants: provenance > qc slug/name > all-qc members > review', () => {
    const verdicts = new Map<number, Verdict>([[10, 'delete'], [11, 'delete'], [12, 'review']])
    const base = { hasProvenance: false, memberUserIds: [] as number[] }
    expect(classifyTenant({ ...base, id: 1, slug: 'qc-shop-1', name: 'x', hasProvenance: true }, verdicts).verdict).toBe('keep')
    expect(classifyTenant({ ...base, id: 2, slug: 'qc-shop-7', name: 'x' }, verdicts).verdict).toBe('delete')
    expect(classifyTenant({ ...base, id: 3, slug: 'a', name: 'QC Tenant 12' }, verdicts).verdict).toBe('delete')
    expect(classifyTenant({ ...base, id: 4, slug: 'a', name: 'b', memberUserIds: [10, 11] }, verdicts).verdict).toBe('delete')
    expect(classifyTenant({ ...base, id: 5, slug: 'a', name: 'b', memberUserIds: [10, 12] }, verdicts).verdict).toBe('review')
    expect(classifyTenant({ ...base, id: 6, slug: 'a', name: 'b' }, verdicts).verdict).toBe('review')
  })

  it('--delete-review purges review rows but keeps staff, service and provenance accounts', () => {
    const purge = { deleteReview: true }
    expect(classifyUser(user(4, 'someone@yopmail.com'), purge).verdict).toBe('delete')
    for (const email of ['sso-service@primeweb.app', 'ben.nguyen@primecommerce.asia', 'phuong.ltweb+pw2staging@gmail.com', 'phuong.ltweb@gmail.com']) {
      expect(classifyUser(user(5, email), purge).verdict).toBe('review')
    }
    expect(classifyUser(user(6, 'someone@yopmail.com', [], true), purge).verdict).toBe('keep')
    const base = { hasProvenance: false, memberUserIds: [] as number[] }
    expect(classifyTenant({ ...base, id: 7, slug: 'store-3', name: 'x' }, new Map(), purge).verdict).toBe('delete')
    expect(classifyTenant({ ...base, id: 8, slug: 'store-3', name: 'x', hasProvenance: true }, new Map(), purge).verdict).toBe('keep')
  })

  it('masks emails for review output', () => {
    expect(maskEmail('someone@gmail.com')).toBe('so***@gmail.com')
    expect(maskEmail('nope')).toBe('***')
  })
})

describe('[TC-F42-PSC-003] FK-aware delete planning', () => {
  const fk = (childTable: string, childColumn: string, parentTable: string, onDelete: FkEdge['onDelete'], parentColumn = 'id'): FkEdge =>
    ({ childTable, childColumn, parentTable, parentColumn, onDelete })
  const fks: FkEdge[] = [
    fk('sites', 'tenant_id', 'tenants', 'SET NULL'),
    fk('orders', 'tenant_id', 'tenants', 'SET NULL'),
    fk('orders_items', '_parent_id', 'orders', 'CASCADE'),
    fk('pages', 'site_id', 'sites', 'RESTRICT'),
    fk('orders', 'site_id', 'sites', 'SET NULL'),
    fk('users_tenants', 'tenant_id', 'tenants', 'SET NULL'),
    fk('users_tenants', '_parent_id', 'users', 'CASCADE'),
    fk('notifications', 'user_id', 'users', 'SET NULL'),
    fk('audit', 'user_id', 'users', 'RESTRICT'),
  ]

  it('deletes tenant-scoped children before parents and tenants last', () => {
    const plan = planTenantDeletes(fks)
    const tables = plan.map((p) => p.table)
    expect(tables[tables.length - 1]).toBe('tenants')
    expect(tables.indexOf('pages')).toBeLessThan(tables.indexOf('sites'))
    expect(tables.indexOf('orders_items')).toBeLessThan(tables.indexOf('orders'))
    expect(plan.find((p) => p.table === 'sites')?.sql).toBe('DELETE FROM "sites" WHERE "tenant_id" IN (SELECT id FROM _del_tenants)')
  })

  it('nests parent predicates for grandchildren', () => {
    const items = planTenantDeletes(fks).find((p) => p.table === 'orders_items')
    expect(items?.sql).toContain('"_parent_id" IN (SELECT "id" FROM "orders" WHERE "tenant_id" IN (SELECT id FROM _del_tenants))')
  })

  it('never emits the same statement twice', () => {
    const sqls = planTenantDeletes(fks).map((p) => p.sql)
    expect(new Set(sqls).size).toBe(sqls.length)
  })

  it('follows only CASCADE edges for users and reports RESTRICT edges as blockers', () => {
    const tables = planUserDeletes(fks).map((p) => p.table)
    expect(tables).toEqual(['users_tenants', 'users'])
    expect(blockingEdges(fks, 'users').map((e) => e.childTable)).toEqual(['audit'])
  })

  it('treats SET NULL on a NOT NULL column as NO ACTION so the child is deleted first', () => {
    expect(effectiveOnDelete('SET NULL', true)).toBe('NO ACTION')
    expect(effectiveOnDelete('SET NULL', false)).toBe('SET NULL')
    expect(effectiveOnDelete('CASCADE', true)).toBe('CASCADE')
    const strict = fks.map((e) =>
      e.childTable === 'orders' && e.childColumn === 'site_id' ? { ...e, onDelete: effectiveOnDelete(e.onDelete, true) } : e,
    )
    const plan = planTenantDeletes(strict)
    const siteOrders = plan.find((p) => p.table === 'orders' && p.sql.includes('"site_id" IN'))
    expect(siteOrders).toBeDefined()
    expect(plan.indexOf(siteOrders!)).toBeLessThan(plan.findIndex((p) => p.table === 'sites'))
  })

  it('terminates on FK cycles', () => {
    const cyclic = [fk('a', 'b_id', 'b', 'CASCADE'), fk('b', 'a_id', 'a', 'CASCADE')]
    expect(() => planTenantDeletes([...cyclic, fk('a', 'tenant_id', 'tenants', 'SET NULL')])).not.toThrow()
  })

  it('rejects unsafe identifiers and unknown FK action codes', () => {
    expect(() => quoteIdent('users; DROP TABLE users')).toThrow('Unsafe SQL identifier')
    expect(() => mapOnDelete('x')).toThrow('Unknown confdeltype')
    expect(mapOnDelete('c')).toBe('CASCADE')
  })

  it('detects wipe sets that would cascade or be blocked outside the set', () => {
    const edges = [fk('qa_results', 'run_id', 'qa_runs', 'CASCADE'), fk('other', 'run_id', 'qa_runs', 'CASCADE'), fk('soft', 'run_id', 'qa_runs', 'SET NULL')]
    const escapes = wipeEscapes(edges, new Set(['qa_runs', 'qa_results']))
    expect(escapes.map((e) => e.childTable)).toEqual(['other'])
  })

  it('orders wipe tables children-first', () => {
    const edges = [fk('qa_results', 'run_id', 'qa_runs', 'CASCADE')]
    expect(orderChildrenFirst(['qa_runs', 'qa_results'], edges)).toEqual(['qa_results', 'qa_runs'])
  })
})
