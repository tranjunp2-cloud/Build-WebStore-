/**
 * TC-AIPROV-PW-009..010 — Overview: tier tiles, banners, provider list, last change, empty (fresh install) and error (ai-platform down) states,
 * and the left rail with its problem badges.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }), usePathname: () => '/studio/settings/ai/models/routing' }))

import { ModelsRail } from '@/app/studio/settings/ai/models/_components/models-rail'
import { OverviewView } from '@/app/studio/settings/ai/models/_components/overview-view'
import { UnreachableBanner } from '@/app/studio/settings/ai/models/_components/unreachable-banner'
import { ModelsLinkSection } from '@/app/studio/settings/ai/_components/models-link-section'
import { AiSettingsTabs } from '@/app/studio/settings/_components/ai-settings-tabs'
import { brokenView, healthyView, HISTORY } from './fixtures'

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('[TC-AIPROV-PW-009] Overview', () => {
  it('shows each tier with its serving model, state chip, effort and timeout, and an Edit link to the tier', () => {
    render(<OverviewView view={healthyView()} history={HISTORY} />)
    const fast = screen.getByRole('article', { name: 'Fast tier' })
    expect(within(fast).getByText('First choice')).toBeInTheDocument()
    expect(within(fast).getByText('claude-haiku-5-5')).toBeInTheDocument()
    expect(within(fast).getByText('Anthropic')).toBeInTheDocument()
    expect(within(fast).getByText('Low')).toBeInTheDocument()
    expect(within(fast).getByText('60 s')).toBeInTheDocument()
    expect(within(fast).getByRole('link', { name: 'Edit Fast tier' })).toHaveAttribute('href', '/studio/settings/ai/models/routing#tier-fast')
    const image = screen.getByRole('article', { name: 'Image tier' })
    expect(within(image).getByText('WEBP')).toBeInTheDocument()
    expect(within(image).getByText('150 s')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('goes red when a tier is down and amber when a tier runs on a fallback, with the reasons', () => {
    render(<OverviewView view={brokenView()} history={HISTORY} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Pictures are failing: no Image model can answer')
    expect(alert).toHaveTextContent('openai/gpt-image-1')
    expect(alert).toHaveTextContent('key needs re-entry')
    expect(within(alert).getByRole('link', { name: 'Open routing' })).toHaveAttribute('href', '/studio/settings/ai/models/routing#tier-image')
    const warn = screen.getByText('1 tier is running on a fallback model').closest('[role="status"]') as HTMLElement
    expect(warn).toHaveTextContent('Quality skips OpenRouter (key needs re-entry)')
    expect(within(warn).getByRole('link', { name: 'Open providers' })).toHaveAttribute('href', '/studio/settings/ai/models/providers')
    const quality = screen.getByRole('article', { name: 'Quality tier' })
    expect(within(quality).getByText('On fallback')).toBeInTheDocument()
    expect(within(quality).getByText(/skipped: key needs re-entry/)).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Image tier' })).getByText('No model can answer')).toBeInTheDocument()
  })

  it('lists every provider with its status and the last change', () => {
    render(<OverviewView view={brokenView()} history={HISTORY} />)
    const card = screen.getByRole('region', { name: 'Providers' })
    expect(card).toHaveTextContent('2 ready · 2 need you · 1 off or without a key')
    expect(within(card).getByText('Needs re-entry')).toBeInTheDocument()
    expect(within(card).getByText('Quota exceeded')).toBeInTheDocument()
    expect(within(card).getAllByText('Key saved in Studio').length).toBe(2)
    expect(card).toHaveTextContent('Last change: Quality chain: haiku → sonnet · minh@primecommerce.asia')
    expect(within(card).getByRole('link', { name: 'See history' })).toHaveAttribute('href', '/studio/settings/ai/models/history')
  })

  it('on a fresh install says everything comes from the environment and that nothing was saved yet', () => {
    const view = healthyView()
    view.updatedAt = null
    render(<OverviewView view={view} history={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Everything here comes from the environment')
    expect(screen.getByText('No changes saved in Studio yet.')).toBeInTheDocument()
  })
})

describe('[TC-AIPROV-PW-010] error state and chrome', () => {
  it('reports ai-platform down with a retry that refreshes the page, and says Limits & prices still works', () => {
    render(<UnreachableBanner message="AI service unreachable" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the AI service')
    expect(screen.getByRole('alert')).toHaveTextContent('Limits & prices still works')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refresh).toHaveBeenCalled()
  })

  it('the rail marks the current page and shows problem counts on Providers and Routing', () => {
    render(<ModelsRail badges={{ providers: 2, routing: 1 }} />)
    const rail = screen.getByRole('navigation', { name: 'Providers and models pages' })
    expect(within(rail).getAllByRole('link').map((a) => a.textContent)).toEqual(['Overview', 'Providers2', 'Routing1', 'Tasks', 'Runtime', 'History'])
    expect(within(rail).getByRole('link', { name: /Routing/ })).toHaveAttribute('aria-current', 'page')
    expect(within(rail).getByRole('link', { name: /Overview/ })).not.toHaveAttribute('aria-current')
    expect(within(rail).getByLabelText('2 need you')).toBeInTheDocument()
  })

  it('the tab bar links both AI settings pages and marks the active one', () => {
    render(<AiSettingsTabs active="models" />)
    expect(screen.getByRole('link', { name: 'Providers & models' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Limits & prices' })).toHaveAttribute('href', '/studio/settings/ai')
  })

  it('the Limits & prices page points its old "Model chains" card at Routing', () => {
    render(<ModelsLinkSection />)
    expect(screen.getByRole('link', { name: 'Open routing' })).toHaveAttribute('href', '/studio/settings/ai/models/routing')
  })
})
