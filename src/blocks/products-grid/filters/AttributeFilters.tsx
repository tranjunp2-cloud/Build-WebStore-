'use client'

import type React from 'react'
import type { AttributeFilter } from '../filter-types'
import { FILTER_CARD_CLASS_NAME, FILTER_CARD_STYLE } from './card-style'

interface AttributeFiltersProps {
    attributes: AttributeFilter[]
    attributeFilters: Record<string, string[]>
    onUpdateFilter: (params: URLSearchParams, event?: React.SyntheticEvent<HTMLElement>) => void
    primaryColor: string
    searchParams: string
    title: string
}

export function AttributeFilters({ attributes, attributeFilters, onUpdateFilter, primaryColor, searchParams, title }: AttributeFiltersProps) {
    const handleToggle = (key: string, value: string, event: React.MouseEvent<HTMLInputElement>) => {
        const params = new URLSearchParams(searchParams)
        const paramKey = `attr_${key}`
        const existing = params.getAll(paramKey)

        if (existing.includes(value)) {
            params.delete(paramKey)
            existing.filter((entry) => entry !== value).forEach((entry) => params.append(paramKey, entry))
        } else {
            params.append(paramKey, value)
        }

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
                {attributes.map((attribute) => {
                    const selected = attributeFilters[attribute.key] ?? []

                    return (
                        <div key={attribute.key} className="space-y-3">
                            <div className="text-[15px] font-bold text-[var(--text-primary)]">{attribute.key}</div>
                            <div className="space-y-2.5">
                                {attribute.values.map((value) => (
                                    <label key={value} className="flex items-center gap-3 text-[14px] text-[var(--text-secondary)]">
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(value)}
                                            onClick={(event) => handleToggle(attribute.key, value, event)}
                                            onChange={() => undefined}
                                            style={{ accentColor: primaryColor }}
                                        />
                                        <span>{value}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
