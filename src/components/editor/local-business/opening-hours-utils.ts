import { DAY_OF_WEEK_OPTIONS } from '@/lib/seo/local-business-constants'
import type { OpeningHourRow } from './types'

export type OpeningHoursMode = 'custom' | 'open24h' | 'closed'
export interface TimeRange { opens: string; closes: string }
export interface DayGroup { day: string; rows: OpeningHourRow[] }

const DAY_ORDER = DAY_OF_WEEK_OPTIONS.map(o => o.value)
const DEFAULT_CLOSED_DAYS = new Set(['Sa', 'Su'])

function sortRows(a: OpeningHourRow, b: OpeningHourRow): number {
    const ai = DAY_ORDER.indexOf(a.dayOfWeek || '')
    const bi = DAY_ORDER.indexOf(b.dayOfWeek || '')
    if (ai !== bi) return ai - bi
    return (a.opens || '').localeCompare(b.opens || '')
}

/** Groups the flat rows array by day, preserving Mo-Su order. Within a day,
 *  rows are sorted by `opens` ascending (stable order for split-shift display). */
export function groupRowsByDay(rows: OpeningHourRow[] | undefined): DayGroup[] {
    const list = rows || []
    return DAY_OF_WEEK_OPTIONS.map(({ value: day }) => ({
        day,
        rows: list.filter(r => r.dayOfWeek === day).sort(sortRows),
    }))
}

/** Infers the modal's initial mode + time ranges from a single day's existing rows
 *  (pre-fill source for the edit-pencil and quick-actions). */
export function rangesFromDay(rows: OpeningHourRow[]): { mode: OpeningHoursMode; ranges: TimeRange[] } {
    if (rows.length === 0) return { mode: 'custom', ranges: [] }
    if (rows.every(r => r.isClosed)) return { mode: 'closed', ranges: [] }
    if (rows.length === 1 && rows[0].opens === '00:00' && rows[0].closes === '23:59') {
        return { mode: 'open24h', ranges: [] }
    }
    const ranges = rows
        .filter(r => !r.isClosed && r.opens && r.closes)
        .map(r => ({ opens: r.opens!, closes: r.closes! }))
    return { mode: 'custom', ranges }
}

/** A range is invalid only once BOTH times are filled in and closes <= opens
 *  (overnight ranges, e.g. 21:00-02:00, are not supported — closes must be later
 *  than opens on the same day). Incomplete ranges (either field still empty while
 *  typing) are treated as not-yet-invalid so the Save button isn't blocked mid-entry. */
export function isRangeOrderValid(range: TimeRange): boolean {
    if (!range.opens || !range.closes) return true
    return range.closes > range.opens
}

function encodeDay(day: string, mode: OpeningHoursMode, ranges: TimeRange[]): OpeningHourRow[] {
    if (mode === 'closed') return [{ dayOfWeek: day, isClosed: true }]
    if (mode === 'open24h') return [{ dayOfWeek: day, opens: '00:00', closes: '23:59', isClosed: false }]
    // custom — one row per complete range; skip incomplete ranges (mirrors json-ld.ts's own filter).
    return ranges
        .filter(r => r.opens && r.closes)
        .map(r => ({ dayOfWeek: day, opens: r.opens, closes: r.closes, isClosed: false }))
}

/** Google-parity OVERWRITE semantics: drops ALL existing rows for every day in
 *  `selectedDays`, then appends freshly-encoded rows for `mode`/`ranges`. Days not
 *  selected are left untouched. Never merges with a selected day's prior rows —
 *  this is the single most bug-prone rule in the whole feature (see Phase 02 risk). */
export function applyBatchSave(
    allRows: OpeningHourRow[] | undefined,
    selectedDays: Set<string>,
    mode: OpeningHoursMode,
    ranges: TimeRange[],
): OpeningHourRow[] {
    const kept = (allRows || []).filter(r => !r.dayOfWeek || !selectedDays.has(r.dayOfWeek))
    const added = DAY_ORDER.filter(day => selectedDays.has(day)).flatMap(day => encodeDay(day, mode, ranges))
    return [...kept, ...added].sort(sortRows)
}

/** Display-only starter suggestion for a brand-new site with zero saved hours
 *  (Mon-Fri 09:00-18:00 open, weekend closed). Never persisted until the seller
 *  actively saves via the modal. */
export function defaultWeek(): OpeningHourRow[] {
    return DAY_OF_WEEK_OPTIONS.map(({ value: day }) =>
        DEFAULT_CLOSED_DAYS.has(day)
            ? { dayOfWeek: day, isClosed: true }
            : { dayOfWeek: day, opens: '09:00', closes: '18:00', isClosed: false },
    )
}

/** Normalizes rows saved before AC-3 strict validation. Two garbage shapes:
 *  (1) isClosed false/omitted but opens/closes missing (old buggy `.refine()`
 *  OR-chain let these persist) — normalized to closed, matching how the row
 *  already renders (describeDay/rangesFromDay filter it out) and how
 *  local-seo-score already scores it (never counted as open).
 *  (2) rows with no dayOfWeek at all — groupRowsByDay never matches them to
 *  any day, so they're invisible in the UI and the user can never fix or
 *  remove them; dropped outright rather than normalized.
 *  Call unconditionally on every save (no-op for encodeDay's output — always
 *  has dayOfWeek, and an open row always has both opens+closes) so a legacy
 *  row on an UNTOUCHED day doesn't 400 an edit to a different day (applyBatchSave
 *  passes untouched days through as-is) or block an edit to an unrelated
 *  local-business field. */
export function sanitizeLegacyOpeningHours(rows: OpeningHourRow[]): OpeningHourRow[] {
    return rows
        .filter(r => r.dayOfWeek)
        .map(r =>
            (!r.isClosed && (!r.opens || !r.closes))
                ? { ...r, isClosed: true, opens: undefined, closes: undefined }
                : r
        )
}

/** Display strings for one day's rows: one line per time range (split-shift =
 *  multiple lines), the closed label if fully closed, or `[]` if no data yet. */
export function describeDay(rows: OpeningHourRow[], closedLabel: string): string[] {
    if (rows.length === 0) return []
    if (rows.every(r => r.isClosed)) return [closedLabel]
    return rows
        .filter(r => !r.isClosed && r.opens && r.closes)
        .map(r => `${r.opens}–${r.closes}`)
}
