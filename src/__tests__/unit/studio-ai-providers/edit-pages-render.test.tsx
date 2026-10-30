/**
 * TC-AIPROV-PW-014, 016, 018..020 — Routing chain editor, Runtime validation, Tasks, History restore / filter / empty.
 * Real: components, lib helpers, browser api. Faked: fetch, next/navigation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), usePathname: () => '/studio/settings/ai/models/routing' }))

import { HistoryClient } from '@/app/studio/settings/ai/models/_components/history-client'
import { RoutingClient } from '@/app/studio/settings/ai/models/_components/routing-client'
import { RuntimeClient } from '@/app/studio/settings/ai/models/_components/runtime-client'
import { TasksClient } from '@/app/studio/settings/ai/models/_components/tasks-client'
import { fakeApi } from './dom-helpers'
import { brokenView, healthyView, HISTORY } from './fixtures'

const PRICED = ['anthropic:claude-haiku-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.4-nano', 'openai:gpt-image-1']
const save = () => fireEvent.click(within(screen.getByRole('region', { name: /Unsaved .* changes/ })).getByRole('button', { name: 'Save changes' }))
const confirm = () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save changes' }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('[TC-AIPROV-PW-014] chain editor', () => {
  it('reorders, swaps and adds a fallback, then PUTs only the changed tier after a confirm', async () => {
    const api = fakeApi({ 'PUT /routing': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    render(<RoutingClient initial={healthyView()} priced={PRICED} />)
    expect(screen.queryByRole('region', { name: /Unsaved/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Move Fast model 2 up' }))
    expect((screen.getByLabelText('Fast model 1') as HTMLSelectElement).value).toBe('openai:gpt-5.4-nano')
    fireEvent.click(screen.getByRole('button', { name: 'Move Fast model 1 down' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Add fallback' })[0])
    const added = screen.getByLabelText('Fast model 3')
    fireEvent.change(added, { target: { value: 'anthropic:claude-sonnet-5-5' } })
    expect(screen.getByRole('region', { name: 'Unsaved routing changes' })).toHaveTextContent('1 unsaved change')
    save()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Fast chain: claude-haiku-5-5 → gpt-5.4-nano → claude-haiku-5-5 → gpt-5.4-nano → claude-sonnet-5-5')
    confirm()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(api.calls).toEqual([{ method: 'PUT', path: '/routing', body: { tiers: { fast: { chain: ['anthropic:claude-haiku-5-5', 'openai:gpt-5.4-nano', 'anthropic:claude-sonnet-5-5'] } } } }])
    expect(refresh).toHaveBeenCalled()
  })

  it('edits effort (with its one-line meaning), timeout in seconds and picture format', async () => {
    const api = fakeApi({ 'PUT /routing': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    render(<RoutingClient initial={healthyView()} priced={PRICED} />)
    const effort = screen.getAllByLabelText('Effort')[0] as HTMLSelectElement
    expect(effort.value).toBe('low')
    fireEvent.change(effort, { target: { value: 'high' } })
    expect(screen.getAllByText('Thinks longer. Better plans, slower and costlier.')).toHaveLength(2) // Fast now, Quality already
    fireEvent.change(screen.getAllByLabelText('Timeout')[1], { target: { value: '90' } })
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }))
    save()
    confirm()
    await waitFor(() => expect(api.calls).toHaveLength(1))
    expect(api.calls[0].body).toEqual({ tiers: { fast: { effort: 'high' }, balanced: { timeoutMs: 90_000 }, image: { format: 'png' } } })
  })

  it('flags a model without a price or a key, blocks an empty chain, and shows who answers now', () => {
    const view = brokenView()
    render(<RoutingClient initial={view} priced={PRICED} />)
    const quality = screen.getByRole('list', { name: 'Quality chain' })
    expect(within(quality).getByText('Skipped: key needs re-entry')).toBeInTheDocument()
    expect(within(quality).getByText('Answers now')).toBeInTheDocument()
    expect(within(quality).getAllByText('No price')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Image model 1' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one model, or this tier stops working.')
    expect(within(screen.getByRole('region', { name: 'Unsaved routing changes' })).getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('resets a tier saved in Studio to the environment after a confirm', async () => {
    const api = fakeApi({ 'PUT /routing': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    render(<RoutingClient initial={healthyView()} priced={PRICED} />)
    expect(screen.queryByRole('button', { name: 'Reset Image to environment' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reset Fast to environment' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(api.calls).toEqual([{ method: 'PUT', path: '/routing', body: { tiers: { fast: null } } }]))
  })
})

describe('[TC-AIPROV-PW-016] runtime page', () => {
  const field = (name: string) => screen.getByLabelText(name, { selector: 'input' })

  it('refuses queue wait + answer time above 290 s, names both fields, and allows exactly 290 s', async () => {
    const api = fakeApi({ 'PUT /runtime': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    render(<RuntimeClient initial={healthyView()} />)
    expect((field('Longest wait in the queue') as HTMLInputElement).value).toBe('90')
    fireEvent.change(field('Longest wait in the queue'), { target: { value: '120' } })
    const bar = screen.getByRole('region', { name: 'Unsaved runtime changes' })
    expect(within(bar).getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getAllByText(/must stay under 290 s \(now 320 s\)/)).toHaveLength(2)
    expect(field('Longest wait in the queue')).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(field('Longest wait in the queue'), { target: { value: '90' } })
    fireEvent.change(field('Time for one copilot answer'), { target: { value: '200' } })
    expect(screen.queryByRole('region', { name: 'Unsaved runtime changes' })).toBeNull()
    fireEvent.change(field('Longest wait in the queue'), { target: { value: '100' } })
    fireEvent.change(field('Time for one copilot answer'), { target: { value: '190' } })
    expect(within(screen.getByRole('region', { name: 'Unsaved runtime changes' })).getByRole('button', { name: 'Save changes' })).toBeEnabled()
    save()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Longest wait in the queue: 90 s → 100 s')
    confirm()
    await waitFor(() => expect(api.calls).toHaveLength(1))
    expect(api.calls[0].body).toEqual({ values: { runsPerDayPerShop: null, queueMaxWaitMs: 100_000, runBudgetMs: 190_000, suggestMode: null, toolRouting: null } })
  })

  it('shows the source, default, env name and a working reset; enum and switch knobs are editable', async () => {
    const api = fakeApi({ 'PUT /runtime': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    const view = healthyView()
    view.runtime[0] = { ...view.runtime[0], value: 150, source: 'studio' }
    render(<RuntimeClient initial={view} />)
    expect(screen.getByText('AI_SUGGEST_MODE')).toBeInTheDocument()
    expect(screen.getByText('Default 200')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset Copilot starts per shop per day to default' }))
    expect((field('Copilot starts per shop per day') as HTMLInputElement).value).toBe('200')
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Send only the tools a message needs' }))
    save()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('back to environment or default')
    confirm()
    await waitFor(() => expect(api.calls).toHaveLength(1))
    expect(api.calls[0].body).toEqual({ values: { runsPerDayPerShop: null, queueMaxWaitMs: null, runBudgetMs: null, suggestMode: 'off', toolRouting: false } })
  })
})

describe('[TC-AIPROV-PW-018] tasks page', () => {
  it('groups tasks, locks picture tasks, and PUTs the override map', async () => {
    const api = fakeApi({ 'PUT /tasks': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    render(<TasksClient initial={healthyView()} />)
    expect(screen.getByText('Chat replies')).toBeInTheDocument()
    expect(screen.getByText('Image only: no other tier makes pictures')).toBeInTheDocument()
    expect((screen.getByLabelText('Tier for Product description') as HTMLSelectElement).value).toBe('fast')
    fireEvent.change(screen.getByLabelText('Tier for Copilot chat reply'), { target: { value: 'quality' } })
    fireEvent.click(within(screen.getByRole('row', { name: /Product description/ })).getByRole('button', { name: 'Reset' }))
    save()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Product description: Fast → Balanced (default)')
    confirm()
    await waitFor(() => expect(api.calls).toHaveLength(1))
    expect(api.calls[0].body).toEqual({ overrides: { 'chat.reply': 'quality', 'product.description': null, 'picture.generate': null } })
  })
})

describe('[TC-AIPROV-PW-019] history restore', () => {
  it('offers Restore only on restorable, non-current versions, and lists what it undoes before restoring', async () => {
    const api = fakeApi({ 'POST /history/h1/restore': { body: healthyView() }, 'GET /history?limit=100': { body: { entries: HISTORY } } })
    vi.stubGlobal('fetch', api.fn)
    render(<HistoryClient initial={HISTORY} />)
    expect(screen.getAllByRole('button', { name: 'Restore this version' })).toHaveLength(1) // h3 is current, h2 is a key change
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText(/Keys can't be restored/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('Product description moved to Fast')
    expect(dialog).toHaveTextContent('Quality chain: haiku → sonnet')
    expect(dialog).not.toHaveTextContent('Anthropic key replaced')
    expect(dialog).toHaveTextContent('Keys stay as they are')
    expect(api.calls).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore this version' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /history/h1/restore', 'GET /history?limit=100'])
    expect(screen.getByRole('status')).toHaveTextContent('Version restored')
  })

  it('cancel writes nothing, and a failed restore keeps the dialog with the reason', async () => {
    const api = fakeApi({ 'POST /history/h1/restore': { status: 422, body: { error: 'This version cannot be restored.' } } })
    vi.stubGlobal('fetch', api.fn)
    render(<HistoryClient initial={HISTORY} />)
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(api.calls).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Restore this version' }))
    expect(await screen.findByText('This version cannot be restored.')).toBeInTheDocument()
  })
})

describe('[TC-AIPROV-PW-020] history filter and empty state', () => {
  it('filters by area', () => {
    render(<HistoryClient initial={HISTORY} />)
    fireEvent.click(screen.getByRole('link', { name: 'Providers' }))
    expect(screen.getByText('Anthropic key replaced')).toBeInTheDocument()
    expect(screen.queryByText('Quality chain: haiku → sonnet')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Runtime' }))
    expect(screen.getByText('No changes in this area.')).toBeInTheDocument()
  })
  it('says nothing was saved yet on a fresh install', () => {
    render(<HistoryClient initial={[]} />)
    expect(screen.getByText(/No changes yet\. Until someone saves a section here, every value comes from the environment\./)).toBeInTheDocument()
  })
})
