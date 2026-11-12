import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderLanding, sectionText, stubFetch, stubMatchMedia } from './landing-test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

const SECTION_IDS = ['top', 'how', 'features', 'tour', 'templates', 'faq', 'contact']

beforeEach(() => {
  localStorage.clear()
  stubMatchMedia(false)
  stubFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('F45 landing v2 — structure', () => {
  it('TC-F45-01: renders nav, hero, how, features (10 cards), tour (4 tabs), templates, faq, final CTA and footer', async () => {
    // Arrange + Act
    const { container } = await renderLanding()

    // Assert
    expect(container.querySelector('nav.nav')).toBeInTheDocument()
    SECTION_IDS.forEach((id) => expect(container.querySelector(`section#${id}`), id).toBeInTheDocument())
    expect(container.querySelectorAll('.bento .card')).toHaveLength(10)
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(container.querySelector('footer.foot')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Describe your business. AI builds your online store.')
  })

  it('TC-F45-01: in-page nav links point at existing section anchors', async () => {
    const { container } = await renderLanding()

    const hrefs = Array.from(container.querySelectorAll('.nav-links a')).map((a) => a.getAttribute('href'))

    expect(hrefs).toEqual(['#how', '#features', '#templates', '#faq'])
    hrefs.forEach((h) => expect(container.querySelector(`section${h}`)).toBeInTheDocument())
  })
})

describe('F45 landing v2 — content rules', () => {
  const FORBIDDEN = [/xendit/i, /e-?wallets?/i, /e-dompet/i, /\bPro\b/, /contact sales/i, /hubungi jualan/i]

  it.each(['en', 'ms'] as const)('TC-F45-02: no removed claims in rendered text or aria-labels (%s)', async (locale) => {
    // Arrange + Act
    const { container } = await renderLanding(locale)
    const labels = Array.from(container.querySelectorAll('[aria-label],[title]'))
      .flatMap((el) => [el.getAttribute('aria-label'), el.getAttribute('title')])
      .join(' | ')
    const haystack = `${container.textContent} | ${labels}`

    // Assert
    FORBIDDEN.forEach((re) => expect(haystack).not.toMatch(re))
    expect(sectionText(container, 'top')).not.toMatch(/malaysia/i)
  })

  it('TC-F45-03: every "Get started free" goes to /register and every "Sign in" to /login', async () => {
    const { container } = await renderLanding()

    const cta = Array.from(container.querySelectorAll('a')).filter((a) => a.textContent?.trim() === 'Get started free')
    const signIn = Array.from(container.querySelectorAll('a')).filter((a) => a.textContent?.trim() === 'Sign in')

    // nav, mobile panel, hero, final CTA, footer
    expect(cta).toHaveLength(5)
    cta.forEach((a) => expect(a).toHaveAttribute('href', '/register'))
    // nav, mobile panel, footer
    expect(signIn).toHaveLength(3)
    signIn.forEach((a) => expect(a).toHaveAttribute('href', '/login'))
  })
})

describe('F45 landing v2 — language and theme', () => {
  it('TC-F45-05: nav and footer toggles switch all copy (incl. aria-labels) and persist prefer_lang', async () => {
    // Arrange
    const { container, unmount } = await renderLanding('en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Describe your business.')

    // Act — nav toggle to BM
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch to Bahasa Melayu' })[0])

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terangkan perniagaan anda.')
    expect(container.querySelector('nav.nav')).toHaveAttribute('aria-label', 'Menu utama')
    expect(sectionText(container, 'faq')).toContain('Soalan lazim')
    expect(localStorage.getItem('prefer_lang')).toBe('ms')

    // Act — footer toggle back to EN
    fireEvent.click(container.querySelector('footer button[aria-label="Tukar ke English"]') as HTMLElement)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Describe your business.')

    // Act — reload keeps the last choice
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch to Bahasa Melayu' })[0])
    unmount()
    await renderLanding('en')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terangkan perniagaan anda.'))
  })

  it('TC-F45-06: theme is dark first, toggles light then dark and is remembered in lv2-theme', async () => {
    const { getByTestId } = await renderLanding()
    const root = getByTestId('landing-v2')
    expect(root).toHaveAttribute('data-theme', 'dark')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(root).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('lv2-theme')).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('lv2-theme')).toBe('dark')
  })

  it('TC-F45-06: a saved light theme is applied on load', async () => {
    localStorage.setItem('lv2-theme', 'light')

    const { getByTestId } = await renderLanding()

    await waitFor(() => expect(getByTestId('landing-v2')).toHaveAttribute('data-theme', 'light'))
  })
})

describe('F45 landing v2 — reduced motion', () => {
  it('TC-F45-10: every reveal block is visible immediately and the tour does not autoplay', async () => {
    stubMatchMedia(true)

    const { container } = await renderLanding()

    const reveals = Array.from(container.querySelectorAll('[data-reveal]'))
    expect(reveals.length).toBeGreaterThan(0)
    reveals.forEach((el) => expect(el).toHaveClass('in'))
    await waitFor(() => expect(container.querySelector('.tour')).not.toHaveClass('auto'))
  })
})
