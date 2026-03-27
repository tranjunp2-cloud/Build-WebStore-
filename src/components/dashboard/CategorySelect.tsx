'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
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
    className?: string
}

export function CategorySelect({ categories, selectedIds, onChange, error, className }: CategorySelectProps) {
    const { t } = useI18n()
    const [isOpen, setIsOpen] = useState(false)
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
            onChange([])
        } else {
            onChange([id])
        }
        setIsOpen(false)
    }

    // Lấy tên các category đã chọn để hiển thị trên nút select
    const selectedCats = categories.filter(c => selectedIds.includes(c.id))

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex min-h-[48px] w-full flex-wrap items-center gap-2 rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] outline-none cursor-pointer transition-colors",
                    error ? "border-red-500 focus-within:border-red-500" : "border-white/[0.08] hover:border-white/20 focus-within:border-white focus-within:ring-1 focus-within:ring-white",
                    isOpen && !error && "border-white ring-1 ring-white",
                    className
                )}
            >
                {selectedCats.length === 0 ? (
                    <span className="text-[#F8FAFC]/40">{t.dashboard.products.form.categories.select}</span>
                ) : (
                    selectedCats.map(cat => (
                        <span key={cat.id} className="text-[#F8FAFC]">
                            {cat.name}
                        </span>
                    ))
                )}
                <div className="ml-auto flex shrink-0 items-center">
                    <ChevronDown className={cn("h-4 w-4 text-gray-500 transition-transform", isOpen && "rotate-180")} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full border border-white/20 bg-[#0B1120] animate-in fade-in slide-in-from-top-1 flex flex-col pt-2 pb-2">
                    <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <div 
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange([])
                                setIsOpen(false)
                            }}
                            className={cn(
                                "flex items-center w-full text-left px-4 py-2.5 text-[16px] cursor-pointer transition-colors",
                                selectedIds.length === 0 ? "bg-[#D9D9D9] text-[#0B1120]" : "text-[#F8FAFC] hover:bg-[#D9D9D9] hover:text-[#0B1120]"
                            )}
                        >
                            {t.dashboard.products.form.categories.select}
                        </div>
                        {categories.map(cat => {
                            const isSelected = selectedIds.includes(cat.id)
                            return (
                                <div 
                                    key={cat.id}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleCategory(cat.id)
                                    }}
                                    className={cn(
                                        "flex items-center w-full text-left px-4 py-2.5 text-[16px] cursor-pointer transition-colors",
                                        isSelected ? "bg-[#D9D9D9] text-[#0B1120]" : "text-[#F8FAFC] hover:bg-[#D9D9D9] hover:text-[#0B1120]"
                                    )}
                                >
                                    <span className="truncate">{cat.name}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
