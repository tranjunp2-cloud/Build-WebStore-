// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateClassification } from '@/lib/migration/pw1-export/validate-classification'
import type { RowDisposition } from '@/lib/migration/pw1-export/source-dispositions'
import type { Diagnostic } from '@/lib/migration/pw1-export/contracts'

function row(table: string, id: string, storeId: string | null, rule: string, parentTable?: string, parentId?: string): RowDisposition {
  return { table, sourceId: id, record: 1, storeId, disposition: 'retained-source', fields: { id: 'source-identity', ...(storeId && table !== 'stores' ? { store_id: 'source-identity' } : {}) }, contributions: [], ownership: { storeId, rule, ...(parentTable ? { parentTable } : {}), ...(parentId ? { parentId } : {}) } }
}
const store = () => row('stores', '1', '1', 'SOURCE_STORE_ID')
const failure = (table: string, sourceId: string, reason: string): Diagnostic => ({ code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table, sourceId, reason })

describe('[TC-F42-EXP-083] Classification evidence graph', () => {
  it('accepts a child chain independent of report order', () => {
    const rows = [row('product_images', '3', '1', 'SOURCE_PARENT_RELATION', 'products', '2'), row('products', '2', '1', 'SOURCE_STORE_ID'), store()]
    expect(() => validateClassification(rows, [])).not.toThrow()
  })
  it('accepts global users and their role evidence without inventing tenant membership', () => {
    const user = row('users', '51', null, 'SOURCE_GLOBAL_SCOPE')
    user.fields.username = 'retained-source'
    user.fieldRetentionRules = { username: 'MASTER-3.4-GLOBAL-USER-DEPENDENCY' }
    const role = row('model_has_roles', 'record:1', null, 'SOURCE_PARENT_RELATION', 'users', '51')
    expect(() => validateClassification([role, user], [])).not.toThrow()
  })
  it('accepts real missing parents only with a matching global blocker', () => {
    const orphan = row('model_has_roles', 'record:1', null, 'OWNERSHIP_PARENT_UNVERIFIED', 'users', '5753')
    const diagnostic = failure(orphan.table, orphan.sourceId, 'OWNERSHIP_PARENT_UNVERIFIED')
    expect(() => validateClassification([orphan], [diagnostic])).not.toThrow()
    expect(() => validateClassification([orphan], [{ ...diagnostic, storeId: '2' }])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
    expect(() => validateClassification([orphan], [])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('rejects a missing-parent claim when that parent is verified in the report', () => {
    const child = row('plan_subscriptions', '2', null, 'OWNERSHIP_PARENT_UNVERIFIED', 'stores', '1')
    expect(() => validateClassification([store(), child], [failure(child.table, child.sourceId, 'OWNERSHIP_PARENT_UNVERIFIED')])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('rejects duplicate source identities instead of silently choosing a parent', () => {
    expect(() => validateClassification([store(), store()], [])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('rejects cycles rather than trusting a same-Store loop', () => {
    const first = row('menu_items', '1', '1', 'SOURCE_PARENT_RELATION', 'menus', '2')
    const second = row('menus', '2', '1', 'SOURCE_PARENT_RELATION', 'menu_items', '1')
    expect(() => validateClassification([first, second, store()], [])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('rejects a parent-dependent table relabeled as global to omit the relation', () => {
    expect(() => validateClassification([row('plan_subscriptions', '1', null, 'SOURCE_GLOBAL_SCOPE')], [])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
  it('rejects a shipping retention rule without its approved policy and diagnostic', () => {
    const delivery = row('store_deliveries', '2', '1', 'SOURCE_STORE_ID')
    delivery.fields.shipping_fee_config = 'retained-source'
    delivery.fieldRetentionRules = { shipping_fee_config: 'MASTER-4.1-APPROVED-SHIPPING-SOURCE' }
    expect(() => validateClassification([store(), delivery], [])).toThrow('CLASSIFICATION_EVIDENCE_INVALID')
  })
})
