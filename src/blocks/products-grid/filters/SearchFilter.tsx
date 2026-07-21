'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FILTER_CARD_CLASS_NAME, FILTER_CARD_STYLE, FILTER_CONTROL_STYLE } from './card-style'

interface SearchFilterProps {
    activeSearch: string | null
    onUpdateFilter: (params: URLSearchParams, event?: React.SyntheticEvent<HTMLElement>) => void
    primaryColor: string
    searchParams: string
    title: string
    placeholder: string
    submitAriaLabel: string
}

export function SearchFilter({
    activeSearch,
    onUpdateFilter,
    primaryColor,
    searchParams,
    title,
    placeholder,
    submitAriaLabel,
}: SearchFilterProps) {
    const [value, setValue] = useState(activeSearch ?? '')
    const committedValueRef = useRef((activeSearch ?? '').trim())

    useEffect(() => {
        const nextValue = activeSearch ?? ''
        setValue(nextValue)
        committedValueRef.current = nextValue.trim()
    }, [activeSearch])

    const applySearch = (event?: React.SyntheticEvent<HTMLElement>) => {
        const trimmed = value.trim()
        if (trimmed === committedValueRef.current) return

        const params = new URLSearchParams(searchParams)
        if (trimmed) params.set('search', trimmed)
        else params.delete('search')

        committedValueRef.current = trimmed
        onUpdateFilter(params, event)
    }

    const submitSearch = (event: React.SyntheticEvent<HTMLElement>) => {
        event.preventDefault()
        applySearch(event)
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

            <form
                aria-label={submitAriaLabel}
                className="overflow-hidden rounded-[8px] border"
                style={FILTER_CONTROL_STYLE}
                onSubmit={(event) => submitSearch(event)}
            >
                <div className="relative min-w-0">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--text-secondary)]" aria-hidden="true">
                        <Search className="h-[16px] w-[16px]" />
                    </span>
                    <Input
                        type="search"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        onBlur={(event) => applySearch(event)}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        enterKeyHint="search"
                        className="h-[36px] rounded-[8px] border-0 bg-transparent pl-11 pr-4 text-[13px] text-[var(--text-primary)] shadow-none focus-visible:border-0 focus-visible:ring-0 [&::-ms-clear]:hidden [&::-webkit-search-cancel-button]:hidden"
                    />
                </div>
            </form>
        </section>
    )
}
