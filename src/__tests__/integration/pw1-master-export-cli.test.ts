// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { writeExportFixture } from '../helpers/pw1-export-fixture'
import { MASTER_SHA256, LEGACY_MASTER_SHA256 } from '@/lib/migration/pw1-export/master-version'
let root: string
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'pw1-cli-test-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
const run = (args: string[]) =>
  new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve, reject) => {
      execFile(
        process.execPath,
        ['--import', 'tsx', 'scripts/data/export-pw1-master.ts', ...args],
        {
          cwd: process.cwd(),
          timeout: 15000,
          env: {
            ...process.env,
            DATABASE_URI: 'postgres://invalid.invalid/no-network',
            DATABASE_URL: 'postgres://invalid.invalid/no-network',
            PAYLOAD_SECRET: '',
          },
        },
        (error, stdout, stderr) => {
          if (error && 'killed' in error && error.killed) {
            reject(error)
            return
          }
          resolve({
            code: error && 'code' in error ? Number(error.code) : 0,
            stdout,
            stderr,
          })
        },
      )
    },
  )
const exportArgs = (input: string, configPath: string, out: string) => [
  '--input-dir',
  input,
  '--source-config',
  configPath,
  '--output-dir',
  out,
]
describe('PW1 export real CLI subprocess', () => {
  it('TC-F42-EXP-015: help works offline, rejects unknown or missing flags without echoing input', async () => {
    const help = await run(['--help'])
    expect(help.code).toBe(0)
    expect(help.stderr).toBe('')
    expect(help.stdout).toContain('--quiet')
    const invalid = await run(['--password-secret-value'])
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).not.toContain('password-secret-value')
    expect((await run([])).code).toBe(1)
  })
  it('TC-F42-EXP-015: inventory-only emits counts without a master', async () => {
    const { input, configPath } = await writeExportFixture(root),
      output = path.join(root, 'inventory')
    const result = await run([
      '--inventory-only',
      ...exportArgs(input, configPath, output),
    ])
    expect(result.code, result.stderr).toBe(0)
    expect(
      JSON.parse(await readFile(path.join(output, 'inventory.json'), 'utf8'))
        .mappingPerformed,
    ).toBe(false)
    await expect(readFile(path.join(output, 'master.json'))).rejects.toThrow()
  })
  it('TC-F42-EXP-006/015/016: exports every synthetic Store deterministically and validates successful export with partial data', async () => {
    const { input, configPath } = await writeExportFixture(root),
      one = path.join(root, 'one'),
      two = path.join(root, 'two')
    const first = await run(exportArgs(input, configPath, one))
    expect(first.code, first.stderr).toBe(0)
    const bytes = await readFile(path.join(one, 'master.json'), 'utf8'),
      master = JSON.parse(bytes)
    expect(
      master,
      JSON.stringify(
        JSON.parse(
          await readFile(path.join(one, 'mapping-report.json'), 'utf8'),
        ).diagnostics.filter(
          (d: { code: string }) => d.code === 'DOCUMENT_SCHEMA_INVALID',
        ),
      ),
    ).toHaveLength(3)
    expect(
      master.map(
        (store: { tenants: { metaData: { pw1StoreId: string } }[] }) =>
          store.tenants[0].metaData.pw1StoreId,
      ),
    ).toEqual(['1', '2', '9007199254740993'])
    expect(first.stderr).toContain('read-csv')
    expect(first.stderr).toContain('map-stores')
    expect(first.stderr).toContain('build-coverage-report')
    expect(first.stderr).toContain('verify-source')
    expect(first.stderr).toContain('published')
    const second = await run(['--quiet', ...exportArgs(input, configPath, two)])
    expect(second.code, second.stderr).toBe(0)
    expect(second.stderr).toBe('')
    expect({ ...JSON.parse(second.stdout), outputDir: '' }).toEqual({
      ...JSON.parse(first.stdout),
      outputDir: '',
    })
    expect(await readFile(path.join(two, 'master.json'), 'utf8')).toBe(bytes)
    const validated = await run(['--validate-only', '--artifact-dir', one])
    expect(validated.code, validated.stderr).toBe(0)
    expect(validated.stderr).toContain('validate-artifact')
    const quietValidated = await run([
      '--quiet',
      '--validate-only',
      '--artifact-dir',
      one,
    ])
    expect(quietValidated.stdout).toBe(validated.stdout)
    expect(quietValidated.stderr).toBe('')
    expect(JSON.parse(validated.stdout)).toMatchObject({
      integrityStatus: 'valid',
      mappingStatus: 'partial',
    })
    const overwritten = await run(exportArgs(input, configPath, one))
    expect(overwritten.code).toBe(1)
    expect(await readFile(path.join(one, 'master.json'), 'utf8')).toBe(bytes)
  }, 30000)
  it('TC-F42-EXP-016: globally conflicting Users block both Stores without claiming their rows mapped', async () => {
    const { input, configPath } = await writeExportFixture(root),
      output = path.join(root, 'collision')
    const users = path.join(input, 'users.csv')
    await writeFile(
      users,
      (await readFile(users, 'utf8')).replace(
        'owner-2@example.test',
        'owner-1@example.test',
      ),
    )
    expect((await run(exportArgs(input, configPath, output))).code).toBe(0)
    const master = JSON.parse(
      await readFile(path.join(output, 'master.json'), 'utf8'),
    )
    expect(master).toHaveLength(1)
    expect(master[0].tenants[0].metaData.pw1StoreId).toBe('9007199254740993')
    const report = JSON.parse(
      await readFile(path.join(output, 'mapping-report.json'), 'utf8'),
    )
    const blocked = report.rows.filter(
      (row: { table: string; sourceId: string }) =>
        row.table === 'users' && ['1', '2'].includes(row.sourceId),
    )
    expect(blocked).toHaveLength(2)
    for (const row of blocked) expect(row.disposition).not.toBe('mapped')
  })
  it('TC-F42-EXP-016: approved optional exclusions remain warnings and cannot waive lifecycle errors', async () => {
    const { input, configPath } = await writeExportFixture(root),
      output = path.join(root, 'exclusions')
    const cfg = JSON.parse(await readFile(configPath, 'utf8'))
    cfg.acceptedExclusions = [
      'subscribers',
      'contact-submissions',
      'analytics',
    ].map((collection) => ({
      ruleId: 'MASTER-2.2-OPTIONAL-HISTORY',
      collection,
      reason: 'Synthetic scope accepted',
      decisionEvidence: 'Synthetic QA decision',
    }))
    await writeFile(configPath, JSON.stringify(cfg))
    const stores = path.join(input, 'stores.csv')
    await writeFile(
      stores,
      (await readFile(stores, 'utf8')).replace(
        '"Store 1","1"',
        '"Store 1","2"',
      ),
    )
    const result = await run(exportArgs(input, configPath, output))
    expect(result.code, result.stderr).toBe(0)
    const manifest = JSON.parse(
      await readFile(path.join(output, 'master-manifest.json'), 'utf8'),
    )
    const report = JSON.parse(
      await readFile(path.join(output, 'mapping-report.json'), 'utf8'),
    )
    expect(manifest.acceptedExclusions).toEqual(cfg.acceptedExclusions)
    expect(manifest.blockedStores).toContain('1')
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'TENANT_LIFECYCLE_CONFLICT',
        severity: 'blocker',
      }),
    )
    const exclusions = report.diagnostics.filter(
      (d: { code: string }) => d.code === 'ACCEPTED_SCOPE_EXCLUSION',
    )
    expect(exclusions).toHaveLength(3)
    for (const diagnostic of exclusions)
      expect(diagnostic.severity).toBe('warning')
    expect(manifest.counts.blockers).toBe(
      report.diagnostics.filter(
        (d: { severity: string }) => d.severity === 'blocker',
      ).length,
    )
    const validated = await run(['--validate-only', '--artifact-dir', output])
    expect(validated.code, validated.stderr).toBe(0)
    cfg.acceptedExclusions[0].collection = 'users'
    await writeFile(configPath, JSON.stringify(cfg))
    const invalid = await run(
      exportArgs(input, configPath, path.join(root, 'invalid')),
    )
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).toContain('INVALID_SOURCE_CONFIG')
  })
  it('TC-F42-EXP-015: a coherent synthetic complete artifact validates with exit zero', async () => {
    // Validator contract fixture only: this does not claim full-source export acceptance.
    const output = path.join(root, 'complete')
    await mkdir(output)
    const files: Record<string, string> = {
      'master.json': '[]',
      'mapping-report.json': JSON.stringify({
        version: 1,
        diagnostics: [],
        rows: [],
      }),
      'mapping-report.csv': 'table,sourceId\n',
      'README.md': 'Synthetic zero-row validation fixture',
    }
    const digest = (value: string) =>
      createHash('sha256').update(value).digest('hex')
    for (const [name, bytes] of Object.entries(files))
      await writeFile(path.join(output, name), bytes)
    await writeFile(
      path.join(output, 'master-manifest.json'),
      JSON.stringify({
        version: 1,
        exporterVersion: '1.0.0',
        contractSha256: LEGACY_MASTER_SHA256,
        sourceConfigSha256: digest('{}'),
        sourceSnapshot: {
          sourceInstance: 'synthetic',
          sourceDatabase: 'empty',
          sourceInstanceToken: 'fixture',
          snapshotId: 'zero',
          asOf: '2026-01-01T00:00:00Z',
        },
        files: [],
        artifacts: Object.fromEntries(
          Object.entries(files).map(([name, bytes]) => [name, digest(bytes)]),
        ),
        status: 'complete',
        importReady: false,
        coverage: { accounted: true },
        mapping: { complete: true },
        counts: {
          sourceStoreCount: 0,
          selectedStoreCount: 0,
          policyExcludedStoreCount: 0,
          emittedStoreCount: 0,
          blockedStoreCount: 0,
          blockers: 0,
        },
        blockedStores: [],
        policyExcludedStores: [],
      }),
    )
    const result = await run(['--validate-only', '--artifact-dir', output])
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      integrityStatus: 'valid',
      mappingStatus: 'complete',
    })
  })
  it('TC-F42-EXP-014/015: validator rejects tampered bytes and report/manifest inconsistency', async () => {
    const { input, configPath } = await writeExportFixture(root),
      output = path.join(root, 'artifact')
    expect((await run(exportArgs(input, configPath, output))).code).toBe(0)
    const masterPath = path.join(output, 'master.json'),
      original = await readFile(masterPath, 'utf8')
    await writeFile(masterPath, original + ' ')
    const changed = await run(['--validate-only', '--artifact-dir', output])
    expect(changed.code).toBe(1)
    expect(changed.stderr).toContain('ARTIFACT_HASH_MISMATCH')
    await writeFile(masterPath, original)
    const manifestPath = path.join(output, 'master-manifest.json'),
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.status = 'complete'
    manifest.mapping.complete = true
    await writeFile(manifestPath, JSON.stringify(manifest))
    const mismatch = await run(['--validate-only', '--artifact-dir', output])
    expect(mismatch.code).toBe(1)
    expect(mismatch.stderr).toContain('ARTIFACT_STATUS_INCONSISTENT')
    // Even rehashed invalid JSON shape fails runtime schema validation.
    await writeFile(masterPath, '[{"tenants":[]}]')
    manifest.artifacts['master.json'] = createHash('sha256')
      .update('[{"tenants":[]}]')
      .digest('hex')
    await writeFile(manifestPath, JSON.stringify(manifest))
    const schema = await run(['--validate-only', '--artifact-dir', output])
    expect(schema.code).toBe(1)
    expect(schema.stderr).toContain('MASTER_SCHEMA_INVALID')
  }, 30000)
})


it('TC-F42-EXP-016: rejects tampered summary even with updated hash; accepts artifacts predating optional summaries', async () => {
  const { input, configPath } = await writeExportFixture(root)
  const output = path.join(root, 'summary-validation')
  expect((await run(exportArgs(input, configPath, output))).code).toBe(0)
  const summaryPath = path.join(output, 'store-summary.json')
  const manifestPath = path.join(output, 'master-manifest.json')
  const summary = JSON.parse(await readFile(summaryPath, 'utf8'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  summary[0].collectionCounts.products = 999
  const bytes = JSON.stringify(summary)
  await writeFile(summaryPath, bytes)
  manifest.artifacts['store-summary.json'] = createHash('sha256').update(bytes).digest('hex')
  await writeFile(manifestPath, JSON.stringify(manifest))

  const invalid = await run(['--validate-only', '--artifact-dir', output])
  expect(invalid.code).toBe(1)
  expect(invalid.stderr).toContain('STORE_SUMMARY_INCONSISTENT')

  delete manifest.artifacts['store-summary.json']
  delete manifest.artifacts['store-summary.csv']
  await writeFile(manifestPath, JSON.stringify(manifest))
  await rm(summaryPath)
  await rm(path.join(output, 'store-summary.csv'))
  const legacy = await run(['--validate-only', '--artifact-dir', output])
  expect(legacy.code, legacy.stderr).toBe(0)
  expect(JSON.parse(legacy.stdout).integrityStatus).toBe('valid')
}, 30000)


it('TC-F42-077: keeps approved Store deferral separate from blocking and validates its manifest', async () => {
  // Arrange
  const { input, configPath } = await writeExportFixture(root);
  const output = path.join(root, 'deferred');
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  cfg.migrationPolicy = { decisionEvidence: 'Synthetic approved deferral', deferredStoreIds: ['2'], siteTypeDefault: 'ecommerce', shippingPolicy: 'pw2-defaults' };
  await writeFile(configPath, JSON.stringify(cfg));
  // Act
  const exported = await run(exportArgs(input, configPath, output));
  const manifest = JSON.parse(await readFile(path.join(output, 'master-manifest.json'), 'utf8'));
  const master = JSON.parse(await readFile(path.join(output, 'master.json'), 'utf8'));
  const checked = await run(['--validate-only', '--artifact-dir', output]);
  // Assert
  expect(exported.code, exported.stderr).toBe(0);
  expect(manifest.policyExcludedStores).toEqual(['2']);
  expect(manifest.blockedStores).not.toContain('2');
  expect(manifest.counts.policyExcludedStoreCount).toBe(1);
  expect(master.map((store: { tenants: { metaData: { pw1StoreId: string } }[] }) => store.tenants[0].metaData.pw1StoreId)).toEqual(['1', '9007199254740993']);
  expect(checked.code, checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout).integrityStatus).toBe('valid');
});
