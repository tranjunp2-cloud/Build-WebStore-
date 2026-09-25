// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
const fs = vi.hoisted(() => ({ statfs: vi.fn() }))
vi.mock('node:fs/promises', async original => ({ ...await original<typeof import('node:fs/promises')>(), statfs: fs.statfs }))
import { assertDiskSpace } from '@/lib/migration/pw1-json/artifact'
import { requiredPrepareDiskBytes } from '@/lib/migration/pw1-json/credentials'
import { masterSetHash } from '@/lib/migration/pw1-json/master-parts'

describe('[TC-F42-IMP-PARTS-001] Chunk preparation disk budget', () => {
  it('binds the empty master set to the SHA256 of []', () => {
    // Arrange / Act / Assert
    expect(masterSetHash([])).toBe('4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945')
  })
  it('budgets one artifact copy for chunks and retains legacy master temporary space', async () => {
    // Arrange
    const copy = BigInt(3000), master = BigInt(2000), encrypted = BigInt(100), reserve = BigInt(64 * 1024 * 1024)
    const required = requiredPrepareDiskBytes(copy, master, encrypted, true)
    // Act / Assert
    expect(required).toBe(copy + encrypted + reserve)
    expect(requiredPrepareDiskBytes(copy, master, encrypted, false)).toBe(required + master * BigInt(2))
    fs.statfs.mockResolvedValue({ bavail: required, bsize: BigInt(1) })
    await expect(assertDiskSpace('/private', required)).resolves.toBeUndefined()
    fs.statfs.mockResolvedValue({ bavail: required - BigInt(1), bsize: BigInt(1) })
    await expect(assertDiskSpace('/private', required)).rejects.toThrow('ARTIFACT_DISK_SPACE_INSUFFICIENT')
  })
})
