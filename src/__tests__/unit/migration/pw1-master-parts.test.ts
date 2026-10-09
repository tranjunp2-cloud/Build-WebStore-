// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { emptyStore, type StoreOutput } from '@/lib/migration/pw1-export/contracts'
import { MASTER_PART_MAX_BYTES, MASTER_PART_MAX_STORES, masterPartChunks, masterPartSchema, masterSetHash, masterStoreJson, planMasterParts, readMasterParts, type MasterPart } from '@/lib/migration/pw1-export/master-parts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const store = (id: string, text = ''): StoreOutput => {
  const output = emptyStore()
  output.tenants.push({ _ref: `@tenants:stores:${id}`, metaData: { pw1StoreId: id }, name: text })
  return output
}
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
// These tests isolate part transport; operational Store schema remains covered by export/validate integration.
const acceptTransportStore = (_value: unknown): _value is StoreOutput => true
async function writeParts(stores: StoreOutput[], maxStores = MASTER_PART_MAX_STORES) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pw1-parts-')); roots.push(root)
  const planned = planMasterParts(stores, { maxStores })
  for (const part of planned) await writeFile(path.join(root, part.descriptor.filename), [...masterPartChunks(part.stores)].join(''))
  const parts = planned.map(part => part.descriptor)
  const artifacts = Object.fromEntries(parts.map(part => [part.filename, part.sha256]))
  return { root, parts, artifacts }
}

describe('TC-F42-EXP-107: bounded atomic Store partitioning', () => {
  it('sorts numeric IDs and splits after exactly 300 Stores without an aggregate file', async () => {
    // Arrange
    const source = Array.from({ length: 301 }, (_, i) => store(String(301 - i)))
    // Act
    const fixture = await writeParts(source)
    // Assert
    expect(fixture.parts.map(part => part.filename)).toEqual(['master-0001.json', 'master-0002.json'])
    expect(fixture.parts.map(part => part.storeIds.length)).toEqual([300, 1])
    expect(fixture.parts[0].storeIds.slice(0, 3)).toEqual(['1', '2', '3'])
    expect(fixture.parts[1].storeIds).toEqual(['301'])
    expect(await readdir(fixture.root)).toEqual(['master-0001.json', 'master-0002.json'])
    const parsed = await readMasterParts(fixture.root, fixture.parts, masterSetHash(fixture.parts), fixture.artifacts, acceptTransportStore)
    expect(parsed).toHaveLength(301)
    expect(source[0].tenants[0]._ref).toBe('@tenants:stores:301')
  })
  it('counts UTF-8, quotes, line separators, indentation and JSON envelope exactly', () => {
    // Arrange
    const source = [store('9', 'Tiếng Việt 😀\n"\\\u2028\u2029'), store('10', '第二')]
    const allBytes = Buffer.byteLength([...masterPartChunks(source)].join(''), 'utf8')
    // Act
    const split = planMasterParts(source, { maxBytes: allBytes })
    const joined = planMasterParts(source, { maxBytes: allBytes + 1 })
    // Assert
    expect(split).toHaveLength(2)
    expect(joined).toHaveLength(1)
    expect(joined[0].descriptor.bytes).toBe(allBytes)
    for (const part of split) {
      const serialized = [...masterPartChunks(part.stores)].join('')
      expect(part.descriptor.bytes).toBe(Buffer.byteLength(serialized, 'utf8'))
      expect(part.descriptor.sha256).toBe(sha(serialized))
      expect(JSON.parse(serialized)).toEqual(part.stores)
    }
    expect(masterStoreJson(source[0])).toContain('\\u2028')
  })
  it('fails at equality with the byte ceiling and identifies the oversized Store', () => {
    // Arrange
    const source = store('9007199254740993', '😀')
    const exactSize = Buffer.byteLength([...masterPartChunks([source])].join(''))
    // Act / Assert
    expect(() => planMasterParts([source], { maxBytes: exactSize })).toThrow('MASTER_STORE_TOO_LARGE:9007199254740993')
    expect(planMasterParts([source], { maxBytes: exactSize + 1 })[0].descriptor.bytes).toBe(exactSize)
    expect(MASTER_PART_MAX_BYTES).toBe(200_000_000)
    expect(() => masterPartSchema.parse({ filename: 'master-0001.json', sha256: 'a'.repeat(64), bytes: 200_000_000, storeIds: ['1'] })).toThrow()
    expect(() => planMasterParts([source], { maxBytes: 200_000_001 })).toThrow('INVALID_MASTER_PART_LIMITS')
  })
  it('represents no Stores as the empty set without creating empty files', async () => {
    // Arrange / Act
    const fixture = await writeParts([])
    // Assert
    expect(fixture.parts).toEqual([])
    expect(await readdir(fixture.root)).toEqual([])
    expect(masterSetHash([])).toBe(sha('[]'))
    await expect(readMasterParts(fixture.root, [], masterSetHash([]), {}, acceptTransportStore)).resolves.toEqual([])
  })
  it('rejects duplicate Store IDs rather than publishing duplicate parts', () => {
    expect(() => planMasterParts([store('1'), store('1')], { maxStores: 1 })).toThrow('MASTER_STORE_DUPLICATE')
  })
  it('uses the specified descriptor key order even if input object insertion order differs', () => {
    // Arrange
    const descriptor: MasterPart = { storeIds: ['1'], bytes: 12, sha256: 'a'.repeat(64), filename: 'master-0001.json' }
    // Act / Assert
    expect(masterSetHash([descriptor])).toBe(sha('[{"filename":"master-0001.json","sha256":"' + 'a'.repeat(64) + '","bytes":12,"storeIds":["1"]}]'))
  })
})

describe('TC-F42-EXP-107: strict master set verification', () => {
  it.each(['missing', 'extra', 'aggregate', 'gap', 'hash', 'bytes', 'store-ids', 'duplicate', 'set-hash', 'artifact-registry'] as const)('rejects %s tampering', async mutation => {
    // Arrange
    const fixture = await writeParts([store('1'), store('2')], 1)
    const first = fixture.parts[0], second = fixture.parts[1]
    if (mutation === 'missing') await rm(path.join(fixture.root, first.filename))
    if (mutation === 'extra') await writeFile(path.join(fixture.root, 'master-0003.json'), '[]\n')
    if (mutation === 'aggregate') await writeFile(path.join(fixture.root, 'master.json'), '[]\n')
    if (mutation === 'gap') {
      await rename(path.join(fixture.root, second.filename), path.join(fixture.root, 'master-0003.json'))
      delete fixture.artifacts[second.filename]; second.filename = 'master-0003.json'; fixture.artifacts[second.filename] = second.sha256
    }
    if (mutation === 'hash') {
      const filename = path.join(fixture.root, first.filename)
      await writeFile(filename, (await readFile(filename, 'utf8')).replace('"name": ""', '"name": "x"'))
      first.bytes++ // correct the size to ensure the digest itself is checked
    }
    if (mutation === 'bytes') first.bytes++
    if (mutation === 'store-ids') first.storeIds = ['99']
    if (mutation === 'duplicate') {
      const bytes = await readFile(path.join(fixture.root, first.filename), 'utf8')
      await writeFile(path.join(fixture.root, second.filename), bytes)
      second.bytes = Buffer.byteLength(bytes); second.sha256 = sha(bytes); second.storeIds = ['1']; fixture.artifacts[second.filename] = second.sha256
    }
    if (mutation === 'artifact-registry') delete fixture.artifacts[first.filename]
    const hash = mutation === 'set-hash' ? 'f'.repeat(64) : masterSetHash(fixture.parts)
    // Act / Assert
    await expect(readMasterParts(fixture.root, fixture.parts, hash, fixture.artifacts, acceptTransportStore)).rejects.toThrow()
  })
  it('uses the actual operational schema validator on each Store', async () => {
    const fixture = await writeParts([store('1')])
    await expect(readMasterParts(fixture.root, fixture.parts, masterSetHash(fixture.parts), fixture.artifacts, (_value): _value is StoreOutput => false)).rejects.toThrow('MASTER_SCHEMA_INVALID')
  })
})
