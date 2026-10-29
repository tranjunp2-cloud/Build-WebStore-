/**
 * Report files written to the run directory. Nothing secret is written: no credentials, no DATABASE_URI.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CompareResult } from './delta-compare'
import { countChanges } from './delta-compare'
import type { EntityChange } from './entity-diff'

export async function writeJson(runDir: string, name: string, value: unknown): Promise<void> {
  await writeFile(path.join(runDir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
}

export async function writeChanges(runDir: string, changes: EntityChange[]): Promise<void> {
  await writeFile(path.join(runDir, 'changes.jsonl'), changes.map(change => JSON.stringify(change)).join('\n') + (changes.length ? '\n' : ''), { mode: 0o600 })
}

/** Masks credentials so the summary can name the target database safely. */
export function describeTarget(uri: string | undefined): string {
  if (!uri) return '(DATABASE_URI not set)'
  try {
    const url = new URL(uri)
    return `${url.hostname}${url.port ? `:${url.port}` : ''}/${url.pathname.replace(/^\//, '')}`
  } catch { return '(unparseable DATABASE_URI)' }
}

const KINDS = ['NEW', 'NEW (recovered)', 'CHANGED', 'CHANGED (quote fix)', 'GONE']

export function changeTable(changes: EntityChange[]): string {
  const counts = countChanges(changes)
  const collections = Object.keys(counts).sort()
  if (!collections.length) return 'No changes.'
  const lines = [`| collection | ${KINDS.join(' | ')} |`, `|---|${KINDS.map(() => '---:').join('|')}|`]
  for (const collection of collections) lines.push(`| ${collection} | ${KINDS.map(kind => counts[collection][kind] ?? 0).join(' | ')} |`)
  return lines.join('\n')
}

export function summaryMarkdown(input: {
  runId: string; target: string; oldDir: string | null; newDir: string; snapshotId: string; oldAsOf: string; asOf: string
  quoteFixes: { old: number; new: number } | null; compare: CompareResult; timings: Record<string, Record<string, number>>
}): string {
  const { compare } = input
  const parity = compare.parity
  return `# PW1 delta run ${input.runId}

- Target: ${input.target}
- Old snapshot: ${input.oldDir ? `${input.oldDir} (asOf ${input.oldAsOf})` : 'not given — new snapshot compared with the import ledger checksums'}
- New snapshot: ${input.newDir} (asOf ${input.asOf})
- Imported snapshot id: ${input.snapshotId}
- Quote-prefix fixes: ${input.quoteFixes ? `old ${input.quoteFixes.old}, new ${input.quoteFixes.new}` : 'disabled (--keep-quotes)'}

${parity ? `## Parity gate: ${parity.passed ? 'PASSED' : 'FAILED'}

| checked | matched | explained by quote fix | unexplained | rebuilt but not imported | imported but not rebuilt |
|---:|---:|---:|---:|---:|---:|
| ${parity.checked} | ${parity.matched} | ${parity.explainedByQuoteFix} | ${parity.unexplained} | ${parity.unclaimed} | ${parity.missingFromRebuild} |
` : '## Parity gate: skipped (no --old)\n'}
## Changes (${compare.changes.length}; unchanged ${compare.unchanged})

Stores compared: ${compare.storesCompared}; only in old: ${compare.storesOnlyOld.length}; only in new: ${compare.storesOnlyNew.length}${compare.storesOnlyNew.length ? ` (${compare.storesOnlyNew.slice(0, 20).join(', ')})` : ''}

${changeTable(compare.changes)}

## Timings (seconds)

${Object.entries(input.timings).map(([side, steps]) => `- ${side}: ${Object.entries(steps).map(([step, ms]) => `${step} ${(ms / 1000).toFixed(0)}`).join(', ')}`).join('\n')}
`
}
