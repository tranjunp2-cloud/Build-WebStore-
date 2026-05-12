'use client'

import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIsHiddenLink } from '@/components/site-renderer/HiddenSlugsContext'

type Props = { url?: string; children: ReactNode }

/**
 * Editor-only: wraps any CTA/button and shows a red outline + warning badge
 * when the URL points to a hidden or deleted page.
 * On live site the context is empty → renders children transparently.
 */
export function BrokenLinkWarning({ url, children }: Props) {
    const isHidden = useIsHiddenLink(url)
    if (!isHidden) return <>{children}</>

    return (
        <span className="relative inline-flex">
            <span
                className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-red-500"
                aria-hidden="true"
            />
            <span
                title="Link trỏ đến trang đã ẩn hoặc đã xoá"
                className="absolute -top-2.5 -right-2.5 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md"
            >
                <AlertTriangle size={10} />
            </span>
            {children}
        </span>
    )
}
