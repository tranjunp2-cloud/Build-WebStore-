/**
 * Copies a PW1 CSV snapshot while removing the spreadsheet "formula guard" quote that the dump tool
 * prepends to values starting with = + - @ (e.g. `'+6012…`, `'-1`). Every other byte is preserved, so the
 * exporter sees exactly the original values except for those cells.
 * The same pass collects headers, row counts and id statistics used by the input guards.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { discoverCsvFiles } from '../pw1-export/csv-loader'

const GUARDED = new Set(['=', '+', '-', '@'])
const SNAPSHOT_NAME = /^(.*)_(\d{8}(?:\d{4}|\d{6})?)\.csv$/i

export interface CsvFix { table: string; row: number; id: string | null; column: string }
export interface CsvTableStats {
  table: string; file: string; date: string; headers: string[]; rowCount: number; duplicateIds: number; emptyIds: number
}
export interface NormalizedText { text: string; headers: string[]; rowCount: number; duplicateIds: number; emptyIds: number; fixes: Omit<CsvFix, 'table'>[] }

/** Table name and snapshot date from `<table>_<YYYYMMDD[HHMM[SS]]>.csv`; null when the name does not follow it. */
export function snapshotTableName(file: string): { table: string; date: string } | null {
  const match = SNAPSHOT_NAME.exec(path.basename(file))
  if (!match) return null
  return { table: match[1] === '_attributes_' ? 'attributes' : match[1], date: match[2].slice(0, 8) }
}

/** RFC 4180 scan (delimiter `,`, quote/escape `"`), matching the exporter's csv-parse settings. */
export function normalizeCsvText(text: string, stripQuotes = true): NormalizedText {
  const pieces: string[] = [], fixes: NormalizedText['fixes'] = [], headers: string[] = [], ids = new Set<string>()
  let last = 0, i = text.charCodeAt(0) === 0xfeff ? 1 : 0, row = 0, col = 0, inQuotes = false, fieldStart = true
  let value = '', rowId: string | null = null, rowFixes: number[] = [], idCol = -1, duplicateIds = 0, emptyIds = 0
  const keep = () => row === 0 || col === idCol
  const endField = () => {
    if (row === 0) headers.push(value)
    else if (col === idCol) rowId = value
    value = ''; col++
  }
  const endRow = () => {
    if (row === 0) idCol = headers.indexOf('id')
    else {
      for (const fixed of rowFixes) fixes.push({ row, id: rowId, column: headers[fixed] ?? String(fixed) })
      if (idCol >= 0) {
        if (!rowId) emptyIds++
        else if (ids.has(rowId)) duplicateIds++
        else ids.add(rowId)
      }
    }
    row++; col = 0; rowId = null; rowFixes = []
  }
  while (i < text.length) {
    if (fieldStart) {
      fieldStart = false
      if (text[i] === '"') { inQuotes = true; i++ }
      if (stripQuotes && row > 0 && text[i] === "'" && GUARDED.has(text[i + 1])) {
        pieces.push(text.slice(last, i)); last = i + 1; i++; rowFixes.push(col)
      }
      continue
    }
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { if (keep()) value += '"'; i += 2 } else { inQuotes = false; i++ }
      } else { if (keep()) value += c; i++ }
      continue
    }
    if (c === ',') { endField(); fieldStart = true; i++ }
    else if (c === '\r' || c === '\n') {
      endField(); endRow(); fieldStart = true
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1
    } else { if (keep()) value += c; i++ }
  }
  if (inQuotes) throw new Error('CSV_UNTERMINATED_QUOTE')
  if (!(fieldStart && col === 0)) { endField(); endRow() }
  pieces.push(text.slice(last))
  return { text: pieces.join(''), headers, rowCount: Math.max(0, row - 1), duplicateIds, emptyIds, fixes }
}

/** Writes a private normalized copy of every snapshot CSV in `sourceDir` to `targetDir`. */
export async function normalizeSnapshot(sourceDir: string, targetDir: string, stripQuotes: boolean) {
  await mkdir(targetDir, { mode: 0o700 })
  const tables: CsvTableStats[] = [], fixes: CsvFix[] = [], unrecognized: string[] = []
  for (const file of await discoverCsvFiles(sourceDir)) {
    const name = snapshotTableName(file)
    if (!name || file.includes('/')) { unrecognized.push(file); continue }
    const result = normalizeCsvText(await readFile(path.join(sourceDir, file), 'utf8'), stripQuotes)
    await writeFile(path.join(targetDir, file), result.text, { mode: 0o600, flag: 'wx' })
    tables.push({ table: name.table, file, date: name.date, headers: result.headers, rowCount: result.rowCount,
      duplicateIds: result.duplicateIds, emptyIds: result.emptyIds })
    for (const fix of result.fixes) fixes.push({ table: name.table, ...fix })
  }
  return { tables, fixes, unrecognized }
}
