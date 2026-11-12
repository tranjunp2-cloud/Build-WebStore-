// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadSource, verifySource } from '@/lib/migration/pw1-export/csv-loader'
import {
  sourceConfigSchema,
  parseConfig,
} from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { timestamp, compareIds } from '@/lib/migration/pw1-export/primitives'
import { emptyStore } from '@/lib/migration/pw1-export/contracts'
import { operationalIssues } from '@/lib/migration/pw1-export/validate-master'
import {
  writeArtifacts,
  csvCell,
} from '@/lib/migration/pw1-export/artifact-writer'
let root: string, input: string
const config = () =>
  sourceConfigSchema.parse({
    version: 1,
    sourceInstance: 'test',
    sourceDatabase: 'test',
    sourceInstanceToken: 'test',
    snapshotId: 'one',
    asOf: '2026-01-01T00:00:00Z',
    utcOffset: '+08:00',
    sourcePlatformSuffix: 'old.test',
    targetPlatformSuffix: 'new.test',
    tables: { stores: 'stores.csv' },
    deletedStores: 'review',
  })
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'pw1-source-test-'))
  input = path.join(root, 'input')
  await mkdir(input)
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
describe('PW1 source contracts', () => {
  it('TC-F42-EXP-001/004: BOM, UTF8, comma/newline/quotes preserve exact cells and large IDs', async () => {
    await writeFile(
      path.join(input, 'stores.csv'),
      '\uFEFFid,name,note\r\n9007199254740993,"Việt, Nam","line1\nline2 ""quoted"""\r\n',
    )
    const source = await loadSource(input, config())
    expect(source.tables.stores).toEqual([
      {
        id: '9007199254740993',
        name: 'Việt, Nam',
        note: 'line1\nline2 "quoted"',
      },
    ])
    expect(source.files[0].rowCount).toBe(1)
  })
  it.each([
    'id,id\n1,2\n',
    'id,\n1,2\n',
    'id,name\n1\n',
    'id,name\n1,"unterminated',
  ])(
    'TC-F42-EXP-002: rejects malformed CSV promptly: %s',
    async (csv) => {
      await writeFile(path.join(input, 'stores.csv'), csv)
      await expect(loadSource(input, config())).rejects.toThrow()
    },
    2000,
  )
  it('TC-F42-EXP-002: malformed UTF8 fails without replacement characters', async () => {
    await writeFile(
      path.join(input, 'stores.csv'),
      Buffer.from([105, 100, 10, 0xc3, 0x28, 10]),
    )
    await expect(loadSource(input, config())).rejects.toThrow()
  })
  it('TC-F42-EXP-002: malformed large record fails without parser backpressure deadlock', async () => {
    await writeFile(
      path.join(input, 'stores.csv'),
      'id,name\n1,"' + 'x'.repeat(150000),
    )
    const cfg = config()
    cfg.maxRecordBytes = 1024
    await expect(loadSource(input, cfg)).rejects.toThrow()
  }, 2000)
  it('TC-F42-EXP-003: selected missing/empty differs from malformed unselected snapshot', async () => {
    await expect(loadSource(input, config())).rejects.toThrow(
      'MISSING_SELECTED_FILE',
    )
    await writeFile(path.join(input, 'stores.csv'), '')
    await expect(loadSource(input, config())).rejects.toThrow(
      'MISSING_CSV_HEADER',
    )
    await writeFile(path.join(input, 'stores.csv'), 'id\n')
    await writeFile(path.join(input, 'stores_old.csv'), 'invalid,"unterminated')
    const source = await loadSource(input, config())
    expect(source.tables.stores).toEqual([])
    expect(source.files.find((f) => !f.selected)).toMatchObject({
      rowCount: null,
      selected: false,
    })
  })
  it('TC-F42-EXP-004: only explicit null tokens coerce and duplicate IDs/composites fail', async () => {
    await writeFile(
      path.join(input, 'stores.csv'),
      'id,a,b,c,d\n001,NULL,0,false,\\N\n',
    )
    const cfg = config()
    cfg.nullTokens = ['\\N']
    expect((await loadSource(input, cfg)).tables.stores[0]).toEqual({
      id: '001',
      a: 'NULL',
      b: '0',
      c: 'false',
      d: null,
    })
    expect(
      () => new SourceIndex({ stores: [{ id: '1' }, { id: '1' }] }),
    ).toThrow('DUPLICATE_OR_EMPTY_SOURCE_ID')
    expect(
      () =>
        new SourceIndex({
          model_has_roles: [
            { model_type: 'User', model_id: '1', role_id: '2' },
            { model_type: 'User', model_id: '1', role_id: '2' },
          ],
        }),
    ).toThrow('DUPLICATE_COMPOSITE_KEY')
    expect(compareIds('9007199254740993', '9007199254740992')).toBe(1)
  })
  it('TC-F42-EXP-005: timestamps normalize fixed offset and reject impossible/calendar-zone mismatch', () => {
    expect(timestamp('2025-01-01 08:00:00', config())).toBe(
      '2025-01-01T00:00:00.000Z',
    )
    expect(() => timestamp('2025-02-29 08:00:00', config())).toThrow(
      'INVALID_TIMESTAMP',
    )
    expect(() =>
      timestamp('2025-01-01 08:00:00', {
        utcOffset: '+00:00',
        timezone: 'Asia/Kuala_Lumpur',
      }),
    ).toThrow('TIMEZONE_OFFSET_MISMATCH')
  })
  it('TC-F42-EXP-006: resource limits stop instead of truncating', async () => {
    await writeFile(path.join(input, 'stores.csv'), 'id\n1\n2\n')
    const cfg = config()
    cfg.maxRows = 1
    await expect(loadSource(input, cfg)).rejects.toThrow('RESOURCE_ROW_LIMIT')
    cfg.maxRows = 10
    cfg.maxInputBytes = 1
    await expect(loadSource(input, cfg)).rejects.toThrow('RESOURCE_INPUT_LIMIT')
  }, 2000)
  it('TC-F42-EXP-014: changed selected bytes and symlink inputs reject', async () => {
    await writeFile(path.join(input, 'stores.csv'), 'id\n1\n')
    const source = await loadSource(input, config())
    await writeFile(path.join(input, 'stores.csv'), 'id\n2\n')
    await expect(verifySource(source)).rejects.toThrow(
      'SOURCE_CHANGED_DURING_EXPORT',
    )
    await symlink(path.join(input, 'stores.csv'), path.join(input, 'link.csv'))
    await expect(loadSource(input, config())).rejects.toThrow('SYMLINK_SOURCE')
  })
  it('TC-F42-EXP-014: no overwrite; failed publication leaves no partial output/lock', async () => {
    const output = path.join(root, 'artifact')
    await writeArtifacts(output, input, { 'master.json': '[]' }, async () => {})
    await expect(
      writeArtifacts(output, input, { 'master.json': '[1]' }, async () => {}),
    ).rejects.toThrow('OUTPUT_EXISTS')
    expect(await readFile(path.join(output, 'master.json'), 'utf8')).toBe('[]')
    await expect(
      writeArtifacts(
        path.join(root, 'fail'),
        input,
        { 'master.json': '[]' },
        async () => {
          throw new Error('changed')
        },
      ),
    ).rejects.toThrow('changed')
    expect((await readdir(root)).sort()).toEqual(['artifact', 'input'])
    await expect(
      writeArtifacts(path.join(input, 'out'), input, {}, async () => {}),
    ).rejects.toThrow('OUTPUT_INSIDE_SOURCE')
  })
  it('TC-F42-EXP-014: pre-existing empty destination is preserved', async () => {
    const output = path.join(root, 'external')
    await mkdir(output)
    await expect(
      writeArtifacts(output, input, { 'master.json': '[]' }, async () => {}),
    ).rejects.toThrow('OUTPUT_EXISTS')
    expect(await readdir(output)).toEqual([])
  })
  it('TC-F42-EXP-014: report CSV cannot execute formula cells', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(csvCell('safe,"value"')).toBe('"safe,""value"""')
  })
  it('TC-F42-EXP-016: free-text reference-like strings stay content while real relationships are checked', () => {
    const store = emptyStore()
    store.tenants.push({
      _ref: '@tenants:stores:1',
      metaData: { pw1StoreId: '1' },
      slug: 'fixture',
    })
    store.sites.push({
      _ref: '@sites:stores:1',
      tenant: '@tenants:stores:1',
      name: '@users:users:missing',
      seo: { metaDescription: '@products:products:missing' },
      pw1_source: { site: '@sites:stores:missing' },
    })
    expect(operationalIssues([store])).toEqual([])
    store.sites[0].tenant = '@tenants:stores:missing'
    expect(operationalIssues([store])).toContainEqual(
      expect.objectContaining({
        code: 'DANGLING_OPERATIONAL_REF',
        field: 'sites.tenant',
      }),
    )
  })
  it('TC-F42-EXP-016: exclusions reject unsupported scope, missing evidence and duplicates', () => {
    const accepted = {
      ruleId: 'MASTER-2.2-OPTIONAL-HISTORY',
      collection: 'analytics',
      reason: 'Approved offline research scope',
      decisionEvidence: 'Synthetic decision QA-1',
    }
    expect(
      sourceConfigSchema.safeParse({
        ...config(),
        acceptedExclusions: [accepted],
      }).success,
    ).toBe(true)
    for (const exclusion of [
      { ...accepted, collection: 'users' },
      { ...accepted, ruleId: '*' },
      { ...accepted, reason: '' },
      { ...accepted, decisionEvidence: '' },
    ])
      expect(
        sourceConfigSchema.safeParse({
          ...config(),
          acceptedExclusions: [exclusion],
        }).success,
      ).toBe(false)
    expect(
      sourceConfigSchema.safeParse({
        ...config(),
        acceptedExclusions: [accepted, accepted],
      }).success,
    ).toBe(false)
    const { reason, ...missingReason } = accepted
    expect(
      sourceConfigSchema.safeParse({
        ...config(),
        acceptedExclusions: [missingReason],
      }).success,
    ).toBe(false)
  })
  it('TC-F42-EXP-015: config rejects timestamp source tokens, unknown flags and duplicate source selection', () => {
    const cfg = config()
    cfg.sourceInstanceToken = '2026-01-01'
    expect(() => parseConfig(Buffer.from(JSON.stringify(cfg)))).toThrow(
      'INVALID_SOURCE_CONFIG',
    )
    expect(() =>
      parseConfig(Buffer.from(JSON.stringify({ ...config(), surprise: true }))),
    ).toThrow('INVALID_SOURCE_CONFIG')
    expect(() =>
      parseConfig(
        Buffer.from(
          JSON.stringify({
            ...config(),
            tables: { stores: 'stores.csv', users: 'stores.csv' },
          }),
        ),
      ),
    ).toThrow('DUPLICATE_SOURCE_SELECTION')
  })
})
