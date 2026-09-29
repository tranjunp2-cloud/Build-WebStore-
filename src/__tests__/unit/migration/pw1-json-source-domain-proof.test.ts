// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSourceDomainProof, SOURCE_SITE_DOMAIN_RULE } from '@/lib/migration/pw1-json/source-domain-proof'
import type { ClassificationRow } from '@/lib/migration/pw1-json/classification'
import { COLLECTIONS, type ImportStore } from '@/lib/migration/pw1-json/types'
function store(): ImportStore { return { storeId: '2330', collections: { ...Object.fromEntries(COLLECTIONS.map(c => [c, []])), sites: [{ domain: 'original malformed domain' }] } as ImportStore['collections'] } }
function row(): ClassificationRow {
  return { table: 'store_domains', sourceId: '4000', storeId: '2330', record: 1, disposition: 'mapped', fields: { id: 'mapped', store_id: 'mapped', domain: 'mapped', is_default: 'mapped', deleted_at: 'mapped' },
    ownership: { storeId: '2330', rule: 'SOURCE_STORE_ID' },
    contributions: [{ table: 'store_domains', sourceId: '4000', storeId: '2330', fields: ['id','store_id','domain','is_default','deleted_at'], targetPath: 'sites[].domain', rule: SOURCE_SITE_DOMAIN_RULE }] }
}
const diagnostic = { code: 'SOURCE_SITE_DOMAIN_FORMAT_PRESERVED', severity: 'warning' as const, table: 'store_domains', storeId: '2330', sourceId: '4000', field: 'domain', reason: 'ORIGINAL_PW1_VALUE' }
describe('[TC-F42-IMP-SOURCE-DOMAIN] Original Site domain receipt', () => {
  it('accepts original malformed hostname with exact source receipt under graceful policy', () => {
    // Arrange
    const proof = createSourceDomainProof(true, { gracefulTenantResolution: true }), master = store()
    // Act
    proof.addStore(master); proof.addRow(row()); proof.finish()
    // Assert
    expect(proof.disposition(diagnostic)).toBe('APPROVED_POLICY')
    expect(master.collections.sites[0].domain).toBe('original malformed domain')
  })
  it.each(['historical','wrong-store','missing-receipt','wrong-path','unmapped-domain','duplicate-receipt','unknown-field'])('rejects %s receipt', mutation => {
    // Arrange
    const proof = createSourceDomainProof(mutation !== 'historical'), source = row()
    if (mutation === 'wrong-store') source.storeId = '411'
    if (mutation === 'wrong-path') source.contributions[0].targetPath = 'tenants.slug'
    if (mutation === 'unmapped-domain') source.fields.domain = 'unresolved'
    if (mutation === 'unknown-field') { source.fields.unknown = 'mapped'; source.contributions[0].fields.push('unknown') }
    // Act / Assert
    expect(() => { proof.addStore(store()); if (mutation !== 'missing-receipt') proof.addRow(source); if (mutation === 'duplicate-receipt') proof.addRow(source); proof.finish() }).toThrow('SOURCE_SITE_DOMAIN_EVIDENCE_INVALID')
  })
  it.each(['wrong-source', 'wrong-reason', 'disabled-policy'])('does not approve %s format warning', mutation => {
    // Arrange
    const proof = createSourceDomainProof(true, { gracefulTenantResolution: mutation !== 'disabled-policy' })
    const warning = { ...diagnostic, ...(mutation === 'wrong-source' ? { sourceId: 'other' } : mutation === 'wrong-reason' ? { reason: 'OTHER' } : {}) }
    // Act
    proof.addStore(store()); proof.addRow(row()); proof.finish()
    // Assert
    expect(proof.disposition(warning)).toBeUndefined()
  })
})
