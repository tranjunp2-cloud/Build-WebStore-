import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    className?: string
    previousLabel?: string
    nextLabel?: string
}

export function Pagination({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    className,
    previousLabel = 'Previous',
    nextLabel = 'Next'
}: PaginationProps) {
    if (totalPages <= 1) return null

    const getVisiblePages = () => {
        const delta = 1
        const range = []
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i)
        }

        if (currentPage - delta > 2) {
            range.unshift('...')
        }
        if (currentPage + delta < totalPages - 1) {
            range.push('...')
        }

        range.unshift(1)
        if (totalPages > 1) {
            range.push(totalPages)
        }
        return range
    }

    return (
        <div className={cn("flex flex-row items-center justify-center gap-2", className)}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center justify-center gap-1.5 px-3 h-8 text-[14px] font-medium text-[#F8FAFC]/60 hover:text-white hover:bg-[#1E293B]/50 rounded-[8px] transition-colors disabled:opacity-50 disabled:pointer-events-none border-none outline-none bg-transparent cursor-pointer shrink-0"
            >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>{previousLabel}</span>
            </button>

            <div className="flex flex-row items-center gap-2 px-1">
                {getVisiblePages().map((page, i) => {
                    if (page === '...') {
                        return (
                            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[#F8FAFC]/60 text-[14px] shrink-0">
                                ...
                            </span>
                        )
                    }
                    return (
                        <button
                            key={page}
                            onClick={() => onPageChange(page as number)}
                            className={cn(
                                "w-8 h-8 min-w-[32px] flex flex-row items-center justify-center rounded-[8px] text-[14px] font-medium transition-colors cursor-pointer border-none outline-none shrink-0",
                                currentPage === page 
                                    ? "bg-[#1E293B] text-white shadow-sm" 
                                    : "bg-transparent text-[#F8FAFC]/60 hover:bg-[#1E293B]/50 hover:text-white"
                            )}
                        >
                            {page}
                        </button>
                    )
                })}
            </div>

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center gap-1.5 px-3 h-8 text-[14px] font-medium text-[#F8FAFC]/60 hover:text-white hover:bg-[#1E293B]/50 rounded-[8px] transition-colors disabled:opacity-50 disabled:pointer-events-none border-none outline-none bg-transparent cursor-pointer shrink-0"
            >
                <span>{nextLabel}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
        </div>
    )
}
