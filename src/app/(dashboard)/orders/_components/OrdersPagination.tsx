"use client"

import React from 'react'
import { useI18n } from '@/i18n'

// ───────── PAGINATION — Node 31463:6729 ─────────
//
// Root (Pagination instance):
//   layout_HPHNTJ: mode row, alignItems center, gap 4px, sizing hug×hug
//
// Buttons (Previous / Next):
//   layout_VDTG4A: mode row, justifyContent center, alignItems center
//   gap: 4px, padding: 8px 12px, height: 36px (fixed), hug width
//   borderRadius: 8px
//
// lucide/chevron-left / lucide/chevron-right:
//   layout_Z9U4W2: 16×16 fixed
//   path stroke: #FAFAFA 1px
//
// Text wrapper (Previous / Next label):
//   layout_4G9L1C: row, justifyContent center, alignItems center, gap 10px, hug
//
// Text — Text-sm/Medium:
//   fontFamily: Inter
//   fontWeight: 500
//   fontSize: 14
//   lineHeight: 1.4285714285714286em
//   fill_OE515K: #FAFAFA
//
// Wrapper (page number):
//   layout_HU4S4R: row, justifyContent center, alignItems center
//   gap: 10px, padding: 10px, width: 36px, height: 36px (fixed)
//   borderRadius: 8px
//
// Number inner frame:
//   layout_725W1Y: column, justifyContent center, alignItems center, gap 10px, hug
//
// ACTIVE page (Wrapper with page 2):
//   fill_P00R8O: #0B1120
//   stroke_4U6DZN: 1px solid rgba(255,255,255,0.08)
//   Box Shadow/shadow-xs: 0px 1px 2px 0px rgba(0,0,0,0.1)
//
// Ellipsis (Wrapper image-svg, page 4 slot):
//   layout_HU4S4R: same 36×36, borderRadius 8px
//   lucide/ellipsis icon (3 dots): path at x:2.67, y:7.33 w:10.67 h:1.33
//   stroke: #FAFAFA 1px

interface PaginationProps {
    currentPage?: number
    totalPages?: number
    onPageChange?: (page: number) => void
}

// ───────── CHEVRON LEFT SVG ─────────
// layout_Z9U4W2: 16×16, path stroke_R51MTU #FAFAFA 1px
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

// ───────── CHEVRON RIGHT SVG ─────────
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

// ───────── ELLIPSIS SVG (lucide/ellipsis) ─────────
// path: x:2.67 y:7.33 w:10.67 h:1.33 → 3 dots layout
function EllipsisIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* 3 dots from layout_BJ4NWO: x:2.67, y:7.33, spacing uniform */}
            <circle cx="3.33" cy="8" r="1" fill="currentColor" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
            <circle cx="12.67" cy="8" r="1" fill="currentColor" />
        </svg>
    )
}

// ───────── PAGE NUMBER TEXT ─────────
// Text-sm/Medium: Inter 500 14px 1.4285714285714286em, #FAFAFA
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

export function OrdersPagination({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
}: PaginationProps) {
    const { t } = useI18n()
    const pg = t.dashboard.orders.pagination
    // Determine the array of pages to show (max 3 pages to perfectly match Figma and fit on responsive devices)
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
                className="flex items-center justify-center rounded-[8px] hover:bg-dash-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ height: 36, padding: '8px 12px', gap: 4 }}
            >
                <ChevronLeft />
                <div className="flex items-center justify-center" style={{ gap: 10 }}>
                    <PageText>{pg.previous}</PageText>
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
                className="flex items-center justify-center rounded-[8px] hover:bg-dash-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ height: 36, padding: '8px 12px', gap: 4 }}
            >
                <div className="flex items-center justify-center" style={{ gap: 10 }}>
                    <PageText>{pg.next}</PageText>
                </div>
                <ChevronRight />
            </button>
        </div>
    )
}
