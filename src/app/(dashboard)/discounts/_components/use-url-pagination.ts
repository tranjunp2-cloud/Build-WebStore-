'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/** Allowed page sizes — shared by both discount tabs' rows-per-page dropdown. */
export const PAGE_SIZES = [10, 25, 50, 100] as const

/**
 * Pagination state synced to the URL (`?page=N&limit=M`) so reload / shared links keep the page
 * (Bug #12 AC). Initial page/limit are read from the URL once; thereafter every change is mirrored
 * back via `router.replace` (no history spam, no scroll jump). Other query params are preserved.
 *
 * `setPage` is React's raw dispatcher, so callers can use both `setPage(2)` and `setPage(p => p + 1)`.
 */
export function useUrlPagination(defaultLimit = 10) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // URL params are untrusted — Number('abc') = NaN, Number(null) = 0. Both initialisers reject any
    // non-conforming value so a tampered `?page=abc&limit=xyz` can never leak NaN into the API query:
    // page must be a positive integer (else → 1); limit must be an allowed PAGE_SIZES entry (else → default).
    const [page, setPage] = useState(() => {
        const p = Number(searchParams.get('page'))
        return Number.isInteger(p) && p > 0 ? p : 1
    })
    const [limit, setLimit] = useState(() => {
        const l = Number(searchParams.get('limit'))
        return (PAGE_SIZES as readonly number[]).includes(l) ? l : defaultLimit
    })

    useEffect(() => {
        const params = new URLSearchParams(Array.from(searchParams.entries()))
        if (params.get('page') === String(page) && params.get('limit') === String(limit)) return
        params.set('page', String(page))
        params.set('limit', String(limit))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [page, limit, pathname, router, searchParams])

    return { page, setPage, limit, setLimit }
}
