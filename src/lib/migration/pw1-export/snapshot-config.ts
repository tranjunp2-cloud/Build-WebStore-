import { readFile, lstat, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { sourceConfigSchema, parseConfig } from './source-config'
import { SOURCE_HEADERS } from './source-registry'
import { checkedFile, discoverCsvFiles } from './csv-loader'
import { ExportError } from './primitives'

const profileSchema = sourceConfigSchema.omit({ tables: true, snapshotId: true, asOf: true }).extend({
  requiredTables: z.array(z.string().refine(t => Object.hasOwn(SOURCE_HEADERS, t))).min(1)
    .refine(tables => new Set(tables).size === tables.length),
}).strict()

/** Filename dates only guard accidental mixing; snapshot identity/asOf must come from the operator. */
export async function createSnapshotConfig(options: { inputDir: string; profile: string; snapshotId: string; asOf: string; output: string }) {
  let profile: z.infer<typeof profileSchema>
  try { profile = profileSchema.parse(JSON.parse(await readFile(options.profile, 'utf8'))) }
  catch { throw new ExportError('INVALID_SOURCE_PROFILE') }
  if ((await lstat(options.inputDir)).isSymbolicLink()) throw new ExportError('SYMLINK_SOURCE')
  const root = await realpath(options.inputDir)
  const tables: Record<string, string> = Object.create(null)
  const dates = new Set<string>()
  for (const filename of await discoverCsvFiles(root)) {
    await checkedFile(root, filename)
    const match = /^(.*)_(\d{8}(?:\d{4}|\d{6})?)\.csv$/i.exec(path.basename(filename))
    if (!match) throw new ExportError('UNRECOGNIZED_SNAPSHOT_FILENAME')
    const table = match[1] === '_attributes_' ? 'attributes' : match[1]
    if (!Object.hasOwn(SOURCE_HEADERS, table) || !profile.requiredTables.includes(table)) throw new ExportError('UNEXPECTED_SNAPSHOT_TABLE')
    if (tables[table]) throw new ExportError('AMBIGUOUS_SNAPSHOT_TABLE')
    const stamp = match[2], date = stamp.slice(0, 8)
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${stamp.slice(8, 10) || '00'}:${stamp.slice(10, 12) || '00'}:${stamp.slice(12, 14) || '00'}Z`
    const parsed = new Date(iso)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== iso.replace('Z', '.000Z')) throw new ExportError('INVALID_SNAPSHOT_FILENAME_DATE')
    dates.add(date)
    tables[table] = filename
  }
  if (dates.size > 1) throw new ExportError('MIXED_SNAPSHOT_DATES')
  if (profile.requiredTables.some(table => !tables[table])) throw new ExportError('MISSING_SNAPSHOT_TABLE')
  const { requiredTables, ...settings } = profile
  const config = parseConfig(Buffer.from(JSON.stringify({ ...settings, snapshotId: options.snapshotId, asOf: options.asOf,
    tables: Object.fromEntries(requiredTables.map(table => [table, tables[table]])),
  })))
  const output = path.resolve(options.output)
  const parent = path.dirname(output)
  if (await realpath(parent) !== parent) throw new ExportError('UNSAFE_CONFIG_OUTPUT')
  const relative = path.relative(root, output)
  if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new ExportError('CONFIG_OUTPUT_INSIDE_SOURCE')
  try { await writeFile(output, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ExportError('OUTPUT_EXISTS')
    throw error
  }
  return { tableCount: requiredTables.length, filenameDate: [...dates][0], snapshotId: config.snapshotId, output, sourceValuesVerified: false }
}
