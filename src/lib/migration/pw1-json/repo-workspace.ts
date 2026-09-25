import { lstat, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

export const PRIVATE_WORKSPACE_DIR = '.migration'

/** The only in-repository location allowed to hold artifacts: <repoRoot>/.migration must be a real, private, gitignored directory. */
export async function isPrivateRepoWorkspace(repoRoot: string, filename: string): Promise<boolean> {
  const workspace = resolve(repoRoot, PRIVATE_WORKSPACE_DIR)
  const inside = relative(workspace, resolve(filename))
  if (inside === '..' || inside.startsWith('..' + '/') || isAbsolute(inside)) return false
  try {
    const stats = await lstat(workspace)
    if (!stats.isDirectory() || (stats.mode & 0o077) !== 0 || await realpath(workspace) !== workspace) return false
    const ignore = await readFile(resolve(repoRoot, '.gitignore'), 'utf8')
    return ignore.split('\n').some(line => /^\.migration\/?$/.test(line.trim()))
  } catch { return false }
}
