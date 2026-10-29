// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

let activeDict: typeof en = en
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: activeDict,
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')),
    }),
}))

import { ExtractionReview } from '@/components/builder/ExtractionReview'

const extracted = { businessName: 'Kopi Senja', industry: 'restaurant', shortDescription: 'Cafe', products: 'Coffee' }
const r = en.onboarding.form.extractionReview

describe('ExtractionReview (#2103 A1)', () => {
    it('TC-AIAUD-059: shows how many real reviews and FAQ answers were found and will be used', () => {
        render(<ExtractionReview extractedData={extracted} faqCount={5} onApply={vi.fn()} onSkip={vi.fn()} testimonialCount={3} />)

        expect(screen.getByText('3 customer reviews')).toBeInTheDocument()
        expect(screen.getByText('5 FAQ answers')).toBeInTheDocument()
        expect(screen.getByText(r.realContentNote)).toBeInTheDocument()
    })

    it('TC-AIAUD-059: says nothing is copied when the page had neither', () => {
        render(<ExtractionReview extractedData={extracted} onApply={vi.fn()} onSkip={vi.fn()} />)

        expect(screen.getByText(r.noRealContent)).toBeInTheDocument()
        expect(screen.queryByText(r.realContentNote)).not.toBeInTheDocument()
    })

    it('TC-AIAUD-059: labels and buttons come from i18n (no hard-coded English) and apply the edited data', () => {
        activeDict = ms as unknown as typeof en
        const onApply = vi.fn()
        render(<ExtractionReview extractedData={extracted} onApply={onApply} onSkip={vi.fn()} />)

        expect(screen.getByText(ms.onboarding.form.extractionReview.title)).toBeInTheDocument()
        expect(screen.queryByText('Review extracted info')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: ms.onboarding.form.extractionReview.apply }))
        expect(onApply).toHaveBeenCalledWith(extracted)
        activeDict = en
    })
})
