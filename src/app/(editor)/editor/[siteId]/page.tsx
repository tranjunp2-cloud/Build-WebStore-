'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { normalizeAddSectionBlock } from '@/lib/ai/add-section'
import { hasLocaleContent, resolveBlockContent, interpolateBrand } from '@/lib/ai/add-section-content'
import { EditorCoachMarks } from '@/components/editor/editor-coach-marks'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'
import { EditorMenuDrawer } from '@/components/editor/EditorMenuDrawer'
import { EditorSidebar, type EditorSidebarTabId } from '@/components/editor/EditorSidebar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { PageManagerPanel } from '@/components/editor/PageManagerPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import type { PreviewFrameHandle } from '@/components/editor/PreviewFrame'
import { SettingsPanel, type SettingsTab } from '@/components/editor/SettingsPanel'
import { useEditorStore, BLOCK_TYPE_TO_KEY, type SiteLocale } from '@/store/editorStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useWorkspaceShortcuts } from '@/hooks/useWorkspaceShortcuts'
import { EDITOR_SIDEBAR_WIDTH, SETTINGS_PANEL_WIDTH } from '@/components/editor/layout-constants'
import type { AIAction } from '@/types/editor'
import { useI18n } from '@/i18n'
import { PrePublishModal } from '@/components/editor/PrePublishModal'
import { UnpublishModal } from '@/components/editor/UnpublishModal'
import { EditorTemplateModal, type TemplateApplyResult } from '@/components/editor/EditorTemplateModal'
import { cn } from '@/lib/utils'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useTabAuthority } from '@/hooks/useTabAuthority'
import { OfflineBanner } from '@/components/editor/OfflineBanner'
import { TabSuspendedOverlay } from '@/components/editor/TabSuspendedOverlay'

type SiteData = {
    id: string
    name: string
    domain?: string | null
    status: string
    theme: Record<string, unknown>
    siteType: string
    branding?: {
        logo?: string
        favicon?: string
    }
    headerBlock?: Record<string, unknown> | null
    footerBlock?: Record<string, unknown> | null
    locale?: string
    generationLocale?: string
    contactInfo?: {
        phone?: string
        email?: string
        address?: string
    }
    socialLinks?: {
        facebook?: string
        instagram?: string
        twitter?: string
        linkedin?: string
        youtube?: string
        tiktok?: string
    }
    seo?: {
        metaTitle?: string
        metaDescription?: string
        ogImage?: string | number | null
    }
    publishedAt?: string | null
    tenantSlug?: string | null
    primaryDomain?: string | null
}

type LoadedPageData = {
    id: string
    title: string
    slug?: string
}

import type { PageData, BlockData } from '@/store/editorStore'

type SaveOptions = {
    showToast?: boolean
    refreshPreview?: boolean
}

// Maps Payload field path segments → user-facing labels for publish error toasts.
const FIELD_LABELS: Record<string, string> = {
    phoneNumber: 'WhatsApp Phone Number',
    countryCode: 'WhatsApp Country Code',
}

function friendlyValidationDetail(path: string, message?: string): string {
    const field = path.split('.').pop() || path
    const label = FIELD_LABELS[field] || field
    return `${label}: ${message || 'invalid'}`
}

export default function EditorPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const siteId = params?.siteId as string
    const selectedPageId = searchParams.get('pageId')

    const { t, ti } = useI18n()
    const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
    const [selectedGlobalBlockType, setSelectedGlobalBlockType] = useState<string | null>(null)
    const [site, setSite] = useState<SiteData | null>(null)
    const [page, setPage] = useState<LoadedPageData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)
    const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
    const [activeSidebarTab, setActiveSidebarTab] = useState<EditorSidebarTabId>('chat')
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [userData, setUserData] = useState<{ name: string; initial: string; role: string; avatarUrl?: string | null } | null>(null)
    const [chatActivity, setChatActivity] = useState<{ id: string; content: string } | null>(null)
    const [chatBlockContext, setChatBlockContext] = useState<{ blockIndex: number; blockType: string } | null>(null)
    const [isCompactLayout, setIsCompactLayout] = useState(false)
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
    const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false)

    // Workspace layout (left/right sidebar visibility, persisted in localStorage)
    const leftSidebarVisible = useWorkspaceStore((s) => s.leftSidebarVisible)
    const rightSidebarVisible = useWorkspaceStore((s) => s.rightSidebarVisible)
    useWorkspaceShortcuts()
    const [settingsRequestedTab, setSettingsRequestedTab] = useState<{ tab: SettingsTab; key: number; section?: string } | null>(null)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [templateApplied, setTemplateApplied] = useState(false)
    const [showSaveGuard, setShowSaveGuard] = useState(false)
    const reorderSaveTimerRef = useRef<number | null>(null)
    const footerUpdateSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Imperative handle to send postMessages to iframe without full reload (Gap B)
    const previewFrameSendRef = useRef<PreviewFrameHandle | null>(null)
    const isSavingRef = useRef(false)
    const pendingSaveRef = useRef<SaveOptions | null>(null)

    const { isOnline, isSyncing } = useConnectivity()
    const { isMaster, reclaimAuthority } = useTabAuthority(siteId)

    const blocks = useEditorStore(state => state.blocks)
    const theme = useEditorStore(state => state.theme)
    const siteName = useEditorStore(state => state.siteName)
    const pages = useEditorStore(state => state.pages)
    const currentPageId = useEditorStore(state => state.currentPageId)
    const hasUnsavedChanges = useEditorStore(state => state.hasUnsavedChanges)
    const hasUnpublishedChanges = useEditorStore(state => state.hasUnpublishedChanges)
    const lastSavedAt = useEditorStore(state => state.lastSavedAt)
    const isSaving = useEditorStore(state => state.isSaving)
    const init = useEditorStore(state => state.init)
    const setPages = useEditorStore(state => state.setPages)
    const setCurrentPageId = useEditorStore(state => state.setCurrentPageId)
    const updatePageInState = useEditorStore(state => state.updatePageInState)
    const updateBlock = useEditorStore(state => state.updateBlock)
    const addBlock = useEditorStore(state => state.addBlock)
    const deleteBlock = useEditorStore(state => state.deleteBlock)
    const duplicateBlock = useEditorStore(state => state.duplicateBlock)
    const reorderBlocks = useEditorStore(state => state.reorderBlocks)
    const updateTheme = useEditorStore(state => state.updateTheme)
    const updateSiteName = useEditorStore(state => state.updateSiteName)
    const headerBlock = useEditorStore(state => state.headerBlock)
    const footerBlock = useEditorStore(state => state.footerBlock)
    const globalBlocks = useEditorStore(state => state.globalBlocks)
    const updateHeaderBlock = useEditorStore(state => state.updateHeaderBlock)
    const updateFooterBlock = useEditorStore(state => state.updateFooterBlock)
    const undo = useEditorStore(state => state.undo)
    const redo = useEditorStore(state => state.redo)
    const canUndo = useEditorStore(state => state.canUndo)
    const canRedo = useEditorStore(state => state.canRedo)
    const markSaved = useEditorStore(state => state.markSaved)
    const markPublished = useEditorStore(state => state.markPublished)
    const setIsSaving = useEditorStore(state => state.setIsSaving)
    const setAutoSaveEnabled = useEditorStore(state => state.setAutoSaveEnabled)
    // F-26: Multilingual locale
    const siteLocale = useEditorStore(state => state.siteLocale)
    const activeLocale = useEditorStore(state => state.activeLocale)
    const localeOverrides = useEditorStore(state => state.localeOverrides)
    const setActiveLocale = useEditorStore(state => state.setActiveLocale)
    const setSiteLocale = useEditorStore(state => state.setSiteLocale)
    const setLocaleOverride = useEditorStore(state => state.setLocaleOverride)
    const initLocaleFromBlock = useEditorStore(state => state.initLocaleFromBlock)

    const currentBlock = useMemo(() => {
        if (selectedBlock === null) return null
        // All floating global blocks use negative indices (cartWidget=-1, whatsapp-button=-2, socialWidget=-3)
        if (selectedBlock < 0) {
            const key = selectedGlobalBlockType ? BLOCK_TYPE_TO_KEY[selectedGlobalBlockType] : undefined
            const data = key ? globalBlocks?.[key] : null
            return data ? { ...data, __editorBlockIndex: selectedBlock } : null
        }
        const raw = blocks[selectedBlock] || null
        // F-26: Apply locale overrides so edit panel shows locale-correct values (M1 fix)
        return raw ? useEditorStore.getState().getDisplayBlock(raw) : null
    }, [blocks, selectedBlock, selectedGlobalBlockType, globalBlocks, localeOverrides, activeLocale])
    const isPublished = site?.status === 'published'
    const wasPublished = !isPublished && !!site?.publishedAt
    const siteUrl = useMemo(() => {
        if (site?.primaryDomain) {
            return `https://${site.primaryDomain}`
        }
        const slug = site?.tenantSlug
        if (!slug) return null
        const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
        return `https://${slug}.${domain}`
    }, [site?.primaryDomain, site?.tenantSlug])

    const lastSavedLabel = useMemo(() => {
        if (!lastSavedAt) return null
        return new Date(lastSavedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })
    }, [lastSavedAt])

    const currentPageTitle = useMemo(() => {
        if (page?.title) return page.title
        const currentPage = pages.find(item => item.id === currentPageId)
        return currentPage?.title || 'Homepage'
    }, [currentPageId, page?.title, pages])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 767px)')
        const applyLayoutMode = (matches: boolean) => setIsCompactLayout(matches)

        applyLayoutMode(mediaQuery.matches)

        const handleChange = (event: MediaQueryListEvent) => applyLayoutMode(event.matches)
        mediaQuery.addEventListener('change', handleChange)

        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    // Phase 1: Reset store when siteId changes to prevent stale data flash
    const storeSiteId = useEditorStore(state => state.siteId)
    const resetStore = useEditorStore(state => state.reset)

    useEffect(() => {
        if (storeSiteId && storeSiteId !== siteId) {
            resetStore()
        }
    }, [siteId, storeSiteId, resetStore])

    useEffect(() => {
        if (!siteId) return

        async function loadData() {
            setIsLoading(true)

            try {
                const editorUrl = new URL(`/api/sites/${siteId}/editor-data`, window.location.origin)
                if (selectedPageId) {
                    editorUrl.searchParams.set('pageId', selectedPageId)
                }


                const [editorRes, pagesRes] = await Promise.all([
                    fetch(editorUrl.toString(), { credentials: 'include' }),
                    fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' }),
                ])

                if (!editorRes.ok) {
                    throw new Error(`Failed to load editor data (${editorRes.status})`)
                }

                const data = await editorRes.json()

                if (data.site) {
                    setSite(data.site)
                }

                // Extract user info for menu drawer
                if (data.user) {
                    const name = data.user.firstName || data.user.email?.split('@')[0] || 'User'
                    const av = data.user.avatar
                    const avatarUrl = av && typeof av === 'object' ? (av.url ?? null) : typeof av === 'string' ? av : null
                    setUserData({ name, initial: name.charAt(0).toUpperCase(), role: data.user.role || 'viewer', avatarUrl })
                }

                if (data.page) {
                    const loadedPage = { id: data.page.id, title: data.page.title }
                    setPage(loadedPage)
                    setCurrentPageId(data.page.id)
                } else {
                    setPage(null)
                    setCurrentPageId('')
                }

                // Normalize sparse server GlobalBlocks to dense GlobalBlocksState — server may omit
                // keys that were never configured, but the store requires explicit null per key so that
                // addBlock auto-restore can distinguish "never configured" from "user deleted".
                const rawGb = data.site?.globalBlocks as { cartWidget?: BlockData | null; whatsappButton?: BlockData | null; socialWidget?: BlockData | null } | null | undefined
                const normalizedGb = rawGb
                    ? { cartWidget: rawGb.cartWidget ?? null, whatsappButton: rawGb.whatsappButton ?? null, socialWidget: rawGb.socialWidget ?? null }
                    : null
                init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '', data.site?.headerBlock || null, data.site?.footerBlock || null, normalizedGb)

                // F-26: siteLocale = generationLocale (which language flat blocks are stored in, immutable).
                // activeLocale = Sites.locale (user's preferred locale, can differ after confirm/switch).
                const siteLocale = (data.site?.generationLocale as SiteLocale) || (data.site?.locale as SiteLocale) || 'en'
                const activeLocale = (data.site?.locale as SiteLocale) || siteLocale
                useEditorStore.getState().setSiteLocale(siteLocale)
                useEditorStore.getState().setActiveLocale(activeLocale)

                // F-26: Hydrate localeOverrides from persisted locale_content (always reset to avoid page-switch bleed)
                const persistedLocaleContent = data.page?.localeContent as Record<string, Record<SiteLocale, Record<string, unknown>>> | undefined
                useEditorStore.setState({ localeOverrides: persistedLocaleContent ?? {} })

                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    const loadedPages = pagesData.pages || []
                    setPages(loadedPages)

                    // Derive hasUnpublishedChanges from data: if site is published
                    // but any page is still draft, user needs to re-publish.
                    // Set directly — don't use handleContentChange which also sets hasUnsavedChanges.
                    const siteIsPublished = data.site?.status === 'published'
                    const hasDraftPages = loadedPages.some((p: { status: string }) => p.status === 'draft')

                    // GH-843: also detect pending draft from current page _status returned by
                    // editor-data (fetched with draft:true — returns draft version when it exists).
                    // The pages API _status reflects the live document and misses auto-saved draft
                    // versions. Timestamp comparison is intentionally omitted: seo-queue runs
                    // payload.update() after publish (no draft:true), bumping page.updatedAt past
                    // site.publishedAt and causing a false positive Update button.
                    const currentPageIsDraft = data.page?._status === 'draft'

                    if (siteIsPublished && (hasDraftPages || currentPageIsDraft)) {
                        useEditorStore.setState({ hasUnpublishedChanges: true })
                    }
                }

                setSelectedBlock(null)
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load site data'
                toast.error('Failed to load site', { description: message })
            } finally {
                setIsLoading(false)
            }
        }

        void loadData()
    }, [init, selectedPageId, setCurrentPageId, setPages, siteId])

    // User data is loaded from editor-data API in loadData useEffect above

    const handleSave = useCallback(async (options: SaveOptions = {}) => {
        if (!siteId) return false

        if (isSavingRef.current) {
            // A save is already in progress. Mutex lock.
            // Queue this save request as "dirty" to fire after the current one completes.
            pendingSaveRef.current = {
                ...pendingSaveRef.current,
                ...options,
                showToast: options.showToast || pendingSaveRef.current?.showToast,
                refreshPreview: options.refreshPreview === true || pendingSaveRef.current?.refreshPreview === true
                    ? true
                    : options.refreshPreview ?? pendingSaveRef.current?.refreshPreview
            }
            return true
        }

        isSavingRef.current = true
        pendingSaveRef.current = null
        setIsSaving(true)

        // Cancel any pending reorder-triggered save to prevent double-fire
        if (reorderSaveTimerRef.current !== null) {
            window.clearTimeout(reorderSaveTimerRef.current)
            reorderSaveTimerRef.current = null
        }

        // Cancel the store's pending auto-save timer — explicit saves subsume it
        const storeTimer = useEditorStore.getState().autoSaveTimer
        if (storeTimer) {
            clearTimeout(storeTimer)
            useEditorStore.setState({ autoSaveTimer: null })
        }

        const snapshot = useEditorStore.getState()
        const currentBlocks = snapshot.blocks
        const currentTheme = snapshot.theme
        // Use pageId from store snapshot (not from closure) to prevent race condition
        // when page switch happens during auto-save
        const savePageId = snapshot.currentPageId

        if (currentBlocks.length === 0 && !page) return false

        setIsSaving(true)

        try {
            const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
            if (savePageId) {
                saveUrl.searchParams.set('pageId', savePageId)
            }

            const res = await fetch(saveUrl.toString(), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    blocks: currentBlocks,
                    theme: currentTheme,
                    headerBlock: snapshot.headerBlock,
                    footerBlock: snapshot.footerBlock,
                    ...(snapshot.globalBlocks !== null && { globalBlocks: snapshot.globalBlocks }),
                    // F-26: Persist locale overrides alongside blocks
                    ...(Object.keys(snapshot.localeOverrides).length > 0 && { localeContent: snapshot.localeOverrides }),
                    // F-26: Persist activeLocale so reload restores the correct locale (only en/ms supported by Sites.locale)
                    ...((snapshot.activeLocale === 'en' || snapshot.activeLocale === 'ms') && { locale: snapshot.activeLocale }),
                    isDraft: true,
                }),
            })

            if (!res.ok) {
                const payload = await res.json().catch(() => null)
                const message = typeof payload?.error === 'string'
                    ? payload.error
                    : payload?.error?.details?.formErrors?.[0]
                        || payload?.error?.details?.fieldErrors?.headerBlock?.[0]
                        || payload?.error?.details?.fieldErrors?.blocks?.[0]
                        || `Server returned ${res.status}`
                throw new Error(message)
            }

            markSaved()
            setSaveSuccess(true)

            if (options.refreshPreview ?? true) {
                setIframeKey(key => key + 1)
            }

            if (options.showToast ?? true) {
                toast.success(t.editor.toast.saveSuccess)
            }

            window.setTimeout(() => setSaveSuccess(false), 2000)
            return true
        } catch (err) {
            // BUG-F05-01: log sanitized error code (no internal details in production console)
            console.error('[Editor] Save failed:', { code: 'SAVE_FAILED', env: process.env.NODE_ENV })
            toast.error(t.editor.toast.saveFailed)
            return false
        } finally {
            isSavingRef.current = false
            if (pendingSaveRef.current) {
                // There were unsaved changes queued while we were saving.
                // Fetch the latest state and save again.
                const nextOptions = pendingSaveRef.current
                pendingSaveRef.current = null
                void handleSave(nextOptions)
            } else {
                setIsSaving(false)
            }
        }
    }, [markSaved, page, setIsSaving, siteId])

    // Suspend store auto-save while a template is applied (user must confirm first)
    useEffect(() => {
        setAutoSaveEnabled(!templateApplied)
    }, [templateApplied, setAutoSaveEnabled])

    // Warn user before leaving page with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    // Clear pending save timers on unmount
    useEffect(() => {
        return () => {
            if (reorderSaveTimerRef.current !== null) {
                window.clearTimeout(reorderSaveTimerRef.current)
            }
            if (footerUpdateSaveTimerRef.current !== null) {
                clearTimeout(footerUpdateSaveTimerRef.current)
            }
        }
    }, [])

    // Sync pages visibility/deleted state to preview iframe so BrokenLinkWarning indicators update live.
    useEffect(() => {
        if (!pages.length) return
        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_PAGES', pages })
    }, [pages])

    // Sync globalBlocks changes to preview iframe (covers all mutation paths: add, delete, undo, redo, settings).
    useEffect(() => {
        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks })
    }, [globalBlocks])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (target && target.closest('input, textarea, [contenteditable="true"]')) {
                return
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()

                if (e.shiftKey) {
                    if (canRedo()) {
                        redo()
                        const redoState = useEditorStore.getState()
                        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: redoState.getDisplayBlocks() })
                        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks: redoState.globalBlocks })
                        if (redoState.headerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: redoState.headerBlock })
                        if (redoState.footerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: redoState.footerBlock })
                    }
                    return
                }

                if (canUndo()) {
                    undo()
                    const undoState = useEditorStore.getState()
                    previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: undoState.getDisplayBlocks() })
                    previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks: undoState.globalBlocks })
                    if (undoState.headerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: undoState.headerBlock })
                    if (undoState.footerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: undoState.footerBlock })
                }
            }

            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                if (templateApplied) {
                    setShowSaveGuard(true)
                } else {
                    void handleSave()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [canRedo, canUndo, handleSave, redo, undo])

    const handleThemeChange = useCallback((key: string, value: string) => {
        updateTheme({ [key]: value })
        // Save to DB but don't reload iframe — live CSS update handles preview
        void handleSave({ showToast: false, refreshPreview: false })
        // colorMode (dark/light) requires toggling the Tailwind `dark` class on <html>
        // inside the preview iframe — CSS variables alone don't flip dark: utility classes.
        // Send UPDATE_SITE_THEME so PreviewSiteRenderer re-renders with new theme, and
        // send THEME_COLOR_MODE_UPDATE so PreviewScripts toggles the html.dark class.
        if (key === 'colorMode') {
            const updatedTheme = useEditorStore.getState().theme
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_SITE_THEME', theme: updatedTheme })
            previewFrameSendRef.current?.sendToIframe({ type: 'THEME_COLOR_MODE_UPDATE', colorMode: value })
        }
    }, [updateTheme, handleSave])

    const handleSiteSettingsChange = useCallback(async (changes: Partial<SiteData>) => {
        if (!siteId) return

        // Business name is required — silently ignore blank submissions
        if ('name' in changes && !changes.name) return

        if (changes.name) {
            updateSiteName(changes.name)
            // Sync business name into navigation logoText so the nav header
            // reflects the new name without a separate block edit.
            updateHeaderBlock({ logoText: changes.name })
        }

        setSite(prev => {
            if (!prev) return prev

            return {
                ...prev,
                ...changes,
                contactInfo: {
                    ...(prev.contactInfo || {}),
                    ...(changes.contactInfo || {}),
                },
                socialLinks: {
                    ...(prev.socialLinks || {}),
                    ...(changes.socialLinks || {}),
                },
                seo: {
                    ...(prev.seo || {}),
                    ...(changes.seo || {}),
                },
                branding: {
                    ...(prev.branding || {}),
                    ...(changes.branding || {}),
                },
            }
        })

        try {
            const saveUrl = new URL(`/api/sites/${siteId}/save`, window.location.origin)
            if (currentPageId) {
                saveUrl.searchParams.set('pageId', currentPageId)
            }

            const response = await fetch(saveUrl.toString(), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...(changes.name ? { siteName: changes.name } : {}),
                    contactInfo: changes.contactInfo,
                    socialLinks: changes.socialLinks,
                    branding: changes.branding,
                    seo: changes.seo,
                    // When name changes, persist updated headerBlock (logoText synced above)
                    headerBlock: changes.name
                        ? useEditorStore.getState().headerBlock
                        : changes.headerBlock,
                    footerBlock: changes.footerBlock,
                }),
            })

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`)
            }

            setSaveSuccess(true)
            // header/footer update in-place; branding (CSS vars) still needs full reload
            if (changes.headerBlock || changes.name) {
                const latestHeader = useEditorStore.getState().headerBlock
                if (latestHeader) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: latestHeader })
            }
            if (changes.footerBlock) {
                const latestFooter = useEditorStore.getState().footerBlock
                if (latestFooter) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: latestFooter })
            }
            if (changes.branding) setIframeKey(key => key + 1)
            window.setTimeout(() => setSaveSuccess(false), 1800)
        } catch (error) {
            console.error('Failed to update site settings', error)
            toast.error('Failed to update site settings', { description: 'Please try again later.' })
        }
    }, [currentPageId, siteId, updateSiteName, updateHeaderBlock])

    // F-26: Auto-translate header or footer block into target locale if not already cached.
    // Stores translation in block._localeContent[locale] (no history entry — silent background op).
    const translateGlobalBlock = useCallback(async (
        block: BlockData,
        blockTypeKey: string,
        locale: SiteLocale,
        applyFn: (patch: Record<string, unknown>) => void,
    ) => {
        const existing = (block as Record<string, unknown>)._localeContent as
            | Record<string, Record<string, unknown>>
            | undefined
        if (existing?.[locale] && Object.keys(existing[locale]).length > 0) return

        // Extract translatable string fields only — skip structural/config/id fields
        const SKIP = new Set(['id', 'blockType', 'logo', 'variant', 'backgroundColor', 'showLanguageSwitcher', '_localeContent'])
        const translatableContent = Object.fromEntries(
            Object.entries(block as Record<string, unknown>).filter(([k]) => !SKIP.has(k)),
        )

        try {
            const res = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blockType: blockTypeKey, targetLocale: locale, content: translatableContent }),
            })
            if (!res.ok) return
            const { translated } = await res.json() as { translated: Record<string, unknown> }
            const newLocaleContent = { ...(existing ?? {}), [locale]: translated }
            applyFn({ _localeContent: newLocaleContent })
        } catch {
            // Non-fatal — show original content as fallback
        }
    }, [])

    // F-26: Handle locale switch — persist Sites.locale immediately (no full save needed)
    const handleLocaleSwitch = useCallback(async (locale: SiteLocale) => {
        if (!siteId) return
        setActiveLocale(locale)
        // Re-render preview immediately with whatever locale content is already cached
        setTimeout(() => {
            const { blocks: currentBlocks, getDisplayBlock, headerBlock, footerBlock } = useEditorStore.getState()
            const displayBlocks = currentBlocks.map(b => getDisplayBlock(b))
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: displayBlocks })
            if (headerBlock) {
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: getDisplayBlock(headerBlock) })
            }
            if (footerBlock) {
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: getDisplayBlock(footerBlock) })
            }
        }, 0)

        // Auto-translate header/footer if locale content not yet cached, then re-send to iframe
        const state = useEditorStore.getState()
        if (state.headerBlock) {
            void translateGlobalBlock(
                state.headerBlock,
                `navigation-${siteId}`,
                locale,
                (patch) => {
                    useEditorStore.getState().updateHeaderBlock(patch)
                    const updated = useEditorStore.getState().headerBlock
                    if (updated) {
                        previewFrameSendRef.current?.sendToIframe({
                            type: 'UPDATE_HEADER_BLOCK',
                            blockData: useEditorStore.getState().getDisplayBlock(updated),
                        })
                    }
                },
            )
        }
        if (state.footerBlock) {
            void translateGlobalBlock(
                state.footerBlock,
                `footer-${siteId}`,
                locale,
                (patch) => {
                    useEditorStore.getState().updateFooterBlock(patch)
                    const updated = useEditorStore.getState().footerBlock
                    if (updated) {
                        previewFrameSendRef.current?.sendToIframe({
                            type: 'UPDATE_FOOTER_BLOCK',
                            blockData: useEditorStore.getState().getDisplayBlock(updated),
                        })
                    }
                },
            )
        }

        // Persist the new locale to Sites.locale so AI gen uses the correct locale
        try {
            await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ locale }),
            })
        } catch {
            // Non-fatal — locale preference stored in memory until next save
        }
    }, [siteId, setActiveLocale, translateGlobalBlock])

    // F-26-04: Translate a specific block instance (called after block drop when needsTranslation)
    const handleAutoTranslateBlock = useCallback(async (blockId: string, blockType: string) => {
        try {
            // Send with {brand} token intact so server cache is brand-agnostic (Fix 3)
            const rawContent = resolveBlockContent(blockType, 'en', '{brand}').content
            const res = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blockType, targetLocale: 'ms', content: rawContent }),
            })
            if (!res.ok) return
            const json = await res.json() as { translated?: Record<string, unknown>; status?: string }
            if (json.status === 'fallback' || !json.translated) return
            // Re-apply brand after retrieval (cache stores {brand} tokens)
            const branded = interpolateBrand(json.translated, siteName || 'Your Brand')
            setLocaleOverride(blockId, 'ms', branded)
            // Push display-merged block to iframe
            setTimeout(() => {
                const { blocks: cur, getDisplayBlock } = useEditorStore.getState()
                const idx = cur.findIndex(b => b.id === blockId)
                if (idx >= 0) {
                    previewFrameSendRef.current?.sendToIframe({
                        type: 'UPDATE_BLOCK_DATA',
                        blockIndex: idx,
                        blockData: getDisplayBlock(cur[idx]),
                    })
                }
            }, 0)
        } catch {
            // AC-3: Non-fatal — EN fallback already in place
        }
    }, [siteId, siteName, setLocaleOverride])

    // F-26-04: Manual translate for a block type (✨ AI button in Block Library)
    const handleAutoTranslate = useCallback(async (blockType: string) => {
        // Send {brand} intact — server caches brand-agnostic template
        const rawContent = resolveBlockContent(blockType, 'en', '{brand}').content
        const res = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ blockType, targetLocale: 'ms', content: rawContent }),
        })
        if (!res.ok) throw new Error('translate failed')
        const json = await res.json() as { translated?: Record<string, unknown>; status?: string }
        if (json.status === 'fallback') throw new Error('translate fallback')
        // Result cached server-side with {brand} tokens — future block drops re-interpolate brand
    }, [])

    const handleDeleteBlock = useCallback((index: number) => {
        deleteBlock(index)
        setSelectedBlock(prev => {
            if (prev === null) return null
            if (index < prev) return prev - 1
            if (index === prev) return null
            return prev
        })
        setTimeout(() => {
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: useEditorStore.getState().getDisplayBlocks()
            })
        }, 0)
        void handleSave({ showToast: false, refreshPreview: false })
    }, [deleteBlock, handleSave])

    const handleDuplicateBlock = useCallback((index: number) => {
        duplicateBlock(index)
        setSelectedBlock(index + 1)
        setTimeout(() => {
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: useEditorStore.getState().getDisplayBlocks()
            })
            previewFrameSendRef.current?.setScrollToBlock?.(index + 1)
        }, 0)
        void handleSave({ showToast: false, refreshPreview: false })
    }, [duplicateBlock, handleSave])

    // BUG-F05-01: retry save once on failure to handle transient Payload errors
    const saveWithRetry = useCallback(async (options: SaveOptions) => {
        const ok = await handleSave({ ...options, showToast: false })
        if (!ok) {
            console.warn('[Editor] First save failed, retrying in 1s...')
            await new Promise(r => setTimeout(r, 1000))
            await handleSave({ ...options, showToast: true })
        }
    }, [handleSave])

    const handleBlockFieldChange = useCallback((index: number, field: string, value: string) => {
        const rawBlock = useEditorStore.getState().blocks[index]
        const blockId = rawBlock?.id as string | undefined
        if (blockId) {
            // F-26: Store edit in localeOverrides so EN defaults (seeded by initLocaleFromBlock)
            // never mask user content when switching locales.
            setLocaleOverride(blockId, activeLocale, { [field]: value })
            // Also update the flat block for the site's primary locale — the live renderer reads
            // flat blocks from DB, so edits must propagate there too (dual-write for primary locale).
            if (activeLocale === (site?.locale ?? 'en')) {
                updateBlock(index, { [field]: value })
            }
            const displayBlock = useEditorStore.getState().getDisplayBlock(rawBlock)
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData: displayBlock })
        } else {
            // No blockId — block not yet persisted; fall back to flat block update
            updateBlock(index, { [field]: value })
            const updatedBlock = useEditorStore.getState().blocks[index]
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData: updatedBlock })
        }
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateBlock, setLocaleOverride, activeLocale, site, saveWithRetry])

    const handleBlockUpdate = useCallback((index: number, changes: Record<string, unknown>) => {
        const rawBlock = useEditorStore.getState().blocks[index]
        const blockId = rawBlock?.id as string | undefined
        if (blockId) {
            // F-26: Same dual-write as handleBlockFieldChange — localeOverrides for editor display,
            // flat block for live renderer (primary locale only, to avoid overwriting BM with EN).
            setLocaleOverride(blockId, activeLocale, changes)
            if (activeLocale === (site?.locale ?? 'en')) {
                updateBlock(index, changes)
            }
            const displayBlock = useEditorStore.getState().getDisplayBlock(rawBlock)
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData: displayBlock })
        } else {
            updateBlock(index, changes)
            const updatedBlock = useEditorStore.getState().blocks[index]
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData: updatedBlock })
        }
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateBlock, setLocaleOverride, activeLocale, site, saveWithRetry])

    const handleReorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return
        reorderBlocks(fromIndex, toIndex)
        setSelectedBlock(toIndex)
        setChatActivity({
            id: `reorder-${Date.now()}`,
            content: `Moved block #${fromIndex + 1} to position #${toIndex + 1}`,
        })
        
        setTimeout(() => {
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: useEditorStore.getState().getDisplayBlocks()
            })
            previewFrameSendRef.current?.setScrollToBlock?.(toIndex)
        }, 0)

        // Coalesce consecutive reorders — save once after 500ms idle
        if (reorderSaveTimerRef.current !== null) {
            window.clearTimeout(reorderSaveTimerRef.current)
        }
        reorderSaveTimerRef.current = window.setTimeout(() => {
            reorderSaveTimerRef.current = null
            void handleSave({ showToast: false, refreshPreview: false })
        }, 500)
    }, [reorderBlocks, handleSave])

    // Seed gallery images from Unsplash → S3, then push the S3 map into the iframe
    // via postMessage so the gallery re-renders with correct images without a reload.
    // Idempotent — if already seeded (e.g. via AI gen) the endpoint returns immediately.
    const triggerImageSeed = useCallback(async () => {
        if (!siteId) return
        try {
            const res = await fetch(`/api/sites/${siteId}/seed-images`, { method: 'POST', credentials: 'include' })
            if (res.ok) {
                const data = await res.json()
                if (data.imageLibraryS3 && Object.keys(data.imageLibraryS3).length > 0) {
                    previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_IMAGE_LIBRARY_S3', imageLibraryS3: data.imageLibraryS3 })
                }
            }
        } catch {
            // non-fatal
        }
    }, [siteId])

    const handleBlockDrop = useCallback((index: number, blockData: { blockType: string, variant: string }) => {
        const globalKey = BLOCK_TYPE_TO_KEY[blockData.blockType]
        if (blockData.variant === 'floating' && globalKey) {
            useEditorStore.getState().updateGlobalBlock(globalKey, { blockType: blockData.blockType, variant: 'floating' })
            return
        }

        const nextBlock = normalizeAddSectionBlock(
            {
                instruction: `Add ${blockData.blockType} block`,
                siteName: siteName || site?.name || '',
                theme,
                requestedType: blockData.blockType,
                locale: (site?.locale as 'en' | 'ms') ?? 'en',
            },
            blockData as Record<string, unknown>
        )

        let safeBlock: BlockData = nextBlock || { blockType: blockData.blockType || 'hero', variant: blockData.variant || 'default' }

        // C1 fix: assign a stable client UUID before initLocaleFromBlock / auto-translate
        // guards so both proceed correctly. normalizeBlocksForPersistence strips this before
        // writing to Payload; the save route remaps localeContent to the Payload-assigned ID.
        if (!(safeBlock as Record<string, unknown>).id) {
            ;(safeBlock as Record<string, unknown>).id = crypto.randomUUID()
        }

        // F-26: Consume __localeInit injected by Phase 01 normalizeAddSectionBlock
        const localeInit = (safeBlock as Record<string, unknown>).__localeInit as { en: Record<string, unknown>; ms: Record<string, unknown> } | undefined
        if (localeInit && safeBlock.id) {
            initLocaleFromBlock(safeBlock.id as string, localeInit)
        }
        // Strip __localeInit before persisting the block
        if ((safeBlock as Record<string, unknown>).__localeInit) {
            const { __localeInit: _, ...rest } = safeBlock as Record<string, unknown>
            safeBlock = rest as BlockData
        }

        // F-26-04: Auto-translate when site is ms + block type has no authored BM content
        const blockTypeStr = String(safeBlock.blockType || '')
        if (blockTypeStr && safeBlock.id && (site?.locale === 'ms' || activeLocale === 'ms') && !hasLocaleContent(blockTypeStr, 'ms')) {
            void handleAutoTranslateBlock(safeBlock.id as string, blockTypeStr)
        }

        addBlock(index - 1, safeBlock)
        setSelectedBlock(index)

        setTimeout(() => {
            const latestState = useEditorStore.getState()
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: latestState.getDisplayBlocks()
            })
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_GLOBAL_BLOCKS',
                globalBlocks: latestState.globalBlocks
            })
        }, 0)

        // Don't call setIframeKey(key => key + 1) because save happens asynchronously via autoSave,
        // which causes a race condition where the iframe fetches stale db state.

        setChatActivity({
            id: `drop-${Date.now()}`,
            content: `Added ${blockData.blockType} block`,
        })

        if (blockData.blockType === 'gallery') void triggerImageSeed()

        void handleSave({ showToast: false, refreshPreview: false })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addBlock, theme, handleSave, triggerImageSeed])

    const handleAIAction = useCallback(async (action: AIAction) => {
        // Cancel any pending debounced auto-save to prevent race conditions
        const { autoSaveTimer } = useEditorStore.getState()
        if (autoSaveTimer) clearTimeout(autoSaveTimer)

        switch (action.action) {
            case 'update_block': {
                const blockIndex = action.blockIndex ?? selectedBlock ?? 0
                updateBlock(blockIndex, action.changes || {})
                setSelectedBlock(blockIndex)
                break
            }

            case 'update_theme':
                updateTheme(action.changes || {})
                break

            case 'add_block': {
                const afterIndex = action.afterIndex ?? (blocks.length - 1)
                let nextBlock = normalizeAddSectionBlock(
                    {
                        instruction: action.message || 'Add a new section',
                        requestedType: String(action.block?.blockType || ''),
                        siteName: siteName || site?.name || '',
                        theme,
                        locale: (site?.locale as 'en' | 'ms') ?? 'en',
                    },
                    action.block,
                )

                if (nextBlock) {
                    // F-26: Consume __localeInit from Phase 01 normalizeAddSectionBlock
                    const localeInitAI = (nextBlock as Record<string, unknown>).__localeInit as { en: Record<string, unknown>; ms: Record<string, unknown> } | undefined
                    if (localeInitAI && nextBlock.id) {
                        initLocaleFromBlock(nextBlock.id as string, localeInitAI)
                    }
                    if ((nextBlock as Record<string, unknown>).__localeInit) {
                        const { __localeInit: _li, ...rest } = nextBlock as Record<string, unknown>
                        nextBlock = rest as BlockData
                    }
                    addBlock(afterIndex, nextBlock)
                    setSelectedBlock(Math.max(0, afterIndex + 1))
                    if (nextBlock.blockType === 'gallery') void triggerImageSeed()
                } else {
                    toast.error('Unable to add this section yet')
                }
                break
            }

            case 'delete_block': {
                const blockIndex = action.blockIndex ?? selectedBlock ?? 0
                deleteBlock(blockIndex)
                setSelectedBlock(prev => {
                    if (prev === null) return null
                    if (prev === blockIndex) return null
                    if (prev > blockIndex) return prev - 1
                    return prev
                })
                break
            }

            case 'update_multiple_blocks': {
                if (!action.updates?.length) break

                const { blocks: currentBlocks, theme: currentTheme, pushBatch } = useEditorStore.getState()
                const newBlocks = [...currentBlocks]
                for (const update of action.updates) {
                    const idx = update.blockIndex
                    if (idx >= 0 && idx < newBlocks.length) {
                        newBlocks[idx] = { ...newBlocks[idx], ...update.changes }
                    }
                }
                pushBatch(newBlocks, currentTheme, action.message || 'Updated multiple sections')
                break
            }

            case 'undo': {
                if (canUndo()) {
                    undo()
                    // Replaced setIframeKey with seamless update
                    setTimeout(() => {
                        previewFrameSendRef.current?.sendToIframe({
                            type: 'UPDATE_FULL_LAYOUT',
                            bodyBlocks: useEditorStore.getState().getDisplayBlocks()
                        })
                    }, 0)
                } else {
                    toast.error('Nothing to undo')
                    return // Nothing changed, skip save
                }
                break
            }
        }

        // Single save + preview refresh after any mutation (including undo).
        // Undo must also save to persist the reverted state to DB,
        // otherwise a page reload would lose the undo.
        // setTimeout lets Zustand state settle before reading snapshot.
        setTimeout(() => {
            const { globalBlocks: currentGlobalBlocks, getDisplayBlocks } = useEditorStore.getState()
            // Perform a seamless update for layout modifications
            if (['add_block', 'delete_block', 'reorder_blocks', 'update_multiple_blocks', 'undo'].includes(action.action)) {
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: getDisplayBlocks() })
                // Sync globalBlocks alongside layout — covers cases where addBlock mutates globalBlocks
                // (e.g. commerce block auto-restoring cart) and undo/redo of globalBlock changes.
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks: currentGlobalBlocks })
                if (action.action === 'add_block') {
                    const afterIndex = action.afterIndex ?? (blocks.length - 1)
                    previewFrameSendRef.current?.setScrollToBlock?.(Math.max(0, afterIndex + 1))
                }
                void handleSave({ showToast: false, refreshPreview: false })
            } else {
                void handleSave({ showToast: false, refreshPreview: true })
            }
        }, 300)
    }, [addBlock, blocks.length, deleteBlock, handleSave, selectedBlock, site?.name, siteName, theme, updateBlock, updateTheme, canUndo, undo, triggerImageSeed])

    const handleUndo = useCallback(() => {
        if (!canUndo()) return
        undo()
        setTimeout(() => {
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: useEditorStore.getState().getDisplayBlocks()
            })
        }, 0)
        // If user undoes the template apply, clear the save guard
        setTemplateApplied(false)
    }, [canUndo, undo])

    const handleRedo = useCallback(() => {
        if (!canRedo()) return
        redo()
        setTimeout(() => {
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: useEditorStore.getState().getDisplayBlocks()
            })
        }, 0)
    }, [canRedo, redo])

    // Wait for any in-flight save to complete, then save if there are pending changes.
    // Prevents publish from reading a stale draft when the user clicks Publish
    // immediately after a variant/block change (race: saveWithRetry is async/fire-and-forget).
    const flushSavesBeforePublish = useCallback(async (): Promise<boolean> => {
        // Poll until in-flight save finishes (max 10s)
        if (isSavingRef.current) {
            await new Promise<void>((resolve) => {
                const deadline = Date.now() + 10_000
                const check = setInterval(() => {
                    if (!isSavingRef.current || Date.now() > deadline) {
                        clearInterval(check)
                        resolve()
                    }
                }, 100)
            })
        }
        // Save any remaining unsaved changes
        if (useEditorStore.getState().hasUnsavedChanges) {
            const saved = await handleSave({ showToast: false, refreshPreview: false })
            if (!saved) return false
            // Wait for that save to finish too
            await new Promise<void>((resolve) => {
                const deadline = Date.now() + 10_000
                const check = setInterval(() => {
                    if (!isSavingRef.current || Date.now() > deadline) {
                        clearInterval(check)
                        resolve()
                    }
                }, 100)
            })
        }
        return true
    }, [handleSave])

    const handlePublish = useCallback(async () => {
        if (!siteId || isPublishing) return

        setIsPublishing(true)
        const currentlyPublished = site?.status === 'published'

        try {
            const flushed = await flushSavesBeforePublish()
            if (!flushed) {
                setIsPublishing(false)
                return
            }

            // Send current store state so publish route uses authoritative client values
            // rather than relying on pending DB reads (unreliable if migration missing).
            const { globalBlocks: globalBlocksSnap, headerBlock: headerBlockSnap, footerBlock: footerBlockSnap } = useEditorStore.getState()
            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: currentlyPublished ? 'DELETE' : 'PATCH',
                credentials: 'include',
                ...(currentlyPublished ? {} : {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ globalBlocks: globalBlocksSnap, headerBlock: headerBlockSnap, footerBlock: footerBlockSnap }),
                }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null) as {
                    error?: {
                        message?: string
                        failures?: Array<{
                            errName?: string
                            errMsg?: string
                            pgColumn?: string
                            pgTable?: string
                            causeMsg?: string
                            validationErrors?: Array<{ path?: string; message?: string }>
                        }>
                    }
                } | null
                const firstFailure = body?.error?.failures?.[0]
                const firstValidation = firstFailure?.validationErrors?.[0]
                let detail: string | undefined
                if (firstValidation?.path) {
                    detail = friendlyValidationDetail(firstValidation.path, firstValidation.message)
                } else if (firstFailure?.pgColumn && firstFailure?.pgTable) {
                    detail = `${firstFailure.pgTable}.${firstFailure.pgColumn} missing — run \`npm run db:migrate\``
                } else {
                    const isDev = process.env.NODE_ENV === 'development'
                    detail = (isDev ? (firstFailure?.causeMsg || firstFailure?.errMsg) : undefined)
                        || body?.error?.message
                }
                throw new Error(detail || `Server returned ${res.status}`)
            }

            setPublishSuccess(true)
            setSite(prev => prev ? {
                ...prev,
                status: currentlyPublished ? 'draft' : 'published',
            } : prev)

            setIsPublishModalOpen(false)
            setIsUnpublishModalOpen(false)

            // Clear unpublished changes flag after successful publish
            if (!currentlyPublished) {
                markPublished()

                // Refetch pages so draft→live status is reflected in the sidebar.
                try {
                    const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
                    if (pagesRes.ok) {
                        const pagesData = await pagesRes.json()
                        if (Array.isArray(pagesData?.pages)) setPages(pagesData.pages)
                    }
                } catch {
                    // Non-fatal.
                }
            }

            if (!currentlyPublished) {
                const data = await res.json()
                const siteUrl = data?.data?.url || data?.data?.domain
                if (siteUrl) {
                    toast.success(`🎉 ${t.editor.toast.publishSuccess}`, {
                        description: ti(t.editor.toast.publishSuccessDomain, { domain: siteUrl.replace(/^https?:\/\//, '') }),
                        action: {
                            label: t.editor.toast.viewAction,
                            onClick: () => window.open(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`, '_blank')
                        }
                    })
                } else {
                    toast.success(`🎉 ${t.editor.toast.publishSuccess}`)
                }
            } else {
                toast.success(t.editor.toast.unpublishSuccess)
            }

            window.setTimeout(() => setPublishSuccess(false), 3000)
        } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error('[Editor] Publish failed:', err)
            const detail = err instanceof Error ? err.message : undefined
            toast.error(t.editor.toast.publishFailed, {
                description: detail,
                duration: 10000,
                action: {
                    label: 'Retry',
                    onClick: () => void handlePublish(),
                },
            })
        } finally {
            setIsPublishing(false)
        }
    }, [flushSavesBeforePublish, isPublishing, markPublished, setPages, site?.status, siteId, siteName])

    // Re-publish: always PATCH (never DELETE). Used by "Update" button on published sites.
    const handleRepublish = useCallback(async () => {
        if (!siteId || isPublishing) return

        setIsPublishing(true)
        try {
            const flushed = await flushSavesBeforePublish()
            if (!flushed) {
                setIsPublishing(false)
                return
            }

            // Send current store state — same pattern as handlePublish
            const { globalBlocks: globalBlocksSnap, headerBlock: headerBlockSnap, footerBlock: footerBlockSnap } = useEditorStore.getState()
            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ globalBlocks: globalBlocksSnap, headerBlock: headerBlockSnap, footerBlock: footerBlockSnap }),
            })

            if (!res.ok) {
                // Try to surface the actual server-side cause (PG column missing,
                // Payload ValidationError on a required field, etc.) instead of
                // a generic "Server returned 500".
                const body = await res.json().catch(() => null) as {
                    error?: {
                        message?: string
                        failures?: Array<{
                            errName?: string
                            errMsg?: string
                            pgColumn?: string
                            pgTable?: string
                            causeMsg?: string
                            validationErrors?: Array<{ path?: string; message?: string }>
                        }>
                    }
                } | null
                const firstFailure = body?.error?.failures?.[0]
                const firstValidation = firstFailure?.validationErrors?.[0]
                let detail: string | undefined
                if (firstValidation?.path) {
                    detail = friendlyValidationDetail(firstValidation.path, firstValidation.message)
                } else if (firstFailure?.pgColumn && firstFailure?.pgTable) {
                    detail = `${firstFailure.pgTable}.${firstFailure.pgColumn} missing — run \`npm run db:migrate\``
                } else {
                    const isDev = process.env.NODE_ENV === 'development'
                    detail = (isDev ? (firstFailure?.causeMsg || firstFailure?.errMsg) : undefined)
                        || body?.error?.message
                }
                throw new Error(detail || `Server returned ${res.status}`)
            }

            markPublished()
            setPublishSuccess(true)

            // Refetch pages so freshly-promoted pages show "Live" instead of stale
            // "Draft". markPublished() only clears hasUnpublishedChanges; individual
            // page.status still holds the pre-publish value until we resync.
            try {
                const pagesRes = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include' })
                if (pagesRes.ok) {
                    const pagesData = await pagesRes.json()
                    if (Array.isArray(pagesData?.pages)) setPages(pagesData.pages)
                }
            } catch {
                // Non-fatal — next page reload will resync.
            }

            const data = await res.json()
            const url = data?.data?.url || data?.data?.domain
            if (url) {
                toast.success(`🎉 ${t.editor.toast.publishSuccess}`, {
                    description: ti(t.editor.toast.publishSuccessDomain, { domain: url.replace(/^https?:\/\//, '') }),
                    action: {
                        label: 'View',
                        onClick: () => window.open(url.startsWith('http') ? url : `https://${url}`, '_blank')
                    }
                })
            } else {
                toast.success(`🎉 ${t.editor.toast.publishSuccess}`)
            }

            window.setTimeout(() => setPublishSuccess(false), 3000)
        } catch (err) {
            if (process.env.NODE_ENV === 'development') console.error('[Editor] Re-publish failed:', err)
            const detail = err instanceof Error ? err.message : undefined
            toast.error(t.editor.toast.publishFailed, {
                description: detail,
                duration: 10000,
                action: {
                    label: 'Retry',
                    onClick: () => void handleRepublish(),
                },
            })
        } finally {
            setIsPublishing(false)
        }
    }, [flushSavesBeforePublish, isPublishing, markPublished, setPages, siteId])

    const handlePageSelected = useCallback(async (pageId: string) => {
        const store = useEditorStore.getState()

        // Cancel any pending auto-save timer to prevent cross-page data save
        if (store.autoSaveTimer) {
            clearTimeout(store.autoSaveTimer)
            useEditorStore.setState({ autoSaveTimer: null })
        }

        // Save current page before switching to prevent data loss
        if (store.hasUnsavedChanges) {
            await handleSave({ showToast: false, refreshPreview: false })
        }

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.set('pageId', pageId)
        router.replace(`/editor/${siteId}?${nextParams.toString()}`)
        // Force iframe refresh to show new page content
        setIframeKey(k => k + 1)
        setSelectedBlock(null)
    }, [handleSave, router, searchParams, siteId])

    const handlePageUpdate = useCallback(async (pageId: string, changes: Partial<PageData>) => {
        try {
            const res = await fetch(`/api/sites/${siteId}/pages/${pageId}`, {
                method: 'PATCH',
                headers: { 'Content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(changes),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error || 'Failed to update page settings')
            }

            const data = await res.json()
            if (data?.page) {
                updatePageInState(pageId, {
                    title: data.page.title,
                    slug: data.page.slug,
                    status: data.page.status,
                    isVisible: data.page.isVisible,
                    seoTitle: data.page.seoTitle,
                    seoDescription: data.page.seoDescription,
                    updatedAt: data.page.updatedAt,
                    error: null,
                })
                if (changes.slug || changes.seoTitle || changes.seoDescription) {
                    setIframeKey(key => key + 1)
                }
                return data.page as PageData
            }
            return null
        } catch {
            toast.error('Failed to update page settings')
            return null
        }
    }, [siteId, updatePageInState])

    // BUG-F05-032/046: context-sensitive tab switching when blocks are clicked
    const handleBlockSelectWithContext = useCallback((blockIndex: number | null, blockType?: string) => {
        if (blockType === 'navigation' || blockType === 'footer' || blockType === 'breadcrumb') {
            setSelectedBlock(null)
            setSelectedGlobalBlockType(null)
            // Use unique key to force re-trigger even on repeated clicks
            const sectionMap: Record<string, string> = { breadcrumb: 'breadcrumb', footer: 'footer' }
            setSettingsRequestedTab({ tab: 'menu', key: Date.now(), section: blockType ? sectionMap[blockType] : undefined })
        } else {
            setSelectedBlock(blockIndex)
            // All floating global blocks have negative blockIndex (cartWidget=-1, whatsapp-button=-2, socialWidget=-3)
            setSelectedGlobalBlockType(blockIndex !== null && blockIndex < 0 ? (blockType ?? null) : null)
            setSettingsRequestedTab(null)
        }
    }, [])

    const handleMobileBlockSelect = useCallback((blockIndex: number | null) => {
        setSelectedBlock(blockIndex)
        // Floating blocks route via onEditGlobalBlock → handleBlockSelectWithContext, not here.
        // Guard clears global type state when switching to a page block (index >= 0 or null).
        if (blockIndex === null || blockIndex >= 0) setSelectedGlobalBlockType(null)
        if (isCompactLayout && blockIndex !== null) {
            setIsMobileSettingsOpen(true)
        }
    }, [isCompactLayout])

    const sidebarTabs = [
        { id: 'chat' as const, label: 'AI Chat', icon: <span aria-hidden="true">💬</span> },
        { id: 'components' as const, label: 'Components', icon: <span aria-hidden="true">⚡</span> },
        { id: 'pages' as const, label: 'Pages', icon: <span aria-hidden="true">📄</span> },
    ]

    const sidebarContent = (
        <>
            {activeSidebarTab === 'chat' ? (
                <AIChatPanel
                    siteId={siteId}
                    blocks={blocks}
                    selectedBlock={selectedBlock}
                    onAIAction={handleAIAction}
                    onUndoLastAction={handleUndo}
                    siteName={siteName || site?.name || ''}
                    theme={theme}
                    currentPageSlug={page?.slug || 'home'}
                    currentPageTitle={currentPageTitle}
                    externalActivity={chatActivity}
                    blockContext={chatBlockContext}
                    onBlockContextDismiss={() => setChatBlockContext(null)}
                    compact={isCompactLayout}
                />
            ) : null}

            {activeSidebarTab === 'components' ? (
                <BlockLibraryPanel
                    blocks={blocks}
                    selectedBlock={selectedBlock}
                    onBlockSelect={handleMobileBlockSelect}
                    onAIAction={handleAIAction}
                    onEditGlobalBlock={(blockType) => {
                        handleBlockSelectWithContext(-1, blockType)
                        if (!rightSidebarVisible) useWorkspaceStore.getState().toggleRight()
                    }}
                    onAutoTranslate={handleAutoTranslate}
                />
            ) : null}

            {activeSidebarTab === 'pages' ? (
                <PageManagerPanel
                    siteId={siteId}
                    currentPageId={currentPageId}
                    siteStatus={site?.status}
                    onPageSelected={handlePageSelected}
                    onPagesChanged={() => setIframeKey(key => key + 1)}
                    onEditPage={() => setActiveSidebarTab('chat')}
                />
            ) : null}
        </>
    )

    return (
        <>
        <div className="editor-shell flex h-[100dvh] overflow-hidden flex-col bg-[#0B1120]">
            <EditorMenuDrawer
                siteId={siteId}
                open={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                currentUserRole={userData?.role}
                userName={userData?.name}
                userInitial={userData?.initial}
                userAvatarUrl={userData?.avatarUrl}
                hasUnsavedChanges={hasUnsavedChanges}
            />

            <EditorToolbar
                siteId={siteId}
                currentPageId={currentPageId}
                siteName={siteName || site?.name || ''}
                currentPageTitle={currentPageTitle}
                pages={pages}
                isPublished={Boolean(isPublished)}
                isSaving={isSaving}
                saveSuccess={saveSuccess}
                hasUnsavedChanges={hasUnsavedChanges}
                hasUnpublishedChanges={hasUnpublishedChanges}
                isPublishing={isPublishing}
                publishSuccess={publishSuccess}
                canUndo={canUndo()}
                canRedo={canRedo()}
                viewport={viewport}
                compact={isCompactLayout}
                onOpenMenu={() => setIsMenuOpen(true)}
                onOpenTemplates={() => setIsTemplateModalOpen(true)}
                onPageSelected={handlePageSelected}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSave={() => {
                    if (templateApplied) {
                        setShowSaveGuard(true)
                    } else {
                        void handleSave()
                    }
                }}
                onPublish={() => setIsPublishModalOpen(true)}
                onRepublish={handleRepublish}
                onUnpublish={() => setIsUnpublishModalOpen(true)}
                onViewLive={() => siteUrl && window.open(siteUrl, '_blank')}
                onCopyLink={() => {
                    if (siteUrl) {
                        navigator.clipboard.writeText(siteUrl)
                        toast.success(t.editor.toast.linkCopied, { description: siteUrl })
                    }
                }}
                siteUrl={siteUrl}
                wasPublished={wasPublished}
                onViewportChange={setViewport}
            />

            <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} />

            {isCompactLayout ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <EditorSidebar
                        tabs={sidebarTabs}
                        activeTab={activeSidebarTab}
                        onTabChange={setActiveSidebarTab}
                        compact
                    >
                        {sidebarContent}
                    </EditorSidebar>

                    {/* F05 FR-29: FAB chat button on mobile */}
                    {activeSidebarTab !== 'chat' && (
                        <button
                            type="button"
                            onClick={() => setActiveSidebarTab('chat')}
                            className="fixed right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-white shadow-lg shadow-blue-500/25 transition-transform active:scale-95"
                            style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
                            aria-label="Open AI Chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>
                    )}

                    {/* F05 FR-31: Bottom sheet for block settings on mobile */}
                    {isMobileSettingsOpen && currentBlock && (
                        <div className="fixed inset-0 z-50 flex flex-col justify-end">
                            <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => setIsMobileSettingsOpen(false)}
                                onKeyDown={(e) => e.key === 'Escape' && setIsMobileSettingsOpen(false)}
                                role="button"
                                tabIndex={0}
                                aria-label="Close settings"
                            />
                            <div className="relative max-h-[70vh] landscape:max-h-[90vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0F172A]">
                                <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#0F172A] px-4 py-3">
                                    <span className="text-sm font-medium text-white">Block Settings</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSettingsOpen(false)}
                                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </div>
                                <SettingsPanel
                                    block={currentBlock}
                                    blockIndex={selectedBlock}
                                    theme={theme}
                                    site={site}
                                    siteName={siteName || site?.name || ''}
                                    siteStatus={site?.status || 'draft'}
                                    headerBlock={headerBlock}
                                    footerBlock={footerBlock}
                                    pages={pages}
                                    currentPageId={currentPageId}
                                    siteLocale={siteLocale}
                                    activeLocale={activeLocale}
                                    navShowLanguageSwitcher={Boolean((headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher)}
                                    onNavLanguageSwitcherChange={(show) => {
                                        updateHeaderBlock({ showLanguageSwitcher: show })
                                        const updatedHeader = useEditorStore.getState().headerBlock
                                        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: updatedHeader })
                                        if (!show) void handleLocaleSwitch(siteLocale as SiteLocale)
                                        void saveWithRetry({ showToast: false, refreshPreview: false })
                                    }}
                                    onLocaleSwitch={(locale) => { void handleLocaleSwitch(locale as SiteLocale) }}
                                    onThemeChange={handleThemeChange}
                                    onBlockFieldChange={handleBlockFieldChange}
                                    onBlockUpdate={handleBlockUpdate}
                                    onHeaderUpdate={(changes) => {
                                        updateHeaderBlock(changes)
                                        const updatedHeader = useEditorStore.getState().headerBlock
                                        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: updatedHeader })
                                        void saveWithRetry({ showToast: false, refreshPreview: false })
                                    }}
                                    onFooterUpdate={(changes) => {
                                        updateFooterBlock(changes)
                                        const updatedFooter = useEditorStore.getState().footerBlock
                                        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: updatedFooter })
                                        if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
                                        footerUpdateSaveTimerRef.current = setTimeout(() => {
                                            footerUpdateSaveTimerRef.current = null
                                            void saveWithRetry({ showToast: false, refreshPreview: false })
                                        }, 600)
                                    }}
                                    onSiteSettingsChange={handleSiteSettingsChange}
                                    onPageUpdate={handlePageUpdate}
                                    requestedTab={settingsRequestedTab}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div
                        className="shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-in-out"
                        style={{
                            width: leftSidebarVisible ? EDITOR_SIDEBAR_WIDTH : 0,
                            opacity: leftSidebarVisible ? 1 : 0,
                        }}
                    >
                        <EditorSidebar
                            tabs={sidebarTabs}
                            activeTab={activeSidebarTab}
                            onTabChange={setActiveSidebarTab}
                        >
                            {sidebarContent}
                        </EditorSidebar>
                    </div>

                    <div className={cn("flex flex-1 flex-col transition-opacity duration-300", isTransitioning && "opacity-0")}>
                        <PreviewFrame
                            siteId={siteId}
                            pageId={currentPageId}
                            iframeKey={iframeKey}
                            isLoading={isLoading}
                            viewport={viewport}
                            selectedBlock={selectedBlock}
                            onBlockSelect={handleBlockSelectWithContext}
                            onBlockAIEdit={(blockIndex, blockType) => {
                                setActiveSidebarTab('chat')
                                setChatBlockContext({ blockIndex, blockType })
                            }}
                            onDeleteBlock={handleDeleteBlock}
                            onDuplicateBlock={handleDuplicateBlock}
                            onInlineEditApplied={async (content, blockIndex, detail) => {
                                setSelectedBlock(blockIndex)
                                setActiveSidebarTab('chat')
                                // BUG-F05-13: Show instruction + result separately in chat
                                if (detail) {
                                    setChatActivity({
                                        id: `inline-req-${Date.now()}`,
                                        content: `✏️ **${detail.blockType}**: ${detail.instruction}`,
                                    })
                                    setTimeout(() => {
                                        setChatActivity({
                                            id: `inline-res-${Date.now()}`,
                                            content: `✅ "${detail.originalText}" → "${detail.rewrittenText}"`,
                                        })
                                    }, 100)
                                } else {
                                    setChatActivity({
                                        id: `inline-${Date.now()}`,
                                        content,
                                    })
                                }
                                // Inline edit already pushed UPDATE_BLOCK_DATA during editing session
                                // — no iframe reload needed, just persist to DB.
                                await handleSave({ showToast: false, refreshPreview: false })
                            }}
                            onReorderBlocks={handleReorderBlocks}
                            onBlockDrop={handleBlockDrop}
                            onImageReplaced={async () => {
                                // UPDATE_BLOCK_DATA (sent by PreviewFrame after updateBlock) already
                                // updates the iframe preview in-place — no full reload needed.
                                // refreshPreview: false prevents setIframeKey from firing and avoids
                                // the stale-DB-data race when a prior save is still in-flight.
                                await handleSave({ showToast: false, refreshPreview: false })
                            }}
                            onPageNavigate={handlePageSelected}
                            onInlineEditSave={async () => {
                                // Inline edit already updated text in iframe — no reload needed.
                                // Reloading here causes visible jank while user is still editing.
                                await handleSave({ showToast: false, refreshPreview: false })
                            }}
                            onFooterUpdate={(changes) => {
                                updateFooterBlock(changes)
                                const updatedFooter = useEditorStore.getState().footerBlock
                                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: updatedFooter })
                                if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
                                footerUpdateSaveTimerRef.current = setTimeout(() => {
                                    footerUpdateSaveTimerRef.current = null
                                    void saveWithRetry({ showToast: false, refreshPreview: false })
                                }, 600)
                            }}
                            onFooterInlineEdit={(changes) => {
                                // Update store only — no iframe push so contentEditable cursor stays intact
                                updateFooterBlock(changes)
                                if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
                                footerUpdateSaveTimerRef.current = setTimeout(() => {
                                    footerUpdateSaveTimerRef.current = null
                                    void saveWithRetry({ showToast: false, refreshPreview: false })
                                }, 600)
                            }}
                            onFooterEditStop={() => {
                                // Only save if a debounce is pending — if it already fired, the save is done
                                const hadPending = !!footerUpdateSaveTimerRef.current
                                if (footerUpdateSaveTimerRef.current) {
                                    clearTimeout(footerUpdateSaveTimerRef.current)
                                    footerUpdateSaveTimerRef.current = null
                                }
                                if (hadPending) void saveWithRetry({ showToast: false, refreshPreview: false })
                            }}
                            onHandleReady={(handle) => { previewFrameSendRef.current = handle }}
                            onLocaleSwitch={(locale) => { void handleLocaleSwitch(locale as SiteLocale) }}
                        />
                    </div>

                    <div
                        className="shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-in-out"
                        style={{
                            width: rightSidebarVisible ? SETTINGS_PANEL_WIDTH : 0,
                            opacity: rightSidebarVisible ? 1 : 0,
                        }}
                    >
                        <SettingsPanel
                            block={currentBlock}
                            blockIndex={selectedBlock}
                            theme={theme}
                            site={site}
                            siteName={siteName || site?.name || ''}
                            siteStatus={site?.status || 'draft'}
                            headerBlock={headerBlock}
                            footerBlock={footerBlock}
                            pages={pages}
                            currentPageId={currentPageId}
                            siteLocale={siteLocale}
                            activeLocale={activeLocale}
                            navShowLanguageSwitcher={Boolean((headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher)}
                            onNavLanguageSwitcherChange={(show) => {
                                updateHeaderBlock({ showLanguageSwitcher: show })
                                const updatedHeader = useEditorStore.getState().headerBlock
                                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: updatedHeader })
                                if (!show) void handleLocaleSwitch(siteLocale as SiteLocale)
                                void saveWithRetry({ showToast: false, refreshPreview: false })
                            }}
                            onLocaleSwitch={(locale) => { void handleLocaleSwitch(locale as SiteLocale) }}
                            onThemeChange={handleThemeChange}
                            onBlockFieldChange={handleBlockFieldChange}
                            onBlockUpdate={handleBlockUpdate}
                            onHeaderUpdate={(changes) => {
                                updateHeaderBlock(changes)
                                const updatedHeader = useEditorStore.getState().headerBlock
                                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: updatedHeader })
                                void saveWithRetry({ showToast: false, refreshPreview: false })
                            }}
                            onFooterUpdate={(changes) => {
                                updateFooterBlock(changes)
                                const updatedFooter = useEditorStore.getState().footerBlock
                                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: updatedFooter })
                                if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
                                footerUpdateSaveTimerRef.current = setTimeout(() => {
                                    footerUpdateSaveTimerRef.current = null
                                    void saveWithRetry({ showToast: false, refreshPreview: false })
                                }, 600)
                            }}
                            onSiteSettingsChange={handleSiteSettingsChange}
                            onPageUpdate={handlePageUpdate}
                            requestedTab={settingsRequestedTab}
                        />
                    </div>
                </div>
            )}

            <PrePublishModal
                isOpen={isPublishModalOpen}
                onOpenChange={setIsPublishModalOpen}
                onPublish={handlePublish}
                isPublishing={isPublishing}
                hasUnsavedChanges={hasUnsavedChanges}
                pages={pages}
            />
            
            <UnpublishModal
                isOpen={isUnpublishModalOpen}
                onOpenChange={setIsUnpublishModalOpen}
                onUnpublish={handlePublish}
                isPublishing={isPublishing}
            />

            {!isCompactLayout && (
                <EditorCoachMarks
                    onEnterStep1={() => setActiveSidebarTab('pages')}
                    onEnterStep2={() => setSettingsRequestedTab({ tab: 'menu', key: Date.now() })}
                />
            )}

            <EditorTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                siteId={siteId}
                onBeforeApply={async () => {
                    // ALWAYS force-save before template apply — draft/published version
                    // mismatch means hasUnsavedChanges can be stale
                    await handleSave({ showToast: false, refreshPreview: false })
                }}
                onApplied={async ({ templateName, unmatchedBlocks }: TemplateApplyResult) => {
                    setIsTemplateModalOpen(false)
                    setIsTransitioning(true)

                    try {
                        // Re-fetch fresh data from DB (template already applied by API)
                        const editorUrl = new URL(`/api/sites/${siteId}/editor-data`, window.location.origin)
                        if (currentPageId) editorUrl.searchParams.set('pageId', currentPageId)
                        const res = await fetch(editorUrl.toString(), { credentials: 'include' })
                        if (!res.ok) throw new Error('Failed to reload editor data')
                        const data = await res.json()

                        // Push as single undoable batch (existing history preserved for Ctrl+Z)
                        const store = useEditorStore.getState()
                        store.pushBatch(
                            data.page?.layout || [],
                            data.site?.theme || {},
                            `Apply template: ${templateName}`
                        )

                        // Disable auto-save BEFORE mutating store — prevents the 3s debounce
                        // timer from firing before user confirms the template save guard.
                        store.setAutoSaveEnabled(false)
                        const pendingTimer = useEditorStore.getState().autoSaveTimer
                        if (pendingTimer) {
                            clearTimeout(pendingTimer)
                            useEditorStore.setState({ autoSaveTimer: null })
                        }

                        // Update header/footer
                        if (data.site?.headerBlock) store.updateHeaderBlock(data.site.headerBlock)
                        if (data.site?.footerBlock) store.updateFooterBlock(data.site.footerBlock)

                        // Update local site state
                        if (data.site) setSite(data.site)

                        // Mark template as just applied (for save guard)
                        setTemplateApplied(true)

                        // Update preview in-place — pushBatch already updated blocks/theme in store
                        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: useEditorStore.getState().getDisplayBlocks() })
                        if (data.site?.headerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: data.site.headerBlock })
                        if (data.site?.footerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: data.site.footerBlock })
                        if (data.site?.theme) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_SITE_THEME', theme: data.site.theme })

                        // Show unmatched block notification (Phase 3)
                        if (unmatchedBlocks && unmatchedBlocks.length > 0) {
                            const types = unmatchedBlocks.join(', ')
                            toast.info(
                                `${unmatchedBlocks.length} section(s) (${types}) had no match in the new template and were placed before the footer.`,
                                { duration: 6000 }
                            )
                        }

                        toast.success(`Template "${templateName}" applied! Press Ctrl+Z to undo.`)
                    } catch (err) {
                        const message = err instanceof Error ? err.message : 'Failed to refresh editor'
                        toast.error('Template applied but editor refresh failed', { description: message })
                        window.location.reload()
                    } finally {
                        setTimeout(() => setIsTransitioning(false), 300)
                    }
                }}
            />

            {/* Tab authority — suspend this tab if another tab claimed the editor */}
            {!isMaster && (
                <TabSuspendedOverlay
                    onReclaim={reclaimAuthority}
                    onReload={() => window.location.reload()}
                />
            )}

            {/* Save guard modal — warns user that saving after template apply is permanent */}
            {showSaveGuard && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowSaveGuard(false)}
                    />
                    <div
                        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Save Template Changes?</h3>
                                <p className="mt-1 text-sm text-gray-400">
                                    Changes will be saved permanently. You will not be able to undo the template change after saving.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowSaveGuard(false)}
                                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setShowSaveGuard(false)
                                    setTemplateApplied(false)
                                    await handleSave({ showToast: true, refreshPreview: true })
                                }}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                            >
                                Confirm Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

</>
    )
}
