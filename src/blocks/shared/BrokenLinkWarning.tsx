'use client'

import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useIsHiddenLink } from '@/components/site-renderer/HiddenSlugsContext'

type Props = {
    url?: string
    children: ReactNode
}

/**
 * Editor-only wrapper: shows a red outline + warning badge when the given URL
 * points to a page that is hidden or deleted (invisible to visitors).
 * Renders transparently on live site (context provides empty set).
 */
export function BrokenLinkWarning({ url, children }: Props) {
    const isHidden = useIsHiddenLink(url)
    if (!isHidden) return <>{children}</>

    return (
        <span className="relative inline-flex">
            <span
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{ outline: '2px solid #ef4444', outlineOffset: '2px' }}
                aria-hidden="true"
            />
            <span className="absolute -top-2.5 -right-2.5 z-50 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md">
                <AlertTriangle size={10} aria-label="Link hidden from visitors" />
            </span>
            {children}
        </span>
    )
}
