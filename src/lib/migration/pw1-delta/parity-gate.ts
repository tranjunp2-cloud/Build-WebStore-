/**
 * Parity gate: entities rebuilt from the imported CSV must carry the exact checksum the original import
 * recorded in its ledger. The only accepted differences are rows where the spreadsheet quote prefix was
 * stripped. Any other mismatch means the delta cannot reproduce the import, so nothing may be written.
 */
import type { Entity } from '../pw1-json/projection'
import type { CsvFix } from './csv-normalize'
import { ledgerKey, type LedgerClaim } from './ledger-lookup'

/** Ledger source entity → PW1 table, where `sourceKey` renames it (see pw1-json/projection.ts). */
const SOURCE_TABLES: Record<string, string[]> = {
  sites: ['stores'], stores: ['stores'], store_logo: ['stores'], store_favicon: ['stores'],
  media: ['medias'], blog_post_thumbnail: ['blog_posts'],
}

/** `<table>\0<id>` keys of the CSV rows whose quote prefix was stripped. */
export function quoteFixedRows(fixes: CsvFix[]): Set<string> {
  return new Set(fixes.map(fix => `${fix.table}\u0000${fix.id ?? ''}`))
}

/** True when the entity was built from a row whose quote prefix was stripped. */
export function isQuoteFixed(rows: ReadonlySet<string>, entity: Pick<Entity, 'sourceEntity' | 'sourceId'>): boolean {
  return (SOURCE_TABLES[entity.sourceEntity] ?? [entity.sourceEntity]).some(table => rows.has(`${table}\u0000${entity.sourceId}`))
}

export interface ParitySample { storeId: string; ref: string; sourceEntity: string; sourceId: string; ledger: string; rebuilt: string }

export class ParityGate {
  private readonly fixed: Set<string>
  private readonly seen = new Set<string>()
  checked = 0
  matched = 0
  unclaimed = 0
  explained: ParitySample[] = []
  unexplained: ParitySample[] = []

  constructor(private readonly claims: ReadonlyMap<string, LedgerClaim>, fixes: CsvFix[]) {
    this.fixed = quoteFixedRows(fixes)
  }

  check(storeId: string, entities: Entity[]): void {
    for (const entity of entities) {
      const key = ledgerKey(entity.sourceEntity, entity.sourceId)
      this.checked++
      this.seen.add(key)
      const claim = this.claims.get(key)
      if (!claim || claim.origin !== 'import') { this.unclaimed++; continue }
      if (claim.sourceChecksum === entity.sourceChecksum) { this.matched++; continue }
      const sample = { storeId, ref: entity.ref, sourceEntity: entity.sourceEntity, sourceId: entity.sourceId, ledger: claim.sourceChecksum, rebuilt: entity.sourceChecksum }
      ;(isQuoteFixed(this.fixed, entity) ? this.explained : this.unexplained).push(sample)
    }
  }

  /** Imported documents that the rebuilt snapshot no longer produces at all. */
  missingFromRebuild(): string[] {
    const missing: string[] = []
    for (const [key, claim] of this.claims) if (claim.origin === 'import' && !this.seen.has(key)) missing.push(key.replace('\u0000', ':'))
    return missing
  }

  result() {
    const missing = this.missingFromRebuild()
    return {
      passed: this.unexplained.length === 0 && missing.length === 0,
      checked: this.checked, matched: this.matched, unclaimed: this.unclaimed,
      explainedByQuoteFix: this.explained.length, unexplained: this.unexplained.length, missingFromRebuild: missing.length,
      samples: { explained: this.explained.slice(0, 50), unexplained: this.unexplained.slice(0, 50), missingFromRebuild: missing.slice(0, 50) },
    }
  }
}
