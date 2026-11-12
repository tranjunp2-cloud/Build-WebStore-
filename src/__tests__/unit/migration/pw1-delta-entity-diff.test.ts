// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Entity } from '@/lib/migration/pw1-json/projection'
import { checksum } from '@/lib/migration/pw1-json/projection'
import { diffStore, ledgerGone, reconcileMoves, RETIRED_CHECKSUM, type EntityChange } from '@/lib/migration/pw1-delta/entity-diff'
import { finalizeChanges, massChange } from '@/lib/migration/pw1-delta/delta-compare'
import { changedPasswords, passwordDecision } from '@/lib/migration/pw1-delta/password-sync'
import { ledgerKey, type LedgerClaim } from '@/lib/migration/pw1-delta/ledger-lookup'
import { ParityGate } from '@/lib/migration/pw1-delta/parity-gate'

function product(id: string, data: Record<string, unknown>, storeId = '7'): Entity {
  return { ref: `@products:products:${id}`, collection: 'products', sourceEntity: 'products', sourceId: id, storeId, data, refs: [], sourceChecksum: checksum(data) }
}
function claim(entity: Entity, overrides: Partial<LedgerClaim> = {}): [string, LedgerClaim] {
  return [ledgerKey(entity.sourceEntity, entity.sourceId), { targetCollection: 'products', targetId: `t${entity.sourceId}`, sourceChecksum: entity.sourceChecksum, targetChecksum: 'x', origin: 'import', ...overrides }]
}

describe('[TC-F42-DELTA-03] Old/new entity diff', () => {
  it('classifies unchanged, changed, new, recovered and gone entities', () => {
    // Arrange
    const same = product('1', { title: 'A' }), before = product('2', { title: 'B', price: 1 }), after = product('2', { title: 'B', price: 2 })
    const removed = product('3', { title: 'C' }), added = product('4', { title: 'D' }), back = product('5', { title: 'E' })
    const claims = new Map([claim(same), claim(before), claim(removed)])
    const excluded = new Set([ledgerKey('products', '5')])
    // Act
    const { changes, unchanged } = diffStore('7', [same, before, removed], [same, after, added, back], claims, excluded)
    // Assert
    expect(unchanged).toBe(1)
    expect(changes.map(change => [change.kind, change.sourceId, change.recovered ?? false])).toEqual([
      ['CHANGED', '2', false], ['NEW', '4', false], ['NEW', '5', true], ['GONE', '3', false],
    ])
    expect(changes[0]).toMatchObject({ fields: ['price'], target: { collection: 'products', id: 't2', origin: 'import' } })
    expect(changes[3].target).toMatchObject({ id: 't3' })
  })

  it('treats a version already applied by a previous delta run as unchanged', () => {
    // Arrange
    const before = product('2', { price: 1 }), after = product('2', { price: 2 })
    const claims = new Map([claim(after, { origin: 'delta' })])
    // Act
    const result = diffStore('7', [before], [after], claims, new Set())
    // Assert
    expect(result).toEqual({ changes: [], unchanged: 1 })
  })

  it('corrects a document imported with a quote prefix even when old and new rebuilds are equal', () => {
    // Arrange: both rebuilds are normalized (no quote); the import recorded the quoted value
    const imported = product('6', { phone: "'+6012" }), rebuilt = product('6', { phone: '+6012' })
    const claims = new Map([claim(imported)])
    // Act
    const withOld = diffStore('7', [rebuilt], [rebuilt], claims, new Set())
    const withoutOld = diffStore('7', null, [rebuilt], claims, new Set())
    // Assert: same result in both modes
    expect(withOld.changes.map(change => [change.kind, change.sourceId])).toEqual([['CHANGED', '6']])
    expect(withoutOld.changes.map(change => [change.kind, change.sourceId])).toEqual([['CHANGED', '6']])
  })

  it('does not remove a document whose store move was applied by an earlier run (--old rerun)', () => {
    // Arrange: old snapshot has product 9 in store 1; new snapshot in store 2, already matching the delta claim
    const oldCopy = product('9', { tenant: 'a' }, '1'), newCopy = product('9', { tenant: 'b' }, '2')
    const claims = new Map([claim(newCopy, { origin: 'delta' })])
    const changes = [...diffStore('1', [oldCopy], [], claims, new Set()).changes, ...diffStore('2', [], [newCopy], claims, new Set()).changes]
    // Act
    const result = finalizeChanges(changes, claims, new Set([ledgerKey('products', '9')]), true)
    // Assert
    expect(result).toEqual([])
  })

  it('finds a document created by a delta run that left PW1, also with --old', () => {
    // Arrange: product 20 was created by a delta run, so it is not in the old snapshot
    const created = product('20', { title: 'X' }, '7')
    const claims = new Map([claim(created, { origin: 'delta', storeId: '7' })])
    // Act
    const withOld = finalizeChanges([], claims, new Set(), true)
    // Assert
    expect(withOld.map(change => [change.kind, change.sourceId, change.storeId])).toEqual([['GONE', '20', '7']])
  })

  it('does not retire again a document retired by a previous delta run', () => {
    // Arrange
    const removed = product('3', { title: 'C' })
    const claims = new Map([claim(removed, { origin: 'delta', sourceChecksum: RETIRED_CHECKSUM })])
    // Act
    const result = diffStore('7', [removed], [], claims, new Set())
    // Assert
    expect(result).toEqual({ changes: [], unchanged: 1 })
  })

  it('turns a move between stores into one update of the same document', () => {
    // Arrange
    const oldCopy = product('9', { tenant: 'a' }, '1'), newCopy = product('9', { tenant: 'b' }, '2')
    const claims = new Map([claim(oldCopy)])
    // Act
    const changes = reconcileMoves([
      ...diffStore('1', [oldCopy], [], claims, new Set()).changes,
      ...diffStore('2', [], [newCopy], claims, new Set()).changes,
    ])
    // Assert
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'CHANGED', storeId: '2', movedFrom: '1', target: { id: 't9' } })
  })
})

describe('[TC-F42-DELTA-04] Parity gate', () => {
  it('passes when only quote-fixed rows differ from the ledger', () => {
    // Arrange
    const ok = product('1', { slug: 'a' }), fixed = product('2', { slug: '-1' })
    const gate = new ParityGate(new Map([claim(ok), claim(fixed, { sourceChecksum: checksum({ slug: "'-1" }) })]), [{ table: 'products', row: 2, id: '2', column: 'slug' }])
    // Act
    gate.check('7', [ok, fixed])
    // Assert
    expect(gate.result()).toMatchObject({ passed: true, matched: 1, explainedByQuoteFix: 1, unexplained: 0 })
  })

  it('maps renamed ledger entities back to their PW1 table', () => {
    // Arrange
    const media = { ...product('1187', { alt: 'x' }), ref: '@media:medias:1187', collection: 'media' as const, sourceEntity: 'media' }
    const thumb = { ...product('2464', { alt: 'y' }), ref: '@media:blog_posts:2464', collection: 'media' as const, sourceEntity: 'blog_post_thumbnail' }
    const gate = new ParityGate(new Map([claim(media, { sourceChecksum: 'old' }), claim(thumb, { sourceChecksum: 'old' })]),
      [{ table: 'medias', row: 1, id: '1187', column: 'name' }, { table: 'blog_posts', row: 2, id: '2464', column: 'title' }])
    // Act
    gate.check('1205', [media, thumb])
    // Assert
    expect(gate.result()).toMatchObject({ passed: true, explainedByQuoteFix: 2, unexplained: 0 })
  })

  it('fails on any other mismatch or on an imported row that is not rebuilt', () => {
    // Arrange
    const drift = product('1', { slug: 'a' }), lost = product('3', { slug: 'c' })
    const gate = new ParityGate(new Map([claim(drift, { sourceChecksum: 'other' }), claim(lost)]), [])
    // Act
    gate.check('7', [drift])
    // Assert
    expect(gate.result()).toMatchObject({ passed: false, unexplained: 1, missingFromRebuild: 1 })
  })
})

describe('[TC-F42-DELTA-06] New snapshot vs ledger checksums (no --old)', () => {
  it('classifies against the ledger and finds vanished claims', () => {
    // Arrange
    const same = product('1', { title: 'A' }), edited = product('2', { title: 'B2' }), added = product('4', { title: 'D' })
    const removed = product('3', { title: 'C' }), retired = product('5', { title: 'E' })
    const claims = new Map([
      claim(same), claim(edited, { sourceChecksum: checksum({ title: 'B' }) }), claim(removed),
      claim(retired, { origin: 'delta', sourceChecksum: RETIRED_CHECKSUM, storeId: '7' }),
    ])
    // Act
    const { changes, unchanged } = diffStore('7', null, [same, edited, added], claims, new Set())
    const gone = ledgerGone(claims, new Set([same, edited, added].map(entity => ledgerKey(entity.sourceEntity, entity.sourceId))))
    // Assert
    expect(unchanged).toBe(1)
    expect(changes.map(change => [change.kind, change.sourceId])).toEqual([['CHANGED', '2'], ['NEW', '4']])
    expect(changes[0]).toMatchObject({ target: { id: 't2' }, oldChecksum: checksum({ title: 'B' }) })
    expect(gone).toHaveLength(1)
    expect(gone[0]).toMatchObject({ kind: 'GONE', sourceId: '3', storeId: '', target: { collection: 'products', id: 't3' } })
  })

  it('takes the store of a vanished store-level document from its own id', () => {
    // Arrange
    const claims = new Map<string, LedgerClaim>([[ledgerKey('stores', '42'), { targetCollection: 'tenants', targetId: '9', sourceChecksum: 'c', targetChecksum: null, origin: 'import' }]])
    // Act
    const [gone] = ledgerGone(claims, new Set())
    // Assert
    expect(gone).toMatchObject({ storeId: '42', collection: 'tenants', target: { id: '9' } })
  })

  it('blocks mass changes but does not count quote-prefix fixes', () => {
    // Arrange
    const change = (quoteFix: boolean): EntityChange => ({ kind: 'CHANGED', storeId: '7', collection: 'products', ref: 'r', sourceEntity: 'products', sourceId: '1',
      oldChecksum: 'a', newChecksum: 'b', fields: [], target: null, ...(quoteFix ? { quoteFix: true as const } : {}) })
    // Act
    const fixesOnly = massChange([change(true), change(true), change(true)], 40)
    const tooMany = massChange([change(false), change(false), change(false)], 40)
    // Assert
    expect(fixesOnly).toMatchObject({ count: 0, limit: 2, exceeded: false })
    expect(tooMany).toMatchObject({ count: 3, limit: 2, exceeded: true })
  })

  it('uses a tighter limit for removals', () => {
    // Arrange
    const gone: EntityChange = { kind: 'GONE', storeId: '7', collection: 'products', ref: 'r', sourceEntity: 'products', sourceId: '1',
      oldChecksum: 'a', newChecksum: null, fields: [], target: null }
    // Act
    const result = massChange([gone, gone, gone], 200)
    // Assert
    expect(result).toEqual({ count: 3, limit: 10, gone: 3, goneLimit: 2, exceeded: true })
  })
})

describe('[TC-F42-DELTA-07] PW1 password changes (with --old)', () => {
  it('lists migrated users whose PW1 credential changed', () => {
    // Arrange
    const before = new Map([['1', { key_string: 'k1', passwordHash: 'h1' }], ['2', { key_string: 'k2', passwordHash: 'h2' }], ['3', { key_string: 'k3', passwordHash: 'h3' }]])
    const after = new Map([['1', { key_string: 'k1', passwordHash: 'h1' }], ['2', { key_string: 'k2b', passwordHash: 'h2b' }], ['3', { key_string: 'k3b', passwordHash: 'h3b' }], ['4', { key_string: 'k4', passwordHash: 'h4' }]])
    const claims = new Map<string, LedgerClaim>([
      [ledgerKey('users', '1'), { targetCollection: 'users', targetId: '11', sourceChecksum: 'c', targetChecksum: null, origin: 'import' }],
      [ledgerKey('users', '2'), { targetCollection: 'users', targetId: '12', sourceChecksum: 'c', targetChecksum: null, origin: 'import' }],
    ])
    // Act
    const changes = changedPasswords(before, after, claims)
    // Assert: user 3 is not migrated, user 4 is new (gets its password on create)
    expect(changes).toEqual([{ sourceId: '2', targetId: 12 }])
  })

  it('writes a credential only when it is new and the PW2 user was not changed', () => {
    // Arrange
    const live = { salt: 's1', updatedAt: '2026-09-18T00:00:00.000Z' }
    // Act + Assert
    expect(passwordDecision({ fingerprint: 'f2', synced: null, live, projectionUpdatedAt: '2026-09-18T00:00:00Z' })).toEqual({ write: true })
    expect(passwordDecision({ fingerprint: 'f2', synced: { fingerprint: 'f2', salt: 's1' }, live, projectionUpdatedAt: null }))
      .toMatchObject({ write: false, outcome: 'skipped', code: 'ALREADY_SYNCED' })
    expect(passwordDecision({ fingerprint: 'f3', synced: { fingerprint: 'f2', salt: 's0' }, live, projectionUpdatedAt: null }))
      .toMatchObject({ write: false, outcome: 'conflict', code: 'PW2_PASSWORD_CHANGED' })
    expect(passwordDecision({ fingerprint: 'f3', synced: { fingerprint: 'f2', salt: 's1' }, live, projectionUpdatedAt: null })).toEqual({ write: true })
    expect(passwordDecision({ fingerprint: 'f2', synced: null, live, projectionUpdatedAt: '2026-09-10T00:00:00Z' }))
      .toMatchObject({ write: false, outcome: 'conflict', code: 'PW2_EDITED_CONFLICT' })
    expect(passwordDecision({ fingerprint: 'f2', synced: null, live, projectionUpdatedAt: null }))
      .toMatchObject({ write: false, outcome: 'conflict', code: 'PROJECTION_MISSING' })
  })
})
