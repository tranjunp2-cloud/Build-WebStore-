'use client'

import { useCallback, useEffect, useState } from 'react'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import type { NavPage, SiteRendererProps } from '@/components/site-renderer/SiteRenderer'

interface Props {
    site: SiteRendererProps['site']
    page: SiteRendererProps['page']
    pages: NavPage[]
    isBuilderPreview?: boolean
}

export function PreviewSiteRenderer({ site, page: initialPage, pages, isBuilderPreview }: Props) {
    const [page, setPage] = useState(initialPage)

    const handleBlockFieldChange = useCallback((blockIndex: number, field: string, value: unknown) => {
        window.parent?.postMessage(
            { type: 'BLOCK_FIELD_CHANGED', blockIndex, field, value },
            window.location.origin,
        )
    }, [])

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return
            if (e.data?.type !== 'UPDATE_BLOCK_DATA') return
            const { blockIndex, blockData } = e.data as { blockIndex: number; blockData: unknown }
            if (typeof blockIndex !== 'number' || typeof blockData !== 'object' || blockData === null) return
            setPage(prev => {
                if (!Array.isArray(prev.layout)) return prev
                const layout = [...prev.layout]
                layout[blockIndex] = blockData
                return { ...prev, layout }
            })
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    return (
        <SiteRenderer
            site={site}
            page={page}
            pages={pages}
            isEditor={true}
            isBuilderPreview={isBuilderPreview}
            isOwner={true}
            onBlockFieldChange={handleBlockFieldChange}
        />
    )
}
