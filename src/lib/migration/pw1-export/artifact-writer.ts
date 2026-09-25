import type { Progress } from './progress'
import { mkdir, open, lstat, realpath, rename, rm } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { ExportError } from './primitives'
export type ArtifactContent =
  | string
  | Iterable<string>
  | AsyncIterable<string>
  | ((hashes: Record<string, string>) => string)
export async function writeArtifacts(
  outputDir: string,
  inputRoot: string | undefined,
  files: Record<string, ArtifactContent>,
  beforePublish: () => Promise<void>,
  progress?: Progress,
): Promise<void> {
  const destination = path.resolve(outputDir),
    parent = path.dirname(destination)
  let current = path.parse(parent).root
  for (const part of parent
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part)
    if ((await lstat(current)).isSymbolicLink())
      throw new ExportError('SYMLINK_OUTPUT')
  }
  const realParent = await realpath(parent)
  if (
    inputRoot &&
    (realParent === inputRoot || realParent.startsWith(inputRoot + path.sep))
  )
    throw new ExportError('OUTPUT_INSIDE_SOURCE')
  const lock = destination + '.lock',
    staging = path.join(parent, `.pw1-export-${randomUUID()}`)
  let handle
  try {
    handle = await open(lock, 'wx', 0o600)
  } catch {
    throw new ExportError('OUTPUT_LOCKED')
  }
  let published = false,
    claimed = false
  try {
    try {
      await lstat(destination)
      throw new ExportError('OUTPUT_EXISTS')
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e
    }
    await mkdir(staging, { mode: 0o700 })
    const hashes: Record<string, string> = {}
    for (const [name, content] of Object.entries(files)) {
      if (path.basename(name) !== name)
        throw new ExportError('INVALID_ARTIFACT_NAME')
      progress?.({ phase: 'write-artifact', table: name, bytes: 0 })
      let bytes = 0
      let nextReport = 1024 * 1024
      const source = typeof content === 'function' ? content(hashes) : content
      const chunks = typeof source === 'string' ? [source] : source
      const f = await open(path.join(staging, name), 'wx', 0o600),
        digest = createHash('sha256')
      try {
        for await (const chunk of chunks) {
          digest.update(chunk)
          await f.writeFile(chunk)
          bytes += Buffer.byteLength(chunk)
          if (bytes >= nextReport) {
            progress?.({ phase: 'write-artifact', table: name, bytes })
            nextReport = bytes + 1024 * 1024
          }
        }
        await f.sync()
      } finally {
        await f.close()
      }
      hashes[name] = digest.digest('hex')
      progress?.({ phase: 'verify-artifact', table: name, bytes })
      const check = createHash('sha256')
      for await (const chunk of createReadStream(path.join(staging, name)))
        check.update(chunk)
      if (check.digest('hex') !== hashes[name])
        throw new ExportError('ARTIFACT_READBACK_FAILED')
    }
    await beforePublish()
    // Exclusive reservation gives no-clobber semantics even against non-cooperating creators.
    // The manifest is the commit marker; readers reject directories without it.
    try {
      await mkdir(destination, { mode: 0o700 })
      claimed = true
    } catch {
      throw new ExportError('OUTPUT_EXISTS')
    }
    const names = Object.keys(files).filter((n) => n !== 'master-manifest.json')
    if (files['master-manifest.json']) names.push('master-manifest.json')
    for (const name of names)
      await rename(path.join(staging, name), path.join(destination, name))
    const dir = await open(destination, 'r')
    try {
      await dir.sync()
    } finally {
      await dir.close()
    }
    published = true
    progress?.({
      phase: 'published',
      completed: names.length,
      total: names.length,
    })
  } finally {
    await rm(staging, { recursive: true, force: true })
    if (claimed && !published)
      await rm(destination, { recursive: true, force: true })
    await handle.close()
    await rm(lock, { force: true })
  }
}
export function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
