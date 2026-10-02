// @vitest-environment node
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertOutsideRepository } from '@/lib/migration/pw1-json/artifact'
import { validateOutputPath } from '@/lib/migration/pw1-json/destination-master'
import { loadCreatorBindings } from '@/lib/migration/pw1-json/creator-bindings'
import { RunLogger } from '@/lib/migration/pw1-json/run-logger'

let root: string | undefined
async function fakeRepo(options: { workspaceMode?: number; gitignore?: boolean; symlinkWorkspace?: boolean } = {}) {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'pw1-repo-workspace-')))
  await writeFile(join(repo, '.git'), 'gitdir: /nonexistent\n')
  if (options.gitignore !== false) await writeFile(join(repo, '.gitignore'), 'node_modules/\n.migration/\n')
  if (options.symlinkWorkspace) {
    const target = await mkdtemp(join(tmpdir(), 'pw1-workspace-target-'))
    await symlink(target, join(repo, '.migration'))
  } else {
    await mkdir(join(repo, '.migration'), { mode: 0o700 })
    await mkdir(join(repo, '.migration/runs'))
    if (options.workspaceMode !== undefined) await chmod(join(repo, '.migration'), options.workspaceMode)
  }
  return repo
}

afterEach(async () => { vi.restoreAllMocks(); if (root) { await rm(root, { recursive: true, force: true }); root = undefined } })

describe('[TC-F42-IMP-WORKFLOW] Sanctioned .migration workspace inside a repository', () => {
  it('allows run outputs under a private gitignored .migration directory', async () => {
    // Arrange
    root = await fakeRepo()
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    const output = resolve(root, '.migration/runs/run-1')
    // Act / Assert
    await expect(assertOutsideRepository(output)).resolves.toBeUndefined()
    await expect(validateOutputPath(output)).resolves.toBe(output)
  })
  it('still rejects repository paths outside .migration', async () => {
    // Arrange
    root = await fakeRepo()
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    // Act / Assert
    await expect(assertOutsideRepository(resolve(root, 'runs/run-1'))).rejects.toThrow('PRIVATE_ARTIFACT_INSIDE_REPOSITORY')
    await mkdir(resolve(root, 'runs'))
    await expect(validateOutputPath(resolve(root, 'runs/run-1'))).rejects.toThrow('PRIVATE_ARTIFACT_INSIDE_REPOSITORY')
  })
  it.each([
    ['world-readable workspace', { workspaceMode: 0o755 }],
    ['missing gitignore entry', { gitignore: false }],
    ['symlinked workspace', { symlinkWorkspace: true }],
  ])('rejects a .migration workspace that is not private, ignored and real (%s)', async (_label, options) => {
    // Arrange
    root = await fakeRepo(options)
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    const output = resolve(root, '.migration/runs/run-1')
    // Act / Assert
    await expect(assertOutsideRepository(output)).rejects.toThrow('PRIVATE_ARTIFACT_INSIDE_REPOSITORY')
    await expect(validateOutputPath(output)).rejects.toThrow('PRIVATE_ARTIFACT_INSIDE_REPOSITORY')
  })
  it('lets creator bindings live inside .migration but not elsewhere in the repository', async () => {
    // Arrange
    root = await fakeRepo()
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    const inside = resolve(root, '.migration/bindings.json')
    await writeFile(inside, '{}', { mode: 0o600 })
    const elsewhere = resolve(root, 'bindings.json')
    await writeFile(elsewhere, '{}', { mode: 0o600 })
    // Act / Assert — the workspace file passes the repository guard and fails later at schema validation
    await expect(loadCreatorBindings(inside)).rejects.toThrow('CREATOR_BINDING_SCHEMA_INVALID')
    await expect(loadCreatorBindings(elsewhere)).rejects.toThrow('CREATOR_BINDINGS_OUTSIDE_REPOSITORY_REQUIRED')
  })
  it('accepts a log root inside .migration and still rejects other repository roots', async () => {
    // Arrange
    root = await fakeRepo()
    vi.spyOn(process, 'cwd').mockReturnValue(root)
    // Act / Assert
    const logger = await RunLogger.create(resolve(root, '.migration/runs/run-1/logs'), 'apply')
    await logger.close()
    await expect(RunLogger.create(resolve(root, 'logs'), 'apply')).rejects.toThrow('LOG_INIT_FAILED')
  })
  it('accepts private logs in a nested worktree while rejecting logs outside its workspace', async () => {
    // Arrange
    root = await fakeRepo()
    const worktree = resolve(root, '.claude/worktrees/test')
    await mkdir(resolve(worktree, '.migration'), { recursive: true, mode: 0o700 })
    await writeFile(join(worktree, '.git'), 'gitdir: /nonexistent\n')
    await writeFile(join(worktree, '.gitignore'), '.migration/\n')
    // Act
    const logger = await RunLogger.create(resolve(worktree, '.migration/runs/test/logs'), 'dry-run')
    await logger.close()
    // Assert
    await expect(RunLogger.create(resolve(worktree, 'logs'))).rejects.toThrow('LOG_INIT_FAILED')
    await chmod(resolve(worktree, '.migration'), 0o755)
    await expect(RunLogger.create(resolve(worktree, '.migration/runs/test/logs'))).rejects.toThrow('LOG_INIT_FAILED')
  })
})
