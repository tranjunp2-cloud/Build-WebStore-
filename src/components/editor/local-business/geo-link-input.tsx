'use client'

import { useState } from 'react'
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

/** F37 US-01: paste-Google-Maps-link primary geo input (PRD §13.9). Runs
 *  layer-1 `parseMapLink` client-side first; on miss, POSTs to the layer-2/3
 *  server route. Resolved coordinates render as read-only chips — direct
 *  editing only via the manual disclosure below, so the two paths never race
 *  (wireframe §4). Net-new UI, no in-file precedent. */
export function GeoLinkInput({ latitude, longitude, streetAddress, city, fullWidth, onCoordinatesChange, labels: s }: GeoLinkInputProps) {
    const [linkValue, setLinkValue] = useState('')
    const [isResolving, setIsResolving] = useState(false)
    const [showManual, setShowManual] = useState(false)
    const [manualLatError, setManualLatError] = useState<string | null>(null)
    const [manualLngError, setManualLngError] = useState<string | null>(null)

    const hasCoords = typeof latitude === 'number' && typeof longitude === 'number'
        && Number.isFinite(latitude) && Number.isFinite(longitude)

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

    function handleManualBlur(field: 'latitude' | 'longitude', raw: string) {
        const setError = field === 'latitude' ? setManualLatError : setManualLngError
        if (!raw.trim()) { setError(null); return }
        const num = Number(raw)
        const [min, max] = field === 'latitude' ? [-90, 90] : [-180, 180]
        if (!Number.isFinite(num) || num < min || num > max) {
            const message = field === 'latitude' ? s.invalidLatitude : s.invalidLongitude
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
                        disabled={isResolving || !linkValue.trim()}
                        className={cn(
                            'shrink-0 rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50',
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
                    <div className="rounded-lg bg-green-500/15 px-3 py-2 text-[11px] font-medium text-green-300">
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
                    className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-300"
                >
                    {showManual ? '▾' : '▸'} {s.manualCoordinates}
                </button>
                {showManual ? (
                    <div className={cn('mt-2 grid gap-3', fullWidth && 'min-[768px]:grid-cols-2')}>
                        <div>
                            <label className="text-[11px] text-slate-500">{s.latitude}</label>
                            <Input
                                type="number"
                                step="any"
                                defaultValue={latitude ?? ''}
                                key={`manual-lat-${latitude ?? ''}`}
                                onBlur={e => handleManualBlur('latitude', e.target.value)}
                                variant="editor"
                                className={cn('mt-1.5', manualLatError && 'border-red-500/50')}
                            />
                            {manualLatError ? <p className="mt-1 text-[11px] text-red-400">{manualLatError}</p> : null}
                        </div>
                        <div>
                            <label className="text-[11px] text-slate-500">{s.longitude}</label>
                            <Input
                                type="number"
                                step="any"
                                defaultValue={longitude ?? ''}
                                key={`manual-lng-${longitude ?? ''}`}
                                onBlur={e => handleManualBlur('longitude', e.target.value)}
                                variant="editor"
                                className={cn('mt-1.5', manualLngError && 'border-red-500/50')}
                            />
                            {manualLngError ? <p className="mt-1 text-[11px] text-red-400">{manualLngError}</p> : null}
                        </div>
                        <p className="text-[11px] text-slate-500 min-[768px]:col-span-2">{s.manualCoordinatesHint}</p>
                    </div>
                ) : null}
            </div>
        </div>
    )
}
