import { describe, it, expect } from 'vitest'
import en from '../../../i18n/locales/en.json'
import ms from '../../../i18n/locales/ms.json'

const FORBIDDEN = /hook|autoLinkCustomer|\{hook\}/i

describe('Customer detail auto-link copy (TC-F25-08-10)', () => {
    it.each([
        ['en', en.dashboard.shopCustomers.detail.autoLinkBody],
        ['ms', ms.dashboard.shopCustomers.detail.autoLinkBody],
    ])('TC-F25-08-10: %s copy does not expose technical hook name', (_locale, body) => {
        // Assert
        expect(body).toBeTruthy()
        expect(body).not.toMatch(FORBIDDEN)
    })
})
