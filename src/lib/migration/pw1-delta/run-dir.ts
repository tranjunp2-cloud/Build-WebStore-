/**
 * Run directories of the delta CLIs. Inside the repository a run directory must live under the private,
 * git-ignored `.migration/` (reports can hold PW1 data); `<…>/delta-runs/` is created on first use.
 */
import { lstat, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { DeltaError } from './delta-options'

export async function createRunDir(out: string): Promise<void> {
  const repo = process.cwd()
  const inside = (dir: string) => { const rel = path.relative(dir, out); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)) }
  if (inside(repo) && !inside(path.join(repo, '.migration'))) throw new DeltaError('OUT_NOT_PRIVATE', `${out} is inside the repository but not under .migration/`)
  const parent = path.dirname(out)
  if (path.basename(parent) === 'delta-runs') {
    await lstat(path.dirname(parent)).catch(() => { throw new DeltaError('OUT_PARENT_MISSING', path.dirname(parent)) })
    await mkdir(parent, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error })
  }
  await mkdir(out, { mode: 0o700 })
}
