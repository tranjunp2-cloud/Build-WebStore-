/**
 * TC-AIPROV-PW-011..013, 015 — Providers page: key dialog (test before save, a full key is never rendered), remove-key consequences,
 * section save bar + confirm + PUT bodies, endpoints, test button.
 * Real: components, lib helpers, browser api. Faked: fetch, next/navigation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), usePathname: () => '/studio/settings/ai/models/providers' }))

import { ProvidersClient } from '@/app/studio/settings/ai/models/_components/providers-client'
import type { SettingsView } from '@/lib/admin/ai-providers/types'
import { fakeApi } from './dom-helpers'
import { healthyView, okTest, provider } from './fixtures'

const FULL_KEY = 'sk-ant-REALLY-SECRET-0123456789CDEF'

const withLast4 = (last4: string): SettingsView => {
  const view = healthyView()
  view.providers[1] = provider({ ...view.providers[1], key: { state: 'set', last4, setBy: 'minh@primecommerce.asia', setAt: '2026-10-30T09:00:00.000Z' } })
  return view
}
const PRICED = ['openai:gpt-5.4-nano', 'anthropic:claude-haiku-5-5']
const mount = (view = healthyView()) => render(<ProvidersClient initial={view} priced={PRICED} />)
const card = (name: string) => screen.getByRole('region', { name })
const open = (name: string, button: string) => fireEvent.click(within(card(name)).getByRole('button', { name: button }))
const typeKey = (value: string) => fireEvent.change(screen.getByLabelText('API key', { selector: 'input' }), { target: { value } })

beforeEach(() => { vi.stubGlobal('fetch', undefined) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('[TC-AIPROV-PW-011] key dialog: test before save', () => {
  it('tests the typed key first, saves only after it passed, then shows the last 4 characters only', async () => {
    const api = fakeApi({
      'POST /providers/anthropic/test': { body: okTest({ ms: 410 }) },
      'PUT /providers/anthropic/key': { body: withLast4('CDEF') },
    })
    vi.stubGlobal('fetch', api.fn)
    mount()
    open('Anthropic', 'Replace')
    expect(screen.getByRole('dialog', { name: 'Replace Anthropic key' })).toBeInTheDocument()
    typeKey(FULL_KEY)
    expect(screen.getByRole('button', { name: 'Test key' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save key' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Test key' }))
    expect(await screen.findByRole('button', { name: 'Save key' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Key works · 410 ms')
    expect(api.calls).toEqual([{ method: 'POST', path: '/providers/anthropic/test', body: { apiKey: FULL_KEY } }])

    fireEvent.click(screen.getByRole('button', { name: 'Save key' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /providers/anthropic/test', 'PUT /providers/anthropic/key'])
    expect(api.calls[1].body).toEqual({ apiKey: FULL_KEY })
    expect(within(card('Anthropic')).getByText('•••• CDEF')).toBeInTheDocument()
  })

  it('does not save a key that fails its test and says why', async () => {
    const api = fakeApi({ 'POST /providers/anthropic/test': { body: okTest({ ok: false, code: 'invalid-key', message: '401 Unauthorized' }) } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    open('Anthropic', 'Replace')
    typeKey(FULL_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Test key' }))
    expect(await screen.findByText(/Invalid key: 401 Unauthorized\. The key was not saved\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save key' })).toBeNull()
    expect(api.calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('asks for a new test when the key is edited after a pass, and refuses a key that is too short', async () => {
    const api = fakeApi({ 'POST /providers/anthropic/test': { body: okTest() } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    open('Anthropic', 'Replace')
    typeKey('short')
    fireEvent.click(screen.getByRole('button', { name: 'Test key' }))
    expect(await screen.findByText('That looks too short for a key. Paste the whole key.')).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
    typeKey(FULL_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Test key' }))
    await screen.findByRole('button', { name: 'Save key' })
    typeKey(`${FULL_KEY}X`)
    expect(screen.getByRole('button', { name: 'Test key' })).toBeInTheDocument()
  })
})

describe('[TC-AIPROV-PW-012] a full key is never rendered', () => {
  it('keeps the field masked until Show, and leaves no trace of the key in the page after saving', async () => {
    const api = fakeApi({ 'POST /providers/anthropic/test': { body: okTest() }, 'PUT /providers/anthropic/key': { body: withLast4('CDEF') } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    open('Anthropic', 'Replace')
    const field = screen.getByLabelText('API key', { selector: 'input' })
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('autocomplete', 'off')
    typeKey(FULL_KEY)
    fireEvent.click(screen.getByRole('button', { name: 'Show key' }))
    expect(field).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Test key' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save key' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.textContent).not.toContain(FULL_KEY)
    expect([...document.querySelectorAll('input')].some((input) => input.value.includes(FULL_KEY))).toBe(false)
  })

  it('shows a stored key as dots + last 4, from the environment or from Studio', () => {
    mount()
    expect(within(card('OpenAI')).getByText('•••• 9c1d')).toBeInTheDocument()
    expect(within(card('OpenAI')).getByText(/from OPENAI_API_KEY in the environment/)).toBeInTheDocument()
    expect(within(card('Anthropic')).getByText('•••• 4f2a')).toBeInTheDocument()
    expect(within(card('Google (Gemini)')).getByRole('button', { name: 'Add key' })).toBeInTheDocument()
    expect(within(card('Google (Gemini)')).getByRole('switch')).toBeDisabled()
  })
})

describe('remove key', () => {
  it('lists, per tier, which model answers instead or that the tier stops working, then deletes the key', async () => {
    const api = fakeApi({ 'DELETE /providers/anthropic/key': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    open('Anthropic', 'Remove')
    const dialog = screen.getByRole('alertdialog', { name: 'Remove the Anthropic key?' })
    expect(dialog).toHaveTextContent('Fast: openai:gpt-5.4-nano answers instead')
    expect(dialog).toHaveTextContent('Quality: no model left: Quality stops working')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove key' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(api.calls).toEqual([{ method: 'DELETE', path: '/providers/anthropic/key', body: undefined }])
    expect(refresh).toHaveBeenCalled()
  })
})

describe('[TC-AIPROV-PW-013] section save bar', () => {
  it('collects edits, lists them in a confirm dialog and sends one PUT per changed provider', async () => {
    const api = fakeApi({ 'PUT /providers/openai': { body: healthyView() }, 'PUT /providers/anthropic': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    expect(screen.queryByRole('region', { name: 'Unsaved providers changes' })).toBeNull()
    fireEvent.click(within(card('Anthropic')).getByRole('switch'))
    fireEvent.change(screen.getByLabelText('OpenAI base URL'), { target: { value: 'https://proxy.example.com/v1' } })
    const bar = screen.getByRole('region', { name: 'Unsaved providers changes' })
    expect(bar).toHaveTextContent('2 unsaved changes')
    fireEvent.click(within(bar).getByRole('button', { name: 'Save changes' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Save 2 changes?' })
    expect(dialog).toHaveTextContent('OpenAI base URL: default → https://proxy.example.com/v1')
    expect(dialog).toHaveTextContent('Anthropic: turned off')
    expect(dialog).toHaveTextContent('Takes effect within 1 min')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(api.calls).toEqual([
      { method: 'PUT', path: '/providers/openai', body: { baseUrl: 'https://proxy.example.com/v1' } },
      { method: 'PUT', path: '/providers/anthropic', body: { enabled: false } },
    ])
    expect(screen.getByRole('status')).toHaveTextContent('Saved. Takes effect within 1 min.')
  })

  it('blocks Save while a base URL is not an address, and Discard drops the edits', () => {
    mount()
    fireEvent.change(screen.getByLabelText('OpenAI base URL'), { target: { value: 'nope' } })
    const bar = screen.getByRole('region', { name: 'Unsaved providers changes' })
    expect(within(bar).getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a full address')
    fireEvent.click(within(bar).getByRole('button', { name: 'Discard' }))
    expect(screen.queryByRole('region', { name: 'Unsaved providers changes' })).toBeNull()
  })

  it('keeps the error on screen when the platform refuses the values', async () => {
    const api = fakeApi({ 'PUT /providers/anthropic': { status: 422, body: { error: 'x', errors: [{ path: 'baseUrl', message: 'not reachable' }] } } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    fireEvent.click(within(card('Anthropic')).getByRole('switch'))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('baseUrl: not reachable')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})

describe('[TC-AIPROV-PW-015] test button and endpoints', () => {
  it('tests a provider with its stored key and shows the result', async () => {
    const api = fakeApi({ 'POST /providers/openai/test': { body: okTest({ ms: 123 }) } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    open('OpenAI', 'Test')
    expect(await within(card('OpenAI')).findByText(/OK · 123 ms/)).toBeInTheDocument()
    expect(api.calls).toEqual([{ method: 'POST', path: '/providers/openai/test', body: {} }])
  })

  it('shows "No endpoints yet" and adds one: validates the name, posts the contract body, then tests it', async () => {
    const added = healthyView()
    added.providers.push(provider({ id: 'compat-local', label: 'local', kind: 'compat', options: { reasoning: false, structuredOutputs: true }, key: { state: 'none', last4: null, setBy: null, setAt: null }, lastTest: null }))
    const api = fakeApi({ 'POST /endpoints': { body: added }, 'POST /providers/compat-local/test': { body: okTest() } })
    vi.stubGlobal('fetch', api.fn)
    mount()
    expect(screen.getByText(/No custom endpoints yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add endpoint' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add endpoint' }))
    expect(screen.getByText('Give the endpoint a short name.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'local' } })
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'not a url' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add endpoint' }))
    expect(screen.getByText(/Enter a full address/)).toBeInTheDocument()
    expect(api.calls).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'http://10.0.4.12:8787/v1' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add endpoint' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.calls[0]).toEqual({ method: 'POST', path: '/endpoints', body: { name: 'local', baseUrl: 'http://10.0.4.12:8787/v1', reasoning: false, structuredOutputs: true } })
    await waitFor(() => expect(api.calls[1]).toEqual({ method: 'POST', path: '/providers/compat-local/test', body: {} }))
  })

  it('flags models without a price, and removes an endpoint after a confirm', async () => {
    const view = healthyView()
    view.providers.push(provider({ id: 'compat-local', label: 'local', kind: 'compat', models: ['cx/mid'], options: { structuredOutputs: true }, baseUrl: 'http://vllm:8000/v1', baseUrlSource: 'studio' }))
    // an endpoint that only lives in the environment shows its address and cannot be removed here
    view.providers.push(provider({ id: 'compat-envonly', label: 'envonly', kind: 'compat', baseUrl: 'http://env-host/v1', baseUrlSource: 'env', key: { state: 'env', last4: null, setBy: null, setAt: null } }))
    const api = fakeApi({ 'DELETE /endpoints/local': { body: healthyView() } })
    vi.stubGlobal('fetch', api.fn)
    mount(view)
    expect(within(card('OpenAI')).getByText('gpt-5.4-mini').closest('.pm-chip')).toHaveAttribute('data-unpriced')
    expect(within(card('OpenAI')).getByText('gpt-5.4-nano').closest('.pm-chip')).not.toHaveAttribute('data-unpriced')
    expect(screen.queryByRole('button', { name: 'Remove compat-envonly' })).toBeNull()
    expect(screen.getByRole('textbox', { name: 'compat-envonly base URL' })).toHaveAttribute('placeholder', 'Environment: http://env-host/v1')
    expect(screen.getAllByText('key from the environment').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Remove compat-local' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove endpoint' }))
    await waitFor(() => expect(api.calls).toEqual([{ method: 'DELETE', path: '/endpoints/local', body: undefined }]))
    await act(async () => undefined)
  })
})
