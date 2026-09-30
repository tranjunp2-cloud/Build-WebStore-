// @vitest-environment node
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverPreparedInput, runPreparedParts } from '@/lib/migration/pw1-prepared-input'
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
async function fixture() { const root = await mkdtemp(join(tmpdir(), 'pw1-parts-')); roots.push(root); return root }
async function makeRun(root: string, name: string, stage = 'COMPLETED') {
    const directory = join(root, name), prepared = join(directory, 'prepared')
    await mkdir(prepared, { recursive: true })
    await writeFile(join(directory, 'run.json'), JSON.stringify({ stage, batchId: name }))
    const files = []
    for (const filename of ['master-0001.json', 'master-0002.json']) {
        const data = JSON.stringify([{ sourceStoreId: filename }])
        await writeFile(join(prepared, filename), data)
        files.push({ filename, state: 'complete', outputHash: createHash('sha256').update(data).digest('hex'), bytes: Buffer.byteLength(data), storeIds: [filename] })
    }
    const manifest = { format: 'pw1-prepared-destination-v1', status: 'complete', mapping: { status: 'complete', batchId: `json:${name}` }, files }
    const save = () => writeFile(join(prepared, 'destination-manifest.json'), JSON.stringify(manifest))
    await save()
    return { directory, prepared, manifest, save }
}
describe('[TC-F35.M51] Automatic prepared master parts', () => {
    it('selects newest completed nested run, ignoring an incomplete newer run', async () => {
        const root = await fixture()
        const old = await makeRun(root, 'old')
        await utimes(join(old.directory, 'run.json'), 1, 1)
        const latest = await makeRun(root, 'export/import-runs/new')
        await makeRun(root, 'unfinished', 'IMPORTING')
        const result = await discoverPreparedInput(root)
        expect(result.directory).toBe(latest.directory)
        expect(result.parts.map(p => p.path)).toEqual(latest.manifest.files.map(f => join(latest.prepared, f.filename)))
    })
    it.each(['missing', 'modified', 'duplicate', 'traversal', 'incomplete'])('rejects %s parts before running any migration', async kind => {
        const root = await fixture(), run = await makeRun(root, 'run')
        if (kind === 'missing') await rm(join(run.prepared, 'master-0002.json'))
        if (kind === 'modified') {
            const path = join(run.prepared, 'master-0002.json')
            await writeFile(path, (await readFile(path, 'utf8')).replace('master', 'MASTER'))
        }
        if (kind === 'duplicate') run.manifest.files.push(run.manifest.files[0])
        if (kind === 'traversal') run.manifest.files[0].filename = '../master-0001.json'
        if (kind === 'incomplete') run.manifest.status = 'writing'
        await run.save()
        await expect(discoverPreparedInput(root)).rejects.toThrow()
    })
    it('rejects a run set without completed imports', async () => {
        const root = await fixture()
        await makeRun(root, 'pending', 'PREPARED')
        await expect(discoverPreparedInput(root)).rejects.toThrow('No completed BE import')
    })
    it('finishes all parts before retrying failures and preserves a failed final status', async () => {
        const root = await fixture(); await makeRun(root, 'run')
        const { parts } = await discoverPreparedInput(root)
        const calls: number[] = []
        const code = await runPreparedParts(parts, async (_part, index) => { calls.push(index); return 2 })
        expect(code).toBe(1); expect(calls).toEqual([0, 1, 0, 1])
        const order: string[] = []
        await runPreparedParts(parts, async (_part, index) => { order.push(`start${index}`); await new Promise(resolve => setTimeout(resolve, 5)); order.push(`end${index}`); return 0 })
        expect(order).toEqual(['start0', 'end0', 'start1', 'end1'])
    })
    it('retries only failed parts and records recovery', async () => {
        const root = await fixture(); await makeRun(root, 'run')
        const { parts } = await discoverPreparedInput(root)
        const calls: string[] = [], results: number[] = []
        const code = await runPreparedParts(parts, async (_part, index, pass) => {
            calls.push(`${pass}:${index}`)
            return index === 0 && pass === 1 ? 1 : 0
        }, async attempt => { results.push(attempt.exitCode) })
        expect(calls).toEqual(['1:0', '1:1', '2:0'])
        expect(results).toEqual([1, 0, 0])
        expect(code).toBe(0)
    })
    it('does not start another part or retry after cancellation', async () => {
        const root = await fixture(); await makeRun(root, 'run')
        const { parts } = await discoverPreparedInput(root)
        const calls: number[] = []
        const code = await runPreparedParts(parts, async (_part, index) => { calls.push(index); return 130 })
        expect(calls).toEqual([0])
        expect(code).toBe(130)
    })

})
