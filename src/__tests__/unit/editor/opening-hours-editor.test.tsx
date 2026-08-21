/**
 * @fileoverview Tests for F37 US-01 opening-hours Google-style editor (Phase 05)
 * TC-IDs: TC-F37-02-22 (provisional — docs/qa/F37-local-seo.md backfills official IDs)
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { OpeningHoursEditor } from '@/components/editor/local-business/opening-hours-editor'
import type { OpeningHourRow } from '@/components/editor/local-business/types'

const DAY_LABELS = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' }

const LABELS = {
    dayLabels: DAY_LABELS,
    closedLabel: 'Closed',
    opensLabel: 'Opens',
    closesLabel: 'Closes',
    editAllLabel: 'Edit all hours',
    editWeekdaysLabel: 'Edit Mon–Fri',
    editWeekendLabel: 'Edit Sat–Sun',
    editDayAriaTemplate: 'Edit {day}',
    modalTitle: 'Select days and hours',
    open24hLabel: 'Open 24 hours',
    addRangeLabel: 'Add hours',
    removeRangeLabel: 'Remove this time range',
    invalidRangeLabel: 'Closing time must be after opening time',
    saveLabel: 'Save',
    cancelLabel: 'Cancel',
    notSetLabel: 'Opening hours are not set yet.',
    setLabel: 'Set opening hours',
}

// ── TC-F37-02-22: list view renders 7 days, split-shift day shows N lines ──

describe('[TC-F37-02-22] OpeningHoursEditor — list view renders 7 days incl. split-shift', () => {
    it('shows an explicit unset state when no hours are saved', () => {
        render(<OpeningHoursEditor rows={undefined} onChange={vi.fn()} {...LABELS} />)
        expect(screen.getByText('Opening hours are not set yet.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Set opening hours' })).toBeInTheDocument()
        for (const label of Object.values(DAY_LABELS)) {
            expect(screen.queryByText(label)).not.toBeInTheDocument()
        }
    })

    it('shows both time ranges on a split-shift day', () => {
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '07:00', closes: '11:00', isClosed: false },
            { dayOfWeek: 'Mo', opens: '13:00', closes: '18:00', isClosed: false },
        ]
        render(<OpeningHoursEditor rows={rows} onChange={vi.fn()} {...LABELS} />)
        expect(screen.getByText('07:00–11:00')).toBeInTheDocument()
        expect(screen.getByText('13:00–18:00')).toBeInTheDocument()
    })

    it('shows the closed label for a day with an isClosed row', () => {
        const rows: OpeningHourRow[] = [{ dayOfWeek: 'Su', isClosed: true }]
        render(<OpeningHoursEditor rows={rows} onChange={vi.fn()} {...LABELS} />)
        expect(screen.getByText('Closed')).toBeInTheDocument()
    })

    it('renders all 3 quick-action buttons for saved hours', () => {
        const rows: OpeningHourRow[] = [{ dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false }]
        render(<OpeningHoursEditor rows={rows} onChange={vi.fn()} {...LABELS} />)
        expect(screen.getByText('Edit all hours')).toBeInTheDocument()
        expect(screen.getByText('Edit Mon–Fri')).toBeInTheDocument()
        expect(screen.getByText('Edit Sat–Sun')).toBeInTheDocument()
    })
})

// ── TC-F37-10-05: individual-day modal blocks incomplete ranges ──────────

const SPLIT_SHIFT_ROWS: OpeningHourRow[] = [
    { dayOfWeek: 'Mo', opens: '07:00', closes: '11:00', isClosed: false },
    { dayOfWeek: 'Mo', opens: '13:00', closes: '18:00', isClosed: false },
    { dayOfWeek: 'Tu', opens: '08:00', closes: '12:00', isClosed: false },
    { dayOfWeek: 'Tu', opens: '13:00', closes: '17:00', isClosed: false },
    { dayOfWeek: 'Su', isClosed: true },
]

describe('[TC-F37-10-05] OpeningHoursEditor — individual-day save guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each([
        ['opens', 1],
        ['closes', 1],
    ] as const)('blocks Save when a non-first split-shift range is missing %s', (field, rangeIndex) => {
        // Arrange
        const rows = structuredClone(SPLIT_SHIFT_ROWS)
        const originalRows = structuredClone(rows)
        const onChange = vi.fn()
        render(<OpeningHoursEditor rows={rows} onChange={onChange} {...LABELS} />)
        fireEvent.click(screen.getByRole('button', { name: 'Edit Monday' }))
        const fieldInputs = screen.getAllByLabelText(field === 'opens' ? 'Opens' : 'Closes')

        // Act
        fireEvent.change(fieldInputs[rangeIndex], { target: { value: '' } })
        const saveButton = screen.getByRole('button', { name: 'Save' })
        fireEvent.click(saveButton)

        // Assert
        expect(saveButton).toBeDisabled()
        expect(onChange).not.toHaveBeenCalled()
        expect(rows).toEqual(originalRows)
    })

    it('blocks Save when a newly added second range is blank', () => {
        // Arrange
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false },
            { dayOfWeek: 'Tu', opens: '10:00', closes: '16:00', isClosed: false },
        ]
        const originalRows = structuredClone(rows)
        const onChange = vi.fn()
        render(<OpeningHoursEditor rows={rows} onChange={onChange} {...LABELS} />)
        fireEvent.click(screen.getByRole('button', { name: 'Edit Monday' }))

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Add hours' }))
        expect(screen.getAllByLabelText('Opens')).toHaveLength(2)
        expect(screen.getAllByLabelText('Closes')).toHaveLength(2)
        const saveButton = screen.getByRole('button', { name: 'Save' })
        fireEvent.click(saveButton)

        // Assert
        expect(saveButton).toBeDisabled()
        expect(onChange).not.toHaveBeenCalled()
        expect(rows).toEqual(originalRows)
    })

    it('saves Monday 09:00–18:00, preserves untouched rows, and rerenders the emitted value', () => {
        // Arrange
        const rows: OpeningHourRow[] = [
            { dayOfWeek: 'Mo', opens: '07:00', closes: '15:00', isClosed: false },
            { dayOfWeek: 'Tu', opens: '08:00', closes: '12:00', isClosed: false },
            { dayOfWeek: 'Tu', opens: '13:00', closes: '17:00', isClosed: false },
            { dayOfWeek: 'Su', isClosed: true },
        ]
        const originalRows = structuredClone(rows)
        const untouchedRows = structuredClone(rows.filter(row => row.dayOfWeek !== 'Mo'))
        const onChange = vi.fn()
        const view = render(<OpeningHoursEditor rows={rows} onChange={onChange} {...LABELS} />)
        fireEvent.click(screen.getByRole('button', { name: 'Edit Monday' }))

        // Act
        fireEvent.change(screen.getByLabelText('Opens'), { target: { value: '09:00' } })
        fireEvent.change(screen.getByLabelText('Closes'), { target: { value: '18:00' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        // Assert
        expect(onChange).toHaveBeenCalledTimes(1)
        const emittedRows = onChange.mock.calls[0][0] as OpeningHourRow[]
        expect(emittedRows.filter(row => row.dayOfWeek !== 'Mo')).toEqual(untouchedRows)
        expect(rows).toEqual(originalRows)
        expect(emittedRows.filter(row => row.dayOfWeek === 'Mo')).toEqual([
            { dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false },
        ])

        view.rerender(<OpeningHoursEditor rows={emittedRows} onChange={onChange} {...LABELS} />)
        expect(screen.getByText('09:00–18:00')).toBeInTheDocument()
        expect(screen.getByText('08:00–12:00')).toBeInTheDocument()
        expect(screen.getByText('13:00–17:00')).toBeInTheDocument()
        expect(screen.getByText('Closed')).toBeInTheDocument()
    })
})
