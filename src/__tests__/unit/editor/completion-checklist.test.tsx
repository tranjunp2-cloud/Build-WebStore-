/**
 * @fileoverview Completion indicator regressions for US-F37-04.
 * TC-ID: TC-F37-04-14
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CompletionChecklist } from '@/components/editor/local-business/completion-checklist'
import type { LocalBusinessData } from '@/components/editor/local-business/types'

const LABELS = {
    title: 'Completion',
    addressSaved: 'Address saved',
    hoursSaved: 'Hours saved',
    categorySaved: 'Category saved',
}

const COMPLETE_ADDRESS = {
    streetAddress: '12 Jalan Ampang',
    city: 'Kuala Lumpur',
    state: 'Kuala Lumpur',
    postcode: '50450',
}

function rowIsDone(label: string): boolean {
    return Boolean(screen.getByText(label).closest('li')?.querySelector('svg'))
}

describe('[TC-F37-04-14] CompletionChecklist predicates', () => {
    it.each(Object.keys(COMPLETE_ADDRESS) as Array<keyof typeof COMPLETE_ADDRESS>)(
        'keeps address incomplete when %s is missing',
        (missingField) => {
            // Arrange
            const data: LocalBusinessData = { ...COMPLETE_ADDRESS }
            delete data[missingField]

            // Act
            render(<CompletionChecklist data={data} labels={LABELS} />)

            // Assert
            expect(rowIsDone(LABELS.addressSaved)).toBe(false)
        },
    )

    it('marks address done only when street, city, state, and postcode are present', () => {
        // Arrange
        const data: LocalBusinessData = { ...COMPLETE_ADDRESS }

        // Act
        render(<CompletionChecklist data={data} labels={LABELS} />)

        // Assert
        expect(rowIsDone(LABELS.addressSaved)).toBe(true)
    })

    it('keeps hours incomplete when rows are closed or missing closes', () => {
        // Arrange
        const data: LocalBusinessData = {
            openingHours: [
                {
                    dayOfWeek: 'Mo',
                    opens: '09:00',
                    closes: '17:00',
                    isClosed: true,
                },
                {
                    dayOfWeek: 'Tu',
                    opens: '09:00',
                    isClosed: false,
                },
            ],
        }

        // Act
        render(<CompletionChecklist data={data} labels={LABELS} />)

        // Assert
        expect(rowIsDone(LABELS.hoursSaved)).toBe(false)
    })

    it('marks hours done when at least one open row has opens and closes', () => {
        // Arrange
        const data: LocalBusinessData = {
            openingHours: [
                { dayOfWeek: 'Tu', opens: '09:00', isClosed: false },
                {
                    dayOfWeek: 'We',
                    opens: '09:00',
                    closes: '17:00',
                    isClosed: false,
                },
            ],
        }

        // Act
        render(<CompletionChecklist data={data} labels={LABELS} />)

        // Assert
        expect(rowIsDone(LABELS.hoursSaved)).toBe(true)
    })
})
