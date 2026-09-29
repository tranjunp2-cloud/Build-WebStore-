// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, rm, readdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { inspectExportArtifact, loadImportArtifact, assertUnsealedArtifact } from '@/lib/migration/pw1-json/artifact'
import { prepareImportArtifact } from '@/lib/migration/pw1-json/credentials'

const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })
describe('[TC-F42-IMP-INLINE-DESTINATION] Sealed prepared artifacts', () => {
  it('blocks export inspection, prepare and import before reading transformed master data', async () => {
    // Arrange: even an incomplete finalization marker seals this directory.
    const directory = await mkdtemp(join(tmpdir(), 'pw1-sealed-')); directories.push(directory)
    await writeFile(join(directory, 'destination-manifest.json'), '{"status":"finalizing"}', { mode: 0o600 })
    // Act / Assert
    for (const attempt of [
      () => inspectExportArtifact(directory),
      () => loadImportArtifact(join(directory, 'import-manifest.json')),
      () => prepareImportArtifact({ exportArtifact: directory, output: join(directory, 'another') }),
    ]) await expect(attempt()).rejects.toThrow('PREPARED_MASTER_FINALIZED_USE_EXPORTER_SOURCE')
    expect(await readdir(directory)).toEqual(['destination-manifest.json'])
  })
  it('does not trust a symlink marker and allows an ordinary unsealed directory', async () => {
    // Arrange
    const directory = await mkdtemp(join(tmpdir(), 'pw1-sealed-')); directories.push(directory)
    await expect(assertUnsealedArtifact(directory)).resolves.toBeUndefined()
    await symlink(join(directory, 'missing'), join(directory, 'destination-manifest.json'))
    // Act / Assert
    await expect(assertUnsealedArtifact(directory)).rejects.toThrow('PREPARED_MASTER_FINALIZED_USE_EXPORTER_SOURCE')
  })
})
