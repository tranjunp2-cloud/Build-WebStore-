/**
 * Shipping Rate Validation Tests — F14
 * TC coverage: TC-F14.21–F14.38
 * Covers: validateRate (13 edge cases), parseRateRm, validateCrossField, component wiring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { validateRate, parseRateRm, validateCrossField } from '@/lib/shipping'
import { ShippingSettingsClient } from '@/app/(dashboard)/settings/shipping/shipping-settings-client'

// ── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            dashboard: {
                settings: {
                    shipping: {
                        pageTitle: 'Shipping Settings',
                        pageSubtitle: 'Configure your shipping rates',
                        title: 'Shipping Rates',
                        subtitle: 'Set rates',
                        westMalaysia: 'West Malaysia',
                        westBadge: 'West',
                        westBadgeTooltip: 'Peninsular',
                        eastMalaysia: 'East Malaysia',
                        eastBadge: 'East',
                        eastBadgeTooltip: 'Borneo',
                        moreStates: '+{count} more',
                        showLess: 'Show less',
                        freeTitle: 'Free Shipping',
                        freeSubtitle: 'Set a minimum',
                        freeMinLabel: 'Minimum order',
                        freeHelper: 'Orders above RM {amount} ship free',
                        errorEmpty: 'Required',
                        errorNegative: 'Cannot be negative',
                        errorTooHigh: 'Maximum RM 1,000',
                        errorFormat: 'Numbers only',
                        warnFree: 'All orders will ship free',
                        warnThresholdBelowRate: 'Threshold below rate',
                        helperRange: 'Range: RM 0.00 – RM 1,000.00',
                        freeError: 'Threshold must be RM 0.01 – RM 100,000',
                        savedSuccess: 'Saved',
                        saveError: 'Failed to save',
                        saveChanges: 'Save Changes',
                        resetToDefaults: 'Reset to Defaults',
                        saving: 'Saving…',
                        allSaved: 'All changes saved',
                        liveBuyerPays: 'Buyer pays',
                    },
                },
            },
        },
    }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/app/(dashboard)/settings/shipping/live-preview-panel', () => ({
    LivePreviewPanel: () => null,
}))

vi.mock('@/app/(dashboard)/settings/shipping/settings-footer', () => ({
    SettingsFooter: ({ onReset, onSave }: { isDirty: boolean; isSaving: boolean; lastSaveSucceeded: boolean; onReset: () => void; onSave: () => void }) => (
        <div>
            <button onClick={onReset} data-testid="reset-btn">Reset</button>
            <button onClick={onSave} data-testid="save-btn">Save</button>
        </div>
    ),
}))

vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
    TooltipContent: () => null,
}))

// ── Pure function test fixtures ────────────────────────────────────────────

const MSGS = {
    errorEmpty: 'Required',
    errorNegative: 'Cannot be negative',
    errorTooHigh: 'Maximum RM 1,000',
    errorFormat: 'Numbers only',
    warnFree: 'All orders will ship free',
}
const OPTS = { maxSen: 100_000, messages: MSGS }

// ── validateRate ───────────────────────────────────────────────────────────

describe('validateRate [TC-F14.21..F14.33]', () => {
    it('[TC-F14.21] empty + required → errorEmpty', () => {
        expect(validateRate('', { ...OPTS, required: true })).toEqual({ error: 'Required' })
    })

    it('[TC-F14.22] empty + optional → no error', () => {
        expect(validateRate('', OPTS)).toEqual({ error: '' })
    })

    it('[TC-F14.23] negative → errorNegative', () => {
        expect(validateRate('-5', OPTS)).toEqual({ error: 'Cannot be negative' })
    })

    it('[TC-F14.24] over max (1001 RM = 100,100 sen) → errorTooHigh', () => {
        expect(validateRate('1001', OPTS)).toEqual({ error: 'Maximum RM 1,000' })
    })

    it('[TC-F14.25] scientific notation 1e3 → errorFormat', () => {
        expect(validateRate('1e3', OPTS)).toEqual({ error: 'Numbers only' })
    })

    it('[TC-F14.26] non-numeric abc → errorFormat', () => {
        expect(validateRate('abc', OPTS)).toEqual({ error: 'Numbers only' })
    })

    it('[TC-F14.27] comma decimal 8,50 → valid', () => {
        expect(validateRate('8,50', OPTS)).toEqual({ error: '' })
    })

    it('[TC-F14.28] whitespace-padded "  8.5  " → valid', () => {
        expect(validateRate('  8.5  ', OPTS)).toEqual({ error: '' })
    })

    it('[TC-F14.29] > 2 decimal places 8.123 → errorFormat', () => {
        expect(validateRate('8.123', OPTS)).toEqual({ error: 'Numbers only' })
    })

    it('[TC-F14.30] zero → no error + warnFree warning', () => {
        expect(validateRate('0', OPTS)).toEqual({ error: '', warning: 'All orders will ship free' })
    })

    it('[TC-F14.31] happy path 8.00 → no error', () => {
        expect(validateRate('8.00', OPTS)).toEqual({ error: '' })
    })

    it('[TC-F14.32] multiple dots 1.2.3 → errorFormat', () => {
        expect(validateRate('1.2.3', OPTS)).toEqual({ error: 'Numbers only' })
    })

    it('[TC-F14.33] sub-cent 0.001 with minSen=1 → rounds to 0 → errorNegative', () => {
        expect(validateRate('0.001', { ...OPTS, minSen: 1 })).toEqual({ error: 'Cannot be negative' })
    })
})

// ── parseRateRm ────────────────────────────────────────────────────────────

describe('parseRateRm', () => {
    it('parses comma decimal', () => { expect(parseRateRm('8,50')).toBe(8.5) })
    it('returns null on empty string', () => { expect(parseRateRm('')).toBeNull() })
    it('returns null on scientific notation', () => { expect(parseRateRm('1e3')).toBeNull() })
    it('trims leading/trailing whitespace', () => { expect(parseRateRm('  8.5  ')).toBe(8.5) })
})

// ── validateCrossField ─────────────────────────────────────────────────────

const CROSS_MSGS = { warnThresholdBelowRate: 'Threshold below rate' }

describe('validateCrossField', () => {
    it('returns empty object when freeEnabled=false', () => {
        expect(validateCrossField('8', '15', '5', false, CROSS_MSGS)).toEqual({})
    })

    it('warns when threshold < max(westRate, eastRate)', () => {
        expect(validateCrossField('8', '15', '5', true, CROSS_MSGS))
            .toEqual({ warning: 'Threshold below rate' })
    })

    it('no warning when threshold > max(westRate, eastRate)', () => {
        expect(validateCrossField('8', '15', '20', true, CROSS_MSGS)).toEqual({})
    })

    it('boundary: threshold === max(rate) → warning', () => {
        expect(validateCrossField('8', '15', '15', true, CROSS_MSGS))
            .toEqual({ warning: 'Threshold below rate' })
    })

    it('boundary: threshold just above max(rate) → no warning', () => {
        expect(validateCrossField('8', '15', '15.01', true, CROSS_MSGS)).toEqual({})
    })
})

// ── Component integration tests ────────────────────────────────────────────

describe('ShippingSettingsClient [TC-F14.34..F14.39]', () => {
    beforeEach(() => { cleanup() })

    function renderClient() {
        return render(<ShippingSettingsClient siteId="s1" initial={null} />)
    }

    /** Simulate paste by dispatching a paste event with controlled clipboardData */
    function pasteText(el: HTMLElement, text: string) {
        fireEvent.paste(el, {
            clipboardData: { getData: () => text },
        })
    }

    it('[TC-F14.34] pasting -1 into west rate shows errorNegative + aria-invalid', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        pasteText(input, '-1')
        expect(screen.getByText('Cannot be negative')).toBeInTheDocument()
        expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('[TC-F14.35] blurring west input after typing 8 auto-formats to 8.00', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        fireEvent.change(input, { target: { value: '8' } })
        fireEvent.blur(input)
        expect(input).toHaveValue('8.00')
    })

    it('[TC-F14.36] aria-describedby links to error paragraph id + role=alert', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        pasteText(input, '-1')
        expect(input).toHaveAttribute('aria-describedby', 'ship-rate-west-err')
        const errEl = document.getElementById('ship-rate-west-err')
        expect(errEl).not.toBeNull()
        expect(errEl?.getAttribute('role')).toBe('alert')
    })

    it('[TC-F14.37] pasting " 8,50 " trims and formats to 8.50', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        pasteText(input, ' 8,50 ')
        expect(input).toHaveValue('8.50')
    })

    it('[TC-F14.38] onChange filter rejects letter "a" — input value unchanged', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        // Empty the input first ('' passes filter), then attempt 'a' (fails filter)
        fireEvent.change(input, { target: { value: '' } })
        expect(input).toHaveValue('')
        fireEvent.change(input, { target: { value: 'a' } })
        expect(input).toHaveValue('')
    })

    it('[TC-F14.39] pasting "RM 8.00" strips prefix and sets value to 8.00 with no error', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        pasteText(input, 'RM 8.00')
        expect(input).toHaveValue('8.00')
        expect(screen.queryByRole('alert')).toBeNull()
    })
})
