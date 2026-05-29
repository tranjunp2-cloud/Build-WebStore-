'use client'

import { useCallback, useEffect, useState } from 'react'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import type { NavPage, SiteRendererProps } from '@/components/site-renderer/SiteRenderer'
import { useEditorStore } from '@/store/editorStore'

interface Props {
    site: SiteRendererProps['site']
    page: SiteRendererProps['page']
    pages: NavPage[]
    isBuilderPreview?: boolean
    isEditorIframe?: boolean
}

export function PreviewSiteRenderer({ site, page: initialPage, pages: initialPages, isBuilderPreview, isEditorIframe }: Props) {
    const [page, setPage] = useState(initialPage)
    const [siteState, setSiteState] = useState(site)
    const [pages, setPages] = useState(initialPages)

    const handleBlockFieldChange = useCallback((blockIndex: number, field: string, value: unknown) => {
        window.parent?.postMessage(
            { type: 'BLOCK_FIELD_CHANGED', blockIndex, field, value },
            window.location.origin,
        )
    }, [])

    // Sync Tailwind `dark` class on <html> with the site colorMode.
    // Tailwind dark: utilities require the `dark` class on the root element.
    // This effect runs on initial mount (server colorMode) and on every theme
    // update received via UPDATE_SITE_THEME postMessage.
    useEffect(() => {
        const colorMode = (siteState.theme as Record<string, unknown> | undefined)?.colorMode
        document.documentElement.classList.toggle('dark', colorMode === 'dark')
    }, [(siteState.theme as Record<string, unknown> | undefined)?.colorMode])

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return
            if (e.data?.type === 'UPDATE_FULL_LAYOUT') {
                const { bodyBlocks } = e.data as { bodyBlocks: unknown[] }
                if (Array.isArray(bodyBlocks)) {
                    setPage(prev => ({
                        ...prev,
                        layout: bodyBlocks.map((b: any, index: number) => ({
                            ...b,
                            __editorBlockIndex: index,
                        })),
                    }))
                }
                return
            }
            if (e.data?.type === 'UPDATE_BLOCK_DATA') {
                const { blockIndex, blockData } = e.data as { blockIndex: number; blockData: unknown }
                if (typeof blockIndex !== 'number' || typeof blockData !== 'object' || blockData === null) return
                setPage(prev => {
                    if (!Array.isArray(prev.layout)) return prev
                    const layout = [...prev.layout]
                    // blockIndex is the STORE index. The iframe layout may have injected system
                    // blocks (e.g. nav prepended at position 0) that shift content blocks so the
                    // iframe slot != store index. Find the slot whose __editorBlockIndex matches
                    // the incoming store index; fall back to direct blockIndex when the layout is
                    // already in store order (after UPDATE_FULL_LAYOUT stamps __editorBlockIndex = i).
                    const iframeSlot = layout.findIndex(
                        b => (b as Record<string, unknown>).__editorBlockIndex === blockIndex
                    )
                    const targetIndex = iframeSlot >= 0 ? iframeSlot : blockIndex
                    if (targetIndex < 0 || targetIndex >= layout.length) return prev
                    layout[targetIndex] = {
                        ...(blockData as object),
                        __editorBlockIndex: blockIndex,
                    }
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
            } else if (e.data?.type === 'UPDATE_SITE_THEME') {
                const { theme } = e.data
                if (typeof theme !== 'object' || theme === null) return
                setSiteState(prev => ({ ...prev, theme: theme as Record<string, unknown> }))
            } else if (e.data?.type === 'UPDATE_IMAGE_LIBRARY_S3') {
                const { imageLibraryS3 } = e.data
                if (typeof imageLibraryS3 !== 'object' || imageLibraryS3 === null) return
                setSiteState(prev => ({ ...prev, imageLibraryS3: imageLibraryS3 as Record<string, string> }))
            } else if (e.data?.type === 'UPDATE_PAGES') {
                const { pages: updatedPages } = e.data
                if (Array.isArray(updatedPages)) setPages(updatedPages as NavPage[])
            } else if (e.data?.type === 'UPDATE_GLOBAL_BLOCKS') {
                const { globalBlocks } = e.data
                setSiteState(prev => ({ ...prev, globalBlocks: globalBlocks ?? null }))
            } else if (e.data?.type === 'UPDATE_LOCALE') {
                // F26-04: sync iframe's editorStore so language switcher flag/state matches parent.
                // Synchronous apply (no dynamic import) to avoid back-to-back UPDATE_LOCALE
                // messages resolving out of order via Promise queue.
                const { activeLocale, generationLocale, siteLocale } = e.data as {
                    activeLocale?: string; generationLocale?: string; siteLocale?: string
                }
                if (typeof activeLocale === 'string') useEditorStore.getState().setActiveLocale(activeLocale)
                if (typeof generationLocale === 'string') useEditorStore.getState().setGenerationLocale(generationLocale)
                if (typeof siteLocale === 'string' && (siteLocale === 'en' || siteLocale === 'ms')) {
                    useEditorStore.getState().setSiteLocale(siteLocale)
                }
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
            isEditorIframe={isEditorIframe}
            isOwner={true}
            onBlockFieldChange={handleBlockFieldChange}
        />
    )
}
