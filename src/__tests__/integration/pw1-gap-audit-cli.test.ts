// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, appendFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeExportFixture } from '@/__tests__/helpers/pw1-export-fixture'
import { exportMaster } from '@/lib/migration/pw1-export/export-master'

let root: string
beforeEach(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'pw1-gap-audit-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
const run = (args: string[]) => new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
  execFile(process.execPath, ['--import', 'tsx', 'scripts/data/audit-pw1-gaps.ts', ...args], { timeout: 15000 }, (error, stdout, stderr) => {
    if (error?.killed) { reject(error); return }
    resolve({ code: error && 'code' in error ? Number(error.code) : 0, stdout, stderr })
  })
})
async function fixture() {
  const source = await writeExportFixture(root)
  const artifact = path.join(root, 'export')
  await exportMaster(source.input, source.configPath, artifact)
  const output = path.join(root, 'audit')
  return { ...source, artifact, output, args: ['--quiet', '--input-dir', source.input, '--source-config', source.configPath, '--artifact-dir', artifact, '--output-dir', output] }
}

describe('[TC-F42-065] Offline audit CLI', () => {
  it('creates bounded cases/coverage and refuses to overwrite an existing output', async () => {
    // Arrange
    const data = await fixture()
    // Act
    const result = await run(data.args)
    const summary = JSON.parse(await readFile(path.join(data.output, 'summary.json'), 'utf8'))
    const cases = await readFile(path.join(data.output, 'reconciliation-cases.csv'), 'utf8')
    const repeated = await run(data.args)
    // Assert
    expect(result.code, result.stderr).toBe(0)
    expect(summary.shipping.missingTable).toBe(true)
    expect(summary.coverage.length).toBeGreaterThan(0)
    expect(summary.severityCounts.blocker).toBeGreaterThan(0)
    expect(cases).not.toContain('@example.test')
    expect(repeated.code).toBe(1)
    expect(repeated.stderr).toContain('OUTPUT_EXISTS')
  })
  it.each(['source', 'config', 'report'] as const)('rejects modified %s before publishing a report', async (kind) => {
    // Arrange
    const data = await fixture()
    const filename = kind === 'source' ? path.join(data.input, 'stores.csv') : kind === 'config' ? data.configPath : path.join(data.artifact, 'mapping-report.json')
    await appendFile(filename, ' ')
    // Act
    const result = await run(data.args)
    // Assert
    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    await expect(readFile(path.join(data.output, 'summary.json'))).rejects.toThrow()
  })
  it('help is offline and invalid arguments do not echo secret-looking input', async () => {
    // Arrange / Act
    const help = await run(['--help'])
    const invalid = await run(['--private-secret'])
    // Assert
    expect(help.code).toBe(0)
    expect(help.stdout).toContain('no DB writes')
    expect(invalid.code).toBe(1)
    expect(invalid.stderr).not.toContain('private-secret')
  })
})
