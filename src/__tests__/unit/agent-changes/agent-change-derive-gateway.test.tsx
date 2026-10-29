/**
 * TC-AICP-299 — a change set becomes the change screens need: applied / undone, the records it names, a fallback to the
 * kinds the action touches when it names none (an undo of an old card), a `media` entry when it brings in new pictures,
 * nothing for a rejected, expired or action-less set.
 * TC-AICP-300 — the shared gateway: Approve (single, Approve all and Auto-approve all end in decideChangeSet) and Undo
 * announce a typed change once the server answered; Reject, and a failed call, announce nothing; the dock's decide / undo
 * no longer call router.refresh. Real: derive, bus, AnnouncingGateway, DashboardAgentDock. Faked: the vendored
 * transport's HttpGateway (the server answers), the agent runtime and panel.
 */
import type { ChangeSet } from '@ech/agent-core'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import { AGENT_CHANGE_EVENT } from '@/lib/agent-changes/bus'
import { changeFromChangeSet } from '@/lib/agent-changes/derive'
import type { AgentChange } from '@/lib/agent-changes/types'

const server = vi.hoisted(() => ({ answer: null as unknown, fail: false }))
vi.mock('@ech/agent-transport', () => ({
    HttpGateway: class {
        async decideChangeSet() {
            if (server.fail) throw new Error('boom')
            return server.answer
        }
        async undoChangeSet() {
            if (server.fail) throw new Error('boom')
            return server.answer
        }
    },
}))

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
const panel = vi.hoisted(() => ({ props: null as null | { onDecide: (c: unknown, d: string) => Promise<unknown>; onUndo?: (c: unknown) => Promise<unknown> } }))
const gateway = vi.hoisted(() => ({ decide: vi.fn(), undo: vi.fn() }))

vi.mock('next/navigation', () => ({
    usePathname: () => '/products',
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ refresh: nav.refresh, push: nav.push, replace: vi.fn() }),
}))
vi.mock('@ech/agent-ui/styles.css', () => ({}))
vi.mock('@ech/agent-react', () => ({
    AgentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useChangeSets: () => ({ data: [], refresh: vi.fn() }),
    useDecideChangeSet: () => gateway.decide,
    useUndoChangeSet: () => gateway.undo,
    // the work queue is not under test here: nothing queued
    useWork: () => ({ data: undefined, loading: false, error: undefined, refresh: vi.fn(), setState: vi.fn() }),
}))
vi.mock('@ech/agent-react/chat', () => ({
    enterSession: vi.fn(),
    outsideWebBuilderChats: () => true,
    useAgentChatRuntime: () => ({ send: vi.fn(), history: {} }),
}))
vi.mock('@ech/agent-ui', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ech/agent-ui')>()),
    AgentAssistantPanel: (props: never) => {
        panel.props = props
        return null
    },
    summonMascot: vi.fn(),
}))


const set = (over: Record<string, unknown> = {}): ChangeSet =>
    ({
        id: 'cs_1',
        runId: 'run_1',
        domain: 'products',
        title: 'Edit product',
        summary: '',
        risk: 'low',
        blastRadius: { kind: 'product', count: 1, label: '1 product' },
        diffs: [{ entity: { kind: 'product', id: '7' }, field: 'name', before: 'a', after: 'b', provenance: 'generated' }],
        guardrails: [],
        status: 'applied',
        stagedBy: 'agent',
        stagedAt: '2026-10-22T00:00:00Z',
        expiresAt: '2026-10-23T00:00:00Z',
        action: { kind: 'shop_product.update', payload: {} },
        result: { entities: [{ kind: 'product', id: '7' }], links: [] },
        ...over,
    }) as ChangeSet

describe('changeFromChangeSet [TC-AICP-299]', () => {
    it('applied: the records the result names', () => {
        expect(changeFromChangeSet(set(), 5)).toEqual({
            action: 'applied',
            kind: 'shop_product.update',
            domain: 'products',
            entities: [{ kind: 'product', id: '7' }],
            changeSetId: 'cs_1',
            at: 5,
        })
    })

    it('undone: a reverted set keeps the records of the apply', () => {
        const change = changeFromChangeSet(set({ status: 'reverted' }))
        expect(change).toMatchObject({ action: 'undone', entities: [{ kind: 'product', id: '7' }] })
    })

    it.each([
        ['blog.update', 'blog_post'],
        ['shop_product.set_status', 'product'],
        ['store.categories_restore', 'store_category'],
        ['store.discounts_patch', 'store_discount'],
        ['store.orders_patch', 'store_order'],
        ['site.page_patch', 'site'],
    ])('names the kind %s touches when the result lists no record', (kind, entityKind) => {
        const change = changeFromChangeSet(set({ action: { kind, payload: {} }, result: { entities: [], links: [] } }))
        expect(change?.entities).toEqual([{ kind: entityKind, id: '*' }])
    })

    it('customers: every kind a customers patch can touch', () => {
        const change = changeFromChangeSet(set({ action: { kind: 'store.customers_restore', payload: {} }, result: undefined }))
        expect(change?.entities.map((e) => e.kind)).toEqual(['store_customer', 'contact_lead', 'lead_reply', 'email_template'])
    })

    it('adds media when a chat upload or stock photo comes in, not for a library picture', () => {
        const withNew = changeFromChangeSet(set({ action: { kind: 'shop_product.update', payload: { images: [{ ref: 'attachment:abc' }] } } }))
        expect(withNew?.entities).toContainEqual({ kind: 'media', id: '*' })
        const reused = changeFromChangeSet(set({ action: { kind: 'shop_product.update', payload: { images: [{ ref: 'media:12' }] } } }))
        expect(reused?.entities.some((e) => e.kind === 'media')).toBe(false)
    })

    it.each(['pending', 'rejected', 'expired', 'superseded'])('nothing for a %s set', (status) => {
        expect(changeFromChangeSet(set({ status }))).toBeNull()
    })

    it('nothing for a set without an action', () => {
        expect(changeFromChangeSet(set({ action: undefined }))).toBeNull()
    })
})

describe('AnnouncingGateway [TC-AICP-300]', () => {
    const heard: AgentChange[] = []
    const onChange = (e: Event) => heard.push((e as CustomEvent<AgentChange>).detail)
    beforeEach(() => {
        heard.length = 0
        server.fail = false
        window.addEventListener(AGENT_CHANGE_EVENT, onChange)
    })
    afterEach(() => window.removeEventListener(AGENT_CHANGE_EVENT, onChange))

    it('announces an applied change after a successful approve', async () => {
        const { createAgentGateway } = await import('@/lib/agent-changes/agent-gateway')
        server.answer = set()
        const decided = await createAgentGateway().decideChangeSet('cs_1', 'approve', 'self')
        expect(decided.status).toBe('applied')
        expect(heard).toHaveLength(1)
        expect(heard[0]).toMatchObject({ action: 'applied', kind: 'shop_product.update', changeSetId: 'cs_1' })
    })

    it('announces an undone change after undo', async () => {
        const { createAgentGateway } = await import('@/lib/agent-changes/agent-gateway')
        server.answer = set({ status: 'reverted' })
        await createAgentGateway().undoChangeSet?.('cs_1')
        expect(heard).toHaveLength(1)
        expect(heard[0]).toMatchObject({ action: 'undone' })
    })

    it('announces nothing for a reject or a failed call', async () => {
        const { createAgentGateway } = await import('@/lib/agent-changes/agent-gateway')
        server.answer = set({ status: 'rejected' })
        await createAgentGateway().decideChangeSet('cs_1', 'reject', 'self')
        server.fail = true
        await expect(createAgentGateway().decideChangeSet('cs_1', 'approve', 'self')).rejects.toThrow('boom')
        await expect(createAgentGateway().undoChangeSet?.('cs_1')).rejects.toThrow('boom')
        expect(heard).toHaveLength(0)
    })
})

describe('DashboardAgentDock approve / undo [TC-AICP-300]', () => {
    afterEach(cleanup)

    it('hands the decision to the gateway and does not refresh the whole page', async () => {
        gateway.decide.mockResolvedValue(set())
        gateway.undo.mockResolvedValue(set({ status: 'reverted' }))
        const { default: Dock } = await import('@/components/agent/DashboardAgentDock')
        render(
            <I18nProvider>
                <Dock />
            </I18nProvider>,
        )
        await waitFor(() => expect(panel.props).not.toBeNull())
        await act(async () => void (await panel.props?.onDecide(set({ status: 'pending' }), 'approve')))
        await act(async () => void (await panel.props?.onUndo?.(set())))
        expect(gateway.decide).toHaveBeenCalledWith('cs_1', 'approve', 'self', undefined, undefined)
        expect(gateway.undo).toHaveBeenCalledWith('cs_1')
        expect(nav.refresh).not.toHaveBeenCalled()
    })
})
