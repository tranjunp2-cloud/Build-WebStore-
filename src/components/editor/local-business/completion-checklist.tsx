'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LocalBusinessData } from './types'

interface CompletionChecklistProps {
    data: LocalBusinessData
    labels: {
        title: string
        addressSaved: string
        hoursSaved: string
        categorySaved: string
    }
}

/** F37 US-01: minimal per-field completion indicator (PRD FR-12 P0 items owned
 *  by THIS story only). NOT the scored `LocalSEOChecklist` widget (US-F37-04)
 *  — no server scoring, no one-click fixes, just 3 client-computed ✓/○ rows. */
export function CompletionChecklist({ data, labels }: CompletionChecklistProps) {
    const addressDone = Boolean(data.streetAddress?.trim() && data.city?.trim() && data.state?.trim() && data.postcode?.trim())
    const hoursDone = Boolean(data.openingHours?.some(row => !row.isClosed && row.opens?.trim() && row.closes?.trim()))
    const categoryDone = Boolean(data.businessCategory?.trim())

    const rows = [
        { key: 'address', label: labels.addressSaved, done: addressDone },
        { key: 'hours', label: labels.hoursSaved, done: hoursDone },
        { key: 'category', label: labels.categorySaved, done: categoryDone },
    ]

    return (
        <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{labels.title}</p>
            <ul className="space-y-1.5">
                {rows.map(row => (
                    <li key={row.key} className="flex items-center gap-2 text-xs">
                        <span
                            className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                                row.done ? 'bg-green-500/15 text-green-300' : 'bg-white/[0.06] text-slate-500',
                            )}
                        >
                            {row.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                        <span className={row.done ? 'text-slate-300' : 'text-slate-500'}>{row.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
