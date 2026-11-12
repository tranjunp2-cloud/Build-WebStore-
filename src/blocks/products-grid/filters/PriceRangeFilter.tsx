'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { ProductFilterBounds } from '../filter-types'
import { FILTER_CARD_CLASS_NAME, FILTER_CARD_STYLE } from './card-style'

interface PriceRangeFilterProps {
    pricePrefix?: string
    activeMinPrice: string | null
    activeMaxPrice: string | null
    bounds: ProductFilterBounds
    onUpdateFilter: (params: URLSearchParams, event?: React.SyntheticEvent<HTMLElement>) => void
    primaryColor: string
    searchParams: string
    title: string
    minLabel: string
    maxLabel: string
}

function clamp(value: number, lower: number, upper: number) {
    return Math.min(Math.max(value, lower), upper)
}

export function PriceRangeFilter({
    pricePrefix = '',
    activeMinPrice,
    activeMaxPrice,
    bounds,
    onUpdateFilter,
    primaryColor,
    searchParams,
    title,
    minLabel,
    maxLabel,
}: PriceRangeFilterProps) {
    const minBound = Math.floor(bounds.minPrice)
    const maxBound = Math.max(Math.ceil(bounds.maxPrice), minBound + 1)

    const parseInitialRange = () => {
        const rawMin = activeMinPrice ? Number(activeMinPrice) : minBound
        const rawMax = activeMaxPrice ? Number(activeMaxPrice) : maxBound
        const normalizedMin = clamp(Number.isFinite(rawMin) ? rawMin : minBound, minBound, maxBound)
        const normalizedMax = clamp(Number.isFinite(rawMax) ? rawMax : maxBound, minBound, maxBound)
        return {
            min: Math.min(normalizedMin, normalizedMax),
            max: Math.max(normalizedMin, normalizedMax),
        }
    }

    const [rangeValues, setRangeValues] = useState(parseInitialRange)

    useEffect(() => {
        setRangeValues(parseInitialRange())
    }, [activeMaxPrice, activeMinPrice, maxBound, minBound])

    const minPercent = useMemo(() => ((rangeValues.min - minBound) / (maxBound - minBound)) * 100, [maxBound, minBound, rangeValues.min])
    const maxPercent = useMemo(() => ((rangeValues.max - minBound) / (maxBound - minBound)) * 100, [maxBound, minBound, rangeValues.max])
    const inactiveTrack = 'var(--divider)'

    const commitRange = (nextMin: number, nextMax: number, event?: React.SyntheticEvent<HTMLElement>) => {
        const params = new URLSearchParams(searchParams)

        if (nextMin <= minBound) params.delete('minPrice')
        else params.set('minPrice', String(nextMin))

        if (nextMax >= maxBound) params.delete('maxPrice')
        else params.set('maxPrice', String(nextMax))

        onUpdateFilter(params, event)
    }

    return (
        <section className={FILTER_CARD_CLASS_NAME} style={FILTER_CARD_STYLE}>
            <div className="mb-6 flex items-center gap-4">
                <span className="flex items-center gap-1" aria-hidden="true">
                    <span className="h-[4px] w-6 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <span className="h-[4px] w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                </span>
                <h4 className="text-[15px] font-extrabold tracking-[0.01em] text-[var(--text-primary)]">{title}</h4>
            </div>

            <div className="space-y-5">
                <div className="flex flex-col gap-1">
                    <span className="text-[15px] leading-6 text-[var(--text-secondary)]">Your range:</span>
                    <span className="whitespace-nowrap text-[15px] font-extrabold leading-6 text-[var(--text-primary)]">
                        {pricePrefix}{rangeValues.min} - {pricePrefix}{rangeValues.max}
                    </span>
                </div>

                <div className="relative h-10">
                    <div
                        className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                        style={{
                            background: `linear-gradient(to right, ${inactiveTrack} 0%, ${inactiveTrack} ${minPercent}%, ${primaryColor} ${minPercent}%, ${primaryColor} ${maxPercent}%, ${inactiveTrack} ${maxPercent}%, ${inactiveTrack} 100%)`,
                        }}
                    />

                    <input
                        type="range"
                        min={minBound}
                        max={maxBound}
                        value={rangeValues.min}
                        aria-label={minLabel}
                        onChange={(event) => {
                            const nextMin = Math.min(Number(event.target.value), rangeValues.max)
                            setRangeValues((current) => ({ ...current, min: nextMin }))
                        }}
                        onPointerUp={(event) => commitRange(rangeValues.min, rangeValues.max, event as unknown as React.SyntheticEvent<HTMLElement>)}
                        className="pointer-events-none absolute left-0 top-1/2 h-10 w-full -translate-y-1/2 appearance-none border-0 bg-transparent outline-none focus:outline-none focus:ring-0 [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-[var(--slider-thumb)] [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-transparent [&::-moz-range-progress]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--slider-thumb)]"
                        style={{ ['--slider-thumb' as string]: primaryColor }}
                    />
                    <input
                        type="range"
                        min={minBound}
                        max={maxBound}
                        value={rangeValues.max}
                        aria-label={maxLabel}
                        onChange={(event) => {
                            const nextMax = Math.max(Number(event.target.value), rangeValues.min)
                            setRangeValues((current) => ({ ...current, max: nextMax }))
                        }}
                        onPointerUp={(event) => commitRange(rangeValues.min, rangeValues.max, event as unknown as React.SyntheticEvent<HTMLElement>)}
                        className="pointer-events-none absolute left-0 top-1/2 h-10 w-full -translate-y-1/2 appearance-none border-0 bg-transparent outline-none focus:outline-none focus:ring-0 [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-[var(--slider-thumb)] [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-transparent [&::-moz-range-progress]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--slider-thumb)]"
                        style={{ ['--slider-thumb' as string]: primaryColor }}
                    />
                </div>
            </div>
        </section>
    )
}
