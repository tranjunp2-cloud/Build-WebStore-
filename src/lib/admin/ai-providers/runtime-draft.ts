/** Draft of the Runtime page. Numbers are typed as text; "...Ms" knobs are shown in seconds. */
import { MAX_REQUEST_MS, type RuntimeKey, type RuntimeValue, type RuntimeView, type SettingsView } from './types'

export interface RuntimeEntry {
  value: string | boolean
  /** go back to the environment / default */
  reset: boolean
}
export type RuntimeDraft = Partial<Record<RuntimeKey, RuntimeEntry>>

const isMs = (key: string): boolean => key.endsWith('Ms')

export function unitOf(row: RuntimeView): string {
  if (row.type !== 'int') return ''
  if (isMs(row.key)) return 's'
  return row.key === 'threadRetentionDays' ? 'days' : ''
}

const toField = (row: RuntimeView, value: RuntimeValue): string | boolean =>
  typeof value === 'boolean' ? value : row.type === 'int' && isMs(row.key) ? String(Number(value) / 1000) : String(value)

const fromField = (row: RuntimeView, value: string | boolean): RuntimeValue => {
  if (row.type === 'bool') return Boolean(value)
  if (row.type === 'enum') return String(value)
  return isMs(row.key) ? Math.round(Number(value) * 1000) : Number(value)
}

export function runtimeDraftFromView(view: SettingsView): RuntimeDraft {
  return Object.fromEntries(view.runtime.map((row) => [row.key, { value: toField(row, row.value), reset: false }])) as RuntimeDraft
}

/** Display text of a value, with its unit. */
export function fmtRuntime(row: RuntimeView, value: RuntimeValue): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (row.type === 'enum') return String(value)
  const unit = unitOf(row)
  const shown = isMs(row.key) ? Number(value) / 1000 : Number(value)
  return `${shown.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`
}

function entryValue(row: RuntimeView, entry: RuntimeEntry | undefined): RuntimeValue {
  if (!entry) return row.value
  if (entry.reset) return row.default
  return fromField(row, entry.value)
}

export function runtimeChanges(view: SettingsView, draft: RuntimeDraft): string[] {
  const lines: string[] = []
  for (const row of view.runtime) {
    const entry = draft[row.key]
    if (!entry) continue
    if (entry.reset) {
      if (row.source === 'studio') lines.push(`${row.label}: ${fmtRuntime(row, row.value)} → back to environment or default`)
      continue
    }
    const next = fromField(row, entry.value)
    if (next !== row.value && !Number.isNaN(next)) lines.push(`${row.label}: ${fmtRuntime(row, row.value)} → ${fmtRuntime(row, next)}`)
  }
  return lines
}

/** key → sentence for each invalid value; the two time knobs share one request, so they also fail together. */
export function runtimeProblems(view: SettingsView, draft: RuntimeDraft): Partial<Record<RuntimeKey, string>> {
  const out: Partial<Record<RuntimeKey, string>> = {}
  const num = (key: RuntimeKey): number | null => {
    const row = view.runtime.find((item) => item.key === key)
    return row && row.type === 'int' ? Number(entryValue(row, draft[key])) : null
  }
  for (const row of view.runtime) {
    const entry = draft[row.key]
    if (row.type !== 'int' || !entry || entry.reset) continue
    const text = String(entry.value).trim()
    const value = Number(text)
    const min = row.min ?? 0
    if (!/^\d+(\.\d+)?$/.test(text) || (isMs(row.key) ? !Number.isInteger(value * 1000) : !Number.isInteger(value))) out[row.key] = 'Enter a whole number.'
    else if (value < (isMs(row.key) ? min / 1000 : min)) out[row.key] = `At least ${fmtRuntime(row, min)}.`
    else if (row.max !== undefined && value > (isMs(row.key) ? row.max / 1000 : row.max)) out[row.key] = `At most ${fmtRuntime(row, row.max)}.`
  }
  const wait = num('queueMaxWaitMs')
  const budget = num('runBudgetMs')
  if (wait !== null && budget !== null && !out.queueMaxWaitMs && !out.runBudgetMs && wait + budget > MAX_REQUEST_MS) {
    const message = `Queue wait + answer time must stay under ${MAX_REQUEST_MS / 1000} s (now ${Math.round((wait + budget) / 1000)} s), or Vercel stops the request.`
    out.queueMaxWaitMs = message
    out.runBudgetMs = message
  }
  return out
}

export function runtimeBody(view: SettingsView, draft: RuntimeDraft): { values: Record<string, RuntimeValue | null> } {
  const values: Record<string, RuntimeValue | null> = {}
  for (const row of view.runtime) {
    const entry = draft[row.key]
    if (entry?.reset) values[row.key] = null
    else if (entry) {
      const next = fromField(row, entry.value)
      values[row.key] = next !== row.value ? next : row.source === 'studio' ? row.value : null
    } else values[row.key] = row.source === 'studio' ? row.value : null
  }
  return { values }
}

export const RUNTIME_GROUPS: ReadonlyArray<{ title: string; keys: readonly RuntimeKey[] }> = [
  { title: 'Run limits', keys: ['runsPerDayPerShop', 'tasksPerDayPerShop', 'runsPerMinutePerUser', 'maxRunningPerUser', 'maxRunningPerShop', 'queueMaxWaitMs'] },
  { title: 'Model calls', keys: ['modelTimeoutMs', 'runBudgetMs'] },
  { title: 'Copilot', keys: ['threadRetentionDays', 'suggestMode', 'toolRouting', 'logRequests'] },
]

const OPTION_LABEL: Record<string, string> = {
  rules: 'Rules first', model: 'Always model', off: 'Off', all: 'All', errors: 'Errors and slow', on: 'On',
}
export const optionLabel = (option: string): string => OPTION_LABEL[option] ?? option.charAt(0).toUpperCase() + option.slice(1)

/** Knobs the platform lists that no group names still show, last. */
export function groupRuntime(view: SettingsView): Array<{ title: string; rows: RuntimeView[] }> {
  const named = new Set<string>(RUNTIME_GROUPS.flatMap((group) => group.keys))
  const groups = RUNTIME_GROUPS.map((group) => ({ title: group.title, rows: group.keys.map((key) => view.runtime.find((row) => row.key === key)).filter((row): row is RuntimeView => Boolean(row)) }))
  const other = view.runtime.filter((row) => !named.has(row.key))
  return [...groups, ...(other.length ? [{ title: 'Other', rows: other }] : [])].filter((group) => group.rows.length > 0)
}

/** The entry after "Reset to default". */
export const resetEntry = (row: RuntimeView): RuntimeEntry => ({ value: toField(row, row.default), reset: true })

/** The typed value differs from the value in force (a half-typed number counts as unchanged). */
export function isEdited(row: RuntimeView, entry: RuntimeEntry): boolean {
  if (entry.reset) return false
  const next = fromField(row, entry.value)
  return !Number.isNaN(next) && next !== row.value
}
