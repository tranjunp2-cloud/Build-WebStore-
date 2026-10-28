/**
 * CLI options for `migrate:pw1:delta`.
 * Every path is a parameter: the delta runs on environments other than the one that did the original import.
 */
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

export const DEFAULT_AS_OF = '2026-09-18T00:00:00Z'
export const DEFAULT_PROFILE = 'configs/migration/pw1-prod-profile.json'

export interface DeltaOptions {
  /** Imported snapshot; optional. When given, the parity gate re-proves the import before comparing. */
  oldDir: string | null
  newDir: string
  asOf: string
  oldAsOf: string
  profile: string
  out: string
  runId: string
  yes: boolean
  keepQuotes: boolean
  stores: string[]
  allowMassChange: boolean
  help: boolean
}

export const HELP = `PW1 → PW2 delta migration (changes since the imported CSV snapshot)

  npm run migrate:pw1:delta -- --new <csv-dir-latest> [options]

Required env: DATABASE_URI (PW2 target, already imported). PW1_APP_KEY is needed when applying new users.
The new snapshot is compared with the checksums the import recorded in its ledger.
Options:
  --old <dir>       imported CSV snapshot: re-checks that it reproduces the import (parity gate, ~22 min more)
                    and reports which fields changed; recommended once per environment before release
  --allow-mass-change  apply even when changes exceed 5% (or removals 1%) of imported documents
  --as-of <ISO>     lifecycle reference time for the new snapshot (default ${DEFAULT_AS_OF}, same as the original import)
  --profile <file>  exporter profile (default ${DEFAULT_PROFILE})
  --out <dir>       run directory (default .migration/delta-runs/<run-id>); inside the repo it must be under .migration/
                    CSV copies (they hold PW1 password data) and rebuilt artifacts are deleted when the run ends
  --store <ids>     comma-separated store ids: report AND apply only these stores (rehearsal)
  --keep-quotes     do not strip the spreadsheet quote prefix ('= '+ '- '@)
  --yes             apply without the interactive confirmation
`

export class DeltaError extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
  }
}

function isoOrThrow(value: string, flag: string): string {
  const time = Date.parse(value)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(time)) throw new DeltaError('INVALID_AS_OF', `${flag}=${value}`)
  return value
}

export function parseDeltaOptions(argv: string[], cwd = process.cwd()): DeltaOptions {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      old: { type: 'string' }, new: { type: 'string' }, 'as-of': { type: 'string' }, profile: { type: 'string' },
      out: { type: 'string' }, store: { type: 'string' }, 'keep-quotes': { type: 'boolean' }, yes: { type: 'boolean' },
      'allow-mass-change': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  })
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const base = {
    asOf: isoOrThrow(values['as-of'] ?? DEFAULT_AS_OF, '--as-of'),
    oldAsOf: DEFAULT_AS_OF,
    profile: path.resolve(cwd, values.profile ?? DEFAULT_PROFILE),
    out: path.resolve(cwd, values.out ?? path.join('.migration', 'delta-runs', runId)),
    runId,
    yes: Boolean(values.yes),
    keepQuotes: Boolean(values['keep-quotes']),
    stores: values.store ? values.store.split(',').map(id => id.trim()).filter(Boolean) : [],
    allowMassChange: Boolean(values['allow-mass-change']),
    help: Boolean(values.help),
  }
  if (base.help) return { ...base, oldDir: null, newDir: '' }
  if (!values.new) throw new DeltaError('MISSING_ARGUMENT', '--new is required')
  return { ...base, oldDir: values.old ? path.resolve(cwd, values.old) : null, newDir: path.resolve(cwd, values.new) }
}
