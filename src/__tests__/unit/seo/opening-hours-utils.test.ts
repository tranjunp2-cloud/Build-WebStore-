/**
 * @fileoverview Tests for F37 US-01 opening-hours Google-style redesign (Phase 05)
 * TC-IDs: TC-F37-02-14 to TC-F37-02-20, TC-F37-02-23 (provisional — docs/qa/F37-local-seo.md backfills official IDs)
 */
import { describe, it, expect } from 'vitest'
import {
    groupRowsByDay, rangesFromDay, applyBatchSave, defaultWeek, describeDay, isRangeOrderValid,
    sanitizeLegacyOpeningHours,
} from '@/components/editor/local-business/opening-hours-utils'
import type { OpeningHourRow } from '@/components/editor/local-business/types'

// ── TC-F37-02-14: groupRowsByDay — Mo→Su order regardless of input order/gaps ──

describe('[TC-F37-02-14] groupRowsByDay — Mo→Su order, handles gaps and out-of-order input', () => {
    it('returns 7 groups in Mo→Su order even when input rows are out of order', () => {
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'We', opens: '09:00', closes: '18:00' },
            { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00' },
        ]
        const groups = groupRowsByDay(rows)
        expect(groups.map(g => g.day)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
    })

    it('gives an empty rows array for a day with no data', () => {
        const groups = groupRowsByDay([{ dayOfWeek: 'Mo', opens: '09:00', closes: '18:00' }])
        expect(groups.find(g => g.day === 'Tu')?.rows).toEqual([])
    })

    it('returns 7 empty groups when rows is undefined', () => {
        const groups = groupRowsByDay(undefined)
        expect(groups).toHaveLength(7)
        expect(groups.every(g => g.rows.length === 0)).toBe(true)
    })
})

// ── TC-F37-02-15: rangesFromDay — mode inference + round-trip ──────────────

describe('[TC-F37-02-15] rangesFromDay — mode inference and split-shift round-trip', () => {
    it('infers "closed" when every row isClosed', () => {
        const { mode, ranges } = rangesFromDay([{ dayOfWeek: 'Sa', isClosed: true }])
        expect(mode).toBe('closed')
        expect(ranges).toEqual([])
    })

    it('infers "open24h" for a single 00:00–23:59 row', () => {
        const { mode } = rangesFromDay([{ dayOfWeek: 'Mo', opens: '00:00', closes: '23:59' }])
        expect(mode).toBe('open24h')
    })

    it('round-trips split-shift ranges in order via groupRowsByDay', () => {
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '13:00', closes: '18:00' },
            { dayOfWeek: 'Mo', opens: '07:00', closes: '11:00' },
        ]
        const mondayRows = groupRowsByDay(rows).find(g => g.day === 'Mo')!.rows
        const { mode, ranges } = rangesFromDay(mondayRows)
        expect(mode).toBe('custom')
        expect(ranges).toEqual([{ opens: '07:00', closes: '11:00' }, { opens: '13:00', closes: '18:00' }])
    })

    it('returns "custom" with empty ranges when the day has no rows at all', () => {
        expect(rangesFromDay([])).toEqual({ mode: 'custom', ranges: [] })
    })
})

// ── TC-F37-02-16: applyBatchSave — OVERWRITE semantics (not merge) ─────────

describe('[TC-F37-02-16] applyBatchSave — overwrite semantics, no duplicate accumulation', () => {
    it('replaces a day’s existing split-shift rows entirely with the new single range', () => {
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '07:00', closes: '11:00' },
            { dayOfWeek: 'Mo', opens: '13:00', closes: '18:00' },
        ]
        const next = applyBatchSave(rows, new Set(['Mo']), 'custom', [{ opens: '09:00', closes: '17:00' }])
        const mondayRows = next.filter(r => r.dayOfWeek === 'Mo')
        expect(mondayRows).toHaveLength(1)
        expect(mondayRows[0]).toMatchObject({ opens: '09:00', closes: '17:00' })
    })

    it('leaves days NOT in selectedDays completely untouched', () => {
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00' },
            { dayOfWeek: 'Tu', opens: '10:00', closes: '19:00' },
        ]
        const next = applyBatchSave(rows, new Set(['Mo']), 'closed', [])
        const tuesday = next.find(r => r.dayOfWeek === 'Tu')
        expect(tuesday).toMatchObject({ opens: '10:00', closes: '19:00' })
    })

    it('applies the same range to multiple selected days in one call (batch apply)', () => {
        const next = applyBatchSave(undefined, new Set(['Mo', 'Tu', 'We']), 'custom', [{ opens: '08:00', closes: '17:00' }])
        expect(next).toHaveLength(3)
        expect(next.every(r => r.opens === '08:00' && r.closes === '17:00')).toBe(true)
    })
})

// ── TC-F37-02-17: applyBatchSave — mode encodings ───────────────────────────

describe('[TC-F37-02-17] applyBatchSave — closed / open24h / custom encodings', () => {
    it('encodes "closed" as a single isClosed row with no opens/closes', () => {
        const next = applyBatchSave(undefined, new Set(['Sa']), 'closed', [])
        expect(next).toEqual([{ dayOfWeek: 'Sa', isClosed: true }])
    })

    it('encodes "open24h" as a single 00:00–23:59 row', () => {
        const next = applyBatchSave(undefined, new Set(['Su']), 'open24h', [])
        expect(next).toEqual([{ dayOfWeek: 'Su', opens: '00:00', closes: '23:59', isClosed: false }])
    })

    it('encodes "custom" as one row per range (split-shift)', () => {
        const next = applyBatchSave(undefined, new Set(['Mo']), 'custom', [
            { opens: '07:00', closes: '11:00' },
            { opens: '13:00', closes: '18:00' },
        ])
        expect(next).toHaveLength(2)
    })

    it('skips incomplete ranges (missing opens or closes) when encoding custom mode', () => {
        const next = applyBatchSave(undefined, new Set(['Mo']), 'custom', [
            { opens: '07:00', closes: '' },
            { opens: '13:00', closes: '18:00' },
        ])
        expect(next).toHaveLength(1)
        expect(next[0]).toMatchObject({ opens: '13:00', closes: '18:00' })
    })
})

// ── TC-F37-02-18: describeDay — display strings for list view ──────────────

describe('[TC-F37-02-18] describeDay — list-view display strings', () => {
    it('returns [] for a day with no rows', () => {
        expect(describeDay([], 'Closed')).toEqual([])
    })

    it('returns the closed label for a fully-closed day', () => {
        expect(describeDay([{ dayOfWeek: 'Su', isClosed: true }], 'Closed')).toEqual(['Closed'])
    })

    it('returns one line per range for a split-shift day', () => {
        const lines = describeDay([
            { dayOfWeek: 'Mo', opens: '07:00', closes: '11:00' },
            { dayOfWeek: 'Mo', opens: '13:00', closes: '18:00' },
        ], 'Closed')
        expect(lines).toEqual(['07:00–11:00', '13:00–18:00'])
    })
})

// ── TC-F37-02-19: defaultWeek — brand-new-site empty-state suggestion ──────

describe('[TC-F37-02-19] defaultWeek — matches legacy Mon–Fri-open/weekend-closed suggestion', () => {
    it('suggests Mon–Fri 09:00–18:00 open, Sat/Sun closed', () => {
        const week = defaultWeek()
        expect(week).toHaveLength(7)
        const sat = week.find(r => r.dayOfWeek === 'Sa')
        const mon = week.find(r => r.dayOfWeek === 'Mo')
        expect(sat).toMatchObject({ isClosed: true })
        expect(mon).toMatchObject({ opens: '09:00', closes: '18:00', isClosed: false })
    })
})

// ── TC-F37-02-20: applyBatchSave — defensive handling of malformed rows ────

describe('[TC-F37-02-20] applyBatchSave — rows with no dayOfWeek are kept regardless of selection', () => {
    it('keeps a row with an empty dayOfWeek untouched even if it happens to overlap selectedDays logic', () => {
        const rows: OpeningHourRow[] = [{ opens: '09:00', closes: '18:00' }]
        const next = applyBatchSave(rows, new Set(['Mo']), 'closed', [])
        expect(next).toContainEqual({ opens: '09:00', closes: '18:00' })
    })
})

// ── TC-F37-02-23: isRangeOrderValid — closes must be after opens (no overnight support) ──

describe('[TC-F37-02-23] isRangeOrderValid — closes must be strictly after opens', () => {
    it('is valid when closes is after opens', () => {
        expect(isRangeOrderValid({ opens: '09:00', closes: '18:00' })).toBe(true)
    })

    it('is invalid when closes equals opens', () => {
        expect(isRangeOrderValid({ opens: '09:00', closes: '09:00' })).toBe(false)
    })

    it('is invalid when closes is before opens (overnight ranges not supported)', () => {
        expect(isRangeOrderValid({ opens: '21:00', closes: '02:00' })).toBe(false)
    })

    it('is treated as valid (not-yet-invalid) while either field is still empty', () => {
        expect(isRangeOrderValid({ opens: '', closes: '18:00' })).toBe(true)
        expect(isRangeOrderValid({ opens: '09:00', closes: '' })).toBe(true)
        expect(isRangeOrderValid({ opens: '', closes: '' })).toBe(true)
    })
})

// ── sanitizeLegacyOpeningHours — normalizes pre-AC-3 invalid rows to closed ──
// (no F37 QA TC-ID yet — added for GH-02 legacy-data fix, backfills into docs/qa/F37-local-seo.md)

describe('sanitizeLegacyOpeningHours — normalizes rows saved before strict opens/closes validation', () => {
    it('normalizes a not-closed row missing both opens and closes to isClosed:true', () => {
        const result = sanitizeLegacyOpeningHours([{ dayOfWeek: 'Mo' }])
        expect(result).toEqual([{ dayOfWeek: 'Mo', isClosed: true, opens: undefined, closes: undefined }])
    })

    it('normalizes a not-closed row missing only closes to isClosed:true', () => {
        const result = sanitizeLegacyOpeningHours([{ dayOfWeek: 'Mo', opens: '09:00', isClosed: false }])
        expect(result[0]).toMatchObject({ isClosed: true, opens: undefined, closes: undefined })
    })

    it('leaves a valid open row (both opens and closes present) untouched', () => {
        const row = { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false }
        expect(sanitizeLegacyOpeningHours([row])).toEqual([row])
    })

    it('leaves an already-closed row untouched', () => {
        const row = { dayOfWeek: 'Sa', isClosed: true }
        expect(sanitizeLegacyOpeningHours([row])).toEqual([row])
    })

    it('handles a mixed array — only the invalid row is normalized', () => {
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false },
            { dayOfWeek: 'Tu', opens: '09:00', isClosed: false },
        ]
        const result = sanitizeLegacyOpeningHours(rows)
        expect(result[0]).toEqual(rows[0])
        expect(result[1]).toMatchObject({ isClosed: true, opens: undefined, closes: undefined })
    })
})
