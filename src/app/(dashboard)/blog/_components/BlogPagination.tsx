"use client"

import React from 'react'

interface PaginationProps {
    currentPage?: number
    totalPages?: number
    onPageChange?: (page: number) => void
}

import { useI18n } from '@/i18n'

function ChevronLeft() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
        >
            <path
                d="M10 4L6 8L10 12"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function ChevronRight() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
        >
            <path
                d="M6 4L10 8L6 12"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function EllipsisIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle cx="3.33" cy="8" r="1" fill="currentColor" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
            <circle cx="12.67" cy="8" r="1" fill="currentColor" />
        </svg>
    )
}

function PageText({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: 14,
                lineHeight: '1.4285714285714286em',
                color: 'var(--dash-text)',
                display: 'block',
            }}
        >
            {children}
        </span>
    )
}

export function BlogPagination({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
}: PaginationProps) {
    const { t } = useI18n()
    let startPage = Math.max(1, currentPage - 1)
    let endPage = Math.min(totalPages, startPage + 2)
    if (endPage - startPage < 2 && startPage > 1) {
        startPage = Math.max(1, endPage - 2)
    }

    const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)

    return (
        <div
            className="flex items-center"
            style={{ gap: 4 }}
            role="navigation"
            aria-label="Pagination"
        >
            <button
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                className="flex items-center justify-center rounded-[8px] hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ height: 36, padding: '8px 12px', gap: 4 }}
            >
                <ChevronLeft />
                <div className="flex items-center justify-center" style={{ gap: 10 }}>
                    <PageText>{t.dashboard.blog.pagination.previous}</PageText>
                </div>
            </button>

            {startPage > 1 && (
                <div
                    className="flex items-center justify-center rounded-[8px]"
                    style={{ width: 36, height: 36, padding: 10 }}
                    aria-hidden="true"
                >
                    <EllipsisIcon />
                </div>
            )}

            {pages.map(page => (
                <button
                    key={page}
                    onClick={() => onPageChange?.(page)}
                    aria-label={`Page ${page}`}
                    aria-current={currentPage === page ? 'page' : undefined}
                    className="flex items-center justify-center rounded-[8px] transition-colors"
                    style={{
                        width: 36,
                        height: 36,
                        padding: 10,
                        ...(currentPage === page ? {
                            background: 'var(--dash-bg)',
                            border: '1px solid var(--dash-border)',
                            boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.1)',
                        } : {}),
                    }}
                >
                    <div className="flex flex-col items-center justify-center" style={{ gap: 10 }}>
                        <PageText>{page}</PageText>
                    </div>
                </button>
            ))}

            {endPage < totalPages && (
                <div
                    className="flex items-center justify-center rounded-[8px]"
                    style={{ width: 36, height: 36, padding: 10 }}
                    aria-hidden="true"
                >
                    <EllipsisIcon />
                </div>
            )}

            <button
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
                className="flex items-center justify-center rounded-[8px] hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ height: 36, padding: '8px 12px', gap: 4 }}
            >
                <div className="flex items-center justify-center" style={{ gap: 10 }}>
                    <PageText>{t.dashboard.blog.pagination.next}</PageText>
                </div>
                <ChevronRight />
            </button>
        </div>
    )
}
