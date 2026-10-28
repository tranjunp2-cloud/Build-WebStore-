import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import React from 'react'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { V2_INTRO_MEDIA } from '@/components/dashboard/v2-intro-media'
import { renderLanding, stubFetch, stubMatchMedia } from './landing-test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

// vi.restoreAllMocks() would also reset the global Intersection/ResizeObserver stubs from the test setup,
// so spies are tracked and restored one by one.
const spies: MockInstance[] = []

beforeEach(() => {
  localStorage.clear()
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  spies.splice(0).forEach((s) => s.mockRestore())
})

const cards = (c: HTMLElement) => Array.from(c.querySelectorAll('.ttrack .tcard'))
const names = (c: HTMLElement) => cards(c).map((el) => el.querySelector('.tname')?.textContent)

describe('F45 landing v2 — hero video', () => {
  it('TC-F45-04: keyboard Play button starts the V2 intro video; sources and poster come from V2_INTRO_MEDIA', async () => {
    stubFetch()
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    spies.push(play)
    const { container } = await renderLanding()
    const player = container.querySelector('.player') as HTMLElement
    const sources = Array.from(player.querySelectorAll('video source')).map((s) => s.getAttribute('src'))

    expect(sources).toEqual(V2_INTRO_MEDIA.sources.map((s) => s.src))
    expect(player.querySelector('picture img')).toHaveAttribute('src', V2_INTRO_MEDIA.posterJpg)
    expect(container.querySelector('#top img[src*="mascot"]')).toBeNull()

    const playBtn = within(player).getAllByRole('button', { name: 'Play video' })[0]
    playBtn.focus()
    expect(playBtn).toHaveFocus()
    fireEvent.click(playBtn)

    expect(play).toHaveBeenCalledTimes(1)
    expect(player).toHaveAttribute('data-state', 'started')
  })

  it('TC-F45-04: mute toggles its label; controls are labelled in the active language', async () => {
    stubFetch()
    const { container } = await renderLanding('ms')
    const player = container.querySelector('.player') as HTMLElement

    fireEvent.click(within(player).getByRole('button', { name: 'Senyapkan', hidden: true }))

    expect(within(player).getByRole('button', { name: 'Nyahsenyap', hidden: true })).toBeInTheDocument()
    expect(within(player).getByRole('slider', { hidden: true })).toHaveAttribute('aria-label', 'Cari kedudukan')
  })

  it('TC-F45-04: when every video source fails the "Video coming soon" overlay state is set', async () => {
    stubFetch()
    const { container } = await renderLanding()
    const player = container.querySelector('.player') as HTMLElement
    const sources = player.querySelectorAll('video source')

    fireEvent.error(sources[sources.length - 1])

    expect(player).toHaveAttribute('data-state', 'error')
    expect(within(player).getByText('Video coming soon')).toBeInTheDocument()
  })
})

describe('F45 landing v2 — templates', () => {
  it('TC-F45-07: "All" shows the first template of each curated category as real previews', async () => {
    stubFetch()
    const { container } = await renderLanding()

    expect(names(container)).toEqual(['Kopi Corner', 'Shop Fresh', 'Glow Studio', 'Cloud Stack', 'Daily Bakes', 'Care Clinic', 'Home Finder', 'Iron Gym'])
    const frame = cards(container)[0].querySelector('iframe') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('/api/templates/preview?id=1')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.cat')).toHaveLength(15) // All + 14 industries
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('TC-F45-07: a category chip keeps only that category and carousel arrows are disabled at the ends', async () => {
    stubFetch()
    const { container } = await renderLanding()

    fireEvent.click(screen.getByRole('button', { name: 'Tech' }))

    expect(names(container)).toEqual(['Cloud Stack', 'Byte Labs'])
    expect(screen.getByRole('button', { name: 'Tech' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Previous templates' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next templates' })).toBeDisabled() // jsdom: nothing overflows
  })

  it('TC-F45-07: shows skeleton cards while the list is loading', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
    const { render } = await import('@testing-library/react')
    const { I18nProvider } = await import('@/i18n')
    const { LandingV2 } = await import('@/components/landing-v2/landing-v2')

    const { container } = render(<I18nProvider><LandingV2 /></I18nProvider>)

    expect(container.querySelectorAll('.ttrack .tcard.skel')).toHaveLength(4)
    expect(container.querySelector('.ttrack')).toHaveAttribute('aria-busy', 'true')
  })

  it.each([
    ['network error', 'network-error'],
    ['HTTP 500', 'http-500'],
    ['empty list', { docs: [] }],
    ['malformed payload', 'malformed'],
  ] as const)('TC-F45-07: %s keeps the heading and "Browse all templates" without a broken carousel', async (_label, behaviour) => {
    spies.push(vi.spyOn(console, 'warn').mockImplementation(() => undefined))
    stubFetch(behaviour)

    const { container } = await renderLanding()

    expect(screen.getByRole('heading', { name: '56 templates for 14 industries' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse all templates' })).toHaveAttribute('href', '/templates')
    expect(container.querySelector('.ttrack')).toBeNull()
    expect(container.querySelector('.cats')).toBeNull()
  })
})

describe('F45 landing v2 — FAQ', () => {
  const buttons = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLButtonElement>('#faq .qa button'))
  const expanded = (c: HTMLElement) => buttons(c).map((b) => b.getAttribute('aria-expanded'))

  it('TC-F45-08: group 1 is shown with every answer closed', async () => {
    stubFetch()
    const { container } = await renderLanding()

    expect(screen.getByRole('button', { name: /Getting started/ })).toHaveAttribute('aria-pressed', 'true')
    expect(buttons(container)).toHaveLength(6)
    expect(expanded(container).every((v) => v === 'false')).toBe(true)
  })

  it('TC-F45-08: opening a question closes the previous one; clicking it again closes it', async () => {
    stubFetch()
    const { container } = await renderLanding()

    fireEvent.click(buttons(container)[1])
    expect(expanded(container)).toEqual(['false', 'true', 'false', 'false', 'false', 'false'])
    expect(buttons(container)[1].closest('.qa')).toHaveClass('open')

    fireEvent.click(buttons(container)[2])
    expect(expanded(container)).toEqual(['false', 'false', 'true', 'false', 'false', 'false'])

    fireEvent.click(buttons(container)[2])
    expect(expanded(container).every((v) => v === 'false')).toBe(true)
  })

  it('TC-F45-08: switching group swaps the list and closes everything', async () => {
    stubFetch()
    const { container } = await renderLanding()
    fireEvent.click(buttons(container)[0])

    fireEvent.click(screen.getByRole('button', { name: /Selling & orders/ }))

    expect(screen.getByRole('button', { name: /Selling & orders/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Getting started/ })).toHaveAttribute('aria-pressed', 'false')
    expect(buttons(container)).toHaveLength(4)
    expect(buttons(container)[0]).toHaveTextContent('Which payment methods can my customers use?')
    expect(expanded(container).every((v) => v === 'false')).toBe(true)
  })
})

describe('F45 landing v2 — product tour', () => {
  const tabs = () => screen.getAllByRole('tab')
  const selected = () => tabs().map((t) => t.getAttribute('aria-selected'))

  function endTourBar(container: HTMLElement) {
    const ev = new Event('animationend', { bubbles: true })
    Object.defineProperty(ev, 'animationName', { value: 'lv-tourbar' })
    act(() => { container.querySelector('.tour .tt-bar i')?.dispatchEvent(ev) })
  }

  it('TC-F45-12: first tab is selected; clicking tab 3 selects it, shows its panel and stops autoplay', async () => {
    stubFetch()
    const { container } = await renderLanding()
    expect(selected()).toEqual(['true', 'false', 'false', 'false'])
    expect(container.querySelector('.tour')).toHaveClass('auto')

    fireEvent.click(tabs()[2])

    expect(selected()).toEqual(['false', 'false', 'true', 'false'])
    expect(tabs()[2]).toHaveAttribute('tabindex', '0')
    expect(container.querySelector('.tp.on')).toHaveAttribute('id', 'tp-sell')
    expect(container.querySelector('.tour')).not.toHaveClass('auto')
    endTourBar(container)
    expect(selected()).toEqual(['false', 'false', 'true', 'false'])
  })

  it('TC-F45-12: while autoplay is on, the end of the progress bar advances to the next tab', async () => {
    stubFetch()
    const { container } = await renderLanding()

    endTourBar(container)

    expect(selected()).toEqual(['false', 'true', 'false', 'false'])
    expect(container.querySelector('.tour')).toHaveClass('auto')
  })

  it('TC-F45-12: arrow keys move the selection and focus', async () => {
    stubFetch()
    await renderLanding()

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowDown' })

    await waitFor(() => expect(tabs()[1]).toHaveFocus())
    expect(selected()).toEqual(['false', 'true', 'false', 'false'])
  })
})
