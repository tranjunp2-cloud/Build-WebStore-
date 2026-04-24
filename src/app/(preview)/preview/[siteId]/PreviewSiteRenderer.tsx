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
    const [siteState, setSiteState] = useState(site)

    const handleBlockFieldChange = useCallback((blockIndex: number, field: string, value: unknown) => {
        window.parent?.postMessage(
            { type: 'BLOCK_FIELD_CHANGED', blockIndex, field, value },
            window.location.origin,
        )
    }, [])

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return
            if (e.data?.type === 'UPDATE_FULL_LAYOUT') {
                const { bodyBlocks } = e.data as { bodyBlocks: unknown[] }
                if (Array.isArray(bodyBlocks)) {
                    setPage(prev => {
                        const layout = prev.layout || []
                        const navBlock = layout.find((b: any) => b.blockType === 'navigation')
                        const footerBlock = layout.find((b: any) => b.blockType === 'footer')
                        
                        const newBodyBlocks = bodyBlocks.map((b: any, index: number) => ({
                            ...b,
                            __editorBlockIndex: index
                        }))

                        const nextLayout = [
                            ...(navBlock ? [navBlock] : []),
                            ...newBodyBlocks,
                            ...(footerBlock ? [footerBlock] : [])
                        ]
                        return { ...prev, layout: nextLayout }
                    })
                }
                return
            }
            if (e.data?.type === 'UPDATE_BLOCK_DATA') {
                const { blockIndex, blockData } = e.data as { blockIndex: number; blockData: unknown }
                if (typeof blockIndex !== 'number' || typeof blockData !== 'object' || blockData === null) return
                setPage(prev => {
                    if (!Array.isArray(prev.layout)) return prev
                    const layout = [...prev.layout]
                    layout[blockIndex] = blockData
                    return { ...prev, layout }
                })
            } else if (e.data?.type === 'UPDATE_HEADER_BLOCK') {
                const { blockData } = e.data
                if (typeof blockData !== 'object' || blockData === null) return
                setSiteState(prev => ({ ...prev, headerBlock: blockData as Record<string, unknown> }))
            } else if (e.data?.type === 'UPDATE_FOOTER_BLOCK') {
                const { blockData } = e.data
                if (typeof blockData !== 'object' || blockData === null) return
                setSiteState(prev => ({ ...prev, footerBlock: blockData as Record<string, unknown> }))
            }
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    return (
        <SiteRenderer
            site={siteState}
            page={page}
            pages={pages}
            isEditor={true}
            isBuilderPreview={isBuilderPreview}
            isOwner={true}
            onBlockFieldChange={handleBlockFieldChange}
        />
    )
}
