import { MigrationError } from './errors'
import type { ClassificationRow } from './classification'
import type { ImportDiagnostic, ImportStore } from './types'

export const SOURCE_SITE_DOMAIN_RULE = 'MASTER-4.1-SOURCE-SITE-DOMAIN'
/** Verify source-domain receipts without deriving a hostname from the tenant slug. */
export function createSourceDomainProof(enabled: boolean, policy?: { gracefulTenantResolution?: boolean }) {
  const domains = new Map<string, string>(), receipts = new Map<string, string>()
  let finished = false
  function fail(): never { throw new MigrationError('SOURCE_SITE_DOMAIN_EVIDENCE_INVALID') }
  return {
    addStore(store: ImportStore) {
      if (!enabled) return
      for (const site of store.collections.sites) if (site.domain !== undefined && site.domain !== null) {
        if (typeof site.domain !== 'string' || !site.domain.trim() || domains.has(store.storeId)) fail()
        domains.set(store.storeId, site.domain)
      }
    },
    addRow(row: ClassificationRow) {
      for (const contribution of row.contributions.filter(c => c.rule === SOURCE_SITE_DOMAIN_RULE)) {
        if (!enabled || row.table !== 'store_domains' || !row.storeId || !domains.has(row.storeId) || receipts.has(row.storeId) || contribution.table !== row.table || contribution.sourceId !== row.sourceId || contribution.storeId !== row.storeId || contribution.targetPath !== 'sites[].domain' || !contribution.fields.includes('domain') || contribution.fields.length !== ['id','store_id','domain','is_default','deleted_at'].filter(field => Object.hasOwn(row.fields, field)).length || contribution.fields.some(field => !['id','store_id','domain','is_default','deleted_at'].includes(field)) || new Set(contribution.fields).size !== contribution.fields.length || contribution.fields.some(field => row.fields[field] !== 'mapped')) fail()
        receipts.set(row.storeId, row.sourceId)
      }
    },
    finish() { if (enabled && [...domains.keys()].some(storeId => !receipts.has(storeId))) fail(); finished = true },
    disposition(d: ImportDiagnostic): 'APPROVED_POLICY' | undefined {
      if (enabled && finished && policy?.gracefulTenantResolution === true && d.code === 'SOURCE_SITE_DOMAIN_FORMAT_PRESERVED' && d.severity === 'warning' && d.table === 'store_domains' && d.field === 'domain' && d.reason === 'ORIGINAL_PW1_VALUE' && d.storeId && d.sourceId && receipts.get(d.storeId) === d.sourceId) return 'APPROVED_POLICY'
    },
  }
}
