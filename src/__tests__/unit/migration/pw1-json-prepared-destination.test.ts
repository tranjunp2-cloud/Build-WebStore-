// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, readFile, readdir, rm, symlink, stat, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { finalizePreparedDestination } from '@/lib/migration/pw1-json/prepared-destination'
import { EXPECTED_MAPPING_HASH, CHUNKED_MASTER_MAPPING_HASH } from '@/lib/migration/pw1-json/artifact'
import { masterSetHash } from '@/lib/migration/pw1-json/master-parts'
import { exportOutcome } from '@/lib/migration/pw1-json/export-outcome'
import type { DestinationMap } from '@/lib/migration/pw1-json/destination-map'
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const store = (id: string) => ({ tenants: [{ _ref: `@tenants:stores:${id}` }], products: [{ description: '<p>Tiếng Việt 🙂</p>', variants: [{ price: 0 }] }], users: [], sites: [], pages: [{ nested: [null, false, 42] }] })
async function fixture(parts = false, conflict = false, normalized = false) {
  const root = await mkdtemp(join(tmpdir(), 'pw1-prepared-destination-')); roots.push(root)
  const records = [store('1'), store('2')]
  const masterData = parts ? [[records[0]], [records[1]]] : [records]
  const descriptors = []
  for (const [i, rows] of masterData.entries()) {
    const filename = parts ? `master-${String(i + 1).padStart(4, '0')}.json` : 'master.json'
    const text = normalized ? '[\n' + rows.map(row => JSON.stringify(row)).join(',\n') + '\n]\n' : JSON.stringify(conflict ? rows.map(row => ({ ...row, destination: {} })) : rows, null, 2)
    await writeFile(join(root, filename), text, { mode: 0o600 })
    descriptors.push({ filename, bytes: Buffer.byteLength(text), sha256: digest(text), storeIds: rows.map(row => row.tenants[0]._ref.split(':')[2]) })
  }
  const snapshot = { sourceInstance: 'fixture', sourceDatabase: 'fixture', sourceInstanceToken: 'fixture', snapshotId: 'snapshot', asOf: '2026-09-23T00:00:00Z' }
  const artifacts: Record<string, string> = { 'mapping-report.json': digest(''), 'mapping-report.csv': digest(''), 'README.md': digest('') }
  for (const part of descriptors) artifacts[part.filename] = part.sha256
  if (parts) for (const name of ['customer-reconciliation.json', 'product-reconciliation.json', 'export-review.json', 'export-review.md']) artifacts[name] = digest('')
  const exporter = { version: 1, exporterVersion: parts ? '1.10.0' : '1.0.0', contractSha256: parts ? CHUNKED_MASTER_MAPPING_HASH : EXPECTED_MAPPING_HASH, sourceConfigSha256: digest('config'), sourceSnapshot: snapshot, files: [], artifacts,
    status: parts ? 'exported' : 'complete', importReady: false, coverage: { accounted: true }, mapping: { complete: true }, counts: { sourceStoreCount: 2, selectedStoreCount: 2, policyExcludedStoreCount: 0, emittedStoreCount: 2, blockedStoreCount: 0, blockers: 0 }, blockedStores: [], policyExcludedStores: [],
    ...(parts ? { classificationVersion: 'source-classification-v1', outcome: exportOutcome([], 0, []), masterParts: descriptors, masterSetHash: masterSetHash(descriptors) } : {}),
  }
  const exportText = JSON.stringify(exporter)
  const masterHash = parts ? masterSetHash(descriptors) : descriptors[0].sha256
  const manifest = { version: parts ? 3 : 1, profile: parts ? 'pw1-json-v3' : 'pw1-json-v1', sourceInstance: snapshot.sourceInstance, sourceDatabase: snapshot.sourceDatabase, snapshotId: snapshot.snapshotId, asOf: snapshot.asOf, mappingHash: exporter.contractSha256, masterHash, credentialHash: null, exporterManifestHash: digest(exportText),
    ...(parts ? { sourceInstanceToken: 'fixture', migrationPolicyHash: null, actorArtifactHash: null, creatorBindingsHash: null, classifierVersion: 'diagnostic-policy-v2', classificationVersion: 'source-classification-v1', customerReconciliationHash: digest(''), productReconciliationHash: digest('') } : {}),
  }
  const importText = JSON.stringify(manifest), manifestHash = digest(importText)
  await writeFile(join(root, 'master-manifest.json'), exportText, { mode: 0o600 })
  await writeFile(join(root, 'import-manifest.json'), importText, { mode: 0o600 })
  const mapping: DestinationMap = { version: 1, format: 'pw1-destination-map-v1', batchId: 'json:11111111-1111-4111-8111-111111111111', source: { instance: 'fixture', snapshotId: 'snapshot', manifestHash, masterHash }, targetHash: digest('target'), scope: 'foundation', status: 'complete', completeness: { selected: 1, verified: 1, pendingStoreIds: [] }, stores: { '1': { tenantId: 101, siteId: 102, productCategories: [] } } }
  return { root, descriptors, mapping, manifestHash, importText, exportText, records }
}
describe('[TC-F42-IMP-INLINE-DESTINATION] Prepared master finalization', () => {
  it.each([false, true])('annotates selected store in place, preserves boundaries/content/provenance, idempotently (parts=%s)', async parts => {
    // Arrange
    const f = await fixture(parts)
    // Act
    const result = await finalizePreparedDestination(f.root, f.manifestHash, f.mapping)
    await finalizePreparedDestination(f.root, f.manifestHash, f.mapping)
    // Assert
    expect(result.files).toBe(f.descriptors.length)
    const rows = []
    for (const file of f.descriptors) { rows.push(...JSON.parse(await readFile(join(f.root, file.filename), 'utf8'))); expect((await stat(join(f.root, file.filename))).mode & 0o777).toBe(0o600) }
    expect(rows).toEqual([{ ...f.records[0], destination: f.mapping.stores['1'] }, f.records[1]])
    expect(await readFile(join(f.root, 'import-manifest.json'), 'utf8')).toBe(f.importText)
    expect(await readFile(join(f.root, 'master-manifest.json'), 'utf8')).toBe(f.exportText)
    expect((await readdir(f.root)).sort()).toEqual([...f.descriptors.map(p => p.filename), 'import-manifest.json', 'master-manifest.json', 'destination-manifest.json'].sort())
  })
  it.each(['temp-synced', 'journal-ready', 'renamed'] as const)('recovers after crash at %s without rewriting committed parts', async phase => {
    // Arrange
    const f = await fixture(true)
    // Act
    await expect(finalizePreparedDestination(f.root, f.manifestHash, f.mapping, undefined, async actual => { if (actual === phase) throw new Error('SIMULATED_CRASH') })).rejects.toThrow('SIMULATED_CRASH')
    await finalizePreparedDestination(f.root, f.manifestHash, f.mapping)
    // Assert
    expect(JSON.parse(await readFile(join(f.root, f.descriptors[0].filename), 'utf8'))[0].destination).toEqual(f.mapping.stores['1'])
    expect(JSON.parse(await readFile(join(f.root, 'destination-manifest.json'), 'utf8')).status).toBe('complete')
    expect((await readdir(f.root)).some(name => name.endsWith('.tmp'))).toBe(false)
  })
  it.each(['target', 'source', 'manifest', 'output', 'journal-path', 'partial', 'symlink'] as const)('rejects %s tampering', async mutation => {
    // Arrange
    const f = await fixture()
    await finalizePreparedDestination(f.root, f.manifestHash, f.mapping)
    if (mutation === 'target') f.mapping.targetHash = digest('other')
    if (mutation === 'source') f.mapping.source.masterHash = digest('other')
    if (mutation === 'manifest') await writeFile(join(f.root, 'import-manifest.json'), '{}')
    if (mutation === 'output') await writeFile(join(f.root, 'master.json'), '[]')
    if (mutation === 'partial') f.mapping.status = 'partial'
    if (mutation === 'journal-path') { const path = join(f.root, 'destination-manifest.json'); const journal = JSON.parse(await readFile(path, 'utf8')); journal.files[0].tempName = '../escape'; await writeFile(path, JSON.stringify(journal)) }
    if (mutation === 'symlink') { await rm(join(f.root, 'master.json')); await symlink(join(f.root, 'import-manifest.json'), join(f.root, 'master.json')) }
    // Act / Assert
    await expect(finalizePreparedDestination(f.root, f.manifestHash, f.mapping)).rejects.toThrow()
  })
  it('recovers byte-identical unselected part with or without its temporary file', async () => {
    // Arrange / Act: stop immediately before an unselected, byte-identical part is published.
    for (const moved of [false, true]) {
      const f = await fixture(true, false, true)
      await expect(finalizePreparedDestination(f.root, f.manifestHash, f.mapping, undefined, async (phase, filename) => {
        if (phase === 'journal-ready' && filename === 'master-0002.json') throw new Error('CRASH')
      })).rejects.toThrow('CRASH')
      const journal = JSON.parse(await readFile(join(f.root, 'destination-manifest.json'), 'utf8'))
      const entry = journal.files[1]
      expect(entry.originalHash).toBe(entry.outputHash)
      if (moved) await rename(join(f.root, entry.tempName), join(f.root, entry.filename))
      await finalizePreparedDestination(f.root, f.manifestHash, f.mapping)
      // Assert
      expect((await readdir(f.root)).some(name => name.endsWith('.tmp'))).toBe(false)
    }
  })
  it.each([false, true])('rejects missing selected store before sealing prepared input (parts=%s)', async parts => {
    // Arrange
    const f = await fixture(parts); f.mapping.stores['999'] = f.mapping.stores['1']; delete f.mapping.stores['1']
    // Act / Assert
    await expect(finalizePreparedDestination(f.root, f.manifestHash, f.mapping)).rejects.toThrow('DESTINATION_STORE_MISSING')
    expect(await readdir(f.root)).not.toContain('destination-manifest.json')
  })
  it('rejects source destination and preserves original bytes', async () => {
    // Arrange
    const f = await fixture(false, true), path = join(f.root, 'master.json'), before = await readFile(path, 'utf8')
    // Act / Assert
    await expect(finalizePreparedDestination(f.root, f.manifestHash, f.mapping)).rejects.toThrow('SOURCE_DESTINATION_CONFLICT')
    expect(await readFile(path, 'utf8')).toBe(before)
  })
  it('preserves full-scope category mappings', async () => {
    // Arrange
    const f = await fixture(); f.mapping.scope = 'full'; f.mapping.stores['1'].productCategories = [{ sourceRef: '@categories:categories:10', targetId: 12 }]
    // Act
    await finalizePreparedDestination(f.root, f.manifestHash, f.mapping)
    // Assert
    expect(JSON.parse(await readFile(join(f.root, 'master.json'), 'utf8'))[0].destination.productCategories).toEqual([12])
  })
})
