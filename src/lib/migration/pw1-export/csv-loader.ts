import type { Progress } from './progress'
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parse } from 'csv-parse'
import { ExportError } from './primitives'
import type { Row, SourceConfig } from './contracts'
import { validateMigrationPolicyScope } from './source-config'
export const hash = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex')
export interface SourceFile {
  table?: string
  filename: string
  sha256: string
  bytes: number
  selected: boolean
  rowCount: number | null
  headers: string[]
}
export interface LoadedSource {
  tables: Record<string, Row[]>
  files: SourceFile[]
  inputRoot: string
  config: SourceConfig
}
export async function checkedFile(
  root: string,
  relative: string,
): Promise<string> {
  if (
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => p === '..' || p === '') ||
    relative.includes('\\')
  )
    throw new ExportError('UNSAFE_SOURCE_PATH')
  let current = root
  for (const segment of relative.split('/')) {
    current = path.join(current, segment)
    if ((await lstat(current)).isSymbolicLink())
      throw new ExportError('SYMLINK_SOURCE')
  }
  if (!(await lstat(current)).isFile())
    throw new ExportError('SOURCE_NOT_REGULAR_FILE')
  return current
}
async function discover(root: string, prefix = ''): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) throw new ExportError('SYMLINK_SOURCE')
    if (entry.isDirectory()) result.push(...(await discover(root, name)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
      result.push(name)
  }
  return result.sort()
}
export function checkResources(config: SourceConfig) {
  if (process.memoryUsage().rss > config.maxResidentBytes)
    throw new ExportError('RESOURCE_MEMORY_LIMIT')
}
export async function loadSource(
  inputDir: string,
  config: SourceConfig,
  progress?: Progress,
): Promise<LoadedSource> {
  if ((await lstat(inputDir)).isSymbolicLink())
    throw new ExportError('SYMLINK_SOURCE')
  const root = await realpath(inputDir),
    names = await discover(root)
  const selected = new Map(
    Object.entries(config.tables).map(([t, f]) => [f, t]),
  )
  for (const file of selected.keys())
    if (!names.includes(file)) throw new ExportError('MISSING_SELECTED_FILE')
  const files: SourceFile[] = [],
    tables: Record<string, Row[]> = Object.create(null)
  let totalBytes = 0,
    totalRows = 0
  for (const filename of names) {
    progress?.({
      phase: 'read-csv',
      completed: files.length,
      total: names.length,
      table: selected.get(filename) ?? 'unselected',
    })
    const file = await checkedFile(root, filename),
      stat = await lstat(file),
      table = selected.get(filename)
    totalBytes += stat.size
    if (totalBytes > config.maxInputBytes)
      throw new ExportError('RESOURCE_INPUT_LIMIT')
    const digest = createHash('sha256'),
      rows: Row[] = []
    let headers: string[] = []
    if (table) {
      const decoder = new TextDecoder('utf-8', { fatal: true })
      const parser = parse({
        bom: true,
        cast: false,
        skip_empty_lines: false,
        relax_column_count: false,
        max_record_size: config.maxRecordBytes,
        columns: (columns: string[]) => {
          if (
            columns.some((c) => !c) ||
            new Set(columns).size !== columns.length
          )
            throw new ExportError('INVALID_CSV_HEADER')
          headers = columns
          return columns
        },
      })
      // Input decoding and hashing happen on the exact bytes parsed, with parser backpressure.
      try {
        await pipeline(
          createReadStream(file),
          async function* decode(chunks: AsyncIterable<Buffer>) {
            for await (const chunk of chunks) {
              digest.update(chunk)
              yield decoder.decode(chunk, { stream: true })
            }
            yield decoder.decode()
          },
          parser,
          async function collect(
            records: AsyncIterable<Record<string, string>>,
          ) {
            for await (const record of records) {
              totalRows++
              if (totalRows > config.maxRows)
                throw new ExportError('RESOURCE_ROW_LIMIT')
              checkResources(config)
              const row: Row = Object.create(null)
              for (const key of headers) {
                const cell = String(record[key])
                row[key] = config.nullTokens.includes(cell) ? null : cell
              }
              rows.push(row)
              if (rows.length % 10000 === 0)
                progress?.({
                  phase: 'read-csv',
                  completed: files.length,
                  total: names.length,
                  table,
                  rows: rows.length,
                })
            }
          },
        )
      } catch (error) {
        throw error instanceof ExportError
          ? error
          : new ExportError('INVALID_CSV_ENCODING_OR_STRUCTURE')
      }
      if (!headers.length) throw new ExportError('MISSING_CSV_HEADER')
      tables[table] = rows
    } else {
      for await (const chunk of createReadStream(file)) digest.update(chunk)
    }
    progress?.({
      phase: 'read-csv-done',
      completed: files.length + 1,
      total: names.length,
      table: table ?? 'unselected',
      rows: rows.length,
      bytes: stat.size,
    })
    files.push({
      ...(table ? { table } : {}),
      filename,
      sha256: digest.digest('hex'),
      bytes: stat.size,
      selected: !!table,
      rowCount: table ? rows.length : null,
      headers,
    })
  }
  if (!tables.stores) throw new ExportError('MISSING_STORES_TABLE')
  validateMigrationPolicyScope(config, tables)
  return { tables, files, inputRoot: root, config }
}
export async function verifySource(source: LoadedSource, progress?: Progress) {
  const names = await discover(source.inputRoot)
  const previous = new Set(source.files.map((f) => f.filename))
  const changed = names
    .filter((n) => !previous.has(n))
    .concat(
      source.files
        .filter((f) => !names.includes(f.filename))
        .map((f) => f.filename),
    )
  for (const name of changed) {
    if (source.files.some((f) => f.selected && f.filename === name))
      throw new ExportError('SOURCE_INVENTORY_CHANGED')
    // Only identifiable alternative snapshots are nonfatal; a new unknown table changes coverage.
    const match = /^(.*)_\d{12,14}\.csv$/.exec(name)
    const table = match?.[1] === '_attributes_' ? 'attributes' : match?.[1]
    if (!table || !Object.hasOwn(source.config.tables, table))
      throw new ExportError('SOURCE_INVENTORY_CHANGED')
  }
  let unselectedContentChanged = false
  let verified = 0
  for (const file of source.files.filter(
    (f) => f.selected || names.includes(f.filename),
  )) {
    progress?.({
      phase: 'verify-source',
      completed: verified++,
      total: source.files.length,
    })
    const p = await checkedFile(source.inputRoot, file.filename),
      digest = createHash('sha256')
    for await (const chunk of createReadStream(p)) digest.update(chunk)
    if (digest.digest('hex') !== file.sha256) {
      if (file.selected) throw new ExportError('SOURCE_CHANGED_DURING_EXPORT')
      unselectedContentChanged = true
    }
  }
  progress?.({ phase: 'verify-source', completed: verified, total: verified })
  return [
    ...(changed.length ? ['UNSELECTED_SNAPSHOT_INVENTORY_CHANGED'] : []),
    ...(unselectedContentChanged
      ? ['UNSELECTED_SNAPSHOT_CONTENT_CHANGED']
      : []),
  ]
}
export async function readConfigFile(filename: string) {
  if ((await lstat(filename)).isSymbolicLink())
    throw new ExportError('SYMLINK_CONFIG')
  return readFile(filename)
}
