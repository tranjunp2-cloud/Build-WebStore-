'use client'

import {
    useId,
    useRef,
    useState,
    type ClipboardEvent,
    type FocusEvent,
    type FormEvent,
    type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { parseMapLink } from '@/lib/seo/map-links'

interface GeoLinkInputLabels {
    pasteMapsLink: string
    mapsLinkPlaceholder: string
    pasteMapsLinkHint: string
    extractCoordinates: string
    extracting: string
    coordinatesExtracted: string
    latitude: string
    longitude: string
    manualCoordinates: string
    manualCoordinatesHint: string
    invalidLatitude: string
    invalidLongitude: string
    geoExtractFailed: string
}

interface GeoLinkInputProps {
    latitude?: number
    longitude?: number
    streetAddress?: string
    city?: string
    fullWidth?: boolean
    /** Merged into the parent's `localBusiness` state — parent is responsible
     *  for spreading existing fields (mirrors `contactInfo` onBlur pattern). */
    onCoordinatesChange: (coords: { latitude?: number; longitude?: number }) => void
    labels: GeoLinkInputLabels
}

function hasUnsupportedCoordinateCharacters(value: string) {
    return /[^0-9.-]/.test(value)
}

/** F37 US-01: paste-Google-Maps-link primary geo input (PRD §13.9). Runs
 *  layer-1 `parseMapLink` client-side first; on miss, POSTs to the layer-2/3
 *  server route. Resolved coordinates render as read-only chips — direct
 *  editing only via the manual disclosure below, so the two paths never race
 *  (wireframe §4). Net-new UI, no in-file precedent. */
export function GeoLinkInput({ latitude, longitude, streetAddress, city, fullWidth, onCoordinatesChange, labels: s }: GeoLinkInputProps) {
    const componentId = useId()
    const previousManualValues = useRef(new WeakMap<HTMLInputElement, string>())
    const [linkValue, setLinkValue] = useState('')
    const [isResolving, setIsResolving] = useState(false)
    const [showManual, setShowManual] = useState(false)
    const [manualLatError, setManualLatError] = useState<string | null>(null)
    const [manualLngError, setManualLngError] = useState<string | null>(null)

    const hasCoords = typeof latitude === 'number' && typeof longitude === 'number'
        && Number.isFinite(latitude) && Number.isFinite(longitude)
    const isExtractDisabled = isResolving || !linkValue.trim()
    const manualGroupId = `${componentId}-manual-coordinates`
    const latitudeInputId = `${componentId}-latitude`
    const longitudeInputId = `${componentId}-longitude`
    const latitudeErrorId = `${componentId}-latitude-error`
    const longitudeErrorId = `${componentId}-longitude-error`

    function handleManualKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key.length === 1 && hasUnsupportedCoordinateCharacters(event.key)) {
            event.preventDefault()
        }
    }

    function handleManualPaste(event: ClipboardEvent<HTMLInputElement>) {
        const value = event.clipboardData.getData('text')
        if (hasUnsupportedCoordinateCharacters(value)) event.preventDefault()
    }

    function handleManualFocus(event: FocusEvent<HTMLInputElement>) {
        previousManualValues.current.set(event.currentTarget, event.currentTarget.value)
    }

    function handleManualBeforeInput(event: FormEvent<HTMLInputElement>) {
        previousManualValues.current.set(event.currentTarget, event.currentTarget.value)
        const value = (event.nativeEvent as InputEvent).data
        if (value && hasUnsupportedCoordinateCharacters(value)) {
            event.preventDefault()
        }
    }

    function handleManualInput(event: FormEvent<HTMLInputElement>) {
        const value = (event.nativeEvent as InputEvent).data
        if (
            (value && hasUnsupportedCoordinateCharacters(value))
            || hasUnsupportedCoordinateCharacters(event.currentTarget.value)
        ) {
            event.currentTarget.value = previousManualValues.current.get(event.currentTarget) ?? ''
            return
        }
        previousManualValues.current.set(event.currentTarget, event.currentTarget.value)
    }

    async function handleExtract() {
        const url = linkValue.trim()
        if (!url) return
        setIsResolving(true)
        try {
            const layer1 = parseMapLink(url)
            if (layer1) {
                onCoordinatesChange({ latitude: layer1.lat, longitude: layer1.lng })
                setShowManual(false)
                return
            }

            const address = [streetAddress, city].filter(Boolean).join(', ')
            const res = await fetch('/api/local-seo/resolve-maps-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, address: address || undefined }),
            })

            if (res.ok) {
                const data = await res.json() as { lat: number; lng: number }
                onCoordinatesChange({ latitude: data.lat, longitude: data.lng })
                setShowManual(false)
            } else {
                toast.error(s.geoExtractFailed)
                setShowManual(true)
            }
        } catch {
            toast.error(s.geoExtractFailed)
            setShowManual(true)
        } finally {
            setIsResolving(false)
        }
    }

    function handleManualBlur(field: 'latitude' | 'longitude', input: HTMLInputElement) {
        const setError = field === 'latitude' ? setManualLatError : setManualLngError
        const message = field === 'latitude' ? s.invalidLatitude : s.invalidLongitude
        if (input.validity.badInput) {
            setError(message)
            toast.error(message)
            return
        }
        const raw = input.value
        if (!raw.trim()) { setError(null); return }
        const num = Number(raw)
        const [min, max] = field === 'latitude' ? [-90, 90] : [-180, 180]
        if (!Number.isFinite(num) || num < min || num > max) {
            setError(message)
            toast.error(message)
            return
        }
        setError(null)
        onCoordinatesChange({ [field]: num })
    }

    return (
        <div className="space-y-3">
            <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.pasteMapsLink}</label>
                <div className={cn('mt-1.5 flex gap-2', fullWidth && 'flex-col min-[768px]:flex-row')}>
                    <Input
                        value={linkValue}
                        onChange={e => setLinkValue(e.target.value)}
                        variant="editor"
                        placeholder={s.mapsLinkPlaceholder}
                        className="min-w-0 flex-1"
                    />
                    <button
                        type="button"
                        onClick={() => void handleExtract()}
                        disabled={isExtractDisabled}
                        className={cn(
                            'shrink-0 rounded-lg px-3 py-2 text-xs font-medium disabled:cursor-not-allowed',
                            isExtractDisabled
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
                                : 'bg-blue-600 text-white hover:bg-blue-700',
                            fullWidth && 'w-full min-[768px]:w-auto',
                        )}
                    >
                        {isResolving ? s.extracting : s.extractCoordinates}
                    </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{s.pasteMapsLinkHint}</p>
            </div>

            {hasCoords ? (
                <div className="space-y-2">
                    <div className="rounded-lg bg-green-100 px-3 py-2 text-[11px] font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                        {s.coordinatesExtracted}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] text-slate-500">{s.latitude}</label>
                            <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-slate-300">{latitude!.toFixed(6)}</div>
                        </div>
                        <div>
                            <label className="text-[11px] text-slate-500">{s.longitude}</label>
                            <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-slate-300">{longitude!.toFixed(6)}</div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div>
                <button
                    type="button"
                    onClick={() => setShowManual(prev => !prev)}
                    aria-expanded={showManual}
                    aria-controls={manualGroupId}
                    className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-300"
                >
                    {showManual ? '▾' : '▸'} {s.manualCoordinates}
                </button>
                {showManual ? (
                    <div
                        id={manualGroupId}
                        className={cn('mt-2 grid gap-3', fullWidth && 'min-[768px]:grid-cols-2')}
                    >
                        <div>
                            <label htmlFor={latitudeInputId} className="text-[11px] text-slate-500">{s.latitude}</label>
                            <Input
                                id={latitudeInputId}
                                type="number"
                                inputMode="decimal"
                                min={-90}
                                max={90}
                                step="any"
                                defaultValue={latitude ?? ''}
                                key={`manual-lat-${latitude ?? ''}`}
                                onFocus={handleManualFocus}
                                onKeyDown={handleManualKeyDown}
                                onBeforeInput={handleManualBeforeInput}
                                onInput={handleManualInput}
                                onPaste={handleManualPaste}
                                onBlur={e => handleManualBlur('latitude', e.currentTarget)}
                                aria-invalid={manualLatError ? true : undefined}
                                aria-describedby={manualLatError ? latitudeErrorId : undefined}
                                variant="editor"
                                className={cn('mt-1.5', manualLatError && 'border-red-500/50')}
                            />
                            {manualLatError ? <p id={latitudeErrorId} role="alert" className="mt-1 text-[11px] text-red-400">{manualLatError}</p> : null}
                        </div>
                        <div>
                            <label htmlFor={longitudeInputId} className="text-[11px] text-slate-500">{s.longitude}</label>
                            <Input
                                id={longitudeInputId}
                                type="number"
                                inputMode="decimal"
                                min={-180}
                                max={180}
                                step="any"
                                defaultValue={longitude ?? ''}
                                key={`manual-lng-${longitude ?? ''}`}
                                onFocus={handleManualFocus}
                                onKeyDown={handleManualKeyDown}
                                onBeforeInput={handleManualBeforeInput}
                                onInput={handleManualInput}
                                onPaste={handleManualPaste}
                                onBlur={e => handleManualBlur('longitude', e.currentTarget)}
                                aria-invalid={manualLngError ? true : undefined}
                                aria-describedby={manualLngError ? longitudeErrorId : undefined}
                                variant="editor"
                                className={cn('mt-1.5', manualLngError && 'border-red-500/50')}
                            />
                            {manualLngError ? <p id={longitudeErrorId} role="alert" className="mt-1 text-[11px] text-red-400">{manualLngError}</p> : null}
                        </div>
                        <p className="text-[11px] text-slate-500 min-[768px]:col-span-2">{s.manualCoordinatesHint}</p>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
