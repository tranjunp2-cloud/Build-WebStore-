import { open, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { MigrationError } from './errors'
type Run = { path: string; hash: string; bytes: number }
const valid = /^[su][a-f0-9]{64} [a-f0-9]{64}$/
function conflict(a: string, b: string): void {
  if (a.slice(0, 65) === b.slice(0, 65) && a !== b) throw new MigrationError(a[0] === 's' ? 'CROSS_STORE_SOURCE_CONFLICT' : 'CROSS_STORE_UNIQUE_CONFLICT')
}
/** Sorted immutable runs. At most 4096 keys and two read buffers are resident. */
export class DiskRegistry {
  private buffer: string[] = []
  private runs: Run[] = []
  private index?: Run
  constructor(private directory: string) {}
  async add(records: Iterable<{ key: string; value: string }>): Promise<void> {
    for (const record of records) {
      const line = `${record.key} ${record.value}`
      if (!valid.test(line)) throw new MigrationError('REGISTRY_KEY_INVALID')
      this.buffer.push(line)
      if (this.buffer.length >= 4096) await this.flush()
    }
  }
  private async flush(): Promise<void> {
    if (!this.buffer.length) return
    const rows = this.buffer.sort(); this.buffer = []
    this.runs.push(await this.write((async function* () {
      let previous: string | undefined
      for (const row of rows) {
        if (previous) conflict(previous, row)
        if (row !== previous) yield row
        previous = row
      }
    })()))
    // Binary compaction bounds run metadata/file count even for large groups.
    while (this.runs.length > 1 && this.runs.at(-1)!.bytes >= this.runs.at(-2)!.bytes) {
      const right = this.runs.pop()!, left = this.runs.pop()!
      this.runs.push(await this.merge(left, right))
    }
  }
  private async write(rows: AsyncIterable<string>): Promise<Run> {
    const path = join(this.directory, `keys-${randomUUID()}.txt`)
    const handle = await open(path, 'wx', 0o600), hash = createHash('sha256')
    let bytes = 0, buffer = ''
    const flush = async () => {
      if (!buffer) return
      const chunk = Buffer.from(buffer)
      let offset = 0
      while (offset < chunk.length) { const result = await handle.write(chunk, offset); if (!result.bytesWritten) throw new MigrationError('REGISTRY_WRITE_FAILED'); offset += result.bytesWritten }
      hash.update(chunk); bytes += chunk.length; buffer = ''
    }
    try {
      for await (const row of rows) { buffer += row + '\n'; if (buffer.length >= 65536) await flush() }
      await flush(); return { path, bytes, hash: hash.digest('hex') }
    } finally { await handle.close() }
  }
  private async *read(run: Run): AsyncGenerator<string> {
    const handle = await open(run.path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size !== run.bytes || (stat.mode & 0o077)) throw new MigrationError('REGISTRY_INTEGRITY_FAILED')
      let buffer = '', bytes = 0; const hash = createHash('sha256')
      for await (const chunk of handle.createReadStream({ autoClose: false, highWaterMark: 65536 })) {
        const raw = Buffer.from(chunk); bytes += raw.length
        if (bytes > run.bytes) throw new MigrationError('REGISTRY_INTEGRITY_FAILED')
        hash.update(raw); buffer += raw.toString('utf8')
        let newline: number
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1)
          if (!valid.test(line)) throw new MigrationError('REGISTRY_INTEGRITY_FAILED')
          yield line
        }
        if (buffer.length > 130) throw new MigrationError('REGISTRY_INTEGRITY_FAILED')
      }
      if (buffer || bytes !== run.bytes || hash.digest('hex') !== run.hash) throw new MigrationError('REGISTRY_INTEGRITY_FAILED')
    } finally { await handle.close() }
  }
  private async merge(left: Run, right: Run): Promise<Run> {
    const a = this.read(left), b = this.read(right)
    try {
      const result = await this.write((async function* () {
        let x = await a.next(), y = await b.next(), previous: string | undefined
        while (!x.done || !y.done) {
          const fromA = !x.done && (y.done || x.value <= y.value)
          const line = fromA ? x.value! : y.value!
          if (previous) conflict(previous, line)
          if (line !== previous) yield line
          previous = line
          if (fromA) x = await a.next(); else y = await b.next()
        }
      })())
      await unlink(left.path); await unlink(right.path)
      return result
    } finally { await a.return(undefined); await b.return(undefined) }
  }
  async commitGroup(): Promise<void> {
    await this.flush()
    if (this.index) this.runs.unshift(this.index)
    this.index = undefined
    while (this.runs.length > 1) {
      const next: Run[] = []
      for (let i = 0; i < this.runs.length; i += 2) next.push(this.runs[i + 1] ? await this.merge(this.runs[i], this.runs[i + 1]) : this.runs[i])
      this.runs = next
    }
    this.index = this.runs.pop()
  }
}
