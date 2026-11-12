import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { z } from 'zod'

const Manifest = z.object({
    format: z.literal('pw1-prepared-destination-v1'),
    status: z.literal('complete'),
    mapping: z.object({ status: z.literal('complete'), batchId: z.string() }),
    files: z.array(z.object({
        filename: z.string().regex(/^master(?:-\d{4})?\.json$/),
        state: z.literal('complete'), outputHash: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z.number().int().nonnegative(), storeIds: z.array(z.string()),
    })).min(1),
})
export type PreparedPart = { path: string; outputHash: string; bytes: number; storeIds: string[] }

type CompletedRun = { directory: string; modified: number; batchId: string }

/** Every completed BE run under the root, newest first. */
async function completedRuns(root: string): Promise<CompletedRun[]> {
    const candidates: CompletedRun[] = []
    async function visit(directory: string, depth: number): Promise<void> {
        const entries = await readdir(directory, { withFileTypes: true })
        if (entries.some(e => e.name === 'run.json' && e.isFile())) {
            const path = join(directory, 'run.json')
            const state = JSON.parse(await readFile(path, 'utf8')) as { stage?: string; batchId?: string }
            if (state.stage === 'COMPLETED' && state.batchId) candidates.push({ directory, modified: (await stat(path)).mtimeMs, batchId: state.batchId })
        }
        if (depth < 5) for (const entry of entries) {
            if (entry.isDirectory() && !['prepared', 'artifact', 'logs', 'binding'].includes(entry.name)) await visit(join(directory, entry.name), depth + 1)
        }
    }
    try { await visit(root, 0) } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') throw new Error('No BE runs found in .migration/runs; supply an input JSON file')
        throw error
    }
    return candidates.sort((a, b) => b.modified - a.modified || b.directory.localeCompare(a.directory))
}

async function preparedParts(selected: CompletedRun) {
    const prepared = join(selected.directory, 'prepared')
    if ((await lstat(prepared)).isSymbolicLink()) throw new Error('Prepared directory must not be a symlink')
    const manifest = Manifest.parse(JSON.parse(await readFile(join(prepared, 'destination-manifest.json'), 'utf8')))
    if (manifest.mapping.batchId !== `json:${selected.batchId}`) throw new Error('BE run and destination manifest batch mismatch')
    const names = manifest.files.map(f => f.filename)
    if (new Set(names).size !== names.length) throw new Error('Duplicate master part in destination manifest')
    return manifest.files.map(f => ({ path: join(prepared, f.filename), outputHash: f.outputHash, bytes: f.bytes, storeIds: f.storeIds }))
}

/** Only completed BE handoffs qualify; never select an exporter master directly. */
export async function discoverPreparedInput(root = resolve('.migration/runs')) {
    const selected = (await completedRuns(root))[0]
    if (!selected) throw new Error('No completed BE import found in .migration/runs; finish BE import or supply an input JSON file')
    const parts = await preparedParts(selected)
    // Check every part before the first child can write to the database.
    for (const part of parts) await verifyPreparedPart(part)
    return { directory: selected.directory, parts }
}

/** Master parts of every completed run, newest first; runs with a broken handoff are reported and skipped (read-only callers). */
export async function discoverAllPreparedParts(root = resolve('.migration/runs')) {
    const parts: PreparedPart[] = []
    const skipped: Array<{ directory: string; reason: string }> = []
    for (const run of await completedRuns(root)) {
        try {
            const runParts = await preparedParts(run)
            for (const part of runParts) await verifyPreparedPart(part)
            parts.push(...runParts)
        } catch (error) { skipped.push({ directory: run.directory, reason: error instanceof Error ? error.message : String(error) }) }
    }
    return { parts, skipped }
}

export async function verifyPreparedPart(part: PreparedPart) {
    const info = await lstat(part.path)
    if (!info.isFile() || info.size !== part.bytes) throw new Error(`Prepared master file/size mismatch: ${part.path}`)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(part.path)) hash.update(chunk)
    if (hash.digest('hex') !== part.outputHash) throw new Error(`Prepared master checksum mismatch: ${part.path}`)
}

export type PartAttempt = { path: string; index: number; pass: number; exitCode: number }

/** Finish the first pass, then retry only failed parts once. Cancellation stops immediately. */
export async function runPreparedParts(
    parts: PreparedPart[],
    run: (part: PreparedPart, index: number, pass: number) => Promise<number>,
    onResult?: (attempt: PartAttempt) => Promise<void>,
) {
    let pending = parts.map((part, index) => ({ part, index }))
    for (let pass = 1; pass <= 2; pass++) {
        const failed: typeof pending = []
        for (const { part, index } of pending) {
            await verifyPreparedPart(part)
            const exitCode = await run(part, index, pass)
            await onResult?.({ path: part.path, index, pass, exitCode })
            if ([130, 143].includes(exitCode)) return exitCode
            if (exitCode !== 0) failed.push({ part, index })
        }
        if (!failed.length) return 0
        pending = failed
    }
    return 1
}
