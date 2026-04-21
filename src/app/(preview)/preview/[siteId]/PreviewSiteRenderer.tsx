'use client'

import { useCallback } from 'react'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import type { NavPage } from '@/components/site-renderer/SiteRenderer'

interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    site: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page: any
    pages: NavPage[]
}

export function PreviewSiteRenderer({ site, page, pages }: Props) {
    const handleBlockFieldChange = useCallback((blockIndex: number, field: string, value: unknown) => {
        window.parent?.postMessage(
            { type: 'BLOCK_FIELD_CHANGED', blockIndex, field, value },
            window.location.origin,
        )
    }, [])

    return (
        <SiteRenderer
            site={site}
            page={page}
            pages={pages}
            isEditor={true}
            isOwner={true}
            onBlockFieldChange={handleBlockFieldChange}
        />
    )
}
