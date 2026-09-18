// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readStoreTargetChecks, loadImportArtifact } from '@/lib/migration/pw1-json/artifact'
import { prepareImportArtifact } from '@/lib/migration/pw1-json/credentials'
import { COLLECTIONS } from '@/lib/migration/pw1-json/types'
import { actorTargetIdentityHash, loadCreatorBindings, validateUserActors } from '@/lib/migration/pw1-json/creator-bindings'

const OLD_CONTRACT = '62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26'
const NEW_CONTRACT = '8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9'
const roots: string[] = []
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

interface DiagnosticFixture {
  code: string
  severity: 'warning' | 'blocker'
  storeId?: string
  table?: string
  sourceId?: string
  field?: string
  reason?: string
}

async function fixture(options: { contract?: string; diagnostics?: DiagnosticFixture[]; actorSnapshot?: string } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pw1-json-v2-test-'))
  roots.push(root)
  const source = join(root, 'export')
  await mkdir(source, { mode: 0o700 })
  const contract = options.contract ?? NEW_CONTRACT
  const diagnostics = options.diagnostics ?? []
  const store = (id: string) => ({
    ...Object.fromEntries(COLLECTIONS.map(collection => [collection, []])),
    tenants: [{ _ref: `@tenants:stores:${id}`, metaData: { pw1StoreId: id } }],
    sites: [{ _ref: `@sites:stores:${id}`, tenant: `@tenants:stores:${id}` }],
  })
  const files: Record<string, string> = {
    'master.json': JSON.stringify([store('205'), store('285')]),
    'mapping-report.json': JSON.stringify({ version: 1, rows: ['205', '285'].map((id, index) => ({
      table: 'stores', sourceId: id, storeId: id, record: index + 1,
      disposition: 'mapped', fields: { id: 'source-identity' }, contributions: [],
    })), diagnostics }),
    'mapping-report.csv': 'table\n',
    'README.md': 'Synthetic contract fixture; no business identities.',
  }
  if (contract === NEW_CONTRACT) files['user-actors.json'] = JSON.stringify({
    version: 1, purpose: 'creator-target-binding-required', sourceInstanceToken: 'synthetic',
    snapshotId: options.actorSnapshot ?? 'snapshot-v2', actors: [],
  })
  for (const [name, contents] of Object.entries(files)) await writeFile(join(source, name), contents, { mode: 0o600 })
  const blockers = diagnostics.filter(item => item.severity === 'blocker').length
  const manifest = {
    version: 1, exporterVersion: '1.0.0', contractSha256: contract,
    sourceConfigSha256: digest('synthetic-config'),
    sourceSnapshot: { sourceInstance: 'synthetic', sourceDatabase: 'synthetic', sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2', asOf: '2026-09-17T00:00:00Z' },
    files: [{ table: 'stores', filename: 'stores.csv', sha256: digest('id\n205\n285\n'), bytes: 11, selected: true, rowCount: 2, headers: ['id'] }],
    artifacts: Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, digest(contents)])),
    status: blockers ? 'needs_review' : 'complete', importReady: false, coverage: { accounted: true }, mapping: { complete: blockers === 0 },
    counts: { sourceStoreCount: 2, selectedStoreCount: 2, policyExcludedStoreCount: 0, emittedStoreCount: 2, blockedStoreCount: 0, blockers },
    blockedStores: [], policyExcludedStores: [],
  }
  await writeFile(join(source, 'master-manifest.json'), JSON.stringify(manifest), { mode: 0o600 })
  return { root, source, output: join(root, 'prepared'), manifest, files }
}

describe('[TC-F42-IMP-003/011] Exact versioned exporter handoff', () => {
  it('keeps the old mapping on its original v1 import profile', async () => {
    // Arrange
    const input = await fixture({ contract: OLD_CONTRACT })
    // Act
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest).toMatchObject({ version: 1, profile: 'pw1-json-v1', mappingHash: OLD_CONTRACT })
  })

  it('binds the new mapping and actor bytes to the v2 import profile', async () => {
    // Arrange
    const input = await fixture()
    // Act
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest).toMatchObject({ version: 2, profile: 'pw1-json-v2', mappingHash: NEW_CONTRACT,
      sourceInstanceToken: 'synthetic', actorArtifactHash: digest(input.files['user-actors.json']),
      creatorBindingsHash: null, migrationPolicyHash: null, classifierVersion: 'diagnostic-policy-v1' })
    expect(artifact.manifestHash).toBe(digest(await readFile(prepared.manifestPath, 'utf8')))
  })

  it('refuses an unreviewed mapping digest even when every file hash matches', async () => {
    // Arrange
    const input = await fixture({ contract: digest('unreviewed-contract') })
    // Act / Assert
    await expect(prepareImportArtifact({ exportArtifact: input.source, output: input.output })).rejects.toThrow()
  })

  it('rejects an actor registry with another snapshot despite a valid publication hash', async () => {
    // Arrange
    const input = await fixture({ actorSnapshot: 'another-snapshot' })
    // Act / Assert
    await expect(prepareImportArtifact({ exportArtifact: input.source, output: input.output })).rejects.toThrow()
  })

  it('rejects a forged v2 envelope around an old-contract publication', async () => {
    // Arrange
    const input = await fixture({ contract: OLD_CONTRACT })
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    const original: Record<string, unknown> = JSON.parse(await readFile(prepared.manifestPath, 'utf8'))
    await writeFile(prepared.manifestPath, JSON.stringify({ ...original, version: 2, profile: 'pw1-json-v2',
      sourceInstanceToken: 'synthetic', migrationPolicyHash: null, actorArtifactHash: null,
      creatorBindingsHash: null, classifierVersion: 'diagnostic-policy-v1' }))
    // Act / Assert
    await expect(loadImportArtifact(prepared.manifestPath)).rejects.toThrow()
  })

  it('does not silently relax old report schema to permit new diagnostic reasons', async () => {
    // Arrange
    const input = await fixture({ contract: OLD_CONTRACT, diagnostics: [{
      code: 'UNKNOWN_POLICY', severity: 'warning', reason: 'NEW_PROFILE_ONLY',
    }] })
    // Act / Assert
    await expect(prepareImportArtifact({ exportArtifact: input.source, output: input.output })).rejects.toThrow()
  })

  it('hash-binds a supplied creator mapping even when no actor is selected', async () => {
    // Arrange
    const input = await fixture()
    const path = join(input.root, 'bindings.json')
    const text = JSON.stringify({ version: 1, sourceInstance: 'synthetic', sourceDatabase: 'synthetic',
      sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2', actorArtifactHash: digest(input.files['user-actors.json']),
      targetIdentityHash: digest('synthetic-target'), entries: [] })
    await writeFile(path, text, { mode: 0o600 })
    // Act
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, creatorBindings: path, output: input.output })
    const artifact = await loadImportArtifact(prepared.manifestPath)
    // Assert
    expect(artifact.manifest).toMatchObject({ creatorBindingsHash: digest(text) })
    await writeFile(join(input.output, 'creator-bindings.json'), '{}')
    await expect(loadImportArtifact(prepared.manifestPath)).rejects.toThrow()
  })

  it('rejects wrong source binding metadata even if entries are empty', async () => {
    // Arrange
    const input = await fixture()
    const path = join(input.root, 'bindings.json')
    await writeFile(path, JSON.stringify({ version: 1, sourceInstance: 'another-source', sourceDatabase: 'synthetic',
      sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2', actorArtifactHash: digest(input.files['user-actors.json']),
      targetIdentityHash: digest('synthetic-target'), entries: [] }), { mode: 0o600 })
    // Act / Assert
    await expect(prepareImportArtifact({ exportArtifact: input.source, creatorBindings: path, output: input.output })).rejects.toThrow()
  })

  it('rejects modified actor bytes after successful preparation', async () => {
    // Arrange
    const input = await fixture()
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    await writeFile(join(input.output, 'user-actors.json'), '{}', { mode: 0o600 })
    // Act / Assert
    await expect(loadImportArtifact(prepared.manifestPath)).rejects.toThrow()
  })
})

describe('[TC-F42-IMP-003/004/005] Bounded diagnostic evidence', () => {
  it('aggregates more than 121859 diagnostics without retaining an unbounded sample list', async () => {
    // Arrange
    const total = 121_860
    const input = await fixture({ diagnostics: Array.from({ length: total }, () => ({
      code: 'UNKNOWN_SOURCE_REQUIREMENT', severity: 'blocker', storeId: '205', table: 'stores',
    })) })
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.diagnosticSummary).toMatchObject({ total, rawBlockers: total, rawWarnings: 0, blockingCount: total })
    expect(artifact.diagnosticSummary.buckets).toHaveLength(1)
    expect(artifact.diagnosticSummary.buckets[0].count).toBe(total)
    expect(artifact.diagnosticSummary.buckets[0].samples.length).toBeLessThanOrEqual(5)
    expect(artifact.diagnostics.length).toBeLessThanOrEqual(5)
    expect(artifact.blockers.length).toBeLessThanOrEqual(5)
  }, 30_000)

  it('preserves an unknown global warning as blocking when a different Store is selected', async () => {
    // Arrange
    const input = await fixture({ diagnostics: [{ code: 'UNKNOWN_GLOBAL_POLICY', severity: 'warning', reason: 'UNREVIEWED_DECISION' }] })
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['285'] })
    // Assert
    expect(artifact.diagnosticSummary).toMatchObject({ total: 1, rawBlockers: 0, rawWarnings: 1, blockingCount: 1 })
    expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_GLOBAL_POLICY' })]))
  })

  it('does not treat Product or untyped shared settings raw diagnostics as Page exclusions', async () => {
    // Arrange
    const input = await fixture({ diagnostics: [
      { code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', storeId: '205', table: 'products', field: 'description', reason: 'UNKNOWN_STRUCTURE_KEY' },
      { code: 'RAW_VALUE_UNVERIFIED', severity: 'blocker', storeId: '205', table: 'model_settings', field: 'value', reason: 'INVALID_JSON' },
    ] })
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.diagnosticSummary).toMatchObject({ total: 2, rawBlockers: 2, blockingCount: 2 })
    expect(artifact.blockers.map(item => item.table).sort()).toEqual(['model_settings', 'products'])
  })

  it('keeps creator target requirements blocked after structural validation', async () => {
    // Arrange
    const input = await fixture({ diagnostics: [{
      code: 'TARGET_USER_CREATOR_BINDING_REQUIRED', severity: 'blocker', storeId: '205', table: 'users', field: 'created_by',
    }] })
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'] })
    // Assert
    expect(artifact.diagnosticSummary.blockingCount).toBe(1)
    expect(artifact.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'TARGET_USER_CREATOR_BINDING_REQUIRED' })]))
  })

  it('rejects free-text diagnostic reasons instead of treating them as decision authority', async () => {
    // Arrange
    const input = await fixture({ diagnostics: [{ code: 'UNKNOWN_POLICY', severity: 'warning', reason: 'operator says ignore everything' }] })
    // Act / Assert
    await expect(prepareImportArtifact({ exportArtifact: input.source, output: input.output })).rejects.toThrow()
  })
})


describe('[TC-F42-IMP-008/011] Creator identity evidence', () => {
  const actor = (sourceId: string, createdBy?: string) => ({
    _ref: `@users:users:${sourceId}`, sourceId, name: 'Synthetic actor', email: `actor-${sourceId}@example.invalid`,
    ...(createdBy ? { createdBy } : {}),
    source: { table: 'users', storeId: null, deletedAt: null, isFrontend: '0', status: '1',
      createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z', roles: [] },
  })
  const registry = (actors: ReturnType<typeof actor>[]) => ({ version: 1, purpose: 'creator-target-binding-required',
    sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2', actors })
  const provenance = { sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2' }

  it('validates complete source ancestry without fabricating Store membership', () => {
    // Arrange
    const input = registry([actor('900', '@users:users:901'), actor('901')])
    // Act
    const result = validateUserActors(input, provenance)
    // Assert
    expect(result.actors).toHaveLength(2)
    expect(result.actors.every(item => item.source.storeId === null)).toBe(true)
  })

  it('rejects cyclic, dangling, duplicated and spoofed actor identities', () => {
    // Arrange
    const cases = [registry([actor('900', '@users:users:901'), actor('901', '@users:users:900')]),
      registry([actor('900', '@users:users:901')]), registry([actor('900'), actor('900')]),
      registry([{ ...actor('900'), sourceId: '901' }])]
    // Act / Assert
    for (const input of cases) expect(() => validateUserActors(input, provenance)).toThrow()
    expect(() => validateUserActors(registry([actor('900')]), { ...provenance, snapshotId: 'other' })).toThrow()
  })

  it('rejects binding and evidence inside a repository child whose name begins with two dots', async () => {
    // Arrange
    const input = await fixture()
    const inside = await mkdtemp(join(process.cwd(), '..private-v2-test-'))
    roots.push(inside)
    const unsafe = join(inside, 'bindings.json')
    await writeFile(unsafe, '{}', { mode: 0o600 })
    const outside = join(input.root, 'bindings.json')
    await writeFile(outside, JSON.stringify({ version: 1, sourceInstance: 'synthetic', sourceDatabase: 'synthetic',
      sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2', actorArtifactHash: digest(input.files['user-actors.json']),
      targetIdentityHash: digest('synthetic-target'), entries: [{ sourceRef: '@users:users:900', targetUserId: 10,
        targetUserIdentityHash: actorTargetIdentityHash({ id: 10, email: 'actor@example.invalid' }),
        provenanceKind: 'operator-approved', evidenceRef: unsafe, evidenceHash: digest('{}') }] }), { mode: 0o600 })
    // Act / Assert
    await expect(loadCreatorBindings(unsafe)).rejects.toThrow('CREATOR_BINDINGS_OUTSIDE_REPOSITORY_REQUIRED')
    await expect(loadCreatorBindings(outside)).rejects.toThrow('CREATOR_BINDINGS_OUTSIDE_REPOSITORY_REQUIRED')
  })

  it('hashes only stable target identity and distinguishes another target account', () => {
    // Arrange
    const target = { id: 10, email: ' Actor@Example.Invalid ', lastLogin: 'today', roles: ['admin'] }
    // Act
    const actual = actorTargetIdentityHash(target)
    // Assert
    expect(actual).toBe(actorTargetIdentityHash({ id: '10', email: 'actor@example.invalid' }))
    expect(actual).not.toBe(actorTargetIdentityHash({ id: 11, email: 'actor@example.invalid' }))
  })

  it('binds private mapping to exact evidence bytes and refuses duplicate source bindings', async () => {
    // Arrange
    const input = await fixture()
    const evidence = join(input.root, 'identity-evidence.json')
    const evidenceText = JSON.stringify({ sourceInstance: 'synthetic', sourceDatabase: 'synthetic', sourceInstanceToken: 'synthetic', snapshotId: 'snapshot-v2', actorArtifactHash: digest(input.files['user-actors.json']), targetIdentityHash: digest('synthetic-target'), sourceRef: '@users:users:900', targetUserId: 10, targetUserIdentityHash: actorTargetIdentityHash({ id: 10, email: 'actor@example.invalid' }), decision: 'approve-existing-creator-binding', approvedBy: 'synthetic-test-operator', approvedAt: '2026-09-17T00:00:00Z' })
    await writeFile(evidence, evidenceText, { mode: 0o600 })
    const entry = { sourceRef: '@users:users:900', targetUserId: 10,
      targetUserIdentityHash: actorTargetIdentityHash({ id: 10, email: 'actor@example.invalid' }),
      provenanceKind: 'operator-approved', evidenceRef: evidence, evidenceHash: digest(evidenceText) }
    const binding = { version: 1, ...input.manifest.sourceSnapshot, actorArtifactHash: digest(input.files['user-actors.json']),
      targetIdentityHash: digest('synthetic-target'), entries: [entry] }
    // asOf is exporter metadata, not part of the strict identity binding contract.
    const { asOf: _asOf, ...strictBinding } = binding
    const path = join(input.root, 'bindings.json')
    const bindingText = JSON.stringify(strictBinding)
    await writeFile(path, bindingText, { mode: 0o600 })
    // Act
    const loaded = await loadCreatorBindings(path, digest(bindingText))
    // Assert
    expect(loaded.entries).toHaveLength(1)
    await expect(loadCreatorBindings(path, digest('wrong'))).rejects.toThrow('CREATOR_BINDING_HASH_MISMATCH')
    await writeFile(path, JSON.stringify({ ...strictBinding, entries: [entry, entry] }))
    await expect(loadCreatorBindings(path)).rejects.toThrow('CREATOR_BINDING_DUPLICATE')
    const opaqueEvidence = JSON.stringify({ opaque: 'not an identity decision' })
    await writeFile(evidence, opaqueEvidence)
    await writeFile(path, JSON.stringify({ ...strictBinding, entries: [{ ...entry, evidenceHash: digest(opaqueEvidence) }] }))
    await expect(loadCreatorBindings(path)).rejects.toThrow()
    const wrongDecision = JSON.stringify({ ...JSON.parse(evidenceText), targetUserId: 11 })
    await writeFile(evidence, wrongDecision)
    await writeFile(path, JSON.stringify({ ...strictBinding, entries: [{ ...entry, evidenceHash: digest(wrongDecision) }] }))
    await expect(loadCreatorBindings(path)).rejects.toThrow()
    await writeFile(path, bindingText)
    await writeFile(evidence, '{}')
    await expect(loadCreatorBindings(path)).rejects.toThrow('CREATOR_EVIDENCE_HASH_MISMATCH')
  })
})


describe('[TC-F42-IMP-DIAGNOSTIC-SPOOL] exact target checks on disk', () => {
  it('preserves duplicate counts and rejects changed spool content', async () => {
    // Arrange
    const diagnostic = { code: 'TARGET_USER_CREATOR_BINDING_REQUIRED', severity: 'blocker' as const,
      storeId: '205', table: 'users', sourceId: '500', field: 'created_by' }
    const input = await fixture({ diagnostics: [diagnostic, diagnostic, { ...diagnostic, sourceId: '501' }] })
    const prepared = await prepareImportArtifact({ exportArtifact: input.source, output: input.output })
    // Act
    const artifact = await loadImportArtifact(prepared.manifestPath, { storeIds: ['205'], spoolDirectory: input.root })
    const checks = await readStoreTargetChecks(artifact, '205')
    // Assert
    expect(artifact.diagnosticSummary?.buckets).toHaveLength(1)
    expect(artifact.diagnosticSummary?.blockingCount).toBe(3)
    expect(checks.map(check => [check.diagnostic.sourceId, check.count])).toEqual([['500', 2], ['501', 1]])
    expect(await readStoreTargetChecks(artifact, '285')).toEqual([])
    await writeFile(artifact.targetCheckFiles!['205'].path, '[]', { mode: 0o600 })
    await expect(readStoreTargetChecks(artifact, '205')).rejects.toThrow('ARTIFACT_HASH_MISMATCH')
  })
})
