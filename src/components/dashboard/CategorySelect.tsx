'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export type Category = {
    id: string
    name: string
    breadcrumbs?: string
}

interface CategorySelectProps {
    categories: Category[]
    selectedIds: string[]
    onChange: (ids: string[]) => void
    error?: string
}

export function CategorySelect({ categories, selectedIds, onChange, error }: CategorySelectProps) {
    const { t } = useI18n()
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleCategory = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(catId => catId !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    const removeCategory = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        onChange(selectedIds.filter(catId => catId !== id))
    }

    // Tính toán depth dựa trên số mũi tên '>' hoặc tự động xếp cây
    const enrichedCategories = categories.map(cat => {
        const parts = cat.breadcrumbs ? cat.breadcrumbs.split(' > ') : [cat.name]
        const depth = parts.length - 1
        // Lấy tên cuối cùng hiển thị thay vì full breadcrumb
        const displayName = parts[parts.length - 1]
        return { ...cat, depth, displayName, fullName: cat.breadcrumbs || cat.name }
    })

    const filteredCategories = enrichedCategories.filter(cat => 
        cat.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Lấy tên các category đã chọn để hiển thị trên nút select
<<<<<<< HEAD
    const selectedCats = enrichedCategories.filter(c => selectedIds.includes(c.id))
=======
    const selectedCats = categories.filter(c => selectedIds.includes(c.id))
>>>>>>> e52acd5 (feat(f08): [US-F08-05] 3-level categories & i18n)

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "mt-1.5 flex min-h-[42px] w-full flex-wrap items-center gap-2 rounded-lg border bg-[#0B1120] px-3 py-2 text-sm text-white outline-none cursor-pointer transition-colors",
                    error ? "border-red-500 focus:border-red-500" : "border-white/10 hover:border-white/20 focus:border-blue-500/50",
                    isOpen && !error && "border-blue-500/50 ring-1 ring-blue-500/50"
                )}
            >
                {selectedCats.length === 0 ? (
                    <span className="text-gray-500">{t.dashboard.products.form.categories.select}</span>
                ) : (
                    selectedCats.map(cat => (
                        <span key={cat.id} className="flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300 border border-blue-500/30">
                            {cat.name}
                            <button 
                                onClick={(e) => removeCategory(e, cat.id)}
                                className="ml-1 rounded-full p-0.5 hover:bg-blue-500/40 text-blue-300"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))
                )}
                <div className="ml-auto flex shrink-0 items-center">
                    <ChevronDown className={cn("h-4 w-4 text-gray-500 transition-transform", isOpen && "rotate-180")} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-[#1E293B] shadow-xl animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                            <input 
                                autoFocus
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t.dashboard.products.form.categories.search}
                                className="w-full rounded-md bg-black/20 pl-8 pr-3 py-1.5 text-sm text-white outline-none placeholder:text-gray-500 border border-transparent focus:border-white/10"
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {filteredCategories.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                                {t.dashboard.products.form.categories.empty}
                            </div>
                        ) : (
                            filteredCategories.map(cat => {
                                const isSelected = selectedIds.includes(cat.id)
                                return (
                                    <div 
                                        key={cat.id}
                                        onClick={() => toggleCategory(cat.id)}
                                        className={cn(
                                            "flex items-center gap-2 cursor-pointer w-full text-left px-2 py-2 text-sm rounded-md transition-colors",
                                            isSelected ? "bg-blue-500/10 text-blue-400 font-medium" : "text-gray-300 hover:bg-white/5 hover:text-white"
                                        )}
                                        style={{ paddingLeft: `${(cat.depth * 1.5) + 0.5}rem` }}
                                        title={cat.fullName}
                                    >
                                        <div className={cn(
                                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                            isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-500"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <span className="truncate">{cat.displayName}</span>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
