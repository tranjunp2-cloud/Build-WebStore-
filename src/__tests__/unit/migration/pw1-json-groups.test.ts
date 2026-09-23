import type { FileHandle } from 'node:fs/promises'
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, readFile, readdir, stat, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checksum } from '@/lib/migration/pw1-json/projection'
import { storeGroups } from '@/lib/migration/pw1-json/groups'
import { DiskRegistry } from '@/lib/migration/pw1-json/disk-registry'
import { RunLogger, safeLogEvent } from '@/lib/migration/pw1-json/run-logger'
import { leaseHeartbeat } from '@/lib/migration/pw1-json/lease-heartbeat'
const roots: string[] = []
async function root() { const path = await mkdtemp(join(tmpdir(), 'pw1-groups-test-')); roots.push(path); return path }
afterEach(async () => { vi.useRealTimers(); await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
describe('[TC-F42-IMP-GROUPS] bounded groups and cross-group keys', () => {
  it.each([0,1,99,100,101,201])('partitions %i sparse sorted IDs without losing/repeating a store', count => {
    const ids = Array.from({ length: count }, (_, i) => String(2 * i + 1))
    const groups = storeGroups(ids)
    expect(groups.flat()).toEqual(ids)
    expect(groups.every(group => group.length <= 100)).toBe(true)
  })
  it.each([0,101,NaN,1.5,-1])('rejects group size %s', size => expect(() => storeGroups(['1'], size)).toThrow('GROUP_SIZE_ARGUMENT_INVALID'))
  it('detects a conflict across merged groups and supports repeated identical owners', async () => {
    const registry = new DiskRegistry(await root())
    const key = 'u' + checksum('email-key')
    await registry.add([{ key, value: checksum('owner1') }]); await registry.commitGroup()
    await registry.add([{ key, value: checksum('owner1') }]); await registry.commitGroup()
    await registry.add([{ key, value: checksum('owner2') }])
    await expect(registry.commitGroup()).rejects.toThrow('CROSS_STORE_UNIQUE_CONFLICT')
  })
  it('externally merges >4096 keys and rejects source ownership drift', async () => {
    const registry = new DiskRegistry(await root())
    await registry.add(Array.from({ length: 12000 }, (_, i) => ({ key: 's' + checksum(i), value: checksum(['store',i]) })))
    await registry.commitGroup()
    await registry.add([{ key: 's' + checksum(7000), value: checksum('other-store') }])
    await expect(registry.commitGroup()).rejects.toThrow('CROSS_STORE_SOURCE_CONFLICT')
  })
})
describe('[TC-F42-IMP-LOGS] private durable logs', () => {
  it('rotates valid JSONL, keeps counters and never serializes raw error/input', async () => {
    const path = await root(), logger = await RunLogger.create(path, 'apply', 400)
    await logger.event({ status: 'SELECTION_READY', stores: 201, verifiedBefore: 100 })
    await logger.event({ status: 'GROUP_PREFLIGHT_STARTED', stores: 100 })
    await logger.event({ status: 'STORE_VERIFIED', storeId: '205' })
    await logger.recordDestination('205', { tenantId: 1213, siteId: 1204, productCategories: [164, 165] })
    await logger.event({ status: 'SESSION_FAILED', code: 'TEST_ERROR', password: 'SECRET_CANARY', cause: { uri: 'SECRET_CANARY' }, sourceId: 'bad\nSECRET_CANARY' })
    await logger.checkpoint('FAILED', { code: 'TEST_ERROR', exitCode: 3 }); await logger.close()
    const names = await readdir(logger.directory)
    const contents = await Promise.all(names.map(name => readFile(join(logger.directory,name),'utf8')))
    expect(contents.join('')).not.toContain('SECRET_CANARY')
    expect(names.filter(name => name.startsWith('events-')).length).toBeGreaterThan(1)
    const summary = JSON.parse(await readFile(join(logger.directory,'summary.json'),'utf8'))
    expect(summary).toMatchObject({ stores:201, verifiedBefore:100, verifiedThisSession:1, remainingStores:100, exitCode:3, destinationsCount: 1 })
    const destinations = JSON.parse(await readFile(join(logger.directory,'store-destinations.json'),'utf8'))
    expect(destinations['205']).toEqual({ tenantId: 1213, siteId: 1204, productCategories: [164, 165] })
    expect((await stat(logger.directory)).mode & 0o777).toBe(0o700)
    expect((await stat(join(logger.directory,'summary.json'))).mode & 0o777).toBe(0o600)
    expect((await stat(join(logger.directory,'store-destinations.json'))).mode & 0o777).toBe(0o600)
    for (const name of names.filter(name => name.endsWith('.jsonl'))) for (const line of (await readFile(join(logger.directory,name),'utf8')).trim().split('\n')) if (line) expect(() => JSON.parse(line)).not.toThrow()
  })
  it('rejects relative/repository paths and drops unsafe metadata', async () => {
    await expect(RunLogger.create('relative')).rejects.toThrow('LOG_INIT_FAILED')
    await expect(RunLogger.create(join(process.cwd(),'migration-logs'))).rejects.toThrow('LOG_INIT_FAILED')
    expect(safeLogEvent({ status:'TEST', email:'secret@example.test', code:'raw SQL password=secret', sourceId:'\u001b[2J' })).toEqual({ status:'TEST' })
  })
})
describe('[TC-F42-IMP-GROUPS] lease heartbeat', () => {
  it('does not overlap renewals and propagates loss before the next write', async () => {
    vi.useFakeTimers()
    let reject!: (error: Error) => void
    const renew = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
    const heartbeat = leaseHeartbeat(renew, 10)
    await vi.advanceTimersByTimeAsync(100)
    expect(renew).toHaveBeenCalledTimes(1)
    reject(new Error('STALE_FENCING_TOKEN')); await Promise.resolve(); await Promise.resolve()
    expect(() => heartbeat.check()).toThrow('STALE_FENCING_TOKEN')
    await heartbeat.stop(); await vi.advanceTimersByTimeAsync(100)
    expect(renew).toHaveBeenCalledTimes(1)
  })
})


describe('[TC-F42-IMP-GROUPS] renewal lock contention', () => {
  it('retries our transaction lock without hiding real fencing loss', async () => {
    vi.useFakeTimers()
    const renew = vi.fn().mockRejectedValueOnce({ code: '55P03' }).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('STALE_FENCING_TOKEN'))
    const heartbeat = leaseHeartbeat(renew, 10, error => Boolean(error && typeof error === 'object' && 'code' in error && error.code === '55P03'))
    await vi.advanceTimersByTimeAsync(10)
    expect(() => heartbeat.check()).not.toThrow()
    await vi.advanceTimersByTimeAsync(1000)
    expect(renew).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10)
    expect(() => heartbeat.check()).toThrow('STALE_FENCING_TOKEN')
    await heartbeat.stop()
  })
})


describe('[TC-F42-IMP-LOGS] failure and dry-run reporting', () => {
  it('keeps dry-run counts planned and separate from committed entities', async () => {
    const logger = await RunLogger.create(await root(), 'dry-run')
    await logger.event({ status: 'SELECTION_READY', stores: 2 })
    await logger.event({ status: 'STORE_PREFLIGHT_PASSED', storeId: '1', creates: 4, reuses: 1 })
    await logger.event({ status: 'STORE_PREFLIGHT_PASSED', storeId: '2', creates: 2, reuses: 0 })
    await logger.checkpoint('PREFLIGHT_PASSED', { writes: 0 }); await logger.close()
    expect(JSON.parse(await readFile(join(logger.directory,'summary.json'),'utf8'))).toMatchObject({ plannedCreates: 6, plannedReuses: 1, preflightedStores: 2, verifiedThisSession: 0, remainingStores: 0, entityCounts: {}, writes: 0 })
  })
  it('fails closed after a disk write failure and leaves the last durable summary honest', async () => {
    const logger = await RunLogger.create(await root())
    // Fault injection at the actual filesystem boundary, not a duplicate logger implementation.
    const handle = (logger as unknown as { events: FileHandle }).events
    vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(Object.assign(new Error('secret-db-uri'), { code: 'ENOSPC' }))
    await expect(logger.event({ status: 'ENTITY_COMMITTED', targetId: 7 })).rejects.toThrow('LOG_WRITE_FAILED')
    await expect(logger.event({ status: 'STORE_VERIFIED', storeId: '1' })).rejects.toThrow('LOG_WRITE_FAILED')
    await logger.close()
    expect(JSON.parse(await readFile(join(logger.directory,'summary.json'),'utf8')).outcome).toBe('RUNNING')
  })
  it('rejects log-root symlinks without following them', async () => {
    const path = await root(), target = await root(), link = join(path,'link')
    await symlink(target, link)
    await expect(RunLogger.create(link)).rejects.toThrow('LOG_INIT_FAILED')
    expect(await readdir(target)).toEqual([])
  })
  it('rejects tampered registry files before committing a subsequent group', async () => {
    const path = await root(), registry = new DiskRegistry(path)
    await registry.add([{ key: 'u' + checksum('one'), value: checksum('owner') }]); await registry.commitGroup()
    const file = (await readdir(path))[0]
    await writeFile(join(path,file), 'u' + checksum('changed') + ' ' + checksum('owner') + '\n')
    await registry.add([{ key: 'u' + checksum('two'), value: checksum('owner2') }])
    await expect(registry.commitGroup()).rejects.toThrow('REGISTRY_INTEGRITY_FAILED')
  })
})
