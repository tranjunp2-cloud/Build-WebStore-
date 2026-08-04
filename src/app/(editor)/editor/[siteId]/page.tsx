'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, MessageCircle, Zap } from 'lucide-react'
import { normalizeAddSectionBlock } from '@/lib/ai/add-section'
import { patchBlockCtaUrls, patchLocaleInitCtaUrls } from '@/lib/ai/patch-block-cta-urls'
import { hasLocaleContent, resolveBlockContent, interpolateBrand } from '@/lib/ai/add-section-content'
import { STRUCTURAL_BLOCK_FIELDS, routeBlockChanges } from '@/lib/editor/structural-block-fields'
import { resolveInitialActiveLocale } from '@/lib/detect-locale'
import { EditorCoachMarks } from '@/components/editor/editor-coach-marks'
import { AIChatPanel } from '@/components/editor/AIChatPanel'
import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'
import { EditorMenuDrawer } from '@/components/editor/EditorMenuDrawer'
import type { SidebarBadgeKey } from '@/config/sidebar-nav'
import { EditorSidebar, type EditorSidebarTabId } from '@/components/editor/EditorSidebar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { PageManagerPanel } from '@/components/editor/PageManagerPanel'
import { PreviewFrame } from '@/components/editor/PreviewFrame'
import type { PreviewFrameHandle } from '@/components/editor/PreviewFrame'
import { SettingsPanel, type SettingsTab } from '@/components/editor/SettingsPanel'
import type { LocalBusinessData } from '@/components/editor/local-business/types'
import { sanitizeLegacyOpeningHours } from '@/components/editor/local-business/opening-hours-utils'
import {
    normalizeLocalBusinessSnapshot,
} from '@/components/editor/local-business/normalization'
import { countCompletedLocalBusinessFields } from '@/components/editor/local-business/completion-utils'
import { trackEvent } from '@/lib/analytics/track-event'
import {
    useEditorStore,
    runSerializedEditorSave,
    hasPendingSerializedEditorSave,
    BLOCK_TYPE_TO_KEY,
    PAGE_META_LOCALE_KEY,
    getDisplayPageTitle,
    type SiteLocale,
} from '@/store/editorStore'
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
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import { CompactEditorLayout, type PreviewFrameSharedProps } from '@/components/editor/CompactEditorLayout'
import type { ToolsSheetPanelProps, ToolsSheetTab } from '@/components/editor/EditorToolsSheet'
import { useEditorLayoutMode } from '@/hooks/useEditorLayoutMode'

class SerializedSaveSetupError extends Error {
    constructor(readonly originalError: unknown) {
        super('Failed to start serialized editor save')
        this.name = 'SerializedSaveSetupError'
    }
}

export type SiteData = {
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
    /** F37 US-01: structured address/geo/hours for Local SEO. */
    localBusiness?: LocalBusinessData
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

type LocalBusinessSaveBatch = {
    siteId: string
    snapshot: LocalBusinessData
    revision: number
    resolvers: Array<(saved: boolean) => void>
}

type LocalBusinessSiteState = {
    snapshot: LocalBusinessData
    persistedSnapshot: LocalBusinessData
    revision: number
    persistedRevision: number
}

type PersistSiteSettingsOptions = {
    commitOptimistically?: boolean
    targetSiteId?: string
}

const LOCAL_BUSINESS_COMPARISON_FIELDS = [
    'streetAddress', 'city', 'state', 'postcode', 'country',
    'latitude', 'longitude', 'businessCategory', 'schemaSubtype',
    'priceRange', 'serviceAreaDescription',
] as const

const LOCAL_BUSINESS_RECONCILE_TIMEOUT_MS = 5_000

function normalizeLocalBusinessForComparison(value: unknown) {
    const record = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
    const normalizedRecord = normalizeLocalBusinessSnapshot(record as LocalBusinessData)
    const openingHours = Array.isArray(normalizedRecord.openingHours)
        ? normalizedRecord.openingHours.map(row => {
            const item = row && typeof row === 'object' && !Array.isArray(row)
                ? row as Record<string, unknown>
                : {}
            return [item.dayOfWeek ?? null, item.opens ?? null, item.closes ?? null, item.isClosed === true]
        })
        : []
    return {
        fields: LOCAL_BUSINESS_COMPARISON_FIELDS.map(field => normalizedRecord[field] ?? null),
        openingHours,
    }
}

function localBusinessSnapshotsMatch(authoritative: unknown, requested: unknown): boolean {
    return JSON.stringify(normalizeLocalBusinessForComparison(authoritative))
        === JSON.stringify(normalizeLocalBusinessForComparison(requested))
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

/** Shared publish/re-publish error detail extractor — DRYs up the identical
 *  error-parsing block that was duplicated across handlePublish and handleRepublish.
 *  Returns a human-readable detail string for the toast. */
type PublishFailureBody = {
    error?: {
        message?: string
        failures?: Array<{
            errName?: string
            errMsg?: string
            pgColumn?: string
            pgTable?: string
            causeMsg?: string
            friendlyDetail?: string
            validationErrors?: Array<{ path?: string; message?: string }>
        }>
    }
} | null

function extractPublishErrorDetail(body: PublishFailureBody, status: number): string {
    const firstFailure = body?.error?.failures?.[0]
    const firstValidation = firstFailure?.validationErrors?.[0]
    if (firstFailure?.friendlyDetail) {
        // GH-1621 P1: server already resolved the failing block/item, e.g.
        // "Portfolio Grid → Project 5 → Title: This field is required."
        return firstFailure.friendlyDetail
    }
    if (firstValidation?.path) {
        return friendlyValidationDetail(firstValidation.path, firstValidation.message)
    }
    if (firstFailure?.pgColumn && firstFailure?.pgTable) {
        return `${firstFailure.pgTable}.${firstFailure.pgColumn} missing — run \`npm run db:migrate\``
    }
    const isDev = process.env.NODE_ENV === 'development'
    return (isDev ? (firstFailure?.causeMsg || firstFailure?.errMsg) : undefined)
        || body?.error?.message
        || `Server returned ${status}`
}

// F26: top-level block fields NEVER sent to the translator. Two groups (see docs/prd/F26 §7b
// Content Classification): (1) structural/media/link fields, and (2) "business data" that must
// stay identical across locales — shop name (logoText), contact info (email/phone/address),
// social links. Translating these mangles brand names, phone numbers, and URLs.
const NON_TRANSLATABLE_FIELDS = [
    // structural
    'id', 'blockType', 'variant', 'backgroundColor', 'showLanguageSwitcher', 'multilingualEnabled', 'primaryLocale', 'secondaryLocale', '_localeContent',
    // media / assets
    'logo', 'image', 'backgroundImage', 'images', 'icon', 'avatar', 'media',
    // links / urls
    'url', 'href', 'src', 'embedUrl',
    // business data — preserved verbatim across locales
    'logoText', 'email', 'phone', 'phoneNumber', 'countryCode', 'address', 'socials',
] as const

export default function EditorPage() {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const siteId = params?.siteId as string
    const selectedPageId = searchParams.get('pageId')

    const { t, ti } = useI18n()
    const sub = t.common.subscriptionErrors
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
    const [userData, setUserData] = useState<{
        name: string
        initial: string
        role: string
        avatarUrl?: string | null
        permissions: string[]
        isSuperAdmin: boolean
        isProduction: boolean
        badgeCounts: Partial<Record<SidebarBadgeKey, number>>
    } | null>(null)
    const [chatActivity, setChatActivity] = useState<{ id: string; content: string } | null>(null)
    const [chatBlockContext, setChatBlockContext] = useState<{ blockIndex: number; blockType: string } | null>(null)
    const { isCompact: isCompactLayout } = useEditorLayoutMode()
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
    const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false)
    // Phase 03: F05 Tools sheet (bottom bar → 4-tab sheet) + AI-processing (Stop AI) state.
    const [toolsSheetOpen, setToolsSheetOpen] = useState(false)
    const [toolsSheetTab, setToolsSheetTab] = useState<ToolsSheetTab>('chat')
    const [aiRunning, setAiRunning] = useState(false)
    const stopAIRef = useRef<(() => void) | null>(null)

    // PR #1485 review fix (I3): rotating/resizing across the 1280px compact↔desktop
    // boundary must not leave a sheet open from before the flip — reset both compact
    // sheet states whenever the layout mode changes (either direction) so a sheet left
    // open pre-flip doesn't silently reappear when flipping back.
    useEffect(() => {
        setToolsSheetOpen(false)
        setIsMobileSettingsOpen(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCompactLayout])

    // Auto-open the publish modal when arriving from an external "Publish" CTA
    // (e.g. the dashboard onboarding "Publish your website" step → /editor/:id?publish=1).
    // Waits for editor data to finish loading, then strips the param so a refresh won't reopen.
    const publishAutoOpenedRef = useRef(false)
    useEffect(() => {
        if (publishAutoOpenedRef.current || isLoading) return
        if (searchParams.get('publish') !== '1') return
        publishAutoOpenedRef.current = true
        setIsPublishModalOpen(true)
        const next = new URLSearchParams(searchParams.toString())
        next.delete('publish')
        const qs = next.toString()
        router.replace(`/editor/${siteId}${qs ? `?${qs}` : ''}`)
    }, [isLoading, searchParams, router, siteId])

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
    const contactSavePendingRef = useRef(false)
    const [isContactSavePending, setIsContactSavePending] = useState(false)
    const localBusinessBySiteRef = useRef(new Map<string, LocalBusinessSiteState>())
    const localBusinessSaveInFlightSiteIdsRef = useRef(new Set<string>())
    const queuedLocalBusinessSavesRef = useRef(new Map<string, LocalBusinessSaveBatch>())
    const drainLocalBusinessSavesRef = useRef<(targetSiteId: string) => void>(() => {})
    const localBusinessUnknownOutcomeSiteIdsRef = useRef(new Set<string>())
    const activeSiteIdRef = useRef(siteId)
    activeSiteIdRef.current = siteId
    // F26-04: AbortController for the currently in-flight locale switch.
    const [localBusinessLockedSiteIds, setLocalBusinessLockedSiteIds] = useState<ReadonlySet<string>>(
        () => new Set(),
    )
    const isLocalBusinessSaveLocked = localBusinessLockedSiteIds.has(siteId)
    // Rapid switches (EN→MS→EN) cancel the previous one so partial state never lands.
    const localeSwitchAbortRef = useRef<AbortController | null>(null)

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
    const markDirty = useEditorStore(state => state.markDirty)
    const markPublished = useEditorStore(state => state.markPublished)
    const setIsSaving = useEditorStore(state => state.setIsSaving)
    const setAutoSaveEnabled = useEditorStore(state => state.setAutoSaveEnabled)
    // F-26: Multilingual locale
    const siteLocale = useEditorStore(state => state.siteLocale)
    const activeLocale = useEditorStore(state => state.activeLocale)
    const primaryLocale = useEditorStore(state => state.primaryLocale)
    const secondaryLocale = useEditorStore(state => state.secondaryLocale)
    const generationLocale = useEditorStore(state => state.generationLocale)
    const pendingLocale = useEditorStore(state => state.pendingLocale)
    const localeOverrides = useEditorStore(state => state.localeOverrides)
    const setActiveLocale = useEditorStore(state => state.setActiveLocale)
    const setSiteLocale = useEditorStore(state => state.setSiteLocale)
    const setPrimaryLocale = useEditorStore(state => state.setPrimaryLocale)
    const setSecondaryLocale = useEditorStore(state => state.setSecondaryLocale)
    const setPendingLocale = useEditorStore(state => state.setPendingLocale)
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
        // Prefer the pages[] entry (carries localeContent → locale-aware title); fall back to
        // the lightweight `page` state (no localeContent) then a default.
        const currentPage = pages.find(item => item.id === currentPageId)
        if (currentPage) return getDisplayPageTitle(currentPage, activeLocale)
        return page?.title || 'Homepage'
    }, [currentPageId, page?.title, pages, activeLocale])

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

        let cancelled = false
        const localBusinessAtLoadStart = localBusinessBySiteRef.current.get(siteId)
        const localBusinessRevisionAtLoadStart = localBusinessAtLoadStart?.revision ?? 0
        const hadPendingLocalBusinessAtLoadStart = localBusinessAtLoadStart !== undefined && (
            localBusinessAtLoadStart.revision !== localBusinessAtLoadStart.persistedRevision ||
            localBusinessSaveInFlightSiteIdsRef.current.has(siteId) ||
            queuedLocalBusinessSavesRef.current.has(siteId)
        )

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

                if (cancelled) return

                if (!editorRes.ok) {
                    throw new Error(`Failed to load editor data (${editorRes.status})`)
                }

                const data = await editorRes.json()

                if (cancelled) return

                if (data.site) {
                    const currentLocalBusiness = localBusinessBySiteRef.current.get(siteId)
                    const hasNewerOrPendingLocalBusiness = currentLocalBusiness !== undefined && (
                        hadPendingLocalBusinessAtLoadStart ||
                        currentLocalBusiness.revision !== localBusinessRevisionAtLoadStart ||
                        currentLocalBusiness.revision !== currentLocalBusiness.persistedRevision ||
                        localBusinessSaveInFlightSiteIdsRef.current.has(siteId) ||
                        queuedLocalBusinessSavesRef.current.has(siteId)
                    )
                    const serverLocalBusiness: LocalBusinessData = {
                        ...(data.site.localBusiness || {}),
                    }

                    if (hasNewerOrPendingLocalBusiness && currentLocalBusiness) {
                        setSite({
                            ...data.site,
                            localBusiness: currentLocalBusiness.snapshot,
                        })
                    } else {
                        const settledRevision = currentLocalBusiness?.revision ?? 0
                        localBusinessBySiteRef.current.set(siteId, {
                            snapshot: serverLocalBusiness,
                            persistedSnapshot: serverLocalBusiness,
                            revision: settledRevision,
                            persistedRevision: settledRevision,
                        })
                        setSite({
                            ...data.site,
                            localBusiness: serverLocalBusiness,
                        })
                    }
                }

                // Extract user info for menu drawer
                if (data.user) {
                    const name = data.user.firstName || data.user.email?.split('@')[0] || 'User'
                    const av = data.user.avatar
                    const avatarUrl = av && typeof av === 'object' ? (av.url ?? null) : typeof av === 'string' ? av : null
                    setUserData({
                        name,
                        initial: name.charAt(0).toUpperCase(),
                        role: data.user.role || 'viewer',
                        avatarUrl,
                        permissions: data.user.permissions ?? [],
                        isSuperAdmin: Boolean(data.user.isSuperAdmin),
                        isProduction: Boolean(data.user.isProduction),
                        badgeCounts: data.user.badgeCounts ?? {},
                    })
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

                // F-26: siteLocale = EN/MS translation slot (Sites.locale).
                // generationLocale = actual ISO 639-1 code AI generated in (may be 'vi', 'el', etc.).
                const rawGenerationLocale = data.site?.generationLocale || (data.site?.locale as string) || 'en'
                const genIsStandard = (['en', 'ms'] as string[]).includes(rawGenerationLocale)
                const siteLocale = genIsStandard
                    ? rawGenerationLocale as SiteLocale
                    : (data.site?.locale as SiteLocale) || 'en'
                // F-26 FIX: restore the user's last-viewed locale (persisted to site.locale on save)
                // so reloading an MS-switched page stays in MS instead of snapping back to the base
                // language. See resolveInitialActiveLocale for the fallback rules.
                const activeLocale = resolveInitialActiveLocale(rawGenerationLocale, data.site?.locale as string | undefined)
                const persistedHeaderLocales = data.site?.headerBlock as { primaryLocale?: string; secondaryLocale?: string } | null | undefined
                useEditorStore.getState().setSiteLocale(siteLocale)
                useEditorStore.getState().setActiveLocale(activeLocale)
                useEditorStore.getState().setGenerationLocale(rawGenerationLocale)
                // primaryLocale: restore the persisted Make Default choice, else default to gen.
                useEditorStore.getState().setPrimaryLocale(persistedHeaderLocales?.primaryLocale || rawGenerationLocale)
                // secondaryLocale: the persisted 2nd language; null = single-language site.
                useEditorStore.getState().setSecondaryLocale(persistedHeaderLocales?.secondaryLocale || null)
                // F26-04: force-clear pendingLocale so navigation between sites doesn't carry
                // over stale translation state from previous editor session.
                useEditorStore.getState().setPendingLocale(null)

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
                if (cancelled) return
                const message = err instanceof Error ? err.message : 'Failed to load site data'
                toast.error('Failed to load site', { description: message })
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void loadData()
        return () => {
            cancelled = true
        }
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

        try {
            return await runSerializedEditorSave(siteId, async () => {
                // Snapshot only when this queued write gets the lock. A snapshot captured
                // while waiting could overwrite a newer edit saved by an earlier task.
                const snapshot = useEditorStore.getState()
                const currentBlocks = snapshot.getDisplayBlocks()
                const currentTheme = snapshot.theme
                const savePageId = snapshot.currentPageId
                const savedRevision = snapshot.contentRevision

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
                            // F26-04: header/footer also serialized in display-locale so public site
                            // renders the chosen language without needing locale resolution on read.
                            headerBlock: snapshot.headerBlock ? snapshot.getDisplayBlock(snapshot.headerBlock) : null,
                            footerBlock: snapshot.footerBlock ? snapshot.getDisplayBlock(snapshot.footerBlock) : null,
                            // F26-04: global blocks also serialized in display locale
                            ...(snapshot.globalBlocks !== null && {
                                globalBlocks: {
                                    cartWidget: snapshot.globalBlocks.cartWidget
                                        ? snapshot.getDisplayBlock(snapshot.globalBlocks.cartWidget)
                                        : null,
                                    whatsappButton: snapshot.globalBlocks.whatsappButton
                                        ? snapshot.getDisplayBlock(snapshot.globalBlocks.whatsappButton)
                                        : null,
                                    socialWidget: snapshot.globalBlocks.socialWidget
                                        ? snapshot.getDisplayBlock(snapshot.globalBlocks.socialWidget)
                                        : null,
                                },
                            }),
                            // F-26: Persist locale overrides alongside blocks
                            ...(Object.keys(snapshot.localeOverrides).length > 0 && { localeContent: snapshot.localeOverrides }),
                            // F-26: Persist activeLocale so reload restores the correct locale (only en/ms supported by Sites.locale)
                            ...((snapshot.activeLocale === 'en' || snapshot.activeLocale === 'ms') && { locale: snapshot.activeLocale }),
                            isDraft: true,
                        }),
                    })

                    if (!res.ok) {
                        const payload = await res.json().catch(() => null)
                        const fallback = typeof payload?.error === 'string'
                            ? payload.error
                            : payload?.error?.details?.formErrors?.[0]
                                || payload?.error?.details?.fieldErrors?.headerBlock?.[0]
                                || payload?.error?.details?.fieldErrors?.blocks?.[0]
                                || `Server returned ${res.status}`
                        throw new Error(resolveApiError(payload, fallback, sub))
                    }

                    markSaved(savedRevision)
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
                    const errMsg = err instanceof Error ? err.message : null
                    toast.error(errMsg || t.editor.toast.saveFailed)
                    return false
                }
            })
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

    // F26-04: Sync locale state to preview iframe so header language switcher reflects active locale.
    // generationLocale included in deps — fires after loadData populates the non-EN/MS source code
    // so the iframe's NavLangSwitcherPlaceholder renders all 3 options (gen + EN + MS).
    useEffect(() => {
        previewFrameSendRef.current?.sendToIframe({
            type: 'UPDATE_LOCALE',
            activeLocale,
            generationLocale,
            siteLocale,
            primaryLocale,
            secondaryLocale,
        })
    }, [activeLocale, siteLocale, generationLocale, primaryLocale, secondaryLocale])

    // Sync globalBlocks changes to preview iframe (covers all mutation paths: add, delete, undo, redo, settings).
    useEffect(() => {
        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks })
    }, [globalBlocks])

    // F26-04: Abort any in-flight locale switch on unmount so its .then() doesn't write to a stale store.
    useEffect(() => {
        return () => { localeSwitchAbortRef.current?.abort() }
    }, [])

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
                        if (redoState.headerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: redoState.getDisplayBlock(redoState.headerBlock) })
                        if (redoState.footerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: redoState.getDisplayBlock(redoState.footerBlock) })
                    }
                    return
                }

                if (canUndo()) {
                    undo()
                    const undoState = useEditorStore.getState()
                    previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: undoState.getDisplayBlocks() })
                    previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks: undoState.globalBlocks })
                    if (undoState.headerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: undoState.getDisplayBlock(undoState.headerBlock) })
                    if (undoState.footerBlock) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: undoState.getDisplayBlock(undoState.footerBlock) })
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

    const persistSiteSettingsChanges = useCallback(async (
        changes: Partial<SiteData>,
        options: PersistSiteSettingsOptions = {},
    ) => {
        const persistenceSiteId = options.targetSiteId ?? siteId
        if (!persistenceSiteId) return

        // Business name is required — silently ignore blank submissions
        if ('name' in changes && !changes.name) return

        const isContactSave = changes.contactInfo !== undefined
        const hasNonContactChanges = Object.entries(changes).some(
            ([key, value]) => key !== 'contactInfo' && value !== undefined,
        )
        if (isContactSave && hasNonContactChanges) return false
        let ownsContactSave = false
        let keepContactSaveLocked = false

        try {
            if (isContactSave) {
                if (contactSavePendingRef.current) return false
                contactSavePendingRef.current = true
                ownsContactSave = true
                setIsContactSavePending(true)
            }

            if (changes.name) {
                updateSiteName(changes.name)
                // Sync business name into navigation logoText so the nav header
                // reflects the new name without a separate block edit.
                updateHeaderBlock({ logoText: changes.name })
            }

        const commitChangesToSite = () => {
            setSite(prev => {
                if (!prev) return prev

                return {
                    ...prev,
                    ...changes,
                    contactInfo: {
                        ...(prev.contactInfo || {}),
                        ...(changes.contactInfo || {}),
                    },
                    localBusiness: {
                        ...(prev.localBusiness || {}),
                        ...(changes.localBusiness || {}),
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
        }

        if (!isContactSave && options.commitOptimistically !== false) {
            commitChangesToSite()
        }

        // If logo is changing (value differs from current store), silently sync header/footer block logos.
        // This avoids handleContentChange (no "Changes Pending") — branding saves go live immediately.
        // Guard against favicon-only saves: spreading siteBranding includes logo key even when unchanged.
        let logoSyncedHeaderBlock: Record<string, unknown> | null | undefined
        let logoSyncedFooterBlock: Record<string, unknown> | null | undefined
        if (changes.branding && 'logo' in changes.branding) {
            const newLogoUrl = (changes.branding as { logo?: string }).logo ?? null
            const s = useEditorStore.getState()
            const currentLogoUrl =
                (s.headerBlock as Record<string, unknown> | null)?.logo &&
                typeof (s.headerBlock as Record<string, unknown>).logo === 'object'
                    ? ((s.headerBlock as Record<string, unknown>).logo as { url?: string })?.url ?? null
                    : null
            if (newLogoUrl !== currentLogoUrl) {
                const logoObj = newLogoUrl ? { url: newLogoUrl, alt: '' } : null
                if (s.headerBlock) {
                    logoSyncedHeaderBlock = { ...(s.headerBlock as Record<string, unknown>), logo: logoObj }
                }
                if (s.footerBlock) {
                    logoSyncedFooterBlock = { ...(s.footerBlock as Record<string, unknown>), logo: logoObj }
                }
                if (logoSyncedHeaderBlock || logoSyncedFooterBlock) {
                    useEditorStore.setState({
                        ...(logoSyncedHeaderBlock ? { headerBlock: logoSyncedHeaderBlock as typeof s.headerBlock } : {}),
                        ...(logoSyncedFooterBlock ? { footerBlock: logoSyncedFooterBlock as typeof s.footerBlock } : {}),
                    })
                }
            }
        }

            const saveUrl = new URL(`/api/sites/${persistenceSiteId}/save`, window.location.origin)
            if (options.targetSiteId === undefined && currentPageId) {
                saveUrl.searchParams.set('pageId', currentPageId)
            }

            let request: Promise<Response>
            try {
                request = runSerializedEditorSave(persistenceSiteId, () => {
                    try {
                        return fetch(saveUrl.toString(), {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                ...(changes.name ? { siteName: changes.name } : {}),
                                contactInfo: changes.contactInfo,
                                localBusiness: changes.localBusiness,
                                socialLinks: changes.socialLinks,
                                branding: changes.branding,
                                seo: changes.seo,
                                // When name changes, persist updated headerBlock (logoText synced above).
                                // When logo changes, persist synced header/footer blocks directly to DB.
                                headerBlock: changes.name
                                    ? useEditorStore.getState().headerBlock
                                    : (logoSyncedHeaderBlock ?? changes.headerBlock),
                                footerBlock: logoSyncedFooterBlock ?? changes.footerBlock,
                            }),
                        })
                    } catch (setupError) {
                        throw new SerializedSaveSetupError(setupError)
                    }
                })
            } catch (setupError) {
                throw setupError
            }

            let response: Response
            try {
                response = await request
            } catch (transportError) {
                if (transportError instanceof SerializedSaveSetupError) {
                    throw transportError.originalError
                }
                if (changes.localBusiness) {
                    const reconcileController = new AbortController()
                    const reconcileTimeoutId = window.setTimeout(
                        () => reconcileController.abort(),
                        LOCAL_BUSINESS_RECONCILE_TIMEOUT_MS,
                    )
                    try {
                        const editorUrl = new URL(`/api/sites/${persistenceSiteId}/editor-data`, window.location.origin)
                        const reconcileResponse = await fetch(editorUrl.toString(), {
                            credentials: 'include',
                            cache: 'no-store',
                            signal: reconcileController.signal,
                        })
                        if (reconcileResponse.ok) {
                            const reconciledData = await reconcileResponse.json() as { site?: SiteData }
                            const authoritativeLocalBusiness = reconciledData.site?.localBusiness
                            if (localBusinessSnapshotsMatch(authoritativeLocalBusiness, changes.localBusiness)) {
                                localBusinessUnknownOutcomeSiteIdsRef.current.delete(persistenceSiteId)
                                setLocalBusinessLockedSiteIds(previous => {
                                    if (!previous.has(persistenceSiteId)) return previous
                                    const next = new Set(previous)
                                    next.delete(persistenceSiteId)
                                    return next
                                })
                                return true
                            }
                        }
                    } catch (reconcileError) {
                        console.error('Failed to reconcile local business information after transport error', reconcileError)
                    } finally {
                        window.clearTimeout(reconcileTimeoutId)
                    }

                    localBusinessUnknownOutcomeSiteIdsRef.current.add(persistenceSiteId)
                    setLocalBusinessLockedSiteIds(previous => {
                        const next = new Set(previous)
                        next.add(persistenceSiteId)
                        return next
                    })
                    console.error('Local business save outcome is unknown', transportError)
                    toast.error(t.editor.settings.localBusinessSaveUnknownTitle, {
                        description: t.editor.settings.localBusinessSaveUnknownDescription,
                    })
                    // Keep the optimistic snapshot visible and prevent later full-snapshot
                    // writes until reload; rolling back could overwrite a late server commit.
                    return false
                }
                if (isContactSave && changes.contactInfo) {
                    try {
                        const editorUrl = new URL(`/api/sites/${persistenceSiteId}/editor-data`, window.location.origin)
                        if (currentPageId) editorUrl.searchParams.set('pageId', currentPageId)
                        const reconcileResponse = await fetch(editorUrl.toString(), {
                            credentials: 'include',
                            cache: 'no-store',
                        })
                        if (reconcileResponse.ok) {
                            const reconciledData = await reconcileResponse.json() as { site?: SiteData }
                            const authoritativeSite = reconciledData.site
                            if (authoritativeSite) {
                                const authoritativeContactInfo = authoritativeSite.contactInfo ?? {}
                                setSite(prev => prev
                                    ? { ...prev, contactInfo: authoritativeSite.contactInfo }
                                    : authoritativeSite)
                                const contactFields = Object.keys(changes.contactInfo) as Array<keyof NonNullable<SiteData['contactInfo']>>
                                const didPersist = contactFields.length > 0 && contactFields.every(
                                    field => authoritativeContactInfo[field] === changes.contactInfo?.[field],
                                )
                                if (didPersist) return true
                            }
                        }
                    } catch (reconcileError) {
                        console.error('Failed to reconcile contact info after transport error', reconcileError)
                    }
                }
                if (isContactSave) {
                    console.error('Contact info save outcome is unknown', transportError)
                    commitChangesToSite()
                    keepContactSaveLocked = true
                    toast.error('Could not confirm whether contact information was saved.', {
                        description: 'Reload the editor before editing contact information again.',
                    })
                    return true
                }
                throw transportError
            }

            if (!response.ok) {
                const body = await response.json().catch(() => null)
                throw new Error(resolveApiError(body, `Server returned ${response.status}`, sub))
            }

            if (isContactSave) commitChangesToSite()

            if (persistenceSiteId === siteId) {
                setSaveSuccess(true)
                // header/footer update in-place; branding (CSS vars) still needs full reload
                if (changes.headerBlock || changes.name) {
                    const s = useEditorStore.getState()
                    const h = s.headerBlock
                    if (h) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: s.getDisplayBlock(h) })
                }
                if (changes.footerBlock) {
                    const s = useEditorStore.getState()
                    const f = s.footerBlock
                    if (f) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: s.getDisplayBlock(f) })
                }
                if (changes.branding) setIframeKey(key => key + 1)
                window.setTimeout(() => setSaveSuccess(false), 1800)
            }
            return true
        } catch (error) {
            console.error('Failed to update site settings', error)
            const errMsg = error instanceof Error ? error.message : null
            toast.error(errMsg || 'Failed to update site settings', { description: errMsg ? undefined : 'Please try again later.' })
            return false
        } finally {
            if (ownsContactSave && !keepContactSaveLocked) {
                contactSavePendingRef.current = false
                setIsContactSavePending(false)
            }
        }
    }, [currentPageId, siteId, t.editor.settings.localBusinessSaveUnknownDescription, t.editor.settings.localBusinessSaveUnknownTitle, updateSiteName, updateHeaderBlock])

    const drainLocalBusinessSaves = useCallback((targetSiteId: string) => {
        if (localBusinessSaveInFlightSiteIdsRef.current.has(targetSiteId)) return

        const batch = queuedLocalBusinessSavesRef.current.get(targetSiteId)
        if (!batch) return
        if (localBusinessUnknownOutcomeSiteIdsRef.current.has(targetSiteId)) {
            queuedLocalBusinessSavesRef.current.delete(targetSiteId)
            for (const resolve of batch.resolvers) resolve(false)
            return
        }

        queuedLocalBusinessSavesRef.current.delete(targetSiteId)
        localBusinessSaveInFlightSiteIdsRef.current.add(batch.siteId)

        const rollbackBatch = () => {
            const current = localBusinessBySiteRef.current.get(batch.siteId)
            if (!current || current.revision !== batch.revision) return

            const rolledBack: LocalBusinessSiteState = {
                snapshot: current.persistedSnapshot,
                persistedSnapshot: current.persistedSnapshot,
                revision: current.persistedRevision,
                persistedRevision: current.persistedRevision,
            }
            localBusinessBySiteRef.current.set(batch.siteId, rolledBack)
            if (batch.siteId === activeSiteIdRef.current) {
                setSite(previous => previous
                    ? { ...previous, localBusiness: rolledBack.snapshot }
                    : previous)
            }
        }

        void persistSiteSettingsChanges(
            { localBusiness: batch.snapshot },
            { commitOptimistically: false, targetSiteId: batch.siteId },
        )
            .then(result => {
                const saved = result === true
                const outcomeUnknown = localBusinessUnknownOutcomeSiteIdsRef.current.has(batch.siteId)
                if (outcomeUnknown) {
                    // A later queued revision was never sent. Keep only the ambiguous
                    // in-flight snapshot visible, then let the locked drain reject the queue.
                    const current = localBusinessBySiteRef.current.get(batch.siteId)
                    if (current) {
                        localBusinessBySiteRef.current.set(batch.siteId, {
                            ...current,
                            snapshot: batch.snapshot,
                            revision: batch.revision,
                        })
                        if (batch.siteId === activeSiteIdRef.current) {
                            setSite(previous => previous
                                ? { ...previous, localBusiness: batch.snapshot }
                                : previous)
                        }
                    }
                } else if (saved) {
                    const current = localBusinessBySiteRef.current.get(batch.siteId)
                    if (current) {
                        localBusinessBySiteRef.current.set(batch.siteId, {
                            ...current,
                            persistedSnapshot: batch.snapshot,
                            persistedRevision: Math.max(current.persistedRevision, batch.revision),
                        })
                    }
                    trackEvent({
                        siteId: batch.siteId,
                        event: 'local_business_data_saved',
                        pageUrl: `/editor/${batch.siteId}`,
                        metadata: {
                            fields_completed_count: countCompletedLocalBusinessFields(batch.snapshot),
                        },
                    })
                } else {
                    rollbackBatch()
                }
                for (const resolve of batch.resolvers) resolve(saved)
            })
            .catch(error => {
                console.error('Unexpected local business queue failure', error)
                rollbackBatch()
                for (const resolve of batch.resolvers) resolve(false)
            })
            .finally(() => {
                localBusinessSaveInFlightSiteIdsRef.current.delete(batch.siteId)
                drainLocalBusinessSavesRef.current(batch.siteId)
            })
    }, [persistSiteSettingsChanges])

    drainLocalBusinessSavesRef.current = drainLocalBusinessSaves

    const handleSiteSettingsChange = useCallback((changes: Partial<SiteData>) => {
        const localBusinessPatch = changes.localBusiness
        if (localBusinessPatch === undefined) {
            return persistSiteSettingsChanges(changes)
        }

        if (localBusinessUnknownOutcomeSiteIdsRef.current.has(siteId)) {
            return Promise.resolve(false)
        }

        const hasNonLocalBusinessChanges = Object.entries(changes).some(
            ([key, value]) => key !== 'localBusiness' && value !== undefined,
        )
        if (hasNonLocalBusinessChanges) return Promise.resolve(false)

        const current = localBusinessBySiteRef.current.get(siteId) ?? {
            snapshot: {},
            persistedSnapshot: {},
            revision: 0,
            persistedRevision: 0,
        }
        const latestSnapshot = normalizeLocalBusinessSnapshot(
            {
                ...current.snapshot,
                ...localBusinessPatch,
            },
        )
        if (latestSnapshot.openingHours) {
            latestSnapshot.openingHours = sanitizeLegacyOpeningHours(latestSnapshot.openingHours)
        }
        const revision = current.revision + 1
        localBusinessBySiteRef.current.set(siteId, {
            snapshot: latestSnapshot,
            persistedSnapshot: current.persistedSnapshot,
            revision,
            persistedRevision: current.persistedRevision,
        })
        setSite(prev => prev
            ? { ...prev, localBusiness: latestSnapshot }
            : prev)

        return new Promise<boolean>(resolve => {
            const queued = queuedLocalBusinessSavesRef.current.get(siteId)
            queuedLocalBusinessSavesRef.current.set(
                siteId,
                queued
                    ? {
                        ...queued,
                        snapshot: latestSnapshot,
                        revision,
                        resolvers: [...queued.resolvers, resolve],
                    }
                    : {
                        siteId,
                        snapshot: latestSnapshot,
                        revision,
                        resolvers: [resolve],
                    },
            )
            drainLocalBusinessSavesRef.current(siteId)
        })
    }, [persistSiteSettingsChanges, siteId])

    // F-26: Auto-translate header or footer block into target locale if not already cached.
    // Stores translation in block._localeContent[locale] (no history entry — silent background op).
    // F26-04: AbortSignal cancels in-flight fetch when caller's switch is superseded.
    const translateGlobalBlock = useCallback(async (
        block: BlockData,
        blockTypeKey: string,
        locale: SiteLocale,
        applyFn: (patch: Record<string, unknown>) => void,
        signal?: AbortSignal,
    ) => {
        const existing = (block as Record<string, unknown>)._localeContent as
            | Record<string, Record<string, unknown>>
            | undefined
        if (existing?.[locale] && Object.keys(existing[locale]).length > 0) return

        // F26: skip media/non-text + business-data fields — see NON_TRANSLATABLE_FIELDS.
        const SKIP = new Set<string>(NON_TRANSLATABLE_FIELDS)
        const translatableContent = Object.fromEntries(
            Object.entries(block as Record<string, unknown>).filter(([k]) => !SKIP.has(k)),
        )

        try {
            const res = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                signal,
                body: JSON.stringify({ blockType: blockTypeKey, targetLocale: locale, content: translatableContent }),
            })
            if (!res.ok || signal?.aborted) return
            const { translated, status } = await res.json() as { translated: Record<string, unknown>; status?: string }
            // Re-check abort after parse — a newer switch may have superseded this flow.
            if (signal?.aborted) return
            // F26: never persist a fallback (English) result — it poisons the locale slot and the
            // guard above would then permanently skip re-translation. Leave empty → registry fallback.
            if (status === 'fallback') return
            const newLocaleContent = { ...(existing ?? {}), [locale]: translated }
            applyFn({ _localeContent: newLocaleContent })
        } catch {
            // AbortError or non-fatal network — show original content as fallback
        }
    }, [])

    // F-26: Handle locale switch — accepts any ISO code; only persists/translates for EN/MS.
    // Switching to generationLocale (native view) bypasses translation since base blocks
    // are already in that language.
    const handleLocaleSwitch = useCallback(async (locale: string) => {
        if (!siteId) return
        const isStandard = locale === 'en' || locale === 'ms'

        // F26-04: Cancel any in-flight switch so rapid clicks (EN→MS→EN) don't race.
        // Each handleLocaleSwitch call gets its own controller; only the latest one is
        // allowed to clear pendingLocale or apply translations.
        localeSwitchAbortRef.current?.abort()
        const switchController = new AbortController()
        localeSwitchAbortRef.current = switchController

        // F26-04 fix: Before switching AWAY from native view, snapshot current content
        // into per-block locale slots so save (which uses getDisplayBlocks merged with
        // translation) doesn't overwrite the original source language permanently.
        const preState = useEditorStore.getState()
        const genLocale = preState.generationLocale || preState.siteLocale
        if (preState.activeLocale === genLocale && locale !== genLocale) {
            // Exclude locale-control fields too — they are site-wide, not per-locale content.
            // Snapshotting them into _localeContent[gen] would freeze a stale secondaryLocale/
            // switcher state and re-apply it on save+reload, silently reverting Remove/Make Default.
            // GH-1381: media fields must be skipped as well (mirrors NON_TRANSLATABLE_FIELDS'
            // media group) — snapshotting `images` freezes the array into localeOverrides, and
            // since getDisplayBlock merges override-over-flat, a later image upload (which only
            // updates the flat block) would be masked by the stale snapshot even across reloads.
            const SKIP = new Set(['id', 'blockType', 'logo', 'image', 'backgroundImage', 'images', 'icon', 'avatar', 'media', '_localeContent', '__localeInit', ...STRUCTURAL_BLOCK_FIELDS])
            const extractContent = (block: BlockData) =>
                Object.fromEntries(
                    Object.entries(block as Record<string, unknown>).filter(([k]) => !SKIP.has(k)),
                )

            // Body blocks → localeOverrides[id][gen]
            preState.blocks.forEach((block) => {
                if (!block.id) return
                const existing = preState.localeOverrides[block.id as string]?.[genLocale]
                if (existing && Object.keys(existing).length > 0) return
                const content = extractContent(block)
                if (Object.keys(content).length > 0) {
                    setLocaleOverride(block.id as string, genLocale, content)
                }
            })

            // Header/footer/globals → block._localeContent[gen]
            const snapshotEmbedded = (block: BlockData) => {
                const existing = (block as Record<string, unknown>)._localeContent as
                    | Record<string, Record<string, unknown>> | undefined
                if (existing?.[genLocale] && Object.keys(existing[genLocale]).length > 0) return null
                const content = extractContent(block)
                if (Object.keys(content).length === 0) return null
                return { ...(existing ?? {}), [genLocale]: content }
            }
            if (preState.headerBlock) {
                const next = snapshotEmbedded(preState.headerBlock)
                if (next) useEditorStore.getState().updateHeaderBlock({ _localeContent: next })
            }
            if (preState.footerBlock) {
                const next = snapshotEmbedded(preState.footerBlock)
                if (next) useEditorStore.getState().updateFooterBlock({ _localeContent: next })
            }
            if (preState.globalBlocks) {
                (['cartWidget', 'whatsappButton', 'socialWidget'] as const).forEach((key) => {
                    const gb = preState.globalBlocks?.[key]
                    if (!gb) return
                    const next = snapshotEmbedded(gb)
                    if (next) useEditorStore.getState().updateGlobalBlock(key, { _localeContent: next })
                })
            }
        }

        setActiveLocale(locale)
        // F26-04: notify iframe of locale change so language switcher flag stays in sync.
        previewFrameSendRef.current?.sendToIframe({
            type: 'UPDATE_LOCALE',
            activeLocale: locale,
            generationLocale: useEditorStore.getState().generationLocale,
            siteLocale: useEditorStore.getState().siteLocale,
            primaryLocale: useEditorStore.getState().primaryLocale,
            secondaryLocale: useEditorStore.getState().secondaryLocale,
        })
        // Re-render preview iframe with content in the new locale (both standard + native).
        setTimeout(() => {
            const { blocks: currentBlocks, getDisplayBlock, headerBlock, footerBlock, globalBlocks } = useEditorStore.getState()
            const displayBlocks = currentBlocks.map(b => getDisplayBlock(b))
            previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FULL_LAYOUT', bodyBlocks: displayBlocks })
            if (headerBlock) {
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: getDisplayBlock(headerBlock) })
            }
            if (footerBlock) {
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: getDisplayBlock(footerBlock) })
            }
            if (globalBlocks) {
                previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_GLOBAL_BLOCKS', globalBlocks })
            }
        }, 0)
        // Native locale → base block is already the target language; no translation needed.
        // Immediate save persists the new active locale's display blocks to DB so
        // /preview and public sources don't show stale content until next auto-save.
        if (!isStandard) {
            markDirty(false)
            void saveWithRetry({ showToast: false, refreshPreview: false })
            return
        }
        // Standard locale: mark pending so UI shows "Adding…" until translation completes.
        // Preview/Publish buttons remain disabled via pendingLocale → UI guarantees DB consistency
        // before user can navigate to /preview. Existing Saving indicator covers visual feedback.
        setPendingLocale(locale)

        // Auto-translate header/footer if locale content not yet cached, then re-send to iframe.
        // Collected as promises so we can await everything before clearing pendingLocale.
        const state = useEditorStore.getState()
        const translationPromises: Array<Promise<unknown>> = []
        if (state.headerBlock) {
            translationPromises.push(translateGlobalBlock(
                state.headerBlock,
                `navigation-${siteId}`,
                locale as SiteLocale,
                (patch) => {
                    if (switchController.signal.aborted) return
                    useEditorStore.getState().updateHeaderBlock(patch)
                    const updated = useEditorStore.getState().headerBlock
                    if (updated) {
                        previewFrameSendRef.current?.sendToIframe({
                            type: 'UPDATE_HEADER_BLOCK',
                            blockData: useEditorStore.getState().getDisplayBlock(updated),
                        })
                    }
                },
                switchController.signal,
            ))
        }
        const gb = state.globalBlocks
        if (gb) {
            (['cartWidget', 'whatsappButton', 'socialWidget'] as const).forEach((key) => {
                const block = gb[key]
                if (!block) return
                translationPromises.push(translateGlobalBlock(
                    block,
                    `${key}-${siteId}`,
                    locale as SiteLocale,
                    (patch) => {
                        if (switchController.signal.aborted) return
                        useEditorStore.getState().updateGlobalBlock(key, patch)
                        const updatedGb = useEditorStore.getState().globalBlocks
                        if (updatedGb) {
                            previewFrameSendRef.current?.sendToIframe({
                                type: 'UPDATE_GLOBAL_BLOCKS',
                                globalBlocks: updatedGb,
                            })
                        }
                    },
                    switchController.signal,
                ))
            })
        }
        if (state.footerBlock) {
            translationPromises.push(translateGlobalBlock(
                state.footerBlock,
                `footer-${siteId}`,
                locale as SiteLocale,
                (patch) => {
                    if (switchController.signal.aborted) return
                    useEditorStore.getState().updateFooterBlock(patch)
                    const updated = useEditorStore.getState().footerBlock
                    if (updated) {
                        previewFrameSendRef.current?.sendToIframe({
                            type: 'UPDATE_FOOTER_BLOCK',
                            blockData: useEditorStore.getState().getDisplayBlock(updated),
                        })
                    }
                },
                switchController.signal,
            ))
        }

        // F26-04: Auto-translate body blocks that have no localeOverride for the new locale.
        // Skips blocks already translated (cached in localeOverrides) for instant switch back.
        // F26: also skip media/non-text fields — translating image objects/URLs bloats the payload,
        // risks malformed JSON, and wastes tokens. Only marketing copy needs translation.
        const SKIP_FIELDS = new Set<string>([...NON_TRANSLATABLE_FIELDS, '__localeInit'])
        translationPromises.push(Promise.all(state.blocks.map(async (block) => {
            if (!block.id) return
            const existingOverride = state.localeOverrides[block.id as string]?.[locale]
            if (existingOverride && Object.keys(existingOverride).length > 0) return

            const translatable = Object.fromEntries(
                Object.entries(block as Record<string, unknown>).filter(([k, v]) =>
                    !SKIP_FIELDS.has(k) && (typeof v === 'string' || Array.isArray(v) || (v !== null && typeof v === 'object'))
                ),
            )
            if (Object.keys(translatable).length === 0) return

            // F26: cache key = blockType + the block's unique id, so the translate cache is scoped per
            // block instance. Prevents cross-site AND cross-page collision (e.g. another site's hero,
            // or a sibling page's hero, leaking in) while still reusing on switch-back for the same block.
            const cacheBlockType = `${String(block.blockType || '')}-${block.id}`

            try {
                const res = await fetch('/api/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    signal: switchController.signal,
                    body: JSON.stringify({
                        blockType: cacheBlockType,
                        targetLocale: locale,
                        content: translatable,
                    }),
                })
                if (!res.ok || switchController.signal.aborted) return
                const { translated, status } = await res.json() as { translated?: Record<string, unknown>; status?: string }
                // F26: never persist a fallback (English) result into the locale slot — that poisons
                // the slot AND blocks future retries (the existingOverride guard above would skip it).
                // Leaving it empty lets getDisplayBlock fall back to the registry BM bundle instead.
                if (status === 'fallback') return
                if (!translated || Object.keys(translated).length === 0) return
                // F26-04: re-check aborted before persisting — stale flow must not write.
                if (switchController.signal.aborted) return
                setLocaleOverride(block.id as string, locale, translated)
            } catch {
                // AbortError or non-fatal network — block stays in original language
            }
        })))

        // GH-1136: translate page titles (Page Library + tab) into the target locale. Titles
        // live on the page record (not blocks) under localeContent['__pageMeta'][locale].title.
        // Current page persists via localeOverrides → /save; other pages persist via PATCH.
        const currentPageIdForTitles = useEditorStore.getState().currentPageId
        translationPromises.push(Promise.all(useEditorStore.getState().pages.map(async (pg) => {
            const title = (pg.title || '').trim()
            if (!title) return
            // Cache: skip when this page already has a title translation for the locale.
            const cachedTitle = pg.localeContent?.[PAGE_META_LOCALE_KEY]?.[locale]?.title
            if (typeof cachedTitle === 'string' && cachedTitle.trim()) return
            try {
                const res = await fetch('/api/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    signal: switchController.signal,
                    // Per-page cache key: the translate cache is keyed by blockType+locale only (not
                    // content), so a shared key would return one page's title for all pages.
                    body: JSON.stringify({ blockType: `pagetitle-${pg.id}`, targetLocale: locale, content: { title } }),
                })
                if (!res.ok || switchController.signal.aborted) return
                const { translated, status } = await res.json() as { translated?: { title?: unknown }; status?: string }
                if (status === 'fallback') return
                const translatedTitle = translated?.title
                if (typeof translatedTitle !== 'string' || !translatedTitle.trim() || switchController.signal.aborted) return

                // Mirror into pages[] for immediate Library/tab display.
                const mergedLc = {
                    ...(pg.localeContent ?? {}),
                    [PAGE_META_LOCALE_KEY]: {
                        ...(pg.localeContent?.[PAGE_META_LOCALE_KEY] ?? {}),
                        [locale]: { title: translatedTitle },
                    },
                }
                updatePageInState(pg.id, { localeContent: mergedLc })

                if (pg.id === currentPageIdForTitles) {
                    // Persisted by the /save below (localeOverrides → locale_content).
                    setLocaleOverride(PAGE_META_LOCALE_KEY, locale, { title: translatedTitle })
                } else {
                    // Other pages aren't in the save payload — persist directly.
                    await fetch(`/api/sites/${siteId}/pages/${pg.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        signal: switchController.signal,
                        body: JSON.stringify({ localeContent: mergedLc }),
                    }).catch(() => { /* non-fatal — title falls back to original */ })
                }
            } catch {
                // AbortError or non-fatal network — title stays in original language
            }
        })))

        // Await all translations (header + footer + global + body), then push refreshed
        // layout to preview, persist to DB, and clear pending state so UI exits "Adding…".
        void Promise.all(translationPromises).then(async () => {
            // F26-04: If a newer switch superseded this one, drop the work — don't ship
            // partial state from a stale flow. The newer flow will clear pendingLocale.
            if (switchController.signal.aborted) return

            const { blocks: nb, getDisplayBlock: gd } = useEditorStore.getState()
            previewFrameSendRef.current?.sendToIframe({
                type: 'UPDATE_FULL_LAYOUT',
                bodyBlocks: nb.map(b => gd(b)),
            })
            // F26-04: Persist translated state to DB so /preview and /sites/{slug}
            // render the chosen language on next load.
            await saveWithRetry({ showToast: false, refreshPreview: false })
            if (switchController.signal.aborted) return
            // Only the currently-active switch may clear pending state.
            if (localeSwitchAbortRef.current === switchController) {
                setPendingLocale(null)
            }
        })

        // Persist new locale to Sites.locale + mark unsaved so flushSavesBeforePublish
        // calls handleSave (which uses getDisplayBlocks) before promoting to published.
        try {
            await runSerializedEditorSave(siteId, () => fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ locale }),
            }))
        } catch {
            // Non-fatal — locale preference stored in memory until next save
        }
        // Mark dirty so publish flow re-saves with the new locale's display blocks (fix: Greek site → switch MS → publish → shows MS)
        markDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveWithRetry declared after this; refs are stable
    }, [siteId, markDirty, setActiveLocale, setPendingLocale, translateGlobalBlock, setLocaleOverride, updatePageInState])

    // F-26-04: Translate a specific block instance (called after block drop when needsTranslation)
    const handleAutoTranslateBlock = useCallback(async (blockId: string, blockType: string) => {
        // TC-F26-04-03/04: non-blocking notice when auto-translation can't complete. EN default
        // is already in place (AC-3) so this only informs — never blocks the editor.
        const notifyFallback = () =>
            toast.warning('Auto-translation unavailable — using English default for now.')
        try {
            // Send with {brand} token intact so server cache is brand-agnostic (Fix 3)
            const rawContent = resolveBlockContent(blockType, 'en', '{brand}').content
            const res = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blockType, targetLocale: 'ms', content: rawContent }),
            })
            if (!res.ok) { notifyFallback(); return }
            const json = await res.json() as { translated?: Record<string, unknown>; status?: string }
            if (json.status === 'fallback' || !json.translated) { notifyFallback(); return }
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
            // AC-3: Non-fatal — EN fallback already in place; inform user (TC-F26-04-04 timeout path).
            notifyFallback()
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

    const handleBlockUpdate = useCallback((index: number, changes: Record<string, unknown>) => {
        const store = useEditorStore.getState()
        const rawBlock = store.blocks[index]
        const blockId = rawBlock?.id as string | undefined

        // Structural fields (variant, backgroundColor, locale controls) are site-wide:
        // they ALWAYS write the flat block and never enter a locale slot. Routing them
        // through localeOverrides desynced canvas vs settings — e.g. picking the hero
        // "video" variant on a vi-generated site stored it only in overrides['vi'], so
        // the next flat-block render silently reverted to the old variant. The full
        // decision (incl. the generationLocale base-language gate) lives in
        // routeBlockChanges() so unit tests pin it.
        const { flatChanges, contentOverride, purgeKeys } = routeBlockChanges(changes, {
            hasBlockId: Boolean(blockId),
            activeLocale,
            generationLocale: store.generationLocale,
            siteLocale: store.siteLocale,
        })

        if (Object.keys(flatChanges).length > 0) {
            updateBlock(index, flatChanges)
        }
        if (blockId) {
            // Purge stale per-locale copies of structural keys (pre-fix sessions) so
            // they can't shadow the flat value in getDisplayBlock.
            for (const key of purgeKeys) store.clearLocaleOverrideField(blockId, key)
            if (Object.keys(contentOverride).length > 0) {
                // F-26: Store edit in localeOverrides so EN defaults (seeded by
                // initLocaleFromBlock) never mask user content when switching locales.
                setLocaleOverride(blockId, activeLocale, contentOverride)
            }
        }

        const updatedBlock = useEditorStore.getState().blocks[index]
        // Id-less blocks (pre-save) echo the RAW block: getDisplayBlock's template
        // fallback for no-id blocks would overwrite the just-typed value with EN/MS
        // locale defaults when editing on a non-base locale view.
        const blockData = blockId ? useEditorStore.getState().getDisplayBlock(updatedBlock) : updatedBlock
        previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_BLOCK_DATA', blockIndex: index, blockData })
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateBlock, setLocaleOverride, activeLocale, saveWithRetry])

    const handleBlockFieldChange = useCallback((index: number, field: string, value: string | boolean) => {
        handleBlockUpdate(index, { [field]: value })
    }, [handleBlockUpdate])

    // ─── F26 Quick Language helpers (shared by desktop + mobile SettingsPanel) ───
    // Push the merged header to the iframe so the nav preview reflects the latest locale fields.
    const refreshHeaderPreview = useCallback(() => {
        const h = useEditorStore.getState().headerBlock
        if (h) previewFrameSendRef.current?.sendToIframe({
            type: 'UPDATE_HEADER_BLOCK',
            blockData: useEditorStore.getState().getDisplayBlock(h),
        })
    }, [])

    // Strip locale-control fields from every cached _localeContent slot so the merged
    // display reflects the current toggle state, not a stale per-locale snapshot.
    const stripHeaderLocaleFields = useCallback((fields: string[]): Record<string, Record<string, unknown>> | undefined => {
        const currentHeader = useEditorStore.getState().headerBlock as Record<string, unknown> | null
        const lc = currentHeader?._localeContent as Record<string, Record<string, unknown>> | undefined
        if (!lc) return undefined
        return Object.fromEntries(
            Object.entries(lc).map(([k, v]) => {
                const copy = { ...v }
                fields.forEach(f => delete copy[f])
                return [k, copy]
            }),
        )
    }, [])

    // Enable/disable the multilingual feature. Enabling shows the panel with the primary
    // language only — the header switcher stays hidden until a 2nd language is added.
    const handleMultilingualToggle = useCallback((on: boolean) => {
        if (on) {
            updateHeaderBlock({ multilingualEnabled: true })
            refreshHeaderPreview()
        } else {
            const cleanedLc = stripHeaderLocaleFields(['showLanguageSwitcher', 'multilingualEnabled', 'secondaryLocale'])
            setSecondaryLocale(null)
            updateHeaderBlock({
                multilingualEnabled: false,
                showLanguageSwitcher: false,
                secondaryLocale: '',
                ...(cleanedLc !== undefined && { _localeContent: cleanedLc }),
            })
            refreshHeaderPreview()
            void handleLocaleSwitch(siteLocale as SiteLocale)
            setTimeout(refreshHeaderPreview, 50)
        }
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateHeaderBlock, setSecondaryLocale, refreshHeaderPreview, stripHeaderLocaleFields, handleLocaleSwitch, siteLocale, saveWithRetry])

    // Add a 2nd language → site has ≥2 languages → header switcher renders.
    // The flag is set up-front; the switch + translation run async with pendingLocale keeping
    // Preview/Publish locked until content is ready. A concurrent toggle-off clears the flag
    // synchronously AND its handleLocaleSwitch call aborts this in-flight switch, so the
    // detached translation can't ship stale state — the two flags stay consistent.
    const handleAddLanguage = useCallback((locale: string) => {
        setSecondaryLocale(locale)
        updateHeaderBlock({ showLanguageSwitcher: true, secondaryLocale: locale })
        refreshHeaderPreview()
        void handleLocaleSwitch(locale as SiteLocale)
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateHeaderBlock, setSecondaryLocale, refreshHeaderPreview, handleLocaleSwitch, saveWithRetry])

    // Remove the secondary → back to 1 language → hide switcher, return to primary view.
    const handleRemoveLanguage = useCallback(() => {
        const s = useEditorStore.getState()
        const primary = s.primaryLocale || s.generationLocale || siteLocale
        setSecondaryLocale(null)
        const cleanedLc = stripHeaderLocaleFields(['showLanguageSwitcher', 'secondaryLocale'])
        updateHeaderBlock({
            showLanguageSwitcher: false,
            secondaryLocale: '',
            ...(cleanedLc !== undefined && { _localeContent: cleanedLc }),
        })
        refreshHeaderPreview()
        void handleLocaleSwitch(primary as SiteLocale)
        setTimeout(refreshHeaderPreview, 50)
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateHeaderBlock, setSecondaryLocale, refreshHeaderPreview, stripHeaderLocaleFields, handleLocaleSwitch, siteLocale, saveWithRetry])

    const handleMakePrimary = useCallback((locale: string) => {
        const s = useEditorStore.getState()
        const oldPrimary = s.primaryLocale || s.generationLocale || siteLocale
        // Promote `locale` to primary; the previous primary becomes the secondary so the
        // language pair (and the header switcher) stays exactly 2 languages. Guard against
        // primary === secondary (e.g. promoting the locale that is already primary).
        const candidateSecondary = locale === oldPrimary ? (s.secondaryLocale || null) : oldPrimary
        const newSecondary = candidateSecondary && candidateSecondary !== locale ? candidateSecondary : null
        setPrimaryLocale(locale)
        setSecondaryLocale(newSecondary)
        if (locale === 'en' || locale === 'ms') setSiteLocale(locale as SiteLocale)
        updateHeaderBlock({ primaryLocale: locale, secondaryLocale: newSecondary || '' })
        // Always switch active display so preview reflects the new primary, including
        // non-standard locales (vi, el, etc.) which return base content.
        void handleLocaleSwitch(locale)
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [setPrimaryLocale, setSecondaryLocale, setSiteLocale, updateHeaderBlock, handleLocaleSwitch, siteLocale, saveWithRetry])

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
                // Block normalized to match the currently-viewed locale; non-standard codes
                // (e.g. 'vi') fall back to 'en' since template defaults are EN/MS only.
                locale: activeLocale === 'ms' ? 'ms' : 'en',
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

        // GH-1359: resolve hardcoded CTA placeholders (#contact/#about/#) to
        // canonical page slugs at insert time, for both the base block and the
        // locale-variant slots (which override the base on render).
        const pagesNow = useEditorStore.getState().pages

        // F-26: Consume __localeInit injected by Phase 01 normalizeAddSectionBlock
        const localeInit = (safeBlock as Record<string, unknown>).__localeInit as { en: Record<string, unknown>; ms: Record<string, unknown> } | undefined
        if (localeInit && safeBlock.id) {
            initLocaleFromBlock(safeBlock.id as string, patchLocaleInitCtaUrls(localeInit, pagesNow))
        }
        // Strip __localeInit before persisting the block
        if ((safeBlock as Record<string, unknown>).__localeInit) {
            const { __localeInit: _, ...rest } = safeBlock as Record<string, unknown>
            safeBlock = rest as BlockData
        }
        safeBlock = patchBlockCtaUrls(safeBlock, pagesNow)

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

        // Real final position of a newly-added block, found by object identity after
        // insertion — avoids fragile `afterIndex + 1` arithmetic that can drift from the
        // store's actual array position (e.g. across chained adds with a stale afterIndex).
        let insertedBlockIndex: number | null = null

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
                        // Block normalized to match the currently-viewed locale; non-standard codes
                // (e.g. 'vi') fall back to 'en' since template defaults are EN/MS only.
                locale: activeLocale === 'ms' ? 'ms' : 'en',
                    },
                    action.block,
                )

                if (nextBlock) {
                    // GH-1359: resolve CTA placeholders to canonical slugs (base + locale slots).
                    const pagesNowAI = useEditorStore.getState().pages
                    // F-26: Consume __localeInit from Phase 01 normalizeAddSectionBlock
                    const localeInitAI = (nextBlock as Record<string, unknown>).__localeInit as { en: Record<string, unknown>; ms: Record<string, unknown> } | undefined
                    if (localeInitAI && nextBlock.id) {
                        initLocaleFromBlock(nextBlock.id as string, patchLocaleInitCtaUrls(localeInitAI, pagesNowAI))
                    }
                    if ((nextBlock as Record<string, unknown>).__localeInit) {
                        const { __localeInit: _li, ...rest } = nextBlock as Record<string, unknown>
                        nextBlock = rest as BlockData
                    }
                    nextBlock = patchBlockCtaUrls(nextBlock, pagesNowAI)
                    addBlock(afterIndex, nextBlock)
                    insertedBlockIndex = useEditorStore.getState().blocks.indexOf(nextBlock)
                    setSelectedBlock(insertedBlockIndex >= 0 ? insertedBlockIndex : Math.max(0, afterIndex + 1))
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
                if (action.action === 'add_block' && insertedBlockIndex !== null && insertedBlockIndex >= 0) {
                    previewFrameSendRef.current?.setScrollToBlock?.(insertedBlockIndex)
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
        // F26-04: Wait for in-flight locale translation/save before publishing — otherwise
        // partial _localeContent / localeOverrides ship and public site renders stale content.
        const wasPending = !!useEditorStore.getState().pendingLocale
        if (wasPending) {
            const ok = await new Promise<boolean>((resolve) => {
                const deadline = Date.now() + 30_000
                const check = setInterval(() => {
                    if (!useEditorStore.getState().pendingLocale) {
                        clearInterval(check)
                        resolve(true)
                    } else if (Date.now() > deadline) {
                        clearInterval(check)
                        resolve(false)
                    }
                }, 100)
            })
            // Timeout → block publish, don't silently ship partial state.
            if (!ok) {
                toast.error('Translation in progress. Please wait and try again.')
                return false
            }
            // Force re-save with fully-translated state to guarantee header/footer/globals
            // hit DB in the chosen language before publish reads them.
            markDirty(false)
        }
        // Poll until in-flight save finishes (max 10s)
        if (isSavingRef.current || hasPendingSerializedEditorSave(siteId)) {
            await new Promise<void>((resolve) => {
                const deadline = Date.now() + 10_000
                const check = setInterval(() => {
                    if (
                        (!isSavingRef.current && !hasPendingSerializedEditorSave(siteId))
                        || Date.now() > deadline
                    ) {
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
                    if (
                        (!isSavingRef.current && !hasPendingSerializedEditorSave(siteId))
                        || Date.now() > deadline
                    ) {
                        clearInterval(check)
                        resolve()
                    }
                }, 100)
            })
        }
        return true
    }, [handleSave, markDirty, siteId])

    const handlePublish = useCallback(async () => {
        if (!siteId || isPublishing) return
        // F26-04: Block publish while translation in flight to prevent shipping mixed-language content.
        if (useEditorStore.getState().pendingLocale) {
            toast.error('Translation in progress. Please wait until "Adding…" completes before publishing.')
            return
        }

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
            // F26-04: serialize header/footer in current display locale so published page
            // renders in the chosen language (not the base/source language).
            const snap = useEditorStore.getState()
            const headerForPublish = snap.headerBlock ? snap.getDisplayBlock(snap.headerBlock) : null
            const footerForPublish = snap.footerBlock ? snap.getDisplayBlock(snap.footerBlock) : null
            const globalBlocksForPublish = snap.globalBlocks ? {
                cartWidget: snap.globalBlocks.cartWidget ? snap.getDisplayBlock(snap.globalBlocks.cartWidget) : null,
                whatsappButton: snap.globalBlocks.whatsappButton ? snap.getDisplayBlock(snap.globalBlocks.whatsappButton) : null,
                socialWidget: snap.globalBlocks.socialWidget ? snap.getDisplayBlock(snap.globalBlocks.socialWidget) : null,
            } : null
            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: currentlyPublished ? 'DELETE' : 'PATCH',
                credentials: 'include',
                ...(currentlyPublished ? {} : {
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        globalBlocks: globalBlocksForPublish,
                        headerBlock: headerForPublish,
                        footerBlock: footerForPublish,
                    }),
                }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null) as PublishFailureBody
                throw new Error(extractPublishErrorDetail(body, res.status))
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
        // F26-04: Block re-publish while translation in flight (same guard as handlePublish).
        if (useEditorStore.getState().pendingLocale) {
            toast.error('Translation in progress. Please wait until "Adding…" completes before publishing.')
            return
        }

        setIsPublishing(true)
        try {
            const flushed = await flushSavesBeforePublish()
            if (!flushed) {
                setIsPublishing(false)
                return
            }

            // Send current store state — same pattern as handlePublish.
            // F26: serialize header/footer/globals in the current display locale via getDisplayBlock
            // so re-publish promotes the translated (e.g. Malay) header — NOT the raw base-language
            // block. Sending raw here was promoting an English header on Update.
            const snap = useEditorStore.getState()
            const headerBlockSnap = snap.headerBlock ? snap.getDisplayBlock(snap.headerBlock) : null
            const footerBlockSnap = snap.footerBlock ? snap.getDisplayBlock(snap.footerBlock) : null
            const globalBlocksSnap = snap.globalBlocks ? {
                cartWidget: snap.globalBlocks.cartWidget ? snap.getDisplayBlock(snap.globalBlocks.cartWidget) : null,
                whatsappButton: snap.globalBlocks.whatsappButton ? snap.getDisplayBlock(snap.globalBlocks.whatsappButton) : null,
                socialWidget: snap.globalBlocks.socialWidget ? snap.getDisplayBlock(snap.globalBlocks.socialWidget) : null,
            } : null
            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ globalBlocks: globalBlocksSnap, headerBlock: headerBlockSnap, footerBlock: footerBlockSnap }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null) as PublishFailureBody
                throw new Error(extractPublishErrorDetail(body, res.status))
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

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(resolveApiError(data, 'Failed to update page settings', sub))
            }
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
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t.editor.toast.saveFailed)
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

    const handleMobileBlockSelect = useCallback((blockIndex: number | null, blockType?: string) => {
        // GH-1557 Bug 7: nav/footer/breadcrumb aren't in `blocks`/`globalBlocks` (no
        // currentBlock resolves for them) — route to SettingsPanel's Menu tab like desktop's
        // handleBlockSelectWithContext, but still open the compact sheet (unlike desktop,
        // whose SettingsPanel is always mounted, this sheet only mounts on demand).
        if (blockType === 'navigation' || blockType === 'footer' || blockType === 'breadcrumb') {
            setSelectedBlock(null)
            setSelectedGlobalBlockType(null)
            const sectionMap: Record<string, string> = { breadcrumb: 'breadcrumb', footer: 'footer' }
            setSettingsRequestedTab({ tab: 'menu', key: Date.now(), section: sectionMap[blockType] })
            if (isCompactLayout) {
                setIsMobileSettingsOpen(true)
                setToolsSheetOpen(false) // Phase 03: XOR — block sheet takes over from the Tools sheet
            }
            return
        }
        setSelectedBlock(blockIndex)
        // Floating blocks route via onEditGlobalBlock → handleBlockSelectWithContext, not here.
        // Guard clears global type state when switching to a page block (index >= 0 or null).
        if (blockIndex === null || blockIndex >= 0) setSelectedGlobalBlockType(null)
        // Clear a stale Menu/SEO/Global requestedTab left over from onEditGlobalBlock —
        // otherwise SettingsPanel's requestedTab effect (SettingsPanel.tsx:425) keeps
        // forcing that tab instead of the newly-tapped block's own settings.
        setSettingsRequestedTab(null)
        if (isCompactLayout && blockIndex !== null) {
            setIsMobileSettingsOpen(true)
            setToolsSheetOpen(false) // Phase 03: XOR — block sheet takes over from the Tools sheet
        }
    }, [isCompactLayout])

    // Phase 02: ✕/backdrop dismiss of the compact block-settings sheet — closes the sheet
    // AND clears the selection (so the canvas highlight/BlockActionBar also clear, and
    // re-tapping the same block still triggers a fresh open).
    const handleCloseMobileSettings = useCallback(() => {
        setIsMobileSettingsOpen(false)
        setSelectedBlock(null)
        setSelectedGlobalBlockType(null)
    }, [])

    // Phase 03: F05 bottom bar → 4-tab Tools sheet. XOR with the block-settings sheet —
    // opening the Tools sheet always closes it (mirrors F05's `openSheet()` clearing block
    // selection). `tab` is optional so the swipe-up/tap-anywhere entry points can reopen
    // on the last-viewed tab (defaults to whatever `toolsSheetTab` already is).
    const openTools = useCallback((tab?: ToolsSheetTab) => {
        if (tab) setToolsSheetTab(tab)
        setToolsSheetOpen(true)
        setIsMobileSettingsOpen(false)
    }, [])

    const closeTools = useCallback(() => setToolsSheetOpen(false), [])

    // Phase 03: "■ Stop AI" — aborts the in-flight AIChatPanel request via the abort
    // function it registers through `onStopHandlerChange` (see toolsPanelProps.chat below).
    const handleStopAI = useCallback(() => {
        stopAIRef.current?.()
    }, [])

    // PR #1485 review fix (C1): the compact AIChatPanel applies AI actions incrementally
    // (and DB-saves each one) as SSE events stream in. On abort, `appliedCount` of those
    // actions already landed — compact hides the global undo/redo pill, so this is the
    // only recovery path. Fully revert everything the aborted stream applied, then
    // persist the reverted state so the DB no longer holds the orphaned partial edit.
    const handleAbortRollback = useCallback((appliedCount: number) => {
        for (let i = 0; i < appliedCount; i++) {
            if (!useEditorStore.getState().canUndo()) break
            useEditorStore.getState().undo()
        }
        previewFrameSendRef.current?.sendToIframe({
            type: 'UPDATE_FULL_LAYOUT',
            bodyBlocks: useEditorStore.getState().getDisplayBlocks(),
        })
        void handleSave({ showToast: false, refreshPreview: false })
    }, [handleSave])

    // Lifted from the inline onHeaderUpdate/onFooterUpdate closures previously in the
    // compact branch's SettingsPanel mount (bodies copied verbatim) so CompactEditorLayout
    // can receive them as named props. Desktop's own SettingsPanel mount keeps its
    // separate inline closures untouched (out of scope for this extraction).
    const handleMobileHeaderUpdate = useCallback((changes: Record<string, unknown>) => {
        updateHeaderBlock(changes)
        const s = useEditorStore.getState()
        const h = s.headerBlock
        // F26-04: send display-merged so iframe sees current locale's _localeContent overrides.
        if (h) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: s.getDisplayBlock(h) })
        void saveWithRetry({ showToast: false, refreshPreview: false })
    }, [updateHeaderBlock, saveWithRetry])

    const handleMobileFooterUpdate = useCallback((changes: Record<string, unknown>) => {
        updateFooterBlock(changes)
        const s = useEditorStore.getState()
        const f = s.footerBlock
        if (f) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: s.getDisplayBlock(f) })
        if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
        footerUpdateSaveTimerRef.current = setTimeout(() => {
            footerUpdateSaveTimerRef.current = null
            void saveWithRetry({ showToast: false, refreshPreview: false })
        }, 600)
    }, [updateFooterBlock, saveWithRetry])

    // Shared by the desktop PageManagerPanel mount (sidebarContent below) AND the
    // Phase 03 compact Tools-sheet Pages tab (toolsPanelProps.pages) — one handler,
    // two hosts, no forked business logic.
    const handlePagesChanged = useCallback(async () => {
        setIframeKey(key => key + 1)
        // Re-sync the page list from the server after create/delete so the
        // panel reflects the change immediately (no manual reload). no-store
        // guarantees a fresh read; setPages is the single source of truth.
        try {
            const r = await fetch(`/api/sites/${siteId}/pages`, { credentials: 'include', cache: 'no-store' })
            if (r.ok) {
                const d = await r.json()
                if (Array.isArray(d?.pages)) setPages(d.pages)
            }
        } catch { /* non-fatal — optimistic addPageToState already applied */ }
    }, [siteId, setPages])

    const sidebarTabs = [
        { id: 'chat' as const, label: t.editor.sidebar.aiChat, icon: <MessageCircle className="h-4 w-4" aria-hidden /> },
        { id: 'components' as const, label: t.editor.sidebar.components, icon: <Zap className="h-4 w-4" aria-hidden /> },
        { id: 'pages' as const, label: t.editor.sidebar.pages, icon: <FileText className="h-4 w-4" aria-hidden /> },
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
                    onPagesChanged={handlePagesChanged}
                    onEditPage={() => setActiveSidebarTab('chat')}
                />
            ) : null}
        </>
    )

    // Phase 03: compact Tools-sheet panel prop bundles (EditorToolsSheet host, mounted from
    // CompactEditorLayout). Second set of instances for the SAME components/handlers the
    // desktop sidebarContent/right-panel SettingsPanel above already use — no forked
    // business logic, mirrors the Phase 02 precedent where CompactEditorLayout's
    // block-settings sheet already duplicates the desktop SettingsPanel mount this way.
    const toolsPanelProps: ToolsSheetPanelProps = {
        chat: {
            siteId,
            blocks,
            selectedBlock,
            onAIAction: handleAIAction,
            onUndoLastAction: handleUndo,
            siteName: siteName || site?.name || '',
            theme,
            currentPageSlug: page?.slug || 'home',
            currentPageTitle,
            externalActivity: chatActivity,
            blockContext: chatBlockContext,
            onBlockContextDismiss: () => setChatBlockContext(null),
            compact: true,
            onProcessingChange: setAiRunning,
            onStopHandlerChange: (stop) => { stopAIRef.current = stop },
            onAbortRollback: handleAbortRollback,
            onRequestStop: handleStopAI,
            externalProcessing: aiRunning,
        },
        components: {
            blocks,
            selectedBlock,
            onBlockSelect: handleMobileBlockSelect,
            // Tapping a block adds it then closes the sheet so the canvas (already
            // scrolling to the new block via handleAIAction's setScrollToBlock) is visible.
            onAIAction: async (action) => {
                await handleAIAction(action)
                if (action.action === 'add_block') closeTools()
            },
            onEditGlobalBlock: (blockType: string) => {
                handleBlockSelectWithContext(-1, blockType)
                if (['navigation', 'footer', 'breadcrumb'].includes(blockType)) {
                    openTools('settings') // F05 screen 9: edit nav/footer → Settings→Menu tab
                } else {
                    // Floating widgets (cartWidget/whatsapp-button/social/...) — route to the
                    // compact block-settings sheet (same destination canvas taps use via
                    // handleMobileBlockSelect) instead of the Tools sheet's Settings tab,
                    // which is fullWidth and always passes block: null (no per-widget controls).
                    setToolsSheetOpen(false)
                    setIsMobileSettingsOpen(true)
                }
            },
            onAutoTranslate: handleAutoTranslate,
            isCompact: true,
        },
        pages: {
            siteId,
            currentPageId,
            siteStatus: site?.status,
            // Selecting/creating a page closes the sheet so the newly-navigated canvas is visible.
            onPageSelected: (pageId: string) => {
                void handlePageSelected(pageId)
                closeTools()
            },
            onPagesChanged: handlePagesChanged,
            onEditPage: () => openTools('chat'),
        },
        settings: {
            block: null,
            blockIndex: null,
            theme,
            site,
            isLocalBusinessSaveLocked,
            siteName: siteName || site?.name || '',
            siteStatus: site?.status || 'draft',
            isContactSavePending,
            headerBlock,
            footerBlock,
            pages,
            currentPageId,
            siteLocale,
            generationLocale: site?.generationLocale ?? siteLocale,
            primaryLocale,
            secondaryLocale,
            pendingLocale,
            navShowLanguageSwitcher: Boolean((headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher),
            navMultilingualEnabled: Boolean((headerBlock as { multilingualEnabled?: boolean; showLanguageSwitcher?: boolean } | null)?.multilingualEnabled ?? (headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher),
            onNavLanguageSwitcherChange: handleMultilingualToggle,
            onAddLanguage: handleAddLanguage,
            onRemoveLanguage: handleRemoveLanguage,
            onMakePrimary: handleMakePrimary,
            onThemeChange: handleThemeChange,
            onBlockFieldChange: handleBlockFieldChange,
            onBlockUpdate: handleBlockUpdate,
            onHeaderUpdate: handleMobileHeaderUpdate,
            onFooterUpdate: handleMobileFooterUpdate,
            onSiteSettingsChange: handleSiteSettingsChange,
            onPageUpdate: handlePageUpdate,
            requestedTab: settingsRequestedTab,
        },
    }

    // Phase 02: PreviewFrame prop bundle shared verbatim between the desktop mount (below)
    // and the compact CompactEditorLayout mount — every value here is IDENTICAL to what was
    // previously inlined on the desktop <PreviewFrame> (extraction only, no behavior change).
    // `onBlockSelect` and `disableDragDrop` are intentionally excluded — desktop passes
    // `handleBlockSelectWithContext` with no `disableDragDrop`; compact passes
    // `handleMobileBlockSelect` with `disableDragDrop` (touch), see CompactEditorLayout.tsx.
    const previewFrameSharedProps: PreviewFrameSharedProps = {
        siteId,
        pageId: currentPageId,
        iframeKey,
        isLoading,
        viewport,
        selectedBlock,
        onBlockAIEdit: (blockIndex, blockType) => {
            setActiveSidebarTab('chat')
            setChatBlockContext({ blockIndex, blockType })
        },
        onDeleteBlock: handleDeleteBlock,
        onDuplicateBlock: handleDuplicateBlock,
        onInlineEditApplied: async (content, blockIndex, detail) => {
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
        },
        onReorderBlocks: handleReorderBlocks,
        onBlockDrop: handleBlockDrop,
        onImageReplaced: async () => {
            // UPDATE_BLOCK_DATA (sent by PreviewFrame after updateBlock) already
            // updates the iframe preview in-place — no full reload needed.
            // refreshPreview: false prevents setIframeKey from firing and avoids
            // the stale-DB-data race when a prior save is still in-flight.
            await handleSave({ showToast: false, refreshPreview: false })
        },
        onPageNavigate: handlePageSelected,
        onInlineEditSave: async () => {
            // Inline edit already updated text in iframe — no reload needed.
            // Reloading here causes visible jank while user is still editing.
            await handleSave({ showToast: false, refreshPreview: false })
        },
        onFooterUpdate: (changes) => {
            updateFooterBlock(changes)
            const s = useEditorStore.getState()
            const f = s.footerBlock
            if (f) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: s.getDisplayBlock(f) })
            if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
            footerUpdateSaveTimerRef.current = setTimeout(() => {
                footerUpdateSaveTimerRef.current = null
                void saveWithRetry({ showToast: false, refreshPreview: false })
            }, 600)
        },
        onFooterInlineEdit: (changes) => {
            // Update store only — no iframe push so contentEditable cursor stays intact
            updateFooterBlock(changes)
            if (footerUpdateSaveTimerRef.current) clearTimeout(footerUpdateSaveTimerRef.current)
            footerUpdateSaveTimerRef.current = setTimeout(() => {
                footerUpdateSaveTimerRef.current = null
                void saveWithRetry({ showToast: false, refreshPreview: false })
            }, 600)
        },
        onFooterEditStop: () => {
            // Only save if a debounce is pending — if it already fired, the save is done
            const hadPending = !!footerUpdateSaveTimerRef.current
            if (footerUpdateSaveTimerRef.current) {
                clearTimeout(footerUpdateSaveTimerRef.current)
                footerUpdateSaveTimerRef.current = null
            }
            if (hadPending) void saveWithRetry({ showToast: false, refreshPreview: false })
        },
        onHandleReady: (handle) => {
            previewFrameSendRef.current = handle
            // F26-04: sync locale on iframe ready so header switcher matches site language immediately
            if (handle) {
                const s = useEditorStore.getState()
                handle.sendToIframe({
                    type: 'UPDATE_LOCALE',
                    activeLocale: s.activeLocale,
                    generationLocale: s.generationLocale,
                    siteLocale: s.siteLocale,
                    primaryLocale: s.primaryLocale,
                    secondaryLocale: s.secondaryLocale,
                })
            }
        },
        onLocaleSwitch: (locale) => { void handleLocaleSwitch(locale as SiteLocale) },
    }

    // Shared by the desktop `EditorToolbar` "Copy Link" action and the compact
    // #1472 advisory banner's CTA — single clipboard implementation, no fork.
    const handleCopyLink = () => {
        if (siteUrl) {
            navigator.clipboard.writeText(siteUrl)
            toast.success(t.editor.toast.linkCopied, { description: siteUrl })
        }
    }

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
                permissions={userData?.permissions}
                isSuperAdmin={userData?.isSuperAdmin}
                isProduction={userData?.isProduction}
                badgeCounts={userData?.badgeCounts}
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
                aiRunning={aiRunning}
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
                pendingLocale={pendingLocale}
                onViewLive={() => siteUrl && window.open(siteUrl, '_blank')}
                onCopyLink={handleCopyLink}
                siteUrl={siteUrl}
                wasPublished={wasPublished}
                onViewportChange={setViewport}
            />

            <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} />

            {isCompactLayout ? (
                <CompactEditorLayout
                    previewFrameProps={previewFrameSharedProps}
                    onBlockSelect={handleMobileBlockSelect}
                    totalBlocks={blocks.length}
                    onReorderBlock={handleReorderBlocks}
                    onDeleteBlockConfirmed={handleDeleteBlock}
                    isMobileSettingsOpen={isMobileSettingsOpen}
                    onCloseMobileSettings={handleCloseMobileSettings}
                    currentBlock={currentBlock}
                    selectedBlock={selectedBlock}
                    theme={theme}
                    site={site}
                    siteName={siteName}
                    isContactSavePending={isContactSavePending}
                    headerBlock={headerBlock}
                    footerBlock={footerBlock}
                    pages={pages}
                    currentPageId={currentPageId}
                    siteLocale={siteLocale}
                    isLocalBusinessSaveLocked={isLocalBusinessSaveLocked}
                    primaryLocale={primaryLocale}
                    secondaryLocale={secondaryLocale}
                    pendingLocale={pendingLocale}
                    settingsRequestedTab={settingsRequestedTab}
                    onNavLanguageSwitcherChange={handleMultilingualToggle}
                    onAddLanguage={handleAddLanguage}
                    onRemoveLanguage={handleRemoveLanguage}
                    onMakePrimary={handleMakePrimary}
                    onThemeChange={handleThemeChange}
                    onBlockFieldChange={handleBlockFieldChange}
                    onBlockUpdate={handleBlockUpdate}
                    onHeaderUpdate={handleMobileHeaderUpdate}
                    onFooterUpdate={handleMobileFooterUpdate}
                    onSiteSettingsChange={handleSiteSettingsChange}
                    onPageUpdate={handlePageUpdate}
                    toolsSheetOpen={toolsSheetOpen}
                    toolsSheetTab={toolsSheetTab}
                    onOpenTools={openTools}
                    onCloseTools={closeTools}
                    onToolsTabChange={setToolsSheetTab}
                    toolsPanelProps={toolsPanelProps}
                    aiRunning={aiRunning}
                    onStopAI={handleStopAI}
                    onCopyLink={handleCopyLink}
                />
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
                            {...previewFrameSharedProps}
                            onBlockSelect={handleBlockSelectWithContext}
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
                            isContactSavePending={isContactSavePending}
                            siteStatus={site?.status || 'draft'}
                            headerBlock={headerBlock}
                            footerBlock={footerBlock}
                            pages={pages}
                            isLocalBusinessSaveLocked={isLocalBusinessSaveLocked}
                            currentPageId={currentPageId}
                            siteLocale={siteLocale}
                            generationLocale={site?.generationLocale ?? siteLocale}
                            primaryLocale={primaryLocale} secondaryLocale={secondaryLocale}
                            navShowLanguageSwitcher={Boolean((headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher)}
                            navMultilingualEnabled={Boolean((headerBlock as { multilingualEnabled?: boolean; showLanguageSwitcher?: boolean } | null)?.multilingualEnabled ?? (headerBlock as { showLanguageSwitcher?: boolean } | null)?.showLanguageSwitcher)}
                            onNavLanguageSwitcherChange={handleMultilingualToggle}
                            onAddLanguage={handleAddLanguage}
                            onRemoveLanguage={handleRemoveLanguage}
                            onMakePrimary={handleMakePrimary}
                            onThemeChange={handleThemeChange}
                            onBlockFieldChange={handleBlockFieldChange}
                            onBlockUpdate={handleBlockUpdate}
                            onHeaderUpdate={(changes) => {
                                updateHeaderBlock(changes)
                                const s = useEditorStore.getState()
                                const h = s.headerBlock
                                if (h) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_HEADER_BLOCK', blockData: s.getDisplayBlock(h) })
                                void saveWithRetry({ showToast: false, refreshPreview: false })
                            }}
                            onFooterUpdate={(changes) => {
                                updateFooterBlock(changes)
                                const s = useEditorStore.getState()
                                const f = s.footerBlock
                                if (f) previewFrameSendRef.current?.sendToIframe({ type: 'UPDATE_FOOTER_BLOCK', blockData: s.getDisplayBlock(f) })
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

            <EditorCoachMarks
                // Force a clean remount when crossing the compact/desktop breakpoint mid-tour
                // (e.g. tablet rotation) — the anchor DOM node from the old layout is gone and
                // nothing else re-resolves it, so a stale rect would otherwise point at nothing.
                key={isCompactLayout ? 'compact' : 'desktop'}
                onEnterStep1={() => {
                    setActiveSidebarTab('pages')
                    if (isCompactLayout) openTools('pages')
                }}
                onEnterStep2={() => {
                    setSettingsRequestedTab({ tab: 'menu', key: Date.now() })
                    if (isCompactLayout) openTools('settings')
                }}
                onFinish={() => {
                    if (isCompactLayout) closeTools()
                }}
                isCompact={isCompactLayout}
            />

            <EditorTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                siteId={siteId}
                onBeforeApply={async () => {
                    // ALWAYS force-save before template apply — draft/published version
                    // mismatch means hasUnsavedChanges can be stale.
                    // Throw sentinel if save fails so EditorTemplateModal aborts without a duplicate toast.
                    const ok = await handleSave({ showToast: false, refreshPreview: false })
                    if (!ok) throw new Error('PRE_SAVE_FAILED')
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
