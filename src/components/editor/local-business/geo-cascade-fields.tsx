'use client'

import { useEffect, useRef, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { LocalBusinessData } from './types'

type GeoState = { id: number; name: string; state_code: string; zone: string }
type GeoDistrict = { id: number; name: string }

interface GeoCascadeLabels {
    state: string
    city: string
    postcode: string
    selectState: string
    selectCity: string
    selectPostcode: string
    loadingOption: string
    legacyValueHint: string
}

interface GeoCascadeFieldsProps {
    value: { state?: string; city?: string; postcode?: string }
    /** Merged into the parent's `localBusiness` state — parent is responsible
     *  for spreading existing fields (mirrors `GeoLinkInput`'s onChange contract). */
    onChange: (patch: Partial<LocalBusinessData>) => void
    labels: GeoCascadeLabels
    fullWidth?: boolean
}

const TRIGGER_CLS = 'mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-[var(--editor-surface-elevated)] px-3 text-sm text-white outline-none'

/** F37 US-01 data-quality follow-up: DB-backed State→District→Postcode cascade,
 *  ported from checkout's `/api/geo/*` pattern (`CheckoutClient.tsx`). Numeric ids
 *  live only in local component state to drive the cascade — only plain string
 *  names are written out via `onChange`, so `LocalBusinessData`/JSON-LD stay
 *  untouched. On mount, saved `value` strings are reverse-resolved to ids so the
 *  cascade pre-fills for an existing site (postcode lookup primary, name-match
 *  secondary). Never auto-clears a saved string it can't resolve — shows an
 *  amber "legacy" hint instead so the seller's existing SEO data survives. */
export function GeoCascadeFields({ value, onChange, labels: s, fullWidth }: GeoCascadeFieldsProps) {
    const [states, setStates] = useState<GeoState[]>([])
    const [statesLoading, setStatesLoading] = useState(true)
    const [selectedStateId, setSelectedStateId] = useState('')

    const [districts, setDistricts] = useState<GeoDistrict[]>([])
    const [districtsLoading, setDistrictsLoading] = useState(false)
    const [selectedDistrictId, setSelectedDistrictId] = useState('')

    const [postcodeOpts, setPostcodeOpts] = useState<string[]>([])
    const [postcodesLoading, setPostcodesLoading] = useState(false)

    const [legacyState, setLegacyState] = useState(false)
    const [legacyCity, setLegacyCity] = useState(false)
    const resolvedOnce = useRef(false)

    // Tracks the most recently selected ids so an out-of-order network response
    // (e.g. district-fetch for a previously selected state resolving AFTER a
    // newer one) can be detected and discarded instead of overwriting the UI
    // with data for a state/district the user has already moved on from.
    const selectedStateIdRef = useRef('')
    const selectedDistrictIdRef = useRef('')

    // Set the instant the user makes ANY manual cascade selection. `bootstrap()`
    // (the mount-time reverse-resolve below) checks this before every setState
    // so a late-resolving lookup/name-match can never clobber a selection the
    // user already made while bootstrap was still in flight.
    const userInteractedRef = useRef(false)

    useEffect(() => {
        if (resolvedOnce.current) return
        resolvedOnce.current = true
        void bootstrap()

        // Loads states, then reverse-resolves any already-saved `value` strings
        // to cascade ids (postcode-lookup primary path, name-match secondary).
        // Read-only pre-fill — never calls `onChange`, never clears a saved
        // string it can't map to a DB row (see legacyState/legacyCity below).
        // Bails out at every checkpoint if the user has since interacted
        // manually, so a slow reverse-resolve never overwrites a fresh pick.
        async function bootstrap() {
            let statesList: GeoState[] = []
            try {
                const res = await fetch('/api/geo/states')
                const data = await res.json()
                statesList = Array.isArray(data) ? data : []
            } catch { /* empty options; select stays usable */ }
            setStatesLoading(false)
            if (userInteractedRef.current) return
            setStates(statesList)

            const savedState = value.state?.trim() || ''
            const savedCity = value.city?.trim() || ''
            const savedPostcode = value.postcode?.trim() || ''
            if (!savedState && !savedCity && !savedPostcode) return

            if (/^\d{5}$/.test(savedPostcode)) {
                try {
                    const res = await fetch(`/api/geo/lookup/${savedPostcode}`)
                    if (res.ok) {
                        const data: { state_id: number; district_id: number } = await res.json()
                        if (userInteractedRef.current) return
                        setSelectedStateId(String(data.state_id))
                        const districtsList = await fetchDistricts(data.state_id)
                        if (userInteractedRef.current) return
                        setDistricts(districtsList)
                        setSelectedDistrictId(String(data.district_id))
                        const postcodes = await fetchPostcodes(data.district_id)
                        if (userInteractedRef.current) return
                        setPostcodeOpts(postcodes)
                        return
                    }
                } catch { /* fall through to name-match */ }
            }
            if (userInteractedRef.current) return

            const stateRow = savedState ? statesList.find(row => row.name === savedState) : undefined
            if (!stateRow) {
                if (savedState) setLegacyState(true)
                if (savedCity || savedPostcode) setLegacyCity(true)
                return
            }
            setSelectedStateId(String(stateRow.id))
            const districtsList = await fetchDistricts(stateRow.id)
            if (userInteractedRef.current) return
            setDistricts(districtsList)

            const districtRow = savedCity ? districtsList.find(row => row.name === savedCity) : undefined
            if (!districtRow) {
                if (savedCity) setLegacyCity(true)
                return
            }
            setSelectedDistrictId(String(districtRow.id))
            const postcodes = await fetchPostcodes(districtRow.id)
            if (userInteractedRef.current) return
            setPostcodeOpts(postcodes)
            // If savedPostcode isn't among the loaded options, the postcode
            // Select (controlled by `value.postcode`) simply shows no match —
            // the string is never cleared, no dedicated hint needed here.
        }

        // Fetch-only helpers — state list is applied by the caller (bootstrap)
        // AFTER re-checking `userInteractedRef`, so results never race a
        // manual selection. Only used by bootstrap (handleStateSelect /
        // handleDistrictSelect below fetch inline with their own stale-guard).
        // The `finally` loading-flag clear is ALSO guarded: if the user
        // interacted while this fetch was in flight, their own handler already
        // owns `districtsLoading`/`postcodesLoading` (via its own inline fetch)
        // — clearing it here would prematurely flip the flag while the user's
        // real fetch is still pending.
        async function fetchDistricts(stateId: number): Promise<GeoDistrict[]> {
            setDistrictsLoading(true)
            try {
                const res = await fetch(`/api/geo/districts?stateId=${stateId}`)
                const data = await res.json()
                return Array.isArray(data) ? data : []
            } catch {
                return []
            } finally {
                if (!userInteractedRef.current) setDistrictsLoading(false)
            }
        }

        async function fetchPostcodes(districtId: number): Promise<string[]> {
            setPostcodesLoading(true)
            try {
                const res = await fetch(`/api/geo/postcodes?districtId=${districtId}`)
                const data = await res.json()
                return Array.isArray(data) ? data : []
            } catch {
                return []
            } finally {
                if (!userInteractedRef.current) setPostcodesLoading(false)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function handleStateSelect(stateId: string) {
        userInteractedRef.current = true
        setSelectedStateId(stateId)
        selectedStateIdRef.current = stateId
        setSelectedDistrictId('')
        selectedDistrictIdRef.current = ''
        setDistricts([])
        setPostcodeOpts([])
        setLegacyState(false)
        setLegacyCity(false)
        const row = states.find(entry => entry.id === Number(stateId))
        onChange({ state: row?.name || '', city: '', postcode: '' })
        if (!stateId) return
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${stateId}`)
            .then(r => r.json())
            .then((data: GeoDistrict[]) => {
                if (selectedStateIdRef.current !== stateId) return // stale response — a newer state was selected since this fetch started
                setDistricts(Array.isArray(data) ? data : [])
            })
            .catch(() => {})
            .finally(() => {
                if (selectedStateIdRef.current === stateId) setDistrictsLoading(false)
            })
    }

    function handleDistrictSelect(districtId: string) {
        userInteractedRef.current = true
        setSelectedDistrictId(districtId)
        selectedDistrictIdRef.current = districtId
        setPostcodeOpts([])
        setLegacyCity(false)
        const row = districts.find(entry => entry.id === Number(districtId))
        onChange({ city: row?.name || '', postcode: '' })
        if (!districtId) return
        setPostcodesLoading(true)
        fetch(`/api/geo/postcodes?districtId=${districtId}`)
            .then(r => r.json())
            .then((data: string[]) => {
                if (selectedDistrictIdRef.current !== districtId) return // stale response — a newer district was selected since this fetch started
                setPostcodeOpts(Array.isArray(data) ? data : [])
            })
            .catch(() => {})
            .finally(() => {
                if (selectedDistrictIdRef.current === districtId) setPostcodesLoading(false)
            })
    }

    function handlePostcodeSelect(postcode: string) {
        userInteractedRef.current = true
        onChange({ postcode })
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.state}</label>
                <Select value={selectedStateId || undefined} onValueChange={handleStateSelect} disabled={statesLoading}>
                    <SelectTrigger className={TRIGGER_CLS}>
                        <SelectValue placeholder={statesLoading ? s.loadingOption : s.selectState} />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                        {states.map(st => (
                            <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {legacyState && value.state ? (
                    <p className="mt-1 text-[11px] text-amber-400">{s.legacyValueHint}: &quot;{value.state}&quot;</p>
                ) : null}
            </div>

            <div className={cn('grid gap-4', fullWidth && 'min-[768px]:grid-cols-2')}>
                <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.city}</label>
                    <Select value={selectedDistrictId || undefined} onValueChange={handleDistrictSelect} disabled={!selectedStateId || districtsLoading}>
                        <SelectTrigger className={TRIGGER_CLS}>
                            <SelectValue placeholder={districtsLoading ? s.loadingOption : s.selectCity} />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="start">
                            {districts.map(d => (
                                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {legacyCity && value.city ? (
                        <p className="mt-1 text-[11px] text-amber-400">{s.legacyValueHint}: &quot;{value.city}&quot;</p>
                    ) : null}
                </div>
                <div>
                    <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.postcode}</label>
                    <Select value={value.postcode || undefined} onValueChange={handlePostcodeSelect} disabled={!selectedDistrictId || postcodesLoading}>
                        <SelectTrigger className={TRIGGER_CLS}>
                            <SelectValue placeholder={postcodesLoading ? s.loadingOption : s.selectPostcode} />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="start">
                            {postcodeOpts.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}
