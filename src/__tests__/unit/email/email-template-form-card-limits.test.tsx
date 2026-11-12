import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/dashboard'),
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}))

import { I18nProvider } from '@/i18n'
import { EmailTemplateFormCard } from '@/app/(dashboard)/settings/email-templates/_components/email-template-form-card'
import { CONTENT_FIELD_LIMITS } from '@/app/(dashboard)/settings/email-templates/validate-content-fields'

function renderCard(contentEn: Record<string, string>, contentMs: Record<string, string> = {}) {
    return render(
        <I18nProvider>
            <EmailTemplateFormCard
                templateType={'order-confirmation' as never}
                locale="en"
                draft={{ contentEn, contentMs, enabled: true }}
                isDirty
                isSaving={false}
                isCritical={false}
                onLocaleChange={vi.fn()}
                onFieldChange={vi.fn()}
                onEnabledChange={vi.fn()}
                onSave={vi.fn()}
                onRevert={vi.fn()}
            />
        </I18nProvider>,
    )
}

describe('EmailTemplateFormCard over-limit handling (F32)', () => {
    it('[TC-F32.12] subject over limit shows friendly inline error and disables Save', () => {
        renderCard({ subject: 'x'.repeat(CONTENT_FIELD_LIMITS.subject + 1) })
        const alert = screen.getByRole('alert')
        expect(alert.textContent).toBe(`Subject can be at most ${CONTENT_FIELD_LIMITS.subject} characters`)
        expect(alert.textContent).not.toMatch(/content(En|Ms)/)
        expect((screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('[TC-F32.14] closing over limit disables Save', () => {
        renderCard({ closing: 'y'.repeat(CONTENT_FIELD_LIMITS.closing + 1) })
        expect((screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('[TC-F32.13] subject exactly at limit keeps Save enabled and shows no error', () => {
        renderCard({ subject: 'a'.repeat(CONTENT_FIELD_LIMITS.subject) })
        expect(screen.queryByRole('alert')).toBeNull()
        expect((screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false)
    })

    it('[TC-F32.12] over-limit Malay content also disables Save while viewing EN', () => {
        renderCard({}, { greeting: 'g'.repeat(CONTENT_FIELD_LIMITS.greeting + 1) })
        expect(screen.getByTestId('other-locale-limit-error').textContent)
            .toBe(`Greeting (MS) can be at most ${CONTENT_FIELD_LIMITS.greeting} characters`)
        expect((screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true)
    })
})
