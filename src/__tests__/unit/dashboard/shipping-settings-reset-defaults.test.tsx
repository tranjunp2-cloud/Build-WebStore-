/**
 * Shipping Settings Reset Behavior — F14
 * TC coverage: TC-F14.40–TC-F14.42
 * Verifies that clicking Reset clears validation errors and warnings, restoring default values.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
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

// ── Helpers ────────────────────────────────────────────────────────────────

function renderClient() {
    return render(<ShippingSettingsClient siteId="s1" initial={null} />)
}

function pasteText(el: HTMLElement, text: string) {
    fireEvent.paste(el, { clipboardData: { getData: () => text } })
}

// ── Reset behavior tests ───────────────────────────────────────────────────

describe('ShippingSettingsClient — Reset [TC-F14.40..F14.42]', () => {
    beforeEach(() => { cleanup() })

    it('[TC-F14.40] Reset after west rate error clears error + aria-invalid', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        // Trigger error via change+blur (value passes INPUT_FILTER, fails validateRate max check)
        fireEvent.change(input, { target: { value: '1000.01' } })
        fireEvent.blur(input)
        expect(screen.getByText('Maximum RM 1,000')).toBeInTheDocument()
        expect(input).toHaveAttribute('aria-invalid', 'true')

        fireEvent.click(screen.getByTestId('reset-btn'))

        expect(screen.queryByText('Maximum RM 1,000')).toBeNull()
        expect(input).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('[TC-F14.41] Reset after rate=0 warning clears warnFree and restores default value', () => {
        renderClient()
        const input = screen.getByPlaceholderText('8.00')
        fireEvent.change(input, { target: { value: '0' } })
        fireEvent.blur(input)
        expect(screen.getByText('All orders will ship free')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('reset-btn'))

        expect(screen.queryByText('All orders will ship free')).toBeNull()
        expect(input).toHaveValue('8.00')
    })

    it('[TC-F14.42] Reset restores west and east inputs to default values', () => {
        renderClient()
        const westInput = screen.getByPlaceholderText('8.00')
        const eastInput = screen.getByPlaceholderText('15.00')
        fireEvent.change(westInput, { target: { value: '5' } })
        fireEvent.change(eastInput, { target: { value: '20' } })
        expect(westInput).toHaveValue('5')
        expect(eastInput).toHaveValue('20')

        fireEvent.click(screen.getByTestId('reset-btn'))

        expect(westInput).toHaveValue('8.00')
        expect(eastInput).toHaveValue('15.00')
    })
})
