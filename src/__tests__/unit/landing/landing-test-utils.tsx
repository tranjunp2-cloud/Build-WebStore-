import { render, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { I18nProvider } from '@/i18n'
import { LandingV2 } from '@/components/landing-v2/landing-v2'

/** Live templates as /api/templates/list returns them (category is a hasMany select → array). */
export const TEMPLATE_DOCS = [
  { id: 1, name: 'Kopi Corner', category: ['restaurant'] },
  { id: 2, name: 'Bistro Noir', category: ['restaurant'] },
  { id: 6, name: 'Shop Fresh', category: ['ecommerce'] },
  { id: 9, name: 'Glow Studio', category: ['beauty'] },
  { id: 13, name: 'Cloud Stack', category: ['tech'] },
  { id: 14, name: 'Byte Labs', category: ['tech'] },
  { id: 17, name: 'Daily Bakes', category: ['fnb'] },
  { id: 21, name: 'Care Clinic', category: ['health'] },
  { id: 29, name: 'Home Finder', category: ['realestate'] },
  { id: 33, name: 'Iron Gym', category: ['fitness'] },
]

type ListBehaviour = { docs: unknown[] } | 'network-error' | 'http-500' | 'malformed'

/** Stubs global fetch: template list per `list`, everything else (e.g. the prefer_lang PATCH) answers 200. */
export function stubFetch(list: ListBehaviour = { docs: TEMPLATE_DOCS }) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.startsWith('/api/templates/list')) return new Response('{}', { status: 200 })
    if (list === 'network-error') throw new TypeError('Failed to fetch')
    if (list === 'http-500') return new Response(JSON.stringify({ docs: [] }), { status: 500 })
    if (list === 'malformed') return new Response('"nope"', { status: 200 })
    return new Response(JSON.stringify({ docs: list.docs }), { status: 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** jsdom has no matchMedia: answer prefers-reduced-motion with `reduce`, fine pointer with false. */
export function stubMatchMedia(reduce = false) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }))
}

/** Renders the landing and waits for the template request to settle (cards, empty or error). */
export async function renderLanding(locale: 'en' | 'ms' = 'en') {
  const utils = render(
    <I18nProvider defaultLocale={locale}>
      <LandingV2 />
    </I18nProvider>,
  )
  await waitFor(() => expect(utils.container.querySelector('.ttrack[aria-busy="true"]')).toBeNull())
  return utils
}

export function sectionText(container: HTMLElement, id: string): string {
  return container.querySelector(`#${id}`)?.textContent ?? ''
}
