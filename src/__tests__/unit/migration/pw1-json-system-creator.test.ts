// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { lookupSystemCreator, SYSTEM_CREATOR_EMAIL } from '@/lib/migration/pw1-json/system-creator'
import { actorTargetIdentityHash } from '@/lib/migration/pw1-json/creator-bindings'

describe('[TC-F42-IMP-SYSTEM-EMAIL] System creator email lookup', () => {
  it('uses actual ID from email lookup instead of a fixed ID', async () => {
    // Arrange
    const row = { id: 425, email: SYSTEM_CREATOR_EMAIL }
    const query = vi.fn(async () => ({ rows: [row] }))
    // Act
    const result = await lookupSystemCreator({ query })
    // Assert
    expect(query).toHaveBeenCalledWith(expect.stringContaining('lower(btrim(email))=$1'), [SYSTEM_CREATOR_EMAIL])
    expect(result).toEqual({ targetUserId: 425, targetUserIdentityHash: actorTargetIdentityHash(row) })
  })
  it.each([[], [{id: 1,email:SYSTEM_CREATOR_EMAIL},{id:2,email:SYSTEM_CREATOR_EMAIL}], [{id:0,email:SYSTEM_CREATOR_EMAIL}]])('rejects unavailable or invalid identity %#', async rows => {
    // Arrange
    const db = { query: async () => ({ rows }) }
    // Act / Assert
    await expect(lookupSystemCreator(db)).rejects.toThrow()
  })
})
