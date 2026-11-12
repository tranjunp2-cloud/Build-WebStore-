// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadSource } from '@/lib/migration/pw1-export/csv-loader'
import type { SourceConfig } from '@/lib/migration/pw1-export/contracts'
const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})
async function fixture(content: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pw1-loader-cancel-'))
  directories.push(directory)
  await writeFile(path.join(directory, 'stores.csv'), content)
  return directory
}
const config = {
  tables: { stores: 'stores.csv' },
  nullTokens: [],
  maxInputBytes: 10000000,
  maxRecordBytes: 1000000,
  maxRows: 1,
  maxResidentBytes: 2 * 1024 * 1024 * 1024,
} as SourceConfig

describe('[TC-F42-EXP-002] CSV streaming cancellation', () => {
  it('rejects row budget while producer is backpressured without hanging', async () => {
    // Arrange
    const directory = await fixture(
      'id,name\n' +
        Array.from(
          { length: 20000 },
          (_, i) => `${i},${'a'.repeat(100)}\n`,
        ).join(''),
    )
    // Act / Assert
    await expect(loadSource(directory, config)).rejects.toMatchObject({
      code: 'RESOURCE_ROW_LIMIT',
    })
  }, 3000)
  it('rejects malformed large input and closes the producer', async () => {
    const directory = await fixture('id,name\n1,"' + 'a'.repeat(100000))
    await expect(
      loadSource(directory, { ...config, maxRows: 100 }),
    ).rejects.toMatchObject({ code: 'INVALID_CSV_ENCODING_OR_STRUCTURE' })
  }, 3000)
})
