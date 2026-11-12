/**
 * TC-F01.115 (GH-2154, UI part) — /templates when apply-template refuses: a 409 shows a readable toast with a
 * "Go to dashboard" action (no automatic navigation); other error objects show their message, never
 * "[object Object]". Real: the page + TemplateCard. Faked: fetch, router, sonner toast, i18n (real English strings), language switcher.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { push, toast } = vi.hoisted(() => ({
    push: vi.fn(),
    toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, back: vi.fn() }) }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/i18n', async () => {
    const en = (await import('@/i18n/locales/en.json')).default
    return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))

import TemplatesPage from '@/app/(frontend)/templates/page'

const TEMPLATE = {
    id: 'tpl-1', name: 'Bakery', description: 'Warm bakery', category: ['fnb'],
    isPremium: false, isFeatured: false, defaultTheme: { primaryColor: '#111111', colorMode: 'light' },
}

function stubFetch(applyStatus: number, applyBody: unknown) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).startsWith('/api/templates/list')) {
            return new Response(JSON.stringify({ docs: [TEMPLATE] }), { status: 200 })
        }
        return new Response(JSON.stringify(applyBody), { status: applyStatus })
    }))
}

async function clickUseTemplate() {
    render(<TemplatesPage />)
    const useButtons = await screen.findAllByRole('button', { name: /use/i })
    fireEvent.click(useButtons[0])
}

describe('/templates — apply-template refusal [TC-F01.115]', () => {
    beforeEach(() => vi.clearAllMocks())
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
    })

    it('409 SITE_ALREADY_EXISTS: toast.info with the server message + Go to dashboard action, no auto redirect', async () => {
        const message = 'This account already has a website. Open it from the dashboard instead of generating a new one.'
        stubFetch(409, { success: false, error: { code: 'SITE_ALREADY_EXISTS', message } })

        await clickUseTemplate()

        await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1))
        const [shown, options] = toast.info.mock.calls[0]
        expect(shown).toBe(message)
        expect(options.action.label).toBe('Go to dashboard')
        expect(push).not.toHaveBeenCalled()

        options.action.onClick()
        expect(push).toHaveBeenCalledWith('/dashboard')
    })

    it('409 GENERATION_IN_PROGRESS: the action opens the generating dashboard state', async () => {
        stubFetch(409, { success: false, error: { code: 'GENERATION_IN_PROGRESS', message: 'Running.' } })

        await clickUseTemplate()

        await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1))
        toast.info.mock.calls[0][1].action.onClick()
        expect(push).toHaveBeenCalledWith('/dashboard?ai_status=generating')
    })

    it('403 error object: toast.error shows the message, not [object Object]', async () => {
        stubFetch(403, { success: false, error: { code: 'FEATURE_LOCKED', message: 'Template application not available on your current plan' } })

        await clickUseTemplate()

        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
        expect(toast.error).toHaveBeenCalledWith('Template application not available on your current plan')
        expect(toast.info).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })
})
