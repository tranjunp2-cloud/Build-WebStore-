/**
 * @fileoverview Direct test of Sites.ts's beforeValidate hook (PR #1591 code
 * review Q2 fix + Stage 3 adversarial finding #7 — the hook had zero direct
 * coverage, only the pure sanitizeLegacyOpeningHours it delegates to was tested).
 * TC-IDs: TC-F37-02-28 — registered in docs/qa/F37-local-seo.md §3.12
 */
import { describe, it, expect } from 'vitest'
import { sanitizeOpeningHoursOnValidate } from '@/collections/Sites'

// Minimal args shape sanitizeOpeningHoursOnValidate actually reads (destructures `data` only)
function callHook(data: unknown) {
    return sanitizeOpeningHoursOnValidate({ data } as Parameters<typeof sanitizeOpeningHoursOnValidate>[0])
}

describe('[TC-F37-02-28] sanitizeOpeningHoursOnValidate — Sites.ts beforeValidate hook', () => {
    it('returns data unchanged when data is undefined', () => {
        expect(callHook(undefined)).toBeUndefined()
    })

    it('returns data unchanged when localBusiness is absent', () => {
        const data = { name: 'My Site' }
        expect(callHook(data)).toEqual(data)
    })

    it('returns data unchanged when localBusiness has no openingHours', () => {
        const data = { localBusiness: { streetAddress: '123 Main St' } }
        expect(callHook(data)).toEqual(data)
    })

    it('returns data unchanged when openingHours is not an array', () => {
        const data = { localBusiness: { openingHours: 'not-an-array' } }
        expect(callHook(data)).toEqual(data)
    })

    it('sanitizes a legacy-invalid row (isClosed false/omitted, missing opens/closes) to isClosed:true', () => {
        const data = {
            localBusiness: {
                streetAddress: '123 Main St',
                openingHours: [{ dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false }, { dayOfWeek: 'Tu' }],
            },
        }
        const result = callHook(data) as typeof data
        expect(result.localBusiness.openingHours[0]).toEqual(data.localBusiness.openingHours[0])
        expect(result.localBusiness.openingHours[1]).toMatchObject({ isClosed: true, opens: undefined, closes: undefined })
        // sibling field untouched — the merge/spread doesn't drop other localBusiness data
        expect(result.localBusiness.streetAddress).toBe('123 Main St')
    })

    it('drops orphan rows with no dayOfWeek', () => {
        const data = { localBusiness: { openingHours: [{ opens: '09:00', closes: '18:00', isClosed: false }] } }
        const result = callHook(data) as typeof data
        expect(result.localBusiness.openingHours).toEqual([])
    })

    it('is a no-op for an already-valid openingHours array', () => {
        const data = { localBusiness: { openingHours: [{ dayOfWeek: 'Mo', opens: '09:00', closes: '18:00', isClosed: false }] } }
        expect(callHook(data)).toEqual(data)
    })

    it('does not mutate other top-level data fields', () => {
        const data = {
            name: 'My Site',
            theme: { primaryColor: '#000' },
            localBusiness: { openingHours: [{ dayOfWeek: 'Mo' }] },
        }
        const result = callHook(data) as typeof data
        expect(result.name).toBe('My Site')
        expect(result.theme).toEqual({ primaryColor: '#000' })
    })
})
