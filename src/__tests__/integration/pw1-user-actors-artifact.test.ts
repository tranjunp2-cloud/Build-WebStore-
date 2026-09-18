// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, rm, appendFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'
import { validateArtifact } from '@/lib/migration/pw1-export/validate-artifact'
let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-actors-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
async function fixture() {
  const source = await writeExportFixture(root)
  const config = JSON.parse(await readFile(source.configPath, 'utf8'))
  config.migrationPolicy = { decisionEvidence: 'User approved Users creator preservation.', preserveUserCreators: true, siteTypeDefault: 'ecommerce', shippingPolicy: 'review' }
  await writeFile(source.configPath, JSON.stringify(config))
  const userFile = path.join(source.input, 'users.csv')
  const lines = (await readFile(userFile, 'utf8')).trimEnd().split('\n')
  await writeFile(userFile, lines.map((line, i) => line + (i ? ',"51"' : ',created_by')).join('\n') + '\n' + '51,,System,system@example.test,1,0,0,2025-01-01 00:00:00,2025-01-02 00:00:00,0\n')
  const artifact = path.join(root, 'export')
  await exportMaster(source.input, source.configPath, artifact)
  return artifact
}
async function rewriteRegistry(artifact: string, mutate: (value: Record<string, unknown>) => void) {
  const filename = path.join(artifact, 'user-actors.json')
  const registry = JSON.parse(await readFile(filename, 'utf8'))
  mutate(registry)
  const content = JSON.stringify(registry)
  await writeFile(filename, content)
  const manifestPath = path.join(artifact, 'master-manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.artifacts['user-actors.json'] = createHash('sha256').update(content).digest('hex')
  await writeFile(manifestPath, JSON.stringify(manifest))
}
describe('[TC-F42-069] Hashed creator sidecar artifact', () => {
  it('exports shared actor once and validates through real offline CLI', async () => {
    // Arrange
    const artifact = await fixture()
    // Act
    const registry = JSON.parse(await readFile(path.join(artifact, 'user-actors.json'), 'utf8'))
    const master = JSON.parse(await readFile(path.join(artifact, 'master.json'), 'utf8'))
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>(resolve => {
      execFile(process.execPath, ['--import', 'tsx', 'scripts/data/export-pw1-master.ts', '--validate-only', '--artifact-dir', artifact], { timeout: 15000 }, (error, stdout, stderr) => resolve({ code: error && 'code' in error ? Number(error.code) : 0, stdout, stderr }))
    })
    // Assert
    expect(registry.actors).toHaveLength(1)
    expect(master).toHaveLength(3)
    expect(master[0].users[0].createdBy).toBe('@users:users:51')
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      integrityStatus: 'valid', mappingStatus: 'partial',
      outcome: { exportStatus: 'succeeded', dataStatus: 'partial', importStatus: 'not_verified' },
    })
  })
  it('rejects modified sidecar hash', async () => {
    // Arrange
    const artifact = await fixture()
    await appendFile(path.join(artifact, 'user-actors.json'), ' ')
    // Act / Assert
    await expect(validateArtifact(artifact)).rejects.toThrow('ARTIFACT_HASH_MISMATCH')
  })
  it('rejects missing sidecar', async () => {
    // Arrange
    const artifact = await fixture()
    await rm(path.join(artifact, 'user-actors.json'))
    // Act / Assert
    await expect(validateArtifact(artifact)).rejects.toThrow()
  })
  it('rejects wrong source provenance even when sidecar hash is updated', async () => {
    // Arrange
    const artifact = await fixture()
    await rewriteRegistry(artifact, registry => { registry.snapshotId = 'different' })
    // Act / Assert
    await expect(validateArtifact(artifact)).rejects.toThrow('USER_ACTORS_PROVENANCE_INVALID')
  })
  it('rejects auth grant fields even when sidecar hash is updated', async () => {
    // Arrange
    const artifact = await fixture()
    await rewriteRegistry(artifact, registry => { registry.roles = ['super-admin'] })
    // Act / Assert
    await expect(validateArtifact(artifact)).rejects.toThrow('USER_ACTORS_SCHEMA_INVALID')
  })
})
