/**
 * @fileoverview Regression tests for GH-1604 — PhoneInput country selector
 * rendered the flag twice in the trigger (manual span + SelectValue mirroring
 * SelectItem children).
 * TC-IDs: TC-F23-02-07 to TC-F23-02-09 (docs/qa/F23-personal-profile.md)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PhoneInput } from '@/app/(dashboard)/settings/profile/_components/phone-input'

// Emoji flags are multi-codepoint — split-count is safer than regex
function countOccurrences(text: string, token: string): number {
    return text.split(token).length - 1
}

function getTrigger(): HTMLElement {
    return screen.getByRole('combobox', { name: 'Country code' })
}

describe('PhoneInput country selector (GH-1604)', () => {
    // TC-F23-02-07: trigger shows exactly one MY flag for a +60 value
    it('renders exactly one MY flag in the trigger for a +60 value', () => {
        // Arrange + Act
        render(<PhoneInput value="+60123456789" onChange={vi.fn()} />)
        const text = getTrigger().textContent ?? ''

        // Assert — one flag, code and label still shown
        expect(countOccurrences(text, '🇲🇾')).toBe(1)
        expect(text).toContain('+60')
        expect(text).toContain('MY')
    })

    // TC-F23-02-08: +84 value shows exactly one VN flag, no stray MY flag
    it('renders exactly one VN flag in the trigger for a +84 value', () => {
        render(<PhoneInput value="+84987654321" onChange={vi.fn()} />)
        const text = getTrigger().textContent ?? ''

        expect(countOccurrences(text, '🇻🇳')).toBe(1)
        expect(countOccurrences(text, '🇲🇾')).toBe(0)
        expect(text).toContain('+84')
        expect(text).toContain('VN')
    })

    // TC-F23-02-09: value without country code falls back to +60, still one flag
    it('falls back to +60 with a single flag for a value without country code', () => {
        render(<PhoneInput value="123456789" onChange={vi.fn()} />)
        const text = getTrigger().textContent ?? ''

        expect(countOccurrences(text, '🇲🇾')).toBe(1)
        expect(text).toContain('+60')
    })
})
