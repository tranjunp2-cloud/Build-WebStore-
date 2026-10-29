/**
 * Early, readable checks on the two CSV snapshots before any heavy export work starts.
 * The exporter validates again; these guards exist so the person who exported the files gets a clear reason.
 */
import { readFile, statfs } from 'node:fs/promises'
import { ARCHIVE_TABLES } from '../pw1-export/source-registry'
import type { CsvTableStats } from './csv-normalize'

export interface GuardIssue { code: string; side?: 'old' | 'new'; table?: string; detail: string }

const MIN_FREE_BYTES = 20 * 1024 ** 3
const ROW_DROP_MIN_ROWS = 100
const ROW_DROP_RATIO = 0.9

export async function requiredTables(profilePath: string): Promise<string[]> {
  const profile = JSON.parse(await readFile(profilePath, 'utf8')) as { requiredTables?: unknown }
  if (!Array.isArray(profile.requiredTables) || profile.requiredTables.some(table => typeof table !== 'string'))
    throw new Error('INVALID_SOURCE_PROFILE')
  return profile.requiredTables as string[]
}

function sideIssues(side: 'old' | 'new', stats: CsvTableStats[], unrecognized: string[], required: string[]): GuardIssue[] {
  const issues: GuardIssue[] = []
  for (const file of unrecognized)
    issues.push({ code: 'INPUT_FILENAME_INVALID', side, detail: `${file} must be named <table>_<YYYYMMDD[HHMM[SS]]>.csv at the top level` })
  const dates = new Set(stats.map(table => table.date))
  if (dates.size > 1) issues.push({ code: 'INPUT_MIXED_DATES', side, detail: `files carry several dates: ${[...dates].join(', ')}` })
  const seen = new Set<string>()
  for (const table of stats) {
    if (seen.has(table.table)) issues.push({ code: 'INPUT_TABLE_DUPLICATE', side, table: table.table, detail: 'more than one file for this table' })
    seen.add(table.table)
    if (!required.includes(table.table)) issues.push({ code: 'INPUT_TABLE_UNEXPECTED', side, table: table.table, detail: `${table.file} is not in the profile` })
  }
  for (const table of required)
    if (!seen.has(table)) issues.push({ code: 'INPUT_TABLE_MISSING', side, table, detail: 'required by the profile' })
  return issues
}

/**
 * Checks the new snapshot (and, when given, compares it with the imported one); returns every issue
 * instead of stopping at the first. Without the old snapshot only the per-file checks run.
 */
export function snapshotIssues(
  old: { tables: CsvTableStats[]; unrecognized: string[] } | null,
  next: { tables: CsvTableStats[]; unrecognized: string[] },
  required: string[],
): GuardIssue[] {
  const issues = sideIssues('new', next.tables, next.unrecognized, required)
  if (!old) return issues
  issues.unshift(...sideIssues('old', old.tables, old.unrecognized, required))
  const before = new Map(old.tables.map(table => [table.table, table]))
  for (const table of next.tables) {
    const prior = before.get(table.table)
    if (!prior) continue
    if (prior.headers.join('\u0000') !== table.headers.join('\u0000')) {
      const added = table.headers.filter(name => !prior.headers.includes(name))
      const removed = prior.headers.filter(name => !table.headers.includes(name))
      issues.push({ code: 'INPUT_HEADER_CHANGED', side: 'new', table: table.table, detail: `added [${added.join(', ')}] removed [${removed.join(', ')}]` })
    }
    if (table.duplicateIds > prior.duplicateIds || table.emptyIds > prior.emptyIds)
      issues.push({ code: 'INPUT_ID_INVALID', side: 'new', table: table.table, detail: `${table.duplicateIds} duplicate / ${table.emptyIds} empty ids` })
    // Archive tables are kept as evidence only and never reach PW2, so a drop there cannot lose PW2 data.
    if (!ARCHIVE_TABLES.has(table.table) && prior.rowCount > ROW_DROP_MIN_ROWS && table.rowCount < prior.rowCount * ROW_DROP_RATIO)
      issues.push({ code: 'INPUT_ROWCOUNT_DROP', side: 'new', table: table.table, detail: `${prior.rowCount} → ${table.rowCount} rows (file truncated?)` })
  }
  return issues
}

export async function diskIssues(directory: string): Promise<GuardIssue[]> {
  const stats = await statfs(directory)
  const free = Number(stats.bavail) * Number(stats.bsize)
  return free < MIN_FREE_BYTES
    ? [{ code: 'DISK_SPACE_LOW', detail: `${(free / 1024 ** 3).toFixed(1)} GB free in ${directory}; need ≥ 20 GB` }]
    : []
}

export function formatIssues(issues: GuardIssue[]): string {
  return issues.map(issue => `- ${issue.code}${issue.side ? ` [${issue.side}]` : ''}${issue.table ? ` ${issue.table}` : ''}: ${issue.detail}`).join('\n')
}
