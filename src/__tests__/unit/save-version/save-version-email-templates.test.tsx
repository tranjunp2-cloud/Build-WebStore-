/**
 * TC-AICP-335 — email template editor against a stale save: a template with a saved row sends the row's updatedAt; one that
 * started from the DEFAULT sends null ("no row yet"); a refused save shows ONE conflict notice, keeps the edit, shows no
 * toast; Load the latest reads the saved rows again and drops the edit; Save mine anyway sends the version the refusal
 * reported (the row's, or null when the row is gone); after the assistant changed the template and the merchant chose Keep mine,
 * Save hits the conflict; two saves in a row from one editor both go through; the copilot's refresh with unchanged content
 * moves the version on.
 * TC-AICP-336 — list switch: sends the row's version (null for a default template); a refused switch is put back, the rows are
 * read again and the one small "Changed elsewhere — refreshed" toast shows.
 * Real: EmailTemplatesClient (list + editor), AgentRefresh, the bus, the notices, en strings. Faked: next/navigation (`refresh` hands
 * the harness the rows a server render would), the template actions (a fake store applying the real version check), sonner.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, push: vi.fn(), replace: vi.fn() }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
const actions = vi.hoisted(() => ({ save: vi.fn(), reset: vi.fn(), settings: vi.fn() }))
vi.mock('@/app/(dashboard)/settings/email-templates/actions', () => ({
    saveEmailTemplateConfig: actions.save,
    resetEmailTemplateConfig: actions.reset,
    getEmailTemplateSettings: actions.settings,
}))
vi.mock('@/app/(dashboard)/settings/email-templates/_components/EmailPreviewPane', () => ({ EmailPreviewPane: () => null }))

import { EmailTemplatesClient } from '@/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import { COALESCE_MS } from '@/lib/agent-changes/use-agent-changes'
import { EMAIL_TEMPLATE_TYPES } from '@/lib/email/types'
import { isStaleVersion } from '@/lib/save-version/save-version'

const V1 = '2026-10-22T01:00:00.000Z'
const V2 = '2026-10-22T02:00:00.000Z'
const copy = en.dashboard.agentChanged
const content = (subject: string) => ({ subject, greeting: 'Hi', ctaLabel: 'Open', closing: 'Thanks' })
const row = (subject: string, updatedAt = V1, enabled = true) => ({
    id: 1, templateType: 'order-confirmation', recipient: 'buyer', enabled, contentEn: content(subject), contentMs: content(subject), updatedAt,
})
const defaultsByType = Object.fromEntries(EMAIL_TEMPLATE_TYPES.map((t) => [t, { contentEn: content('Default subject'), contentMs: content('Default subject') }])) as never

/** the store the actions work on, and what a server render of the page would pass */
const store = { row: null as ReturnType<typeof row> | null, clock: 0, setRows: (_: unknown[]) => {} }
function Harness({ first }: { first: unknown[] }) {
    const [rows, setRows] = useState(first)
    store.setRows = setRows
    return (
        <>
            <AgentRefresh kinds={['email_template']} />
            <EmailTemplatesClient initialRows={rows} defaultsByType={defaultsByType} />
        </>
    )
}
const mount = (first: unknown[]) => {
    store.row = (first[0] as typeof store.row) ?? null
    nav.refresh.mockImplementation(() => act(() => store.setRows(store.row ? [store.row] : [])))
    return render(<I18nProvider defaultLocale="en"><TooltipProvider><Harness first={first} /></TooltipProvider></I18nProvider>)
}
const open = () => fireEvent.click(screen.getAllByText('Order Confirmation')[0]!)
const save = () => fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
const assistantRewrites = async (subject: string) => {
    store.row = row(subject, V2)
    await act(async () => {
        announceAgentChange({ action: 'applied', kind: 'store.email_templates_patch', entities: [{ kind: 'email_template', id: 'order-confirmation' }], changeSetId: `cs-${Math.random()}`, at: Date.now() })
        // the screen hears it once the change window closes: let that land before the next step
        await new Promise((resolve) => setTimeout(resolve, COALESCE_MS + 20))
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    store.clock = 0
    // the real check, in place of the real database
    // the store holds the order-confirmation row only; every other template is on its default
    actions.save.mockImplementation(async (input: { templateType: string; enabled: boolean; contentEn: ReturnType<typeof content>; expectedUpdatedAt?: string | null }) => {
        const stored = input.templateType === 'order-confirmation' ? store.row : null
        if (isStaleVersion(input.expectedUpdatedAt, stored?.updatedAt ?? null)) {
            return { success: false, ok: false, code: 'VERSION_CONFLICT', current: stored?.updatedAt ?? null }
        }
        const updatedAt = new Date(Date.parse(V2) + ++store.clock * 60_000).toISOString()
        if (input.templateType === 'order-confirmation') store.row = { ...row(input.contentEn.subject, updatedAt, input.enabled), contentEn: input.contentEn }
        return { success: true, updatedAt }
    })
    actions.settings.mockImplementation(async () => ({ success: true, rows: store.row ? [store.row] : [] }))
    actions.reset.mockResolvedValue({ success: true })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.restoreAllMocks()
})

describe('email template editor against a stale save [TC-AICP-335]', () => {
    it('TC-AICP-335: a saved row sends its version; the second save sends the version the first returned', async () => {
        mount([row('Old subject')])
        open()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'First' } })
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: V1 }))
        const afterFirst = store.row!.updatedAt

        fireEvent.change(screen.getByDisplayValue('First'), { target: { value: 'Second' } })
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: afterFirst }))
        expect(screen.queryByRole('status')).toBeNull()
    })

    it('TC-AICP-335: started from the default: sends null; the save creates the row, the next one sends its version', async () => {
        mount([])
        open()
        fireEvent.change(screen.getByDisplayValue('Default subject'), { target: { value: 'My first' } })
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: null }))

        fireEvent.change(screen.getByDisplayValue('My first'), { target: { value: 'My second' } })
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: expect.stringMatching(/^2026-10-22T/) }))
    })

    it('TC-AICP-335: from the default, the assistant created the row meanwhile: Save is refused (null vs a row); Save mine anyway sends the row\'s version', async () => {
        mount([])
        open()
        fireEvent.change(screen.getByDisplayValue('Default subject'), { target: { value: 'Mine' } })
        store.row = row('Assistant subject', V2)

        save()

        expect(await screen.findByText(copy.conflict.template)).toBeInTheDocument()
        expect(screen.getAllByRole('status')).toHaveLength(1)
        expect(screen.getByDisplayValue('Mine')).toBeInTheDocument()
        expect(toast.error).not.toHaveBeenCalled()
        expect(store.row!.contentEn.subject).toBe('Assistant subject')

        fireEvent.click(screen.getByRole('button', { name: copy.saveAnyway }))
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: V2 }))
        expect(store.row!.contentEn.subject).toBe('Mine')
    })

    it('TC-AICP-335: Load the latest reads the saved rows and drops the edit; the next save carries the row\'s version', async () => {
        mount([row('Old subject')])
        open()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'Mine' } })
        store.row = row('Assistant subject', V2)
        save()
        await screen.findByText(copy.conflict.template)

        fireEvent.click(screen.getByRole('button', { name: copy.loadLatest }))

        await waitFor(() => expect(screen.getByDisplayValue('Assistant subject')).toBeInTheDocument())
        expect(screen.queryByRole('status')).toBeNull()
        fireEvent.change(screen.getByDisplayValue('Assistant subject'), { target: { value: 'After load' } })
        save()
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: V2 }))
    })

    it('TC-AICP-335: the row was reset meanwhile (current null): Save mine anyway sends null and creates it', async () => {
        mount([row('Old subject')])
        open()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'Mine' } })
        store.row = null
        save()
        await screen.findByText(copy.conflict.template)

        fireEvent.click(screen.getByRole('button', { name: copy.saveAnyway }))

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: null }))
        expect(store.row!.contentEn.subject).toBe('Mine')
    })

    it('TC-AICP-335: assistant change + Keep mine, then Save hits the conflict', async () => {
        mount([row('Old subject')])
        open()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'Mine' } })
        await assistantRewrites('Assistant subject')
        fireEvent.click(await screen.findByRole('button', { name: copy.keepMine }))

        save()

        expect(await screen.findByText(copy.conflict.template)).toBeInTheDocument()
        expect(screen.getByDisplayValue('Mine')).toBeInTheDocument()
        expect(actions.save).toHaveBeenCalledWith(expect.objectContaining({ expectedUpdatedAt: V1 }))
        expect(store.row!.contentEn.subject).toBe('Assistant subject')
    })

    it('TC-AICP-335: a refresh that left the content as it was (only the timestamp moved) moves the version on, so Save is not refused', async () => {
        mount([row('Old subject')])
        open()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'Mine' } })
        await assistantRewrites('Old subject')
        await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1))
        expect(screen.queryByText(copy.template)).toBeNull()

        save()

        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ expectedUpdatedAt: V2 }))
    })
})

describe('email template list switch against a stale row [TC-AICP-336]', () => {
    const toggles = () => screen.getAllByRole('switch')
    const stateOf = (el: HTMLElement) => el.getAttribute('aria-checked')

    it('TC-AICP-336: sends the row\'s version (null for a default template) and keeps the saved row\'s version afterwards', async () => {
        mount([row('Old subject')])
        const first = toggles().find((s) => stateOf(s) === 'true')!
        fireEvent.click(first)
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
        expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ templateType: 'order-confirmation', enabled: false, expectedUpdatedAt: V1 }))

        // another template has no row: it started from the default
        const other = toggles().find((s) => stateOf(s) === 'true')!
        fireEvent.click(other)
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2))
        expect(actions.save.mock.calls.at(-1)![0]).toMatchObject({ expectedUpdatedAt: null })
    })

    it('TC-AICP-336: a refused switch is put back, the rows are read again, and one small toast says so', async () => {
        mount([row('Old subject')])
        const target = toggles().find((s) => stateOf(s) === 'true')!
        const before = toggles().map(stateOf)
        // the assistant re-wrote the row since the list was read
        store.row = row('Assistant subject', V2)

        fireEvent.click(target)

        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
        expect(toast.error).toHaveBeenCalledWith(copy.changedElsewhere)
        await waitFor(() => expect(actions.settings).toHaveBeenCalledTimes(1))
        expect(toast.success).not.toHaveBeenCalled()
        expect(toggles().map(stateOf)).toEqual(before)
        expect(screen.queryByRole('dialog')).toBeNull()
    })
})
