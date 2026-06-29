'use client'

import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { useI18n } from '@/i18n'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'
import { Button } from '@/components/ui/button'

type Props = {
    onSearch: (q: string) => void
    onStatusChange: (status: string) => void
    onSourceChange: (source: string) => void
    onExport: () => void
    exporting: boolean
    status: string
    source: string
}

/**
 * Contact Leads toolbar — composes the shared <TableSearch> + <FilterChip>
 * primitives (GH-1222), same DS as discounts/blog/orders. Status/Source are
 * simple single-selects so they map directly onto FilterChip.
 */
export function CustomersActionBar({ onSearch, onStatusChange, onSourceChange, onExport, exporting, status, source }: Props) {
    const [search, setSearch] = useState('')
    const { t } = useI18n()
    const c = t.dashboard.customers

    const STATUS_OPTIONS = useMemo(() => {
        const base = [{ key: '', label: c.statusAll }]
        const contactOpts = [
            { key: 'new', label: c.statusNew },
            { key: 'read', label: c.statusRead },
            { key: 'contacted', label: c.statusContacted },
            { key: 'ignored', label: c.statusIgnored },
        ]
        if (source === 'newsletter') return [...base, { key: 'subscribed', label: c.statusSubscribed }]
        if (source === 'contact-form') return [...base, ...contactOpts]
        return [...base, ...contactOpts, { key: 'subscribed', label: c.statusSubscribed }]
    }, [c, source])

    const SOURCE_OPTIONS = useMemo(() => [
        { key: '', label: c.sourceAll },
        { key: 'contact-form', label: c.sourceContact },
        { key: 'newsletter', label: c.sourceNewsletter },
    ], [c])

    return (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <TableSearch
                value={search}
                onSearch={(q) => { setSearch(q); onSearch(q) }}
                placeholder={c.searchPlaceholder}
                className="w-full sm:flex-1 sm:max-w-[360px]"
            />

            <FilterChip
                label={c.colStatus}
                value={status}
                options={STATUS_OPTIONS}
                onChange={onStatusChange}
            />
            <FilterChip
                label={c.colSource}
                value={source}
                options={SOURCE_OPTIONS}
                onChange={onSourceChange}
            />

            {/* Spacer pushes the export CTA to the right edge on desktop */}
            <div className="hidden sm:block sm:flex-1" />

            {/* Export CSV — standard F33 secondary action (matches Discounts/Customers) */}
            <div className="flex justify-end sm:contents">
                <Button variant="dashSecondary" size="dash" onClick={onExport} disabled={exporting} className="shrink-0">
                    <Download className="w-4 h-4" />
                    {exporting ? c.exporting : c.exportCsv}
                </Button>
            </div>
        </div>
    )
}
