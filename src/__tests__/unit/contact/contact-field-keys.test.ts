/**
 * Unit Tests: canonical contact-form field keys (GH-2243)
 * TC-ID: TC-F01-CONTACT-KEY-03
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect } from 'vitest'
import { resolveContactFieldKeys } from '@/lib/contact/contact-field-keys'

describe('[TC-F01-CONTACT-KEY-03] resolveContactFieldKeys', () => {
    it('TC-F01-CONTACT-KEY-03a — keeps standard fieldNames unchanged', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'name', fieldType: 'text' },
            { fieldName: 'email', fieldType: 'email' },
            { fieldName: 'phone', fieldType: 'phone' },
            { fieldName: 'message', fieldType: 'textarea' },
        ])
        expect(keys).toEqual(['name', 'email', 'phone', 'message'])
    })

    it('TC-F01-CONTACT-KEY-03b — maps Malay aliases', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'Nama', fieldType: 'text' },
            { fieldName: 'e-mel', fieldType: 'email' },
            { fieldName: 'telefon', fieldType: 'phone' },
            { fieldName: 'mesej', fieldType: 'textarea' },
        ])
        expect(keys).toEqual(['name', 'email', 'phone', 'message'])
    })

    it('TC-F01-CONTACT-KEY-03c — garbled fieldName falls back to field type', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'Kedai kopi Ipoh untuk ujian QA', fieldType: 'text' },
            { fieldName: 'Kedai kopi Ipoh untuk ujian QA', fieldType: 'email' },
            { fieldName: 'Kedai kopi Ipoh untuk ujian QA', fieldType: 'textarea' },
        ])
        expect(keys).toEqual(['name', 'email', 'message'])
    })

    it('TC-F01-CONTACT-KEY-03d — two text fields become name + subject', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'company', fieldType: 'text' },
            { fieldName: 'other', fieldType: 'text' },
        ])
        expect(keys).toEqual(['name', 'subject'])
    })

    it('TC-F01-CONTACT-KEY-03e — duplicates and unknown types get unique names', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'email', fieldType: 'email' },
            { fieldName: 'email', fieldType: 'email' },
            { fieldName: 'topping', fieldType: 'select' },
        ])
        expect(keys).toEqual(['email', 'field-2', 'topping'])
    })

    it('TC-F01-CONTACT-KEY-03f — mapCustomText=false keeps custom text names but maps generic ones', () => {
        const keys = resolveContactFieldKeys(
            [
                { fieldName: 'companyName', fieldType: 'text' },
                { fieldName: 'field-2', fieldType: 'text' },
            ],
            { mapCustomText: false },
        )
        expect(keys).toEqual(['companyName', 'name'])
    })

    it('TC-F01-CONTACT-KEY-03g — normalises punctuation/spaces in aliases', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'No. Telefon', fieldType: 'text' },
            { fieldName: 'E-mail:', fieldType: 'text' },
        ])
        expect(keys).toEqual(['phone', 'email'])
    })

    it('TC-F01-CONTACT-KEY-03h — never resolves a visible field to the honeypot key', () => {
        const keys = resolveContactFieldKeys([
            { fieldName: 'website', fieldType: 'select' },
            { fieldName: 'Website', fieldType: 'url' },
        ])
        expect(keys).not.toContain('website')
        expect(new Set(keys).size).toBe(2)
    })
})
