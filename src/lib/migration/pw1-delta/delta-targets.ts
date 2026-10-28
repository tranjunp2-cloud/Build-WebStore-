/**
 * Resolves PW1 refs to PW2 ids (ledger claims, external creator bindings, documents created in this run)
 * and loads user credentials from the new snapshot's users CSV for password migration.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { sourceKey, type Entity } from '../pw1-json/projection'
import type { CollectionName, SourceCredential } from '../pw1-json/types'
import { snapshotTableName } from './csv-normalize'
import { ledgerKey, type LedgerClaim } from './ledger-lookup'

export class TargetResolver {
  /** Documents created by this run, committed stores only. */
  readonly created = new Map<string, number>()

  constructor(private readonly claims: ReadonlyMap<string, LedgerClaim>, private readonly external: ReadonlyMap<string, string>) {}

  lookup(ref: string, collection: string, pending?: ReadonlyMap<string, number>): number | undefined {
    const local = pending?.get(ref) ?? this.created.get(ref)
    if (local !== undefined) return local
    try {
      const key = sourceKey(ref, collection as CollectionName)
      const claim = this.claims.get(ledgerKey(key.sourceEntity, key.sourceId))
      if (claim) return Number(claim.targetId)
    } catch { /* not a source-keyed ref (e.g. external actor); fall through */ }
    const external = this.external.get(ref)
    return external === undefined ? undefined : Number(external)
  }

  /** Target map for `resolveData`, covering the entity itself and every relationship it holds. */
  targetsFor(entity: Entity, pending?: ReadonlyMap<string, number>): Map<string, number> {
    const targets = new Map<string, number>()
    for (const ref of [{ ref: entity.ref, collection: entity.collection }, ...entity.refs]) {
      const id = this.lookup(ref.ref, ref.collection, pending)
      if (id !== undefined) targets.set(ref.ref, id)
    }
    return targets
  }
}

/** `id → {key_string, bcrypt hash}` from the users CSV, the same fields the original import sealed. */
export async function loadUserCredentials(csvDir: string, files: string[]): Promise<Map<string, SourceCredential>> {
  const file = files.find(name => snapshotTableName(name)?.table === 'users')
  if (!file) return new Map()
  const rows = parse(await readFile(path.join(csvDir, file), 'utf8'), { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[]
  return new Map(rows.map(row => [row.id, { key_string: row.key_string || null, ...(row.password ? { passwordHash: row.password } : {}) }]))
}
