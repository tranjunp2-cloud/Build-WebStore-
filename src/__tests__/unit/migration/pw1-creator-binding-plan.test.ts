// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { planCreatorBindings, type CreatorTargetUser } from '@/lib/migration/pw1-export/creator-binding-plan'

function fixture(targetUsers: CreatorTargetUser[] = []) {
  const source = { table: 'users', storeId: null, deletedAt: null, isFrontend: '0', status: '1',
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', roles: [] }
  return { sourceInstanceToken: 'PW1PROD', snapshotId: 'one', targetInstanceId: 'local-test', targetUsers,
    registry: { version: 1, purpose: 'creator-target-binding-required', sourceInstanceToken: 'PW1PROD', snapshotId: 'one', actors: [
      { _ref: '@users:users:51', sourceId: '51', name: 'SSO', email: 'sso@example.test', createdBy: '@users:users:1', source },
      { _ref: '@users:users:1', sourceId: '1', name: 'Admin', email: 'admin@example.test', source },
    ] } }
}
function target(sourceId: number, id: number, email: string): CreatorTargetUser {
  return { id, email, verifiedSource: { sourceInstanceToken: 'PW1PROD', sourceRef: `@users:users:${sourceId}` } }
}
describe('[TC-F42-EXP-075] Creator binding preflight', () => {
  it('plans verified target IDs and creator chain deterministically without changing inputs', () => {
    // Arrange
    const input = fixture([target(51, 905, 'SSO@example.test'), target(1, 800, 'admin@example.test')])
    const before = JSON.stringify(input)
    // Act
    const result = planCreatorBindings(input)
    // Assert
    expect(result.ready).toBe(true)
    expect(result.databaseWritten).toBe(false)
    expect(result.bindings.map(r => [r.sourceId, r.targetId, r.creatorTargetId])).toEqual([['1', 800, null], ['51', 905, 800]])
    expect(JSON.stringify(input)).toBe(before)
    expect(result).toEqual(planCreatorBindings({ ...input, targetUsers: [...input.targetUsers].reverse() }))
  })
  it('reports missing actors and unresolved creator dependencies', () => {
    // Arrange
    const input = fixture([target(51, 905, 'sso@example.test')])
    // Act
    const result = planCreatorBindings(input)
    // Assert
    expect(result.ready).toBe(false)
    expect(result.bindings[0].status).toBe('missing-target')
    expect(result.bindings[1]).toMatchObject({ targetId: 905, creatorTargetId: null, creatorResolved: false })
  })
  it('does not trust email alone or an unrelated source instance', () => {
    // Arrange
    const input = fixture([{ id: 800, email: 'admin@example.test' }, { ...target(51, 905, 'sso@example.test'), verifiedSource: { sourceInstanceToken: 'pw1dev', sourceRef: '@users:users:51' } }])
    // Act
    const result = planCreatorBindings(input)
    // Assert
    expect(result.bindings.map(r => r.status)).toEqual(['unverified-candidate', 'identity-conflict'])
    expect(result.bindings.every(r => r.targetId === null)).toBe(true)
  })
  it('rejects ambiguous emails and duplicate target IDs', () => {
    // Arrange
    const input = fixture([target(1, 800, 'admin@example.test'), { id: 801, email: 'ADMIN@example.test' }])
    // Act
    const result = planCreatorBindings(input)
    // Assert
    expect(result.bindings[0]).toMatchObject({ status: 'ambiguous-email', targetId: null })
    expect(() => planCreatorBindings(fixture([target(1, 800, 'admin@example.test'), target(51, 800, 'sso@example.test')]))).toThrow('CREATOR_TARGET_ID_DUPLICATE')
  })
  it('rejects sidecar provenance mismatch and inconsistent identity claims', () => {
    // Arrange
    const input = fixture([target(1, 800, 'wrong@example.test')])
    // Act
    const result = planCreatorBindings(input)
    // Assert
    expect(result.bindings[0].status).toBe('identity-conflict')
    expect(() => planCreatorBindings({ ...input, sourceInstanceToken: 'wrong' })).toThrow('USER_ACTORS_PROVENANCE_INVALID')
  })
  it('refuses to merge two source actors sharing one target email', () => {
    // Arrange
    const input = fixture([target(1, 800, 'admin@example.test')])
    input.registry.actors[0].email = 'ADMIN@example.test'
    // Act
    const result = planCreatorBindings(input)
    // Assert
    expect(result.ready).toBe(false)
    expect(result.bindings.every(r => r.status === 'identity-conflict' && r.targetId === null)).toBe(true)
  })

})
