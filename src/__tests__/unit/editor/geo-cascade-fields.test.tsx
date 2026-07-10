/**
 * @fileoverview Tests for F37 US-01 geo-cascade data-quality follow-up (Phase 04)
 * TC-IDs: TC-F37-01-15 to TC-F37-01-21, TC-F37-01-24 (provisional — docs/qa/F37-local-seo.md backfills official IDs)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { GeoCascadeFields } from '@/components/editor/local-business/geo-cascade-fields'

// ── Stub jsdom's missing Radix Select support (mirrors font-select.test.tsx) ─
beforeEach(() => {
    if (!window.HTMLElement.prototype.hasPointerCapture) {
        window.HTMLElement.prototype.hasPointerCapture = () => false
    }
    if (!window.HTMLElement.prototype.scrollIntoView) {
        window.HTMLElement.prototype.scrollIntoView = () => {}
    }
})

// ── Canned geo data ──────────────────────────────────────────────────────────
const STATES = [
    { id: 1, name: 'Selangor', state_code: 'SGR', zone: 'west' },
    { id: 2, name: 'Sabah', state_code: 'SBH', zone: 'east' },
]
const DISTRICTS_SELANGOR = [
    { id: 10, name: 'Petaling Jaya' },
    { id: 11, name: 'Shah Alam' },
]
const DISTRICTS_SABAH = [
    { id: 20, name: 'Kota Kinabalu' },
]
const POSTCODES_PJ = ['47300', '47301']

const LABELS = {
    state: 'State', city: 'City', postcode: 'Postcode',
    selectState: 'Select state', selectCity: 'Select city', selectPostcode: 'Select postcode',
    loadingOption: 'Loading...', legacyValueHint: 'Saved value',
}

function makeJsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Default happy-path router: Selangor -> Petaling Jaya -> 47300/47301. */
function defaultRouter(url: string): Promise<Response> {
    if (url === '/api/geo/states') return Promise.resolve(makeJsonResponse(STATES))
    if (url === '/api/geo/districts?stateId=1') return Promise.resolve(makeJsonResponse(DISTRICTS_SELANGOR))
    if (url === '/api/geo/postcodes?districtId=10') return Promise.resolve(makeJsonResponse(POSTCODES_PJ))
    if (url === '/api/geo/lookup/47300') return Promise.resolve(makeJsonResponse({ state_id: 1, district_id: 10 }))
    if (url === '/api/geo/lookup/99999') return Promise.resolve(makeJsonResponse({ error: 'not found' }, 404))
    return Promise.resolve(makeJsonResponse([]))
}

/** Radix Select triggers render in JSX order: [state, city, postcode]. */
const triggers = () => screen.getAllByRole('combobox')

async function openAndPick(index: number, optionName: string) {
    await waitFor(() => expect(triggers()[index]).not.toBeDisabled())
    fireEvent.click(triggers()[index])
    const option = await screen.findByRole('option', { name: optionName })
    fireEvent.click(option)
}

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-15 — Forward cascade writes plain string names via onChange
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-15] GeoCascadeFields — forward cascade writes plain string names', () => {
    beforeEach(() => {
        global.fetch = vi.fn(defaultRouter) as unknown as typeof fetch
    })

    it('picking state -> district -> postcode fires onChange with plain string names each step', async () => {
        const onChange = vi.fn()
        render(<GeoCascadeFields value={{}} onChange={onChange} labels={LABELS} />)

        await openAndPick(0, 'Selangor')
        expect(onChange).toHaveBeenLastCalledWith({ state: 'Selangor', city: '', postcode: '' })

        await openAndPick(1, 'Petaling Jaya')
        expect(onChange).toHaveBeenLastCalledWith({ city: 'Petaling Jaya', postcode: '' })

        await openAndPick(2, '47300')
        expect(onChange).toHaveBeenLastCalledWith({ postcode: '47300' })
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-16 — Selecting a new state clears downstream city+postcode in one patch
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-16] GeoCascadeFields — state change clears downstream selection', () => {
    beforeEach(() => {
        global.fetch = vi.fn(defaultRouter) as unknown as typeof fetch
    })

    it('re-selecting state after district/postcode chosen resets both in a single onChange call', async () => {
        const onChange = vi.fn()
        const { rerender } = render(<GeoCascadeFields value={{}} onChange={onChange} labels={LABELS} />)

        await openAndPick(0, 'Selangor')
        await openAndPick(1, 'Petaling Jaya')
        await openAndPick(2, '47300')
        onChange.mockClear()

        // Re-render with the committed value (mirrors parent re-render after save)
        rerender(<GeoCascadeFields value={{ state: 'Selangor', city: 'Petaling Jaya', postcode: '47300' }} onChange={onChange} labels={LABELS} />)

        // Selecting Sabah must clear city+postcode in the SAME patch (one call, not three)
        await openAndPick(0, 'Sabah')
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith({ state: 'Sabah', city: '', postcode: '' })

        // District select becomes disabled again (no district chosen for the new state yet)
        await waitFor(() => expect(triggers()[1]).toBeDisabled())
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-17 — Reverse-resolve via postcode lookup pre-selects all 3
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-17] GeoCascadeFields — reverse-resolve by postcode lookup', () => {
    beforeEach(() => {
        global.fetch = vi.fn(defaultRouter) as unknown as typeof fetch
    })

    it('mounting with a saved, DB-known postcode pre-selects state+district+postcode read-only', async () => {
        const onChange = vi.fn()
        render(<GeoCascadeFields value={{ state: 'Selangor', city: 'Petaling Jaya', postcode: '47300' }} onChange={onChange} labels={LABELS} />)

        await waitFor(() => {
            expect(triggers()[0]).toHaveTextContent('Selangor')
            expect(triggers()[1]).toHaveTextContent('Petaling Jaya')
        })
        expect(triggers()[2]).toHaveTextContent('47300')
        expect(onChange).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-18 — Reverse-resolve by name match (no/blank postcode)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-18] GeoCascadeFields — reverse-resolve by name match, blank postcode', () => {
    beforeEach(() => {
        global.fetch = vi.fn(defaultRouter) as unknown as typeof fetch
    })

    it('mounting with saved state+city (no postcode) pre-selects both via name match; postcode stays empty', async () => {
        const onChange = vi.fn()
        render(<GeoCascadeFields value={{ state: 'Selangor', city: 'Petaling Jaya', postcode: '' }} onChange={onChange} labels={LABELS} />)

        await waitFor(() => {
            expect(triggers()[0]).toHaveTextContent('Selangor')
            expect(triggers()[1]).toHaveTextContent('Petaling Jaya')
        })
        expect(triggers()[2]).toHaveTextContent(LABELS.selectPostcode)
        expect(onChange).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-19 — Legacy city (no DB match) keeps the saved string, never clears it
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-19] GeoCascadeFields — legacy city degrades non-destructively', () => {
    beforeEach(() => {
        global.fetch = vi.fn(defaultRouter) as unknown as typeof fetch
    })

    it('state resolves but freetext city "PJ" has no district match -> hint shown, onChange never fired', async () => {
        const onChange = vi.fn()
        render(<GeoCascadeFields value={{ state: 'Selangor', city: 'PJ', postcode: '' }} onChange={onChange} labels={LABELS} />)

        await waitFor(() => expect(triggers()[0]).toHaveTextContent('Selangor'))
        expect(triggers()[1]).toHaveTextContent(LABELS.selectCity)
        expect(await screen.findByText(`${LABELS.legacyValueHint}: "PJ"`)).toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-20 — Legacy state (no match) shows hints for all saved strings, no crash
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-20] GeoCascadeFields — legacy state degrades non-destructively', () => {
    beforeEach(() => {
        global.fetch = vi.fn(defaultRouter) as unknown as typeof fetch
    })

    it('saved state string with no DB match -> legacy hints for state and city, no throw', async () => {
        const onChange = vi.fn()
        render(<GeoCascadeFields value={{ state: 'Wilayah KL', city: 'Kuala Lumpur', postcode: '' }} onChange={onChange} labels={LABELS} />)

        expect(await screen.findByText(`${LABELS.legacyValueHint}: "Wilayah KL"`)).toBeInTheDocument()
        expect(await screen.findByText(`${LABELS.legacyValueHint}: "Kuala Lumpur"`)).toBeInTheDocument()
        expect(onChange).not.toHaveBeenCalled()
    })

    it('postcode saved but not in DB (lookup 404) falls through to name-match without crashing', async () => {
        const onChange = vi.fn()
        render(<GeoCascadeFields value={{ state: 'Selangor', city: 'Petaling Jaya', postcode: '99999' }} onChange={onChange} labels={LABELS} />)

        // Lookup 404s -> secondary name-match resolves state+city fine; postcode "99999"
        // isn't in the loaded options, so the controlled Select just shows no match —
        // it must NOT be treated as a crash or a legacy-city case.
        await waitFor(() => {
            expect(triggers()[0]).toHaveTextContent('Selangor')
            expect(triggers()[1]).toHaveTextContent('Petaling Jaya')
        })
        expect(onChange).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-21 — Geo API failure during resolve never throws; saved strings kept
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-21] GeoCascadeFields — API failure resilience', () => {
    beforeEach(() => {
        global.fetch = vi.fn(() => Promise.reject(new Error('network down'))) as unknown as typeof fetch
    })

    it('every /api/geo/* call rejecting does not throw, selects stay usable, saved strings surface via legacy hint', async () => {
        const onChange = vi.fn()
        expect(() =>
            render(<GeoCascadeFields value={{ state: 'Selangor', city: 'Petaling Jaya', postcode: '47300' }} onChange={onChange} labels={LABELS} />)
        ).not.toThrow()

        expect(await screen.findByText(`${LABELS.legacyValueHint}: "Selangor"`)).toBeInTheDocument()
        await waitFor(() => expect(triggers()[0]).not.toBeDisabled())
        expect(onChange).not.toHaveBeenCalled()
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F37-01-24 — Out-of-order fetch response is discarded (stale-response guard)
// ═══════════════════════════════════════════════════════════════════════════
describe('[TC-F37-01-24] GeoCascadeFields — stale district-fetch response is discarded', () => {
    it('reselecting state before the first districts fetch resolves keeps only the newer selection\'s districts, even if the stale response arrives last', async () => {
        // Arrange — defer both districts fetches so we control resolve ORDER manually
        const pending: Record<string, (res: Response) => void> = {}
        global.fetch = vi.fn((url: string) => {
            if (url === '/api/geo/states') return Promise.resolve(makeJsonResponse(STATES))
            if (url === '/api/geo/districts?stateId=1' || url === '/api/geo/districts?stateId=2') {
                return new Promise<Response>(resolve => { pending[url] = resolve })
            }
            return Promise.resolve(makeJsonResponse([]))
        }) as unknown as typeof fetch

        const onChange = vi.fn()
        render(<GeoCascadeFields value={{}} onChange={onChange} labels={LABELS} />)
        await waitFor(() => expect(triggers()[0]).not.toBeDisabled())

        // Act — select Selangor (fires districts?stateId=1, left pending), then immediately
        // re-select Sabah before it resolves (fires districts?stateId=2, also left pending)
        fireEvent.click(triggers()[0])
        fireEvent.click(await screen.findByRole('option', { name: 'Selangor' }))
        fireEvent.click(triggers()[0])
        fireEvent.click(await screen.findByRole('option', { name: 'Sabah' }))

        // Resolve OUT OF ORDER: the newer request (Sabah) arrives first, the stale
        // request (Selangor) arrives last — the stale one must NOT win.
        pending['/api/geo/districts?stateId=2'](makeJsonResponse(DISTRICTS_SABAH))
        await waitFor(() => expect(triggers()[1]).not.toBeDisabled())
        pending['/api/geo/districts?stateId=1'](makeJsonResponse(DISTRICTS_SELANGOR))

        // Assert — the district dropdown must show Sabah's district, never Selangor's
        fireEvent.click(triggers()[1])
        expect(await screen.findByRole('option', { name: 'Kota Kinabalu' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Petaling Jaya' })).not.toBeInTheDocument()
    })
})
