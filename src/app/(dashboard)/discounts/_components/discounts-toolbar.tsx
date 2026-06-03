'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Clock, Tag, ChevronDown } from 'lucide-react'

type StatusFilter = 'all' | 'active' | 'inactive'
type TypeFilter = 'all' | 'percentage' | 'fixed'

interface DiscountsToolbarProps {
    search: string
    onSearch: (q: string) => void
    statusFilter: StatusFilter
    onStatusFilter: (s: StatusFilter) => void
    typeFilter: TypeFilter
    onTypeFilter: (t: TypeFilter) => void
}

function FilterChip<T extends string>({
    icon: Icon,
    label,
    value,
    options,
    onChange,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: T
    options: { key: T; label: string }[]
    onChange: (v: T) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const active = value !== options[0]?.key
    const selected = options.find(o => o.key === value) ?? options[0]!

    useEffect(() => {
        if (!open) return
        function onMouseDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [open])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 h-[40px] px-3 rounded-[10px] text-[13px] font-medium transition-colors cursor-pointer"
                style={{
                    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.1)',
                    color: active ? '#60a5fa' : 'rgba(248,250,252,0.6)',
                }}
            >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label} : </span>
                    {selected.label}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    className="absolute top-[calc(100%+4px)] left-0 min-w-[140px] z-50 rounded-[12px] border border-white/[0.08] overflow-hidden"
                    style={{ background: '#1e293b' }}
                >
                    {options.map(o => (
                        <button
                            key={o.key}
                            type="button"
                            onClick={() => { onChange(o.key); setOpen(false) }}
                            className="w-full px-4 py-[10px] text-left text-[13px] transition-colors hover:bg-white/[0.05] cursor-pointer"
                            style={{
                                color: o.key === value ? 'rgba(248,250,252,1)' : 'rgba(248,250,252,0.5)',
                                fontWeight: o.key === value ? 500 : 400,
                            }}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export function DiscountsToolbar({
    search,
    onSearch,
    statusFilter,
    onStatusFilter,
    typeFilter,
    onTypeFilter,
}: DiscountsToolbarProps) {
    const [input, setInput] = useState(search)

    useEffect(() => { setInput(search) }, [search])

    useEffect(() => {
        const timer = setTimeout(() => onSearch(input), 400)
        return () => clearTimeout(timer)
    }, [input, onSearch])

    const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'active', label: 'Active' },
        { key: 'inactive', label: 'Inactive' },
    ]

    const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'percentage', label: 'Percentage' },
        { key: 'fixed', label: 'Fixed' },
    ]

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-[360px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Search code or description..."
                    className="w-full h-[40px] rounded-[10px] pl-9 pr-3 text-[13px] outline-none transition-colors"
                    style={{
                        background: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(248,250,252,1)',
                    }}
                />
            </div>

            <FilterChip<StatusFilter>
                icon={Clock}
                label="Status"
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={onStatusFilter}
            />

            <FilterChip<TypeFilter>
                icon={Tag}
                label="Type"
                value={typeFilter}
                options={TYPE_OPTIONS}
                onChange={onTypeFilter}
            />
        </div>
    )
}
