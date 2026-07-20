/** EasyParcel settings locale contract — GH-1652, TC-F36.205. */

import { describe, expect, it } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { getEasyParcelErrorMessage } from '@/app/(dashboard)/settings/shipping/easyparcel-error-message'

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key
        if (child && typeof child === 'object' && !Array.isArray(child)) {
            return flattenKeys(child as Record<string, unknown>, path)
        }
        return path
    })
}

describe('EasyParcel settings locale tree [TC-F36.205]', () => {
    it('keeps English and Malay key shapes identical', () => {
        const enKeys = flattenKeys(en.dashboard.settings.shipping.easyParcel).sort()
        const msKeys = flattenKeys(ms.dashboard.settings.shipping.easyParcel).sort()

        expect(msKeys).toEqual(enKeys)
        expect(enKeys.length).toBeGreaterThan(70)
    })

    it('includes translated validation, confirmation, and accessibility copy', () => {
        const copy = ms.dashboard.settings.shipping.easyParcel

        expect(copy.invalidPhone).toBeTruthy()
        expect(copy.deleteLastDescription).toContain('{label}')
        expect(copy.toggleLabel).toBeTruthy()
        expect(copy.disconnectTitle).toBeTruthy()
        expect(copy.disconnectDescription).toContain('dipadamkan')
        expect(en.dashboard.settings.shipping.easyParcel.disconnectDescription).toContain('deleted')
        expect(en.dashboard.settings.shipping.easyParcel.saveSettings).toBeTruthy()
    })

    it('maps API codes to localized copy without exposing server messages', () => {
        const copy = ms.dashboard.settings.shipping.easyParcel

        expect(getEasyParcelErrorMessage('RATE_LIMITED', copy, copy.syncFailed)).toBe(copy.rateLimited)
        expect(getEasyParcelErrorMessage('FORBIDDEN', copy, copy.disconnectFailed)).toBe(copy.forbidden)
        expect(getEasyParcelErrorMessage('EP_NOT_READY', copy, copy.saveFailed)).toBe(copy.addCompleteBeforeActivating)
        expect(getEasyParcelErrorMessage('INTERNAL_ERROR', copy, copy.saveFailed)).toBe(copy.saveFailed)
    })
})
