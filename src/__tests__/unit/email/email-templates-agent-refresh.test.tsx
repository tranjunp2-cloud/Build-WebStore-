/**
 * TC-AICP-316 — email templates: an assistant change to a template renders the server data ONCE per burst (other kinds
 * do nothing); the list shows the new rows; an open editor for the changed template with no unsaved edits is replaced
 * silently, with unsaved edits it keeps them and shows the notice (Reload takes the new text, Keep mine dismisses); an
 * editor for another template, or a refresh that changed nothing for its template, is left alone.
 * Real: AgentRefresh, EmailTemplatesClient (list + editor), useAgentChanges, announceAgentChange (the bus), en strings.
 * Faked: next/navigation (`refresh` hands the harness the rows a server render would), the template actions, sonner,
 * the preview pane. The harness stands in for the server page: it owns `initialRows`.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh, push: vi.fn(), replace: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/(dashboard)/settings/email-templates/actions', () => ({
    saveEmailTemplateConfig: vi.fn(async () => ({ success: true })),
    resetEmailTemplateConfig: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/app/(dashboard)/settings/email-templates/_components/EmailPreviewPane', () => ({ EmailPreviewPane: () => null }))

import { EmailTemplatesClient } from '@/app/(dashboard)/settings/email-templates/_components/EmailTemplatesClient'
import { TooltipProvider } from '@/components/ui/tooltip'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'
import { announceAgentChange, resetAgentChangeBus } from '@/lib/agent-changes/bus'
import type { AgentChange } from '@/lib/agent-changes/types'
import { EMAIL_TEMPLATE_TYPES } from '@/lib/email/types'

const content = (subject: string) => ({ subject, greeting: 'Hi', ctaLabel: 'Open', closing: 'Thanks' })
const row = (templateType: string, subject: string, enabled = true) => ({
    id: templateType, templateType, recipient: 'buyer', enabled, contentEn: content(subject), contentMs: content(subject), updatedAt: '2026-10-01T00:00:00Z',
})
const defaultsByType = Object.fromEntries(EMAIL_TEMPLATE_TYPES.map((t) => [t, { contentEn: content(''), contentMs: content('') }])) as never

/** what the server page would pass after a refresh; the test sets it before announcing */
const server = { rows: [] as unknown[], setRows: (_: unknown[]) => {} }
function Harness({ first }: { first: unknown[] }) {
    const [rows, setRows] = useState(first)
    server.setRows = setRows
    return (
        <>
            <AgentRefresh kinds={['email_template']} />
            <EmailTemplatesClient initialRows={rows} defaultsByType={defaultsByType} />
        </>
    )
}
const mount = (first: unknown[]) => {
    nav.refresh.mockImplementation(() => act(() => server.setRows([...server.rows])))
    return render(<I18nProvider defaultLocale="en"><TooltipProvider><Harness first={first} /></TooltipProvider></I18nProvider>)
}

const change = (id: string, kind = 'email_template'): AgentChange => ({
    action: 'applied', kind: 'store.customers_patch', entities: [{ kind, id }], changeSetId: `cs-${id}-${Math.random()}`, at: Date.now(),
})
const notice = en.dashboard.agentChanged.template
const settle = () => act(() => new Promise((r) => setTimeout(r, 300)))
const openEditor = () => {
    fireEvent.click(screen.getAllByText('Order Confirmation')[0])
}

beforeEach(() => {
    nav.refresh.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
    cleanup()
    resetAgentChangeBus()
    vi.restoreAllMocks()
})

describe('email templates follow the assistant [TC-AICP-316]', () => {
    it('TC-AICP-316: renders the server data once per burst, and only for an email template', async () => {
        server.rows = [row('order-confirmation', 'New subject')]
        mount([row('order-confirmation', 'Old subject')])

        act(() => announceAgentChange(change('1', 'store_order')))
        await settle()
        expect(nav.refresh).not.toHaveBeenCalled()

        act(() => { announceAgentChange(change('order-confirmation')); announceAgentChange(change('order-shipped')); announceAgentChange(change('welcome')) })
        await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1))
        await settle()
        expect(nav.refresh).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-316: an open editor without unsaved edits is replaced silently', async () => {
        server.rows = [row('order-confirmation', 'New subject')]
        mount([row('order-confirmation', 'Old subject')])
        openEditor()
        expect(screen.getByDisplayValue('Old subject')).toBeInTheDocument()

        act(() => announceAgentChange(change('order-confirmation')))
        await waitFor(() => expect(screen.getByDisplayValue('New subject')).toBeInTheDocument())
        expect(screen.queryByText(notice)).toBeNull()
    })

    it('TC-AICP-316: unsaved edits are kept with the notice; Reload takes the new text, Keep mine dismisses', async () => {
        server.rows = [row('order-confirmation', 'New subject')]
        mount([row('order-confirmation', 'Old subject')])
        openEditor()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'My subject' } })

        act(() => announceAgentChange(change('order-confirmation')))
        await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument())
        expect(screen.getByDisplayValue('My subject')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: en.dashboard.agentChanged.keepMine }))
        expect(screen.queryByText(notice)).toBeNull()
        expect(screen.getByDisplayValue('My subject')).toBeInTheDocument()

        // a second change brings the notice back; Reload replaces the edits with the new text
        server.rows = [row('order-confirmation', 'Newer subject')]
        act(() => announceAgentChange(change('order-confirmation')))
        await waitFor(() => expect(screen.getByText(notice)).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: en.dashboard.agentChanged.reload }))
        expect(screen.getByDisplayValue('Newer subject')).toBeInTheDocument()
        expect(screen.queryByText(notice)).toBeNull()
    })

    it('TC-AICP-316: a change to another template leaves the open editor and its edits alone', async () => {
        server.rows = [row('order-confirmation', 'Old subject'), row('order-completed', 'Changed elsewhere')]
        mount([row('order-confirmation', 'Old subject')])
        openEditor()
        fireEvent.change(screen.getByDisplayValue('Old subject'), { target: { value: 'My subject' } })

        act(() => announceAgentChange(change('order-completed')))
        await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1))
        await settle()
        expect(screen.queryByText(notice)).toBeNull()
        expect(screen.getByDisplayValue('My subject')).toBeInTheDocument()
    })

    it('TC-AICP-316: the list shows the new state after the refresh', async () => {
        server.rows = [row('order-confirmation', 'Old subject', false)]
        mount([row('order-confirmation', 'Old subject', true)])
        const switches = () => screen.getAllByRole('switch').map((s) => s.getAttribute('aria-checked') ?? s.getAttribute('data-state'))
        const before = switches()

        act(() => announceAgentChange(change('order-confirmation')))
        await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(switches()).not.toEqual(before))
    })
})
