import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Row } from '@/lib/migration/pw1-export/contracts'
export async function writeExportFixture(root: string) {
  const input = path.join(root, 'input')
  await mkdir(input)
  const dates = {
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-02 00:00:00',
  }
  const tables: Record<string, Row[]> = {
    stores: [],
    users: [],
    roles: [{ id: '1', name: 'owner', guard_name: 'api' }],
    model_has_roles: [],
    store_domains: [],
    store_payments: [],
    payment_methods: [{ id: '77', code: 'cod', status: '1' }],
    plans: [{ id: '1', code: 'FREEMIUM' }],
    plan_subscriptions: [],
    plan_subscription_usages: [],
    plan_features: [],
  }
  for (const id of ['1', '2', '9007199254740993']) {
    tables.stores.push({ id, name: `Store ${id}`, status: '1', ...dates })
    tables.users.push({
      id,
      store_id: id,
      name: `Owner ${id}`,
      email: `owner-${id}@example.test`,
      status: '1',
      is_store_owner: '1',
      is_frontend: '0',
      ...dates,
    })
    tables.model_has_roles.push({
      model_id: id,
      model_type: 'App\\Models\\User',
      role_id: '1',
    })
    tables.store_domains.push({
      id,
      store_id: id,
      domain: `fixture-${id}.old.test`,
      is_default: '1',
      is_main: '1',
    })
    tables.store_payments.push({
      id,
      store_id: id,
      payment_method_id: '77',
      status: '1',
    })
    tables.plan_subscriptions.push({
      id,
      subscribable_type: 'App\\Models\\Store',
      subscribable_id: id,
      name: 'main',
      plan_id: '1',
      starts_at: '2025-01-01 00:00:00',
      ends_at: '2027-01-01 00:00:00',
      canceled_immediately: '0',
      ...dates,
    })
  }
  const selected: Record<string, string> = {}
  for (const [table, rows] of Object.entries(tables)) {
    const headers = rows.length ? Object.keys(rows[0]) : ['id']
    selected[table] = `${table}.csv`
    const csv =
      [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((key) => `"${(row[key] ?? '').replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n') + '\n'
    await writeFile(path.join(input, selected[table]), csv)
  }
  const configPath = path.join(root, 'source.json')
  await writeFile(
    configPath,
    JSON.stringify({
      version: 1,
      sourceInstance: 'synthetic',
      sourceDatabase: 'fixture',
      sourceInstanceToken: 'fixture',
      snapshotId: 'one',
      asOf: '2026-01-01T00:00:00Z',
      utcOffset: '+00:00',
      sourcePlatformSuffix: 'old.test',
      targetPlatformSuffix: 'new.test',
      tables: selected,
      deletedStores: 'review',
    }),
  )
  return { input, configPath }
}
