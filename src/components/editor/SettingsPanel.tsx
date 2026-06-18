'use client'

import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { AlertTriangle, Building2, ChevronDown, Compass, Globe, Globe2, ListTree, Loader2, Palette, Search, Settings, Sparkles, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NavigationEditor, type NavLinkItem } from './NavigationEditor'
import { NavMultilingualPanel } from './nav-multilingual-panel'
import { LogoEditor } from './LogoEditor'
import { OgImageEditor } from './og-image-editor'
import { BlockImageEditor } from './BlockImageEditor'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { BreadcrumbEditor } from './BreadcrumbEditor'
import { FooterLinkEditor } from './footer-link-editor'
import FaqSettings from './FaqSettings'
import TeamSettings from './TeamSettings'
import PricingSettings from './PricingSettings'
import FeatureComparisonSettings from './FeatureComparisonSettings'
import { SOCIAL_ICONS } from '@/blocks/shared/social-icons'
import { THEME_ENUMS } from '@/lib/theme/enums'
import type { BlockData, ThemeData, CtaButton, NavLink, FeatureItem, TestimonialItem, FooterColumn } from '@/types/editor'
import type { StepItem } from '@/blocks/step-process/config'
import type { FeatureComparisonConfig } from '@/blocks/feature-comparison/config'
import type { MenuCategory, MenuItem } from '@/blocks/menu-food/config'
import type { FAQConfig } from '@/blocks/faq/config'
import type { TeamConfig } from '@/blocks/team/config'
import type { PricingConfig } from '@/blocks/pricing/config'
import { SETTINGS_PANEL_WIDTH } from './layout-constants'
import type { PageData } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { useEditorStore, BLOCK_TYPE_TO_KEY } from '@/store/editorStore'
import { toast } from 'sonner'
import { buildSlugCanonicalMap, resolveInternalUrlPath } from '@/lib/navigation-url'
import { plainText } from '@/lib/utils/rich-text-render'
import { checkHiddenPageUrl } from '@/lib/editor/check-hidden-page-url'

/** Strip HTML tags for display in text inputs (block fields may contain inline formatting) */
function stripHtmlForDisplay(value: unknown): string {
    if (!value || typeof value !== 'string') return ''
    return value.replace(/<[^>]*>/g, '')
}

/** Strip HTML tags from input to prevent XSS */
function sanitizeInput(value: string): string {
    return value.replace(/<[^>]*>/g, '').trim()
}

/** Derive a display URL from seo.ogImage which may be a populated object, string, numeric ID, or null */
function deriveOgUrl(ogImage: string | number | null | undefined): string | null {
    if (!ogImage) return null
    if (typeof ogImage === 'string') return ogImage
    if (typeof ogImage === 'object' && 'url' in (ogImage as object)) {
        return (ogImage as { url?: string }).url ?? null
    }
    return null
}

/** Check if input contains HTML/script injection */
function containsHtml(value: string): boolean {
    return /<[^>]*>/i.test(value)
}

/** Validate URL format — allow http/https and relative paths (/ or #), reject protocol-relative (//host) */
function isValidUrl(value: string): boolean {
    if (!value) return true
    if (value.startsWith('#')) return true
    if (value.startsWith('/') && !value.startsWith('//')) return true
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch { return false }
}

type SocialWidgetLink = {
    platform: 'facebook' | 'whatsapp' | 'instagram' | 'linkedin' | 'youtube'
    url: string
    enabled?: boolean
}

const SOCIAL_PLATFORM_META: Record<SocialWidgetLink['platform'], { mark: string; accent: string }> = {
    facebook: { mark: 'f', accent: '#2563eb' },
    whatsapp: { mark: 'wa', accent: '#16a34a' },
    instagram: { mark: 'ig', accent: '#db2777' },
    linkedin: { mark: 'in', accent: '#0284c7' },
    youtube: { mark: '▶', accent: '#dc2626' },
}

const FOOTER_SOCIAL_PLATFORMS = [
    { key: 'facebook',  label: 'Facebook URL' },
    { key: 'twitter',   label: 'Twitter URL' },
    { key: 'instagram', label: 'Instagram URL' },
    { key: 'linkedin',  label: 'LinkedIn URL' },
    { key: 'youtube',   label: 'YouTube URL' },
] as const

// ─── Constants ──────────────────────────────────────────────────────────
const HEADING_FONT_OPTIONS = [...THEME_ENUMS.fontHeading]
const BODY_FONT_OPTIONS = [...THEME_ENUMS.fontBody]
const labelCls = "text-[11px] font-medium text-slate-400"

const PHONE_COUNTRIES = [
    { code: '+60', flag: '🇲🇾', name: 'Malaysia', iso: 'my', placeholder: '+60 12 345 6789' },
    { code: '+84', flag: '🇻🇳', name: 'Vietnam', iso: 'vn', placeholder: '+84 93 123 4567' },
] as const
const sectionCls = "border-t border-white/10 pt-4"
// Hide newsletter variants from footer UI — feature not ready for users
const FOOTER_HIDDEN_VARIANTS = new Set(['expanded', 'mega-footer'])

/** Ensure phone number is displayed with country code prefix (e.g. "+60123456789"). */
function preparePhoneForDisplay(phone: string, countryCode: string): string {
    if (!phone) return ''
    const digits = phone.replace(/[^0-9]/g, '')
    const dialDigits = countryCode.replace(/[^0-9]/g, '')
    if (!digits.startsWith(dialDigits)) return countryCode + digits
    return '+' + digits
}

function PhoneCountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)
    const selected = PHONE_COUNTRIES.find(c => c.code === value) ?? PHONE_COUNTRIES[0]

    React.useEffect(() => {
        if (!open) return
        const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [open])

    return (
        <div ref={ref} className="relative flex h-8 shrink-0 items-center drop-shadow-[0px_1px_1px_rgba(0,0,0,0.1)]">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex h-8 items-center gap-1.5 rounded-lg px-1 focus:outline-none"
            >
                <img src={`https://flagcdn.com/w40/${selected.iso}.png`} alt={selected.name} className="h-8 w-8 rounded-[7px] object-cover" />
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[140px] overflow-hidden rounded-xl border border-[rgba(59,130,246,0.2)] bg-[#0b1120] py-1 shadow-lg">
                    {PHONE_COUNTRIES.map(c => (
                        <button
                            key={c.code}
                            type="button"
                            onClick={() => { onChange(c.code); setOpen(false) }}
                            className={cn(
                                'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-white/5',
                                c.code === value ? 'text-blue-400' : 'text-slate-200',
                            )}
                        >
                            <img src={`https://flagcdn.com/w40/${c.iso}.png`} alt={c.name} className="h-5 w-5 rounded object-cover" />
                            <span>{c.name}</span>
                            <span className="ml-auto text-xs text-slate-500">{c.code}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

type FieldBlurEvent = React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
export type SettingsTab = 'global' | 'seo' | 'menu' | 'block'

function getBlockInfo(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return { label: meta?.name || blockType, icon: meta?.icon || '🧩', variants: meta?.variants || [] }
}

function normalizePagePath(slug?: string | null) {
    if (!slug || slug === '/' || slug === 'home') return '/'
    return slug.startsWith('/') ? slug : `/${slug}`
}

function inferNavLinkType(url: string, pages?: PageData[]): NavLinkItem['type'] {
    if (!url?.startsWith('/')) return 'external'
    if (!pages?.length) return 'page'

    const normalizedUrl = normalizePagePath(url)
    return pages.some(page => normalizePagePath(page.slug) === normalizedUrl)
        ? 'page'
        : 'external'
}

function normalizeNavLinkItems(
    links: Array<Record<string, unknown> | NavLinkItem>,
    pages?: PageData[],
): NavLinkItem[] {
    return links.map((link, index) => {
        const raw = link as Record<string, unknown>
        const inferredType = raw.type === 'page' || raw.type === 'external'
            ? raw.type
            : inferNavLinkType(typeof raw.url === 'string' ? raw.url : '', pages)
        const url = typeof raw.url === 'string' && raw.url.length > 0
            ? raw.url
            : inferredType === 'page' ? '#' : ''
        const children = Array.isArray(raw.children) ? normalizeNavLinkItems(raw.children as Array<Record<string, unknown>>, pages) : []

        return {
            id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `legacy_${index}_${String(raw.label || 'link')}`,
            label: typeof raw.label === 'string' ? raw.label : '',
            url,
            type: inferredType,
            children,
        }
    })
}

// ─── Props ──────────────────────────────────────────────────────────────
interface SettingsPanelProps {
    block: BlockData | null
    blockIndex: number | null
    theme: ThemeData | undefined
    site?: {
        id: string
        name: string
        status: string
        domain?: string | null
        primaryDomain?: string | null
        branding?: {
            logo?: string
            favicon?: string
        }
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
    } | null
    siteName: string
    siteStatus: string
    headerBlock?: BlockData | null
    footerBlock?: BlockData | null
    pages?: PageData[]
    onThemeChange: (key: string, value: string) => void
    onBlockFieldChange: (idx: number, field: string, value: string) => void
    onBlockUpdate: (idx: number, changes: Record<string, unknown>) => void
    onHeaderUpdate?: (changes: Record<string, unknown>) => void
    onFooterUpdate?: (changes: Record<string, unknown>) => void
    onLogoChange?: (logoUrl: string, faviconUrl?: string) => void
    onSiteSettingsChange?: (changes: {
        name?: string
        branding?: { logo?: string; favicon?: string }
        contactInfo?: { phone?: string; email?: string; address?: string }
        socialLinks?: { facebook?: string; instagram?: string; twitter?: string; linkedin?: string; youtube?: string; tiktok?: string }
        seo?: { metaTitle?: string; metaDescription?: string; ogImage?: string | number | null }
        headerBlock?: Record<string, unknown>
        footerBlock?: Record<string, unknown>
    }) => void | Promise<void>
    currentPageId?: string | null
    onPageUpdate?: (pageId: string, changes: Partial<PageData>) => Promise<PageData | null> | PageData | null
    /** External tab request — set to { tab, key } when navigation/footer block is clicked (BUG-F05-032/046) */
    requestedTab?: { tab: SettingsTab; key: number; section?: string } | null
    // F26: Multilingual panel in Menu settings
    siteLocale?: string
    navShowLanguageSwitcher?: boolean
    navMultilingualEnabled?: boolean
    generationLocale?: string
    primaryLocale?: string
    secondaryLocale?: string | null
    pendingLocale?: string | null
    onNavLanguageSwitcherChange?: (show: boolean) => void
    onAddLanguage?: (locale: string) => void
    onRemoveLanguage?: () => void
    onMakePrimary?: (locale: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────
function SettingsPanelInner({
    block, blockIndex, theme, site, siteName, siteStatus, headerBlock, footerBlock, pages, currentPageId,
    onThemeChange, onBlockFieldChange, onBlockUpdate,
    onHeaderUpdate, onFooterUpdate, onLogoChange, onSiteSettingsChange, onPageUpdate,
    requestedTab,
    siteLocale = 'en',
    generationLocale, primaryLocale, secondaryLocale, pendingLocale,
    navShowLanguageSwitcher = false, navMultilingualEnabled = false,
    onNavLanguageSwitcherChange, onAddLanguage, onRemoveLanguage, onMakePrimary,
}: SettingsPanelProps) {
    const { t, ti } = useI18n()
    const pm = t.editor.pageManager
    const s = t.editor.settings
    // Version key: changes when block data changes (from inline editing or AI) → forces input re-mount
    const blockDataVersion = useMemo(() => {
        if (!block) return ''
        return `${block.headline || ''}-${block.subheadline || ''}-${block.body || ''}-${block.variant || ''}`
    }, [block])
    const bk = `${blockIndex}-${blockDataVersion.length}` // short block key for input keys
    const fbk = `footer-${((footerBlock?.columns as unknown[]) || []).length}-${footerBlock?.variant || ''}` // footer block key
    const footerVariant = (footerBlock?.variant as string) || 'simple'
    const footerShowColumns = footerVariant !== 'simple' && footerVariant !== 'minimal'
    const footerShowSocials = footerVariant !== 'minimal'
    const footerShowTagline = footerVariant === 'centered-stack' || footerVariant === 'dark-gradient'

    const _spacingDefault = () => block?.blockType === 'announcement-bar' ? Number((block as Record<string, unknown>)?.paddingY || 12) : 32
    const [localPaddingTop, setLocalPaddingTop] = useState(() => Number((block?.blockSpacing as Record<string, unknown>)?.paddingTop ?? _spacingDefault()))
    const [localPaddingBottom, setLocalPaddingBottom] = useState(() => Number((block?.blockSpacing as Record<string, unknown>)?.paddingBottom ?? _spacingDefault()))
    useEffect(() => {
        const def = block?.blockType === 'announcement-bar' ? Number((block as Record<string, unknown>)?.paddingY || 12) : 32
        setLocalPaddingTop(Number((block?.blockSpacing as Record<string, unknown>)?.paddingTop ?? def))
        setLocalPaddingBottom(Number((block?.blockSpacing as Record<string, unknown>)?.paddingBottom ?? def))
    }, [block?.blockSpacing, block?.blockType])

    // Resolve navigation links: prefer headerBlock.links, fallback to layout nav block
    const storeBlocks = useEditorStore(state => state.blocks)
    // GH-1136: locale-aware nav labels — getDisplayBlock merges headerBlock._localeContent[locale]
    // so the menu editor shows the same labels the visitor nav renders for the active locale.
    const getDisplayBlock = useEditorStore(state => state.getDisplayBlock)
    const activeLocale = useEditorStore(state => state.activeLocale)
    // Per-locale nav editing: in the base language edits write to the base links; in a translated
    // locale they write to that locale's slot (headerBlock._localeContent[locale]) so each language
    // is editable independently without clobbering the others. Mirrors how nav translations persist.
    // Read base locale from the store (same source getDisplayBlock uses) so the editor's base/
    // translated decision can never disagree with the merge that produces the displayed labels.
    const storeGenerationLocale = useEditorStore(state => state.generationLocale)
    const storeSiteLocale = useEditorStore(state => state.siteLocale)
    const baseLocale = storeGenerationLocale || storeSiteLocale
    const isTranslatedNavView = activeLocale !== baseLocale
    // Breadcrumb config stored globally in headerBlock.breadcrumbConfig
    const breadcrumbCfg = (headerBlock as Record<string, unknown> | null | undefined)?.breadcrumbConfig as
        { homeLabel?: string; separator?: string; showOnAllPages?: boolean } | undefined
    const resolvedNavLinks = useMemo(() => {
        // Display-merge so labels reflect activeLocale (base view → base labels, returned as-is).
        const displayHeader = headerBlock ? getDisplayBlock(headerBlock as BlockData) as Record<string, unknown> : null
        const headerLinks = ((displayHeader?.links as Array<Record<string, unknown>>) || [])
        if (headerLinks.length > 0) return normalizeNavLinkItems(headerLinks, pages)
        // Fallback: find navigation block in page layout
        const navBlock = Array.isArray(storeBlocks) ? storeBlocks.find(b => (b as Record<string, unknown>).blockType === 'navigation') : undefined
        const navLinks = (((navBlock as Record<string, unknown>)?.links as Array<Record<string, unknown>>) || [])
        return normalizeNavLinkItems(navLinks, pages)
    }, [headerBlock, pages, storeBlocks, getDisplayBlock, activeLocale])

    const [activeTab, setActiveTab] = useState<SettingsTab>(block ? 'block' : 'global')
    const [openGlobalSections, setOpenGlobalSections] = useState({
        brand: true,
        contact: true,
        social: true,
        theme: true,
        seo: true,
    })
    const [isFooterBrandOpen, setIsFooterBrandOpen] = useState(false)
    const [isFooterSocialOpen, setIsFooterSocialOpen] = useState(false)
    const [isStepConfigOpen, setIsStepConfigOpen] = useState(false)
    const [isAnnContentOpen, setIsAnnContentOpen] = useState(true)
    const [isAnnCtaOpen, setIsAnnCtaOpen] = useState(true)
    const [isAnnAppearanceOpen, setIsAnnAppearanceOpen] = useState(true)
    const [annShowLink, setAnnShowLink] = useState(() => {
        const b = block as Record<string, unknown> | undefined
        const sl = b?.showLink
        return sl === true || (sl === undefined && !!(b?.linkText || b?.linkUrl))
    })
    useEffect(() => {
        const b = block as Record<string, unknown> | undefined
        const sl = b?.showLink
        setAnnShowLink(sl === true || (sl === undefined && !!(b?.linkText || b?.linkUrl)))
    }, [blockIndex, block?.showLink, block?.linkText, block?.linkUrl])
    const [isUploadingFooterLogo, setIsUploadingFooterLogo] = useState(false)
    const footerLogoRef = React.useRef<HTMLInputElement>(null)
    const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
    const [seoSlugInput, setSeoSlugInput] = useState('')
    const [seoTitleInput, setSeoTitleInput] = useState('')
    const [seoDescriptionInput, setSeoDescriptionInput] = useState('')
    const [seoFieldError, setSeoFieldError] = useState<string | null>(null)
    const [ogImageDisplayUrl, setOgImageDisplayUrl] = useState<string | null>(
        () => deriveOgUrl(site?.seo?.ogImage)
    )

    useEffect(() => {
        const val = site?.seo?.ogImage
        // Skip re-sync when value is a bare numeric ID — that means an optimistic write
        // is in flight and there is no URL to derive. Leaving the local display URL alone
        // prevents the image preview from vanishing immediately after upload.
        if (typeof val === 'number') return
        setOgImageDisplayUrl(deriveOgUrl(val))
    }, [site?.seo?.ogImage])

    const breadcrumbSectionRef = React.useRef<HTMLDivElement>(null)
    const breadcrumbScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const footerSectionRef = React.useRef<HTMLDivElement>(null)
    const footerScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const [phoneTouchedSet, setPhoneTouchedSet] = useState<Set<string>>(new Set())

    // BUG-F05-032/046: unified tab switching — block changes + external requestedTab
    useEffect(() => {
        if (requestedTab) {
            setActiveTab(requestedTab.tab)
            if (requestedTab.section === 'breadcrumb') {
                if (breadcrumbScrollTimerRef.current) clearTimeout(breadcrumbScrollTimerRef.current)
                breadcrumbScrollTimerRef.current = setTimeout(() => {
                    breadcrumbSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 80)
            }
            if (requestedTab.section === 'footer') {
                if (footerScrollTimerRef.current) clearTimeout(footerScrollTimerRef.current)
                footerScrollTimerRef.current = setTimeout(() => {
                    footerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 80)
            }
            return () => {
                if (breadcrumbScrollTimerRef.current) clearTimeout(breadcrumbScrollTimerRef.current)
                if (footerScrollTimerRef.current) clearTimeout(footerScrollTimerRef.current)
            }
        }
        if (block) {
            setActiveTab('block')
            return
        }
        setActiveTab(prev => (prev === 'block' ? 'global' : prev))
    }, [block, requestedTab])

    const siteContactInfo = site?.contactInfo || {}
    const siteSocialLinks = site?.socialLinks || {}
    const siteSeo = site?.seo || {}
    const siteBranding = site?.branding || {}

    const globalAccordionButtonCls = 'flex w-full items-center justify-between rounded-t-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.06]'
    const globalAccordionBodyCls = 'rounded-b-xl border border-t-0 border-white/[0.08] bg-[#0F172A] px-4 py-4'

    const renderGlobalAccordion = (
        id: keyof typeof openGlobalSections,
        title: string,
        content: React.ReactNode,
    ) => (
        <div className="rounded-xl">
            <button
                type="button"
                onClick={() => setOpenGlobalSections(prev => ({ ...prev, [id]: !prev[id] }))}
                className={cn(
                    globalAccordionButtonCls,
                    openGlobalSections[id] ? 'rounded-b-none' : 'rounded-b-xl',
                )}
            >
                <span className="text-[13px] font-medium text-slate-200">{title}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 text-slate-500 transition-transform',
                        openGlobalSections[id] && 'rotate-180',
                    )}
                />
            </button>
            {openGlobalSections[id] ? (
                <div className={globalAccordionBodyCls}>
                    {content}
                </div>
            ) : null}
        </div>
    )

    const editorInputClassName = 'mt-1.5'
    const editorTextareaClassName = 'mt-1.5 min-h-[96px]'

    const renderThemeContent = () => theme ? (
        <div className="space-y-3">
            <div>
                <label className="text-xs text-gray-400">{s.primaryColor}</label>
                <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={(theme.primaryColor as string) || '#0ea5e9'}
                        onChange={e => onThemeChange('primaryColor', e.target.value)}
                        aria-label={t.editor.settingsValidation.primaryColorLabel}
                        className="h-7 w-7 rounded border-0 cursor-pointer bg-transparent" />
                    <input value={(theme.primaryColor as string) || '#0ea5e9'}
                        onChange={e => onThemeChange('primaryColor', e.target.value)}
                        className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50" />
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-400">{s.headingFont}</label>
                <select value={(theme.fontHeading as string) || 'Outfit'} onChange={e => onThemeChange('fontHeading', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                    {HEADING_FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-400">{s.bodyFont}</label>
                <select value={(theme.fontBody as string) || 'Inter'} onChange={e => onThemeChange('fontBody', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                    {BODY_FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-400">{s.colorMode}</label>
                <div className="mt-1 flex gap-2">
                    {(['dark', 'light'] as const).map(mode => (
                        <button key={mode} onClick={() => onThemeChange('colorMode', mode)}
                            className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                                theme.colorMode === mode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                            {mode === 'dark' ? s.dark : s.light}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    ) : null

    const renderGlobalContent = () => (
        <div className="space-y-4">
            {renderGlobalAccordion('brand', s.brandIdentity, (
                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.businessName}</label>
                        <Input
                            defaultValue={siteName || site?.name || ''}
                            key={`business-name-${siteName || site?.name || ''}`}
                            onBlur={(e: FieldBlurEvent) => {
                                const sanitized = sanitizeInput(e.target.value)
                                if (sanitized !== e.target.value) e.target.value = sanitized
                                onSiteSettingsChange?.({ name: sanitized })
                            }}
                            maxLength={200}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder={s.businessNamePlaceholder}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.uploadLogo}</label>
                        <div className="mt-2">
                            <LogoEditor
                                currentLogo={
                                    (siteBranding.logo as string | undefined) ||
                                    (typeof (headerBlock as Record<string, unknown>)?.logo === 'string'
                                        ? ((headerBlock as Record<string, unknown>)?.logo as string)
                                        : ((headerBlock as Record<string, unknown>)?.logo as { url?: string } | undefined)?.url) ||
                                    null
                                }
                                onLogoChange={(logoUrl, faviconUrl) => {
                                    const siteBrandingChanges: Record<string, unknown> = { logo: logoUrl }
                                    if (faviconUrl) {
                                        siteBrandingChanges.favicon = faviconUrl
                                    } else if (!logoUrl) {
                                        siteBrandingChanges.favicon = ''
                                    }
                                    // Pass logo as { url, alt } object so NavigationBlock/FooterBlock
                                    // can render it immediately via block.logo?.url
                                    const logoObj = logoUrl ? { url: logoUrl, alt: '' } : null
                                    onHeaderUpdate?.({ ...siteBrandingChanges, logo: logoObj })
                                    onFooterUpdate?.({ ...siteBrandingChanges, logo: logoObj })
                                    void onSiteSettingsChange?.({ branding: siteBrandingChanges })
                                    if (onLogoChange) onLogoChange(logoUrl, faviconUrl)
                                }}
                            />
                        </div>
                    </div>
                </div>
            ))}

            {renderGlobalAccordion('contact', s.contactInfo, (
                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.phone}</label>
                        <Input
                            defaultValue={siteContactInfo.phone || ''}
                            key={`contact-phone-${siteContactInfo.phone || ''}`}
                            onBlur={(e: FieldBlurEvent) => {
                                const v = e.target.value.trim()
                                if (!v || /^\+?[\d\s\-().]*$/.test(v)) {
                                    void onSiteSettingsChange?.({ contactInfo: { ...siteContactInfo, phone: v } })
                                } else {
                                    toast.error(t.editor.settingsValidation.invalidPhone)
                                }
                            }}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder={s.phonePlaceholder}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.email}</label>
                        <Input
                            type="email"
                            defaultValue={siteContactInfo.email || ''}
                            key={`contact-email-${siteContactInfo.email || ''}`}
                            onBlur={(e: FieldBlurEvent) => {
                                if (!e.target.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                                    void onSiteSettingsChange?.({ contactInfo: { ...siteContactInfo, email: e.target.value } })
                                } else {
                                    toast.error(s.invalidEmail)
                                }
                            }}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder={s.emailPlaceholder}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{s.address}</label>
                        <Textarea
                            defaultValue={siteContactInfo.address || ''}
                            key={`contact-address-${siteContactInfo.address || ''}`}
                            onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ contactInfo: { ...siteContactInfo, address: e.target.value } })}
                            variant="editor"
                            className={editorTextareaClassName}
                            placeholder={s.addressPlaceholder}
                        />
                    </div>
                </div>
            ))}

            {renderGlobalAccordion('social', s.socialLinks, (
                <div className="space-y-3">
                    {(['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'] as const).map(platform => (
                        <Input
                            key={`social-${platform}-${(siteSocialLinks as Record<string, string>)[platform] || ''}`}
                            defaultValue={(siteSocialLinks as Record<string, string>)[platform] || ''}
                            onBlur={(e: FieldBlurEvent) => {
                                const raw = e.target.value.trim()
                                if (!raw) {
                                    onSiteSettingsChange?.({ socialLinks: { ...siteSocialLinks, [platform]: null } })
                                    return
                                }
                                if (containsHtml(raw)) {
                                    toast.error(s.invalidSocialHtml)
                                    e.target.value = ''
                                    return
                                }
                                if (!isValidUrl(raw)) {
                                    toast.error(s.invalidSocialUrl)
                                    e.target.value = ''
                                    return
                                }
                                onSiteSettingsChange?.({ socialLinks: { ...siteSocialLinks, [platform]: raw } })
                            }}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} URL`}
                        />
                    ))}
                </div>
            ))}

            {renderGlobalAccordion('theme', s.themeColors, renderThemeContent())}
        </div>
    )

    const activePage = useMemo(() => {
        if (!pages || !currentPageId) return null
        return pages.find(p => p.id === currentPageId) || null
    }, [pages, currentPageId])

    useEffect(() => {
        if (!activePage) {
            setSeoSlugInput('')
            setSeoTitleInput('')
            setSeoDescriptionInput('')
            setSeoFieldError(null)
            return
        }

        setSeoSlugInput(activePage.isHomepage ? '/' : (activePage.slug || ''))
        setSeoTitleInput(activePage.seoTitle || activePage.title || '')
        setSeoDescriptionInput(activePage.seoDescription || '')
        setSeoFieldError(activePage.error || null)
    }, [activePage])

    const handleSeoUpdate = async (field: keyof PageData, value: string) => {
        if (!activePage || !currentPageId) return
        if (activePage[field] === value) return

        const updatedPage = await onPageUpdate?.(currentPageId, { [field]: value })
        if (!updatedPage) {
            if (field === 'slug') {
                setSeoSlugInput(activePage.isHomepage ? '/' : (activePage.slug || ''))
            } else if (field === 'seoTitle') {
                setSeoTitleInput(activePage.seoTitle || activePage.title || '')
            } else if (field === 'seoDescription') {
                setSeoDescriptionInput(activePage.seoDescription || '')
            }
            return
        }

        setSeoFieldError(null)
        setSeoSlugInput(updatedPage.isHomepage ? '/' : (updatedPage.slug || ''))
        setSeoTitleInput(updatedPage.seoTitle || updatedPage.title || '')
        setSeoDescriptionInput(updatedPage.seoDescription || '')
    }

    const seoTitleValue = seoTitleInput
    const seoDescriptionValue = seoDescriptionInput
    const seoSlugValue = seoSlugInput
    const isHomepage = activePage?.isHomepage || activePage?.slug === 'home' || activePage?.slug === '/' || activePage?.slug === ''
    const normalizedPreviewPath = isHomepage ? '' : seoSlugValue.replace(/^\//, '')
    const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN!
    const previewDomain = (site?.primaryDomain || site?.domain || `${(siteName || site?.name || 'site').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}.${platformDomain}`).replace(/^https?:\/\//, '')
    const metaTitleWarning = seoTitleValue.length > 60 ? s.titleTruncated : null
    const metaDescriptionWarning = seoDescriptionValue.length > 160 ? s.descTruncated : null

    const renderSeoContent = () => {
        if (!activePage) {
            return (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    {s.selectPageSeo}
                </div>
            )
        }

        return (
            <div className="space-y-5">
                <div>
                    <label className={labelCls}>{s.urlSlug}</label>
                    <Input
                        value={isHomepage ? '/' : seoSlugValue}
                        disabled={isHomepage || siteStatus === 'published'}
                        onChange={(e) => {
                            setSeoSlugInput(e.target.value)
                            setSeoFieldError(null)
                        }}
                        onBlur={(e: FieldBlurEvent) => {
                            let val = e.target.value.trim()
                            if (val.startsWith('/')) val = val.substring(1)
                            void handleSeoUpdate('slug', val)
                        }}
                        variant="editor"
                        className={editorInputClassName}
                    />
                    {siteStatus === 'published' && !isHomepage ? (
                        <p className="mt-1 text-[10px] text-amber-400">{pm.slugLocked}</p>
                    ) : null}
                    {seoFieldError ? (
                        <p className="mt-1 text-[10px] text-rose-400">{seoFieldError}</p>
                    ) : null}
                </div>
                <div>
                    <label className={labelCls}>{s.metaTitle}</label>
                    <Input
                        value={seoTitleValue}
                        onChange={(e) => setSeoTitleInput(e.target.value)}
                        onBlur={(e: FieldBlurEvent) => void handleSeoUpdate('seoTitle', e.target.value)}
                        variant="editor"
                        className={cn(editorInputClassName, metaTitleWarning && 'border-amber-500/40 focus-visible:border-amber-400')}
                    />
                    <div className="mt-1 flex items-center justify-between gap-3">
                        <span className={cn('text-[10px] text-slate-500', metaTitleWarning && 'text-amber-400')}>
                            {metaTitleWarning || ' '}
                        </span>
                        <span className={cn('text-[10px] text-slate-500', metaTitleWarning && 'text-amber-400')}>{seoTitleValue.length}/60 {s.characters}</span>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>{s.metaDescription}</label>
                    <Textarea
                        rows={4}
                        value={seoDescriptionValue}
                        onChange={(e) => setSeoDescriptionInput(e.target.value)}
                        onBlur={(e: FieldBlurEvent) => void handleSeoUpdate('seoDescription', e.target.value)}
                        variant="editor"
                        className={cn(editorTextareaClassName, metaDescriptionWarning && 'border-amber-500/40 focus-visible:border-amber-400')}
                        placeholder={s.metaDescPlaceholder}
                    />
                    <div className="mt-1 flex items-center justify-between gap-3">
                        <span className={cn('text-[10px] text-slate-500', metaDescriptionWarning && 'text-amber-400')}>
                            {metaDescriptionWarning || ' '}
                        </span>
                        <span className={cn('text-[10px] text-slate-500', metaDescriptionWarning && 'text-amber-400')}>{seoDescriptionValue.length}/160 {s.characters}</span>
                    </div>
                </div>

                <div className={sectionCls}>
                    <label className="text-xs font-medium uppercase text-gray-500">{s.googlePreview}</label>
                    <div className="mt-3 rounded-[8px] border border-[#25324A] bg-white p-4">
                        <div className="text-[14px] text-[#202124] truncate" style={{ fontFamily: 'arial,sans-serif' }}>
                            <span className="text-[12px] text-[#202124] flex items-center gap-2">
                                <Globe2 className="w-4 h-4 text-slate-400" />
                                {siteName || 'Your Website'}
                            </span>
                        </div>
                        <div className="text-[12px] text-[#006621] mt-1 truncate" style={{ fontFamily: 'arial,sans-serif' }}>
                            https://{previewDomain}/{normalizedPreviewPath}
                        </div>
                        <div className="text-[18px] text-[#1a0dab] font-normal mt-1 truncate hover:underline cursor-pointer leading-[1.2]" style={{ fontFamily: 'arial,sans-serif' }}>
                            {seoTitleValue || 'Page Title'}
                        </div>
                        <div className="text-[13px] text-[#4d5156] mt-1 line-clamp-2 leading-[1.4]" style={{ fontFamily: 'arial,sans-serif' }}>
                            {seoDescriptionValue || 'Provide a meta description to help users know what this page is about before they click on the search result.'}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="mb-3 border-t border-white/10 pt-4">
                        <label className={labelCls}>{s.socialImage}</label>
                    </div>
                    <OgImageEditor
                        currentOgImage={ogImageDisplayUrl}
                        onOgImageChange={(mediaId, url) => {
                            setOgImageDisplayUrl(url)
                            void onSiteSettingsChange?.({ seo: { ...siteSeo, ogImage: mediaId } })
                        }}
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="button"
                        disabled={isGeneratingSEO}
                        onClick={async () => {
                            if (!currentPageId || !site?.id) return
                            setIsGeneratingSEO(true)
                            const loadingToastId = toast.loading(s.generatingSeo)
                            try {
                                const res = await fetch(`/api/sites/${site.id}/pages/${currentPageId}/generate-seo`, {
                                    method: 'POST'
                                })
                                if (res.ok) {
                                    const data = await res.json()
                                    const proposed = data.proposed || data
                                    const applyChanges = async () => {
                                        if (proposed.title) setSeoTitleInput(proposed.title)
                                        if (proposed.description) setSeoDescriptionInput(proposed.description)
                                        if (proposed.slug && !isHomepage) setSeoSlugInput(proposed.slug)
                                        if (proposed.title) await handleSeoUpdate('seoTitle', proposed.title)
                                        if (proposed.description) await handleSeoUpdate('seoDescription', proposed.description)
                                        if (proposed.slug && !isHomepage) await handleSeoUpdate('slug', proposed.slug)
                                    }
                                    // AC-16, BR-06: confirm before overwriting existing meta
                                    if (data.hasExisting) {
                                        toast.dismiss(loadingToastId)
                                        const confirmed = window.confirm(
                                            t.editor.settingsValidation.seoConfirmReplace
                                                .replace('{oldTitle}', data.existing?.title || '(empty)')
                                                .replace('{newTitle}', proposed.title)
                                                .replace('{oldDesc}', data.existing?.description || '(empty)')
                                                .replace('{newDesc}', proposed.description)
                                        )
                                        if (!confirmed) {
                                            toast.info(s.seoCancelled)
                                            return
                                        }
                                    }
                                    await applyChanges()
                                    toast.success(s.seoGenerated, { id: loadingToastId })
                                    if (data.warning) toast.warning(data.warning)
                                } else {
                                    toast.error(s.seoFailed, { id: loadingToastId })
                                }
                            } catch (error) {
                                toast.error(s.seoError, { id: loadingToastId })
                            } finally {
                                setIsGeneratingSEO(false)
                            }
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,#3B82F6_0%,#2DD4BF_100%)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                    >
                        {isGeneratingSEO ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <Sparkles className="h-4 w-4" aria-hidden />
                        )}
                        {isGeneratingSEO ? s.generating : s.autoSeo}
                    </button>
                </div>
            </div>
        )
    }

    const handleFooterLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploadingFooterLogo(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', 'Logo')
            const uploaded = await uploadMediaAction(formData)
            if (!uploaded?.url) throw new Error('Upload succeeded but no URL returned')
            onFooterUpdate?.({ logo: { url: uploaded.url, alt: (footerBlock?.logo as { alt?: string } | undefined)?.alt || '' } })
        } catch {
            toast.error('Failed to upload logo')
        } finally {
            setIsUploadingFooterLogo(false)
            if (footerLogoRef.current) footerLogoRef.current.value = ''
        }
    }

    const renderMenuContent = () => {
        return (
            <div className="space-y-5">
                {/* 1. Navigation Style */}
                <div className={sectionCls}>
                    <label className={labelCls}>{s.navVariant}</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {([
                            { key: 'default', label: s.navVariantDefault },
                            { key: 'centered', label: s.navVariantCentered },
                            { key: 'mega', label: s.navVariantMega },
                            { key: 'transparent', label: s.navVariantTransparent },
                            { key: 'sidebar', label: s.navVariantSidebar },
                            { key: 'floating', label: s.navVariantFloating },
                        ] as { key: string; label: string }[]).map(({ key, label }) => {
                            const current = (headerBlock as Record<string, unknown>)?.variant as string | undefined
                            const active = current === key || (!current && key === 'default')
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => onHeaderUpdate?.({ variant: key })}
                                    className={cn(
                                        'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                                        active
                                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                    )}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 2. Navigation Editor (List menu items) */}
                <div className={sectionCls} data-coach="menu-settings">
                    <label className={labelCls}>{t.editor.navigation.title}</label>
                    <div className="mt-2">
                        <NavigationEditor
                            links={resolvedNavLinks}
                            onUpdate={(links) => {
                                if (isTranslatedNavView) {
                                    // GH-1136: write into the active locale's slot so editing the
                                    // translated menu doesn't overwrite the base-language labels.
                                    const lc = ((headerBlock as Record<string, unknown> | null)?._localeContent
                                        ?? {}) as Record<string, Record<string, unknown>>
                                    onHeaderUpdate?.({
                                        _localeContent: { ...lc, [activeLocale]: { ...(lc[activeLocale] ?? {}), links } },
                                    })
                                } else {
                                    onHeaderUpdate?.({ links })
                                }
                            }}
                            pages={pages}
                        />
                    </div>
                </div>

                {/* 3.5 Quick Language — multilingual toggle */}
                <div className={sectionCls}>
                    <NavMultilingualPanel
                        siteLocale={siteLocale}
                        enabled={navMultilingualEnabled}
                        switcherVisible={navShowLanguageSwitcher}
                        onToggle={(on) => onNavLanguageSwitcherChange?.(on)}
                        generationLocale={generationLocale}
                        primaryLocale={primaryLocale}
                        secondaryLocale={secondaryLocale}
                        pendingLocale={pendingLocale}
                        onAddLanguage={(locale) => onAddLanguage?.(locale)}
                        onRemoveLanguage={() => onRemoveLanguage?.()}
                        onMakePrimary={(locale) => onMakePrimary?.(locale)}
                    />
                </div>

                {/* 4. Nav CTA Button */}
                <div className={sectionCls}>
                    <label className={labelCls}>{s.navCta}</label>
                    <div className="mt-2 space-y-2">
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                            <input
                                type="checkbox"
                                checked={Boolean((headerBlock?.ctaButton as Record<string, unknown>)?.show)}
                                onChange={(e) => {
                                    const current = (headerBlock?.ctaButton as Record<string, unknown>) || { show: false, label: 'Get started', url: '/contact' }
                                    onHeaderUpdate?.({ ctaButton: { ...current, show: e.target.checked } })
                                }}
                            />
                            {s.navCtaShow}
                        </label>
                        <Input
                            key={`nav-cta-label-${((headerBlock?.ctaButton as Record<string, unknown>)?.label as string) || ''}`}
                            defaultValue={((headerBlock?.ctaButton as Record<string, unknown>)?.label as string) || ''}
                            placeholder={s.navCtaLabel}
                            variant="editor"
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                const current = (headerBlock?.ctaButton as Record<string, unknown>) || { show: true, label: '', url: '' }
                                onHeaderUpdate?.({ ctaButton: { ...current, label: e.target.value } })
                            }}
                        />
                        {(() => {
                            const ctaUrl = (headerBlock?.ctaButton as Record<string, unknown>)?.url as string | undefined
                            const hiddenCta = checkHiddenPageUrl(ctaUrl, pages)
                            return (
                                <>
                                    <Input
                                        key={`nav-cta-url-${ctaUrl || ''}`}
                                        defaultValue={ctaUrl || ''}
                                        placeholder={s.navCtaUrl}
                                        variant="editor"
                                        className={hiddenCta ? 'mt-1.5 ring-2 ring-red-500/70' : undefined}
                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                            const raw = e.target.value.trim()
                                            const current = (headerBlock?.ctaButton as Record<string, unknown>) || { show: true, label: '', url: '' }
                                            if (raw && /^(javascript|data|vbscript):/i.test(raw)) {
                                                toast.error(s.invalidSocialUrl)
                                                e.target.value = (current.url as string) || ''
                                                return
                                            }
                                            onHeaderUpdate?.({ ctaButton: { ...current, url: raw } })
                                        }}
                                    />
                                    {hiddenCta && (
                                        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                                            <AlertTriangle size={11} className="shrink-0" />
                                            {hiddenCta === 'deleted' ? s.linkPageDeleted : hiddenCta === 'draft' ? s.linkPageDraft : hiddenCta === 'not-found' ? s.linkPageNotFound : s.linkPageHidden}
                                        </p>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                </div>

                {/* ─── Breadcrumb Settings ─────────────────────────────────── */}
                <div ref={breadcrumbSectionRef} className={sectionCls}>
                    <div className="flex items-center gap-2 mb-4">
                        <ListTree className="h-4 w-4 text-[#2dd4bf]" aria-hidden />
                        <span className="text-[13px] font-semibold uppercase tracking-wide text-[#2dd4bf]">{s.breadcrumbSettings}</span>
                    </div>
                    <BreadcrumbEditor
                        homeLabel={String(breadcrumbCfg?.homeLabel || 'Home')}
                        separator={String(breadcrumbCfg?.separator || '/')}
                        showOnAllPages={Boolean(breadcrumbCfg?.showOnAllPages ?? true)}
                        pageSlug={activePage?.slug ?? undefined}
                        onChange={(changes) => {
                            onHeaderUpdate?.({ breadcrumbConfig: { ...breadcrumbCfg, ...changes } })
                        }}
                    />
                </div>

                {/* ─── Footer Settings ─────────────────────────────────────── */}
                {footerBlock && (
                    <div ref={footerSectionRef} className={sectionCls}>
                        <div className="flex items-center gap-2 mb-4">
                            <Palette className="h-4 w-4 text-[#2dd4bf]" aria-hidden />
                            <span className="text-[13px] font-semibold uppercase tracking-wide text-[#2dd4bf]">{s.footerSettings}</span>
                        </div>

                        {/* Footer Style */}
                        <div className="mb-4">
                            <label className={labelCls}>{s.footerStyle}</label>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {([
                                    { key: 'simple', label: s.footerStyleSimple },
                                    { key: 'minimal', label: s.footerStyleMinimal },
                                    { key: 'centered-stack', label: s.footerStyleCentered },
                                    { key: 'dark-gradient', label: s.dark },
                                ] as { key: string; label: string }[]).map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => onFooterUpdate?.({ variant: key })}
                                        className={cn(
                                            'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                                            (footerBlock.variant as string) === key || (!footerBlock.variant && key === 'simple')
                                                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Brand & Logo */}
                        <div className="mb-4">
                            <button
                                type="button"
                                onClick={() => setIsFooterBrandOpen(v => !v)}
                                className="flex w-full items-center justify-between rounded-xl border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)] px-3 py-2.5 text-[13px] font-medium text-white"
                            >
                                <span className="flex items-center gap-1"><Building2 className="h-4 w-4" aria-hidden /> {s.brandLogo}</span>
                                <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isFooterBrandOpen && 'rotate-180')} />
                            </button>
                            {isFooterBrandOpen && (() => {
                                const currentLogoUrl = (footerBlock?.logo as { url?: string } | undefined)?.url || ''
                                return (
                                <div className="mt-1 space-y-3 rounded-xl border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)] px-3 pb-3 pt-2.5">
                                    {/* Upload Logo */}
                                    <div>
                                        <label className={labelCls}>{s.uploadLogo}</label>
                                        <button
                                            type="button"
                                            onClick={() => footerLogoRef.current?.click()}
                                            disabled={isUploadingFooterLogo}
                                            className="mt-1 flex h-24 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-blue-500/20 bg-[#0b1120] text-slate-400 transition-colors hover:border-blue-500/40 disabled:opacity-50"
                                        >
                                            {isUploadingFooterLogo ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : currentLogoUrl ? (
                                                <>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={currentLogoUrl} alt="Logo preview" className="max-h-14 max-w-full object-contain" />
                                                    <span className="text-[10px] text-slate-500">{s.clickToChange}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <UploadCloud className="h-5 w-5" />
                                                    <span className="text-[12px] font-medium">{s.clickToUpload}</span>
                                                </>
                                            )}
                                        </button>
                                        <input
                                            ref={footerLogoRef}
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            className="hidden"
                                            onChange={handleFooterLogoUpload}
                                        />
                                    </div>
                                    {/* Paste URL */}
                                    <div>
                                        <p className="text-[12px] text-slate-400">{s.pasteImageUrl}</p>
                                        <Input
                                            key={`footer-logo-url-${fbk}-${currentLogoUrl}`}
                                            defaultValue={currentLogoUrl}
                                            placeholder="https://example.com/logo.png"
                                            onBlur={(e: FieldBlurEvent) => {
                                                const url = e.target.value.trim()
                                                if (url && !isValidUrl(url)) {
                                                    toast.error(s.invalidUrlFormat)
                                                    e.target.value = currentLogoUrl
                                                    return
                                                }
                                                onFooterUpdate?.({ logo: { url, alt: (footerBlock?.logo as { alt?: string } | undefined)?.alt || '' } })
                                            }}
                                            variant="editor"
                                            className="mt-1 h-8 text-[12px]"
                                        />
                                    </div>
                                    {/* Company Description — only for variants that render tagline */}
                                    {footerShowTagline && (
                                    <div>
                                        <label className={labelCls}>{s.companyDescription}</label>
                                        <Textarea
                                            key={`footer-tagline-${fbk}`}
                                            defaultValue={(footerBlock?.tagline as string) || ''}
                                            placeholder={s.companyDescPlaceholder}
                                            onBlur={(e: FieldBlurEvent) => onFooterUpdate?.({ tagline: sanitizeInput(e.target.value) })}
                                            className="mt-1 min-h-[66px] resize-none rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#0b1120] px-3 py-2 text-[12px] text-white placeholder:text-slate-400 outline-none focus:border-blue-500/30"
                                        />
                                    </div>
                                    )}
                                </div>
                                )
                            })()}
                        </div>

                        {/* Column Link Editor — hidden for simple; minimal uses single-column mode */}
                        {footerShowColumns && (
                            <FooterLinkEditor
                                columns={(footerBlock?.columns as FooterColumn[]) || []}
                                onUpdate={(cols) => onFooterUpdate?.({ columns: cols })}
                                pages={pages}
                            />
                        )}

                        {/* Social Media — hidden for minimal (no socials rendered) */}
                        {footerShowSocials && <div className="mb-4">
                            <button
                                type="button"
                                onClick={() => setIsFooterSocialOpen(v => !v)}
                                className="flex w-full items-center justify-between rounded-xl border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)] px-3 py-2.5 text-[13px] font-medium text-white"
                            >
                                <span>{s.socialMedia}</span>
                                <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isFooterSocialOpen && 'rotate-180')} />
                            </button>
                            {isFooterSocialOpen && (
                                <div className="mt-1 space-y-3 rounded-xl border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)] px-3 pb-3 pt-2.5">
                                    {FOOTER_SOCIAL_PLATFORMS.map(({ key, label }) => {
                                        const PlatformIcon = SOCIAL_ICONS[key]
                                        const currentUrl = ((footerBlock?.socials as { platform: string; url: string }[] | undefined) || [])
                                            .find(s => s.platform === key)?.url || ''
                                        return (
                                            <div key={key} className="flex flex-col gap-1.5">
                                                <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                                                    {PlatformIcon && <PlatformIcon size={12} className="shrink-0" />}
                                                    {label}
                                                </label>
                                                <Input
                                                    key={`footer-social-${key}-${fbk}`}
                                                    defaultValue={currentUrl}
                                                    placeholder={`https://${key}.com/yourcompany`}
                                                    onBlur={(e: FieldBlurEvent) => {
                                                        const val = e.target.value.trim()
                                                        if (val && !isValidUrl(val)) {
                                                            toast.error('Invalid URL format')
                                                            e.target.value = currentUrl
                                                            return
                                                        }
                                                        const existing = ((footerBlock?.socials as { platform: string; url: string }[] | undefined) || [])
                                                            .filter(s => s.platform !== key)
                                                        const updated = val ? [...existing, { platform: key, url: val }] : existing
                                                        onFooterUpdate?.({ socials: updated })
                                                    }}
                                                    variant="editor"
                                                    className="h-8 text-[12px]"
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>}

                        {/* Copyright Text */}
                        <div className="mb-4">
                            <label className={labelCls}>{s.copyrightText}</label>
                            <Input
                                key={`footer-copyright-${fbk}-${(footerBlock?.copyrightText as string) || ''}`}
                                defaultValue={(footerBlock?.copyrightText as string) || ''}
                                placeholder="© 2026 Your Company. All rights reserved."
                                onBlur={(e: FieldBlurEvent) => onFooterUpdate?.({ copyrightText: sanitizeInput(e.target.value) })}
                                variant="editor"
                                className="mt-1 h-8 text-[12px]"
                            />
                        </div>

                        {/* Background Color */}
                        <div className="mb-4">
                            <label className={labelCls}>{s.backgroundColor}</label>
                            <div className="mt-1.5 flex gap-2">
                                <Input
                                    key={`footer-bgcolor-${fbk}-${(footerBlock?.backgroundColor as string) || ''}`}
                                    defaultValue={(footerBlock?.backgroundColor as string) || ''}
                                    placeholder="#0f172a"
                                    onBlur={(e: FieldBlurEvent) => onFooterUpdate?.({ backgroundColor: e.target.value.trim() || undefined })}
                                    variant="editor"
                                    className="h-8 text-[12px]"
                                />
                                <input
                                    type="color"
                                    value={(footerBlock?.backgroundColor as string) || '#0f172a'}
                                    onChange={(e) => onFooterUpdate?.({ backgroundColor: e.target.value })}
                                    aria-label={s.pickBgColor}
                                    className="h-8 w-12 shrink-0 cursor-pointer rounded border border-blue-500/30 bg-transparent p-0.5"
                                />
                            </div>
                        </div>

                    </div>
                )}
            </div>
        )
    }

    const panelTitle = activeTab === 'global'
        ? s.globalSettings
        : activeTab === 'seo'
            ? s.seoSettings
            : activeTab === 'menu'
                ? s.menuSettings
                : s.blockSettings

    const panelDescription = activeTab === 'block'
        ? s.blockDesc
        : activeTab === 'seo'
            ? s.seoDesc
            : activeTab === 'menu'
                ? s.menuDesc
                : s.globalDesc

    const info = block ? getBlockInfo(block.blockType) : null
    const bt = block?.blockType
    const currentBlockIndex = blockIndex ?? 0

    const focusedBlockIndexRef = useRef<number>(currentBlockIndex)

    // Global block routing — floating blocks use negative __editorBlockIndex
    // (cartWidget=-1, whatsapp-button=-2, socialWidget=-3). Reads go to the live store
    // entry; writes route to updateGlobalBlock.
    const storeGlobalBlocks = useEditorStore(state => state.globalBlocks)
    const storeUpdateGlobalBlock = useEditorStore(state => state.updateGlobalBlock)

    const isGlobal = block?.__editorBlockIndex !== undefined && (block.__editorBlockIndex as number) < 0
    const globalKey = bt ? BLOCK_TYPE_TO_KEY[bt] : undefined
    const effectiveBlock = (isGlobal && globalKey
        ? (storeGlobalBlocks?.[globalKey] ?? block)
        : block) as BlockData | null

    const handleBlockUpdate = (changes: Record<string, unknown>) => {
        if (isGlobal && globalKey) {
            storeUpdateGlobalBlock(globalKey, changes)
        } else {
            onBlockUpdate(currentBlockIndex, changes)
        }
    }

    const handleBlockFieldChange = (field: string, value: string) => {
        if (isGlobal && globalKey) {
            storeUpdateGlobalBlock(globalKey, { [field]: value })
        } else {
            onBlockFieldChange(currentBlockIndex, field, value)
        }
    }

    // Helper: update item in an array field
    const updateArrayItem = (field: string, index: number, key: string, val: unknown) => {
        const arr = [...(((effectiveBlock?.[field] as Record<string, unknown>[] | undefined) || []))]
        arr[index] = { ...arr[index], [key]: val }
        handleBlockUpdate({ [field]: arr })
    }

    // Helper: add item to array field
    const addArrayItem = (field: string, template: Record<string, unknown>) => {
        const arr = [...(((effectiveBlock?.[field] as Record<string, unknown>[] | undefined) || [])), template]
        handleBlockUpdate({ [field]: arr })
    }

    // Helper: remove item from array field
    const removeArrayItem = (field: string, index: number) => {
        const arr = (((effectiveBlock?.[field] as Record<string, unknown>[] | undefined) || [])).filter((_: unknown, i: number) => i !== index)
        handleBlockUpdate({ [field]: arr })
    }

    // Helpers: nested two-level CRUD (categories[].items[])
    const updateNestedItem = (field: string, catIdx: number, itemIdx: number, key: string, val: unknown) => {
        const cats = [...(((effectiveBlock?.[field] as Record<string, unknown>[] | undefined) || []))]
        const catItems = [...((cats[catIdx]?.['items'] as Record<string, unknown>[] || []))]
        catItems[itemIdx] = { ...catItems[itemIdx], [key]: val }
        cats[catIdx] = { ...cats[catIdx], items: catItems }
        handleBlockUpdate({ [field]: cats })
    }
    const addNestedItem = (field: string, catIdx: number, template: Record<string, unknown>) => {
        const cats = [...(((effectiveBlock?.[field] as Record<string, unknown>[] | undefined) || []))]
        const catItems = [...((cats[catIdx]?.['items'] as Record<string, unknown>[] || [])), template]
        cats[catIdx] = { ...cats[catIdx], items: catItems }
        handleBlockUpdate({ [field]: cats })
    }
    const removeNestedItem = (field: string, catIdx: number, itemIdx: number) => {
        const cats = [...(((effectiveBlock?.[field] as Record<string, unknown>[] | undefined) || []))]
        const catItems = ((cats[catIdx]?.['items'] as Record<string, unknown>[] || [])).filter((_, i) => i !== itemIdx)
        cats[catIdx] = { ...cats[catIdx], items: catItems }
        handleBlockUpdate({ [field]: cats })
    }

    const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; disabled?: boolean }> = [
        { id: 'global', label: s.tabGlobal, icon: <Settings className="h-4 w-4" aria-hidden /> },
        { id: 'seo', label: s.tabSeo, icon: <Search className="h-4 w-4" aria-hidden /> },
        { id: 'menu', label: s.tabMenu, icon: <Compass className="h-4 w-4" aria-hidden /> },
        { id: 'block', label: s.tabBlock, icon: <Palette className="h-4 w-4" aria-hidden />, disabled: !block },
    ]

    return (
        <div
            className="flex h-full shrink-0 flex-col border-l border-white/5 bg-[#111827]"
            style={{ width: SETTINGS_PANEL_WIDTH }}
        >
            <div className="border-b border-white/5 px-4 py-4">
                <div className="grid grid-cols-2 gap-2">
                    {tabs.map(tab => (
                        <Tooltip.Provider key={tab.id} delayDuration={150}>
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <span className="block">
                                        <button
                                            type="button"
                                            disabled={tab.disabled}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={cn(
                                                'inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-medium transition-colors',
                                                activeTab === tab.id
                                                    ? 'bg-[linear-gradient(90deg,rgba(37,99,235,0.28),rgba(34,211,238,0.2))] text-[#F8FAFC] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]'
                                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                                                tab.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-500',
                                            )}
                                        >
                                            <span className="shrink-0">{tab.icon}</span>
                                            {tab.label}
                                        </button>
                                    </span>
                                </Tooltip.Trigger>
                                {tab.disabled ? (
                                    <Tooltip.Portal>
                                        <Tooltip.Content
                                            side="bottom"
                                            sideOffset={8}
                                            className="z-50 rounded-md border border-white/10 bg-[#0B1120] px-3 py-2 text-xs text-slate-100 shadow-xl"
                                            style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
                                        >
                                            {s.selectBlock}
                                            <Tooltip.Arrow className="fill-[#0B1120]" />
                                        </Tooltip.Content>
                                    </Tooltip.Portal>
                                ) : null}
                            </Tooltip.Root>
                        </Tooltip.Provider>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                <div className="mb-6">
                    <div className="flex items-start gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="flex shrink-0 text-[#2DD4BF]">
                                    {activeTab === 'global' ? <Settings className="h-4 w-4" aria-hidden /> : activeTab === 'seo' ? <Search className="h-4 w-4" aria-hidden /> : activeTab === 'menu' ? <Compass className="h-4 w-4" aria-hidden /> : <Palette className="h-4 w-4" aria-hidden />}
                                </span>
                                <p className="text-[14px] font-semibold uppercase leading-5 tracking-normal text-[#2DD4BF]">{panelTitle}</p>
                            </div>
                            {activeTab === 'block' && block ? (
                                <div className="mt-1 pl-7 flex items-center gap-2">
                                    <p className="text-[11px] text-slate-500">[{block.blockType}]</p>
                                    {isGlobal && (
                                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none" style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
                                            <Globe className="h-3 w-3" aria-hidden /> Global
                                        </span>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="space-y-5">
                    {activeTab === 'global' ? renderGlobalContent() : null}
                    {activeTab === 'seo' ? renderSeoContent() : null}
                    {activeTab === 'menu' ? renderMenuContent() : null}
                    {activeTab === 'block' && !block ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                            {s.selectBlockMsg}
                        </div>
                    ) : null}

                    {activeTab === 'block' && block ? (
                        <>
                            <div className="rounded-2xl border border-[#25324A] bg-[#172033] px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-white">{info?.icon} {info?.label}</span>
                                    <span className="text-xs text-gray-500">#{currentBlockIndex + 1}</span>
                                </div>
                            </div>
                            {/* Variant Switcher */}
                            {(info?.variants?.length || 0) > 1 && (
                                <div>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.variant}</label>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {info?.variants.filter(v => bt !== 'footer' || !FOOTER_HIDDEN_VARIANTS.has(v)).map(v => (
                                            <button key={v}
                                                onClick={() => onBlockFieldChange(currentBlockIndex, 'variant', v)}
                                                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                    block.variant === v ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                                                {v.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Layout & Spacing */}
                            {block.blockType !== 'navigation' && block.blockType !== 'footer' && block.blockType !== 'announcement-bar' && block.blockType !== 'pricing' && block.blockType !== 'feature-comparison' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">Layout & Spacing</label>
                                    <div className="mt-3 space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className={labelCls}>Top Spacing</span>
                                                <span className="text-[10px] text-slate-500">{localPaddingTop}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0} max={120} step={4}
                                                value={localPaddingTop}
                                                onChange={(e) => setLocalPaddingTop(Number(e.target.value))}
                                                onPointerUp={(e) => {
                                                    const val = Number((e.target as HTMLInputElement).value)
                                                    const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                    onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingTop: val } })
                                                }}
                                                className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className={labelCls}>Bottom Spacing</span>
                                                <span className="text-[10px] text-slate-500">{localPaddingBottom}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0} max={120} step={4}
                                                value={localPaddingBottom}
                                                onChange={(e) => setLocalPaddingBottom(Number(e.target.value))}
                                                onPointerUp={(e) => {
                                                    const val = Number((e.target as HTMLInputElement).value)
                                                    const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                    onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingBottom: val } })
                                                }}
                                                className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── Common Text Fields ──────────────────────── */}
                            {block.logoText !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.logoText}</label>
                                    <Input defaultValue={stripHtmlForDisplay(block.logoText)} key={`logo-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'logoText', e.target.value)}
                                        variant="editor"
                                        className={editorInputClassName} />
                                </div>
                            )}

                            {block.headline !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.headline}</label>
                                    <Input defaultValue={stripHtmlForDisplay(block.headline)} key={`hl-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'headline', e.target.value)}
                                        variant="editor"
                                        className={editorInputClassName} />
                                </div>
                            )}

                            {block.subheadline !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.subheadline}</label>
                                    <Textarea defaultValue={stripHtmlForDisplay(block.subheadline)} rows={2} key={`sub-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'subheadline', e.target.value)}
                                        variant="editor"
                                        className={editorTextareaClassName} />
                                </div>
                            )}

                            {block.sectionLabel !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.sectionLabel}</label>
                                    <Input defaultValue={stripHtmlForDisplay(block.sectionLabel)} key={`sl-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'sectionLabel', e.target.value)}
                                        variant="editor"
                                        className={editorInputClassName} />
                                </div>
                            )}

                            {block.body !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.bodyText}</label>
                                    <Textarea defaultValue={stripHtmlForDisplay(block.body)} rows={4} key={`body-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'body', e.target.value)}
                                        variant="editor"
                                        className={editorTextareaClassName} />
                                </div>
                            )}

                            {block.subtext !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.description}</label>
                                    <Textarea defaultValue={stripHtmlForDisplay(block.subtext)} rows={3} key={`subtext-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'subtext', e.target.value)}
                                        variant="editor"
                                        className={editorTextareaClassName} />
                                </div>
                            )}

                            {block.tagline !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.tagline}</label>
                                    <Textarea defaultValue={stripHtmlForDisplay(block.tagline)} rows={2} key={`tag-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'tagline', e.target.value)}
                                        variant="editor"
                                        className={editorTextareaClassName} />
                                </div>
                            )}

                            {/* ─── Contact Fields ─────────────────────────── */}
                            {(bt === 'contact') && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.contactInfo}</label>
                                    <div className="mt-3 space-y-3">
                                        <div>
                                            <label className={labelCls}>{s.email}</label>
                                            <Input type="email" defaultValue={(block.email as string) || ''} key={`email-${bk}`}
                                                onBlur={(e: FieldBlurEvent) => {
                                                    if (!e.target.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                                                        onBlockFieldChange(currentBlockIndex, 'email', e.target.value)
                                                    } else {
                                                        toast.error(s.invalidEmail)
                                                    }
                                                }}
                                                variant="editor"
                                                className={editorInputClassName} placeholder={s.emailPlaceholder} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{s.phone}</label>
                                            <Input defaultValue={(block.phone as string) || ''} key={`phone-${bk}`}
                                                onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'phone', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} placeholder={s.phonePlaceholder} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{s.address}</label>
                                            <Textarea defaultValue={(block.address as string) || ''} rows={2} key={`addr-${bk}`}
                                                onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'address', e.target.value)}
                                                variant="editor"
                                                className={editorTextareaClassName} placeholder={s.addressPlaceholder} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── CTA Fields ─────────────────────────────── */}
                            {(block.ctaLabel !== undefined || block.ctaUrl !== undefined) && (
                                <div>
                                    <label className={labelCls}>{s.ctaButton}</label>
                                    <div className="mt-1.5 space-y-2">
                                        <Input defaultValue={stripHtmlForDisplay(block.ctaLabel)} key={`ctalbl-${bk}`}
                                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'ctaLabel', e.target.value)}
                                            variant="editor"
                                            className={editorInputClassName} placeholder={s.buttonText} />
                                        {(() => {
                                            const ctaUrlVal = block.ctaUrl as string | undefined
                                            const hiddenCtaUrl = checkHiddenPageUrl(ctaUrlVal, pages)
                                            return (
                                                <>
                                                    <Input defaultValue={ctaUrlVal || ''} key={`ctaurl-${bk}`}
                                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'ctaUrl', e.target.value)}
                                                        variant="editor"
                                                        className={hiddenCtaUrl ? `${editorInputClassName} ring-2 ring-red-500/70` : editorInputClassName}
                                                        placeholder={s.buttonUrl} />
                                                    {hiddenCtaUrl && (
                                                        <p className="flex items-center gap-1 text-[11px] text-red-400">
                                                            <AlertTriangle size={11} className="shrink-0" />
                                                            {hiddenCtaUrl === 'deleted' ? s.linkPageDeleted : hiddenCtaUrl === 'draft' ? s.linkPageDraft : hiddenCtaUrl === 'not-found' ? s.linkPageNotFound : s.linkPageHidden}
                                                        </p>
                                                    )}
                                                </>
                                            )
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* ─── Announcement Bar Settings ───────────────── */}
                            {bt === 'announcement-bar' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">Announcement Bar</label>

                                    {/* Content Configuration */}
                                    <div className="mt-3 rounded-xl overflow-hidden border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)]">
                                        <button type="button" onClick={() => setIsAnnContentOpen(v => !v)}
                                            className="flex w-full items-center justify-between h-11 px-3 hover:bg-white/[0.02] transition-colors">
                                            <span className="text-sm font-medium text-slate-100">Content Configuration</span>
                                            <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', isAnnContentOpen && 'rotate-180')} />
                                        </button>
                                        {isAnnContentOpen && (
                                            <div className="px-3 pb-3">
                                                <label className={labelCls}>Message:</label>
                                                <Textarea defaultValue={(block.message as string) || ''} rows={3} key={`msg-${bk}`}
                                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'message', e.target.value)}
                                                    variant="editor" className={editorTextareaClassName}
                                                    placeholder="Free shipping on all orders this week!" />
                                            </div>
                                        )}
                                    </div>

                                    {/* CTA Settings */}
                                    <div className="mt-4 rounded-xl overflow-hidden border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)]">
                                        <button type="button" onClick={() => setIsAnnCtaOpen(v => !v)}
                                            className="flex w-full items-center justify-between h-11 px-3 hover:bg-white/[0.02] transition-colors">
                                            <span className="text-sm font-medium text-slate-100">CTA Settings</span>
                                            <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', isAnnCtaOpen && 'rotate-180')} />
                                        </button>
                                        {isAnnCtaOpen && (
                                            <div className="px-3 pb-3 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Show Link/CTA:</span>
                                                    <button type="button"
                                                        onClick={() => {
                                                            const next = !annShowLink
                                                            setAnnShowLink(next)
                                                            onBlockUpdate(currentBlockIndex, { showLink: next })
                                                        }}
                                                        className={cn('relative h-6 w-11 rounded-full transition-colors', annShowLink ? 'bg-blue-500' : 'bg-slate-700')}
                                                    >
                                                        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', annShowLink ? 'left-6' : 'left-1')} />
                                                    </button>
                                                </div>
                                                {annShowLink && (
                                                    <>
                                                        <div>
                                                            <label className={labelCls}>Link Text:</label>
                                                            <Input defaultValue={(block.linkText as string) || ''} key={`lt-${bk}`}
                                                                onBlur={(e: FieldBlurEvent) => {
                                                                    const val = e.target.value
                                                                    if (containsHtml(val)) { e.target.value = (block.linkText as string) || ''; return }
                                                                    onBlockFieldChange(currentBlockIndex, 'linkText', val)
                                                                }}
                                                                variant="editor" className={editorInputClassName} placeholder="Shop Now →" />
                                                        </div>
                                                        <div>
                                                            <label className={labelCls}>Action:</label>
                                                            <select
                                                                value={(block.linkIsInternal as boolean) ? 'internal' : 'external'}
                                                                onChange={(e) => onBlockUpdate(currentBlockIndex, { linkIsInternal: e.target.value === 'internal' })}
                                                                className="mt-1.5 w-full rounded-lg bg-[#0b1120] border border-[rgba(59,130,246,0.1)] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                                            >
                                                                <option value="external">Style: External</option>
                                                                <option value="internal">Style: Internal Page</option>
                                                            </select>
                                                        </div>
                                                        {block.linkIsInternal ? (
                                                            <select
                                                                value={(block.linkUrl as string) || ''}
                                                                onChange={(e) => onBlockFieldChange(currentBlockIndex, 'linkUrl', e.target.value)}
                                                                className="w-full rounded-lg bg-[#0b1120] border border-[rgba(59,130,246,0.1)] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                                            >
                                                                <option value="">— select page —</option>
                                                                {pages?.map(p => (
                                                                    <option key={p.slug} value={p.slug.startsWith('/') ? p.slug : `/${p.slug}`}>{p.title || p.slug}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <Input defaultValue={(block.linkUrl as string) || ''} key={`lu-${bk}`}
                                                                onBlur={(e: FieldBlurEvent) => {
                                                                    const raw = e.target.value.trim()
                                                                    if (!raw) { onBlockFieldChange(currentBlockIndex, 'linkUrl', ''); return }
                                                                    if (containsHtml(raw) || !isValidUrl(raw)) {
                                                                        toast.error('Invalid URL: only http/https allowed')
                                                                        e.target.value = (block.linkUrl as string) || ''
                                                                        return
                                                                    }
                                                                    onBlockFieldChange(currentBlockIndex, 'linkUrl', raw)
                                                                }}
                                                                variant="editor" className="mt-1" placeholder="https://example.com" />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Appearance */}
                                    <div className="mt-4 rounded-xl overflow-hidden border border-[rgba(59,130,246,0.04)] bg-[rgba(30,41,59,0.3)]">
                                        <button type="button" onClick={() => setIsAnnAppearanceOpen(v => !v)}
                                            className="flex w-full items-center justify-between h-11 px-3 hover:bg-white/[0.02] transition-colors">
                                            <span className="text-sm font-medium text-slate-100">Appearance</span>
                                            <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', isAnnAppearanceOpen && 'rotate-180')} />
                                        </button>
                                        {isAnnAppearanceOpen && (
                                            <div className="px-3 pb-3 space-y-3">
                                                <div>
                                                    <label className={labelCls}>Bar Background Color {block.variant === 'gradient' ? '1 (Start):' : ':'}</label>
                                                    <div className="mt-1.5 flex gap-2">
                                                        <Input key={`bgc1-text-${bk}`}
                                                            defaultValue={(block.backgroundColor as string) || '#0ea5e9'}
                                                            placeholder="#0ea5e9"
                                                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'backgroundColor', e.target.value.trim())}
                                                            variant="editor" className="h-8 text-[12px]" />
                                                        <label className="relative h-8 w-12 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-[rgba(59,130,246,0.5)]" style={{ backgroundColor: (block.backgroundColor as string) || '#0ea5e9' }}>
                                                            <input type="color" key={`bgc1-${bk}`}
                                                                value={(block.backgroundColor as string) || '#0ea5e9'}
                                                                onChange={(e) => onBlockFieldChange(currentBlockIndex, 'backgroundColor', e.target.value)}
                                                                aria-label="Pick background color"
                                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                                                        </label>
                                                    </div>
                                                </div>
                                                {block.variant === 'gradient' && (
                                                    <div>
                                                        <label className={labelCls}>Bar Background Color 2 (End):</label>
                                                        <div className="mt-1.5 flex gap-2">
                                                            <Input key={`bgc2-text-${bk}`}
                                                                defaultValue={(block.backgroundColor2 as string) || '#d946ef'}
                                                                placeholder="#d946ef"
                                                                onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'backgroundColor2', e.target.value.trim())}
                                                                variant="editor" className="h-8 text-[12px]" />
                                                            <label className="relative h-8 w-12 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-[rgba(59,130,246,0.5)]" style={{ backgroundColor: (block.backgroundColor2 as string) || '#d946ef' }}>
                                                                <input type="color" key={`bgc2-${bk}`}
                                                                    value={(block.backgroundColor2 as string) || '#d946ef'}
                                                                    onChange={(e) => onBlockFieldChange(currentBlockIndex, 'backgroundColor2', e.target.value)}
                                                                    aria-label="Pick gradient end color"
                                                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className={labelCls}>Text Color:</label>
                                                    <div className="mt-1.5 flex gap-2">
                                                        <Input key={`tc-text-${bk}`}
                                                            defaultValue={(block.textColor as string) || '#ffffff'}
                                                            placeholder="#ffffff"
                                                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'textColor', e.target.value.trim())}
                                                            variant="editor" className="h-8 text-[12px]" />
                                                        <label className="relative h-8 w-12 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-[rgba(59,130,246,0.5)]" style={{ backgroundColor: (block.textColor as string) || '#ffffff' }}>
                                                            <input type="color" key={`tc-${bk}`}
                                                                value={(block.textColor as string) || '#ffffff'}
                                                                onChange={(e) => onBlockFieldChange(currentBlockIndex, 'textColor', e.target.value)}
                                                                aria-label="Pick text color"
                                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Layout & Spacing */}
                                    <div className="mt-4">
                                        <label className="text-xs font-medium uppercase text-gray-500 tracking-[0.6px]">Layout &amp; Spacing</label>
                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Top Spacing</span>
                                                    <span className="text-[10px] text-slate-500">{localPaddingTop}px</span>
                                                </div>
                                                <input type="range" min={0} max={120} step={4}
                                                    value={localPaddingTop}
                                                    onChange={(e) => setLocalPaddingTop(Number(e.target.value))}
                                                    onPointerUp={(e) => {
                                                        const val = Number((e.target as HTMLInputElement).value)
                                                        const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                        onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingTop: val } })
                                                    }}
                                                    className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Bottom Spacing</span>
                                                    <span className="text-[10px] text-slate-500">{localPaddingBottom}px</span>
                                                </div>
                                                <input type="range" min={0} max={120} step={4}
                                                    value={localPaddingBottom}
                                                    onChange={(e) => setLocalPaddingBottom(Number(e.target.value))}
                                                    onPointerUp={(e) => {
                                                        const val = Number((e.target as HTMLInputElement).value)
                                                        const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                        onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingBottom: val } })
                                                    }}
                                                    className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── CTA Block Secondary Button ──────────────── */}
                            {bt === 'cta' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.secondaryButton}</label>
                                    {block.secondaryCtaLabel ? (
                                        <>
                                            <div className="mt-2 space-y-2">
                                                <Input defaultValue={stripHtmlForDisplay(block.secondaryCtaLabel as string)} key={`sec-lbl-${bk}`}
                                                    placeholder={s.buttonText}
                                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'secondaryCtaLabel', e.target.value.trim())}
                                                    variant="editor" className={editorInputClassName} />
                                                <Input defaultValue={(block.secondaryCtaUrl as string) || ''} key={`sec-url-${bk}`}
                                                    placeholder={s.buttonUrl}
                                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'secondaryCtaUrl', e.target.value.trim())}
                                                    variant="editor" className={editorInputClassName} />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onBlockUpdate(currentBlockIndex, { secondaryCtaLabel: '', secondaryCtaUrl: '' })}
                                                aria-label="Remove secondary button"
                                                className="mt-2 w-full rounded-lg bg-red-500/10 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                                            ><X className="mr-1 inline-block h-3 w-3 align-text-bottom" aria-hidden />{s.removeButton}</button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onBlockUpdate(currentBlockIndex, { secondaryCtaLabel: 'Learn More', secondaryCtaUrl: '#' })}
                                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
                                        >{s.addButton}</button>
                                    )}
                                </div>
                            )}

                            {block.copyrightText !== undefined && (
                                <div>
                                    <label className={labelCls}>{s.copyright}</label>
                                    <Input defaultValue={block.copyrightText as string} key={`copy-${bk}`}
                                        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'copyrightText', e.target.value)}
                                        variant="editor"
                                        className={editorInputClassName} />
                                </div>
                            )}

                            {/* ─── Hero CTA Buttons ───────────────────────── */}
                            {bt === 'hero' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.ctaButtons}</label>
                                    {((block.ctaButtons || []) as CtaButton[]).length === 0 && (
                                        <p className="mt-2 text-xs text-gray-500 italic">{s.noButtons}</p>
                                    )}
                                    {((block.ctaButtons || []) as CtaButton[]).map((btn, i) => (
                                        <div key={`cta-${btn.label}-${btn.url}-${i}`} className="mt-3 rounded-lg bg-white/5 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500">{ti(s.buttonN, { n: i + 1 })}</span>
                                                <button onClick={() => removeArrayItem('ctaButtons', i)} aria-label={`Remove button ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300"><X className="h-4 w-4" aria-hidden /></button>
                                            </div>
                                            <Input defaultValue={stripHtmlForDisplay(btn.label)} placeholder={s.label}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('ctaButtons', i, 'label', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                            {(() => {
                                                const hiddenBtn = checkHiddenPageUrl(btn.url, pages)
                                                return (
                                                    <>
                                                        <Input defaultValue={btn.url || ''} placeholder={s.url}
                                                            onBlur={(e: FieldBlurEvent) => updateArrayItem('ctaButtons', i, 'url', e.target.value)}
                                                            variant="editor"
                                                            className={hiddenBtn ? `${editorInputClassName} ring-2 ring-red-500/70` : editorInputClassName} />
                                                        {hiddenBtn && (
                                                            <p className="flex items-center gap-1 text-[11px] text-red-400">
                                                                <AlertTriangle size={11} className="shrink-0" />
                                                                {hiddenBtn === 'deleted' ? s.linkPageDeleted : hiddenBtn === 'draft' ? s.linkPageDraft : hiddenBtn === 'not-found' ? s.linkPageNotFound : s.linkPageHidden}
                                                            </p>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => addArrayItem('ctaButtons', { label: 'New Button', url: '#', style: 'primary' })}
                                        disabled={((block.ctaButtons || []) as CtaButton[]).length >= 2}
                                        className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >{s.addButton}</button>
                                </div>
                            )}

                            {/* ─── Navigation Links ───────────────────────── */}
                            {bt === 'navigation' && (
                                <div className={sectionCls}>
                                    <NavigationEditor
                                        links={normalizeNavLinkItems((block.links || []) as Array<Record<string, unknown>>, pages)}
                                        onUpdate={(links) => onBlockUpdate(currentBlockIndex, { links })}
                                        pages={pages}
                                    />
                                    {/* Nav CTA */}
                                    {!!block.ctaButton && (
                                        <div className="mt-3">
                                            <label className={labelCls}>{s.ctaButton}</label>
                                            <Input defaultValue={stripHtmlForDisplay((block.ctaButton as CtaButton)?.label)} placeholder={s.buttonText}
                                                onBlur={(e: FieldBlurEvent) => onBlockUpdate(currentBlockIndex, { ctaButton: { ...(block.ctaButton as CtaButton), label: e.target.value } })}
                                                variant="editor"
                                                className={editorInputClassName} />
                                            {(() => {
                                                const navBtnUrl = (block.ctaButton as CtaButton)?.url
                                                const hiddenNavBtn = checkHiddenPageUrl(navBtnUrl, pages)
                                                return (
                                                    <>
                                                        <Input defaultValue={navBtnUrl || ''} placeholder={s.buttonUrl}
                                                            onBlur={(e: FieldBlurEvent) => onBlockUpdate(currentBlockIndex, { ctaButton: { ...(block.ctaButton as CtaButton), url: e.target.value } })}
                                                            variant="editor"
                                                            className={hiddenNavBtn ? `${editorInputClassName} ring-2 ring-red-500/70` : editorInputClassName} />
                                                        {hiddenNavBtn && (
                                                            <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                                                                <AlertTriangle size={11} className="shrink-0" />
                                                                {hiddenNavBtn === 'deleted' ? s.linkPageDeleted : hiddenNavBtn === 'draft' ? s.linkPageDraft : hiddenNavBtn === 'not-found' ? s.linkPageNotFound : s.linkPageHidden}
                                                            </p>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Features Items ─────────────────────────── */}
                            {bt === 'features' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.features} ({((block.features || []) as FeatureItem[]).length})</label>
                                    {((block.features || []) as FeatureItem[]).map((feat, i) => (
                                        <div key={`feat-${feat.title}-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500">{feat.icon || '✦'} {ti(s.featureN, { n: i + 1 })}</span>
                                                <button onClick={() => removeArrayItem('features', i)} aria-label={`Remove feature ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300"><X className="h-4 w-4" aria-hidden /></button>
                                            </div>
                                            <Input defaultValue={feat.title || ''} placeholder={s.title}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('features', i, 'title', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                            <Textarea defaultValue={feat.description || ''} rows={2} placeholder={s.description}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('features', i, 'description', e.target.value)}
                                                variant="editor"
                                                className={editorTextareaClassName} />
                                            <Input defaultValue={feat.icon || ''} placeholder={s.icon}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('features', i, 'icon', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                        </div>
                                    ))}
                                    <button onClick={() => addArrayItem('features', { title: 'New Feature', description: '', icon: '✦' })}
                                        className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">{s.addFeature}</button>
                                </div>
                            )}

                            {/* ─── Testimonials ───────────────────────────── */}
                            {bt === 'testimonials' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.testimonials} ({((block.testimonials || []) as TestimonialItem[]).length})</label>
                                    {((block.testimonials || []) as TestimonialItem[]).map((item, i) => (
                                        <div key={`test-${item.name}-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500">{ti(s.reviewN, { n: i + 1 })}</span>
                                                <button onClick={() => removeArrayItem('testimonials', i)} aria-label={`Remove testimonial ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300"><X className="h-4 w-4" aria-hidden /></button>
                                            </div>
                                            <Input defaultValue={item.name || ''} placeholder={s.name}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('testimonials', i, 'name', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                            <Input defaultValue={item.title || ''} placeholder={s.titleRole}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('testimonials', i, 'title', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                            <Textarea defaultValue={item.quote || ''} rows={2} placeholder={s.quote}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('testimonials', i, 'quote', e.target.value)}
                                                variant="editor"
                                                className={editorTextareaClassName} />
                                        </div>
                                    ))}
                                    <button onClick={() => addArrayItem('testimonials', { name: s.defaultCustomerName, title: '', quote: s.defaultReviewQuote, rating: 5 })}
                                        className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">{s.addTestimonial}</button>
                                </div>
                            )}


                            {/* ─── Feature Comparison Products + Features ──── */}
                            {bt === 'feature-comparison' && block && (
                                <>
                                    <FeatureComparisonSettings
                                        block={block as FeatureComparisonConfig}
                                        blockIndex={currentBlockIndex}
                                        onBlockUpdate={onBlockUpdate}
                                    />
                                    {/* Layout & Spacing — after comparison content, mirrors pricing pattern */}
                                    <div className={sectionCls}>
                                        <label className="text-xs font-medium uppercase text-gray-500">Layout & Spacing</label>
                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Top Spacing</span>
                                                    <span className="text-[10px] text-slate-500">{localPaddingTop}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0} max={120} step={4}
                                                    value={localPaddingTop}
                                                    onChange={(e) => setLocalPaddingTop(Number(e.target.value))}
                                                    onPointerUp={(e) => {
                                                        const val = Number((e.target as HTMLInputElement).value)
                                                        const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                        onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingTop: val } })
                                                    }}
                                                    className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Bottom Spacing</span>
                                                    <span className="text-[10px] text-slate-500">{localPaddingBottom}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0} max={120} step={4}
                                                    value={localPaddingBottom}
                                                    onChange={(e) => setLocalPaddingBottom(Number(e.target.value))}
                                                    onPointerUp={(e) => {
                                                        const val = Number((e.target as HTMLInputElement).value)
                                                        const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                        onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingBottom: val } })
                                                    }}
                                                    className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ─── Menu Food Categories ─────────────────────── */}
                            {bt === 'menu-food' && (() => {
                                const categories = (block.categories || []) as MenuCategory[]
                                return (
                                    <div className={sectionCls}>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{s.categoriesLabel}</p>
                                        {categories.map((cat, ci) => (
                                            <div key={`mf-cat-${ci}`} className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2">
                                                <div className="mb-1 flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-300">{ti(s.categoryN, { n: ci + 1 })}</span>
                                                    <button type="button" aria-label={`Remove category ${ci + 1}`} onClick={() => removeArrayItem('categories', ci)}
                                                        className="text-xs text-red-400 hover:text-red-300 transition-colors"><X className="h-4 w-4" aria-hidden /></button>
                                                </div>
                                                <Input defaultValue={plainText(cat.name)} placeholder={s.name}
                                                    onFocus={() => { focusedBlockIndexRef.current = currentBlockIndex }}
                                                    onBlur={(e: FieldBlurEvent) => { if (focusedBlockIndexRef.current === currentBlockIndex) updateArrayItem('categories', ci, 'name', e.target.value) }}
                                                    variant="editor" className={editorInputClassName} />
                                                {/* Items */}
                                                <p className="mt-2 mb-1 text-xs font-medium text-[#94a3b8]">{s.itemsLabel}</p>
                                                {(cat.items || []).map((item: MenuItem, ii: number) => (
                                                    <div key={`mf-item-${ci}-${ii}`} className="mb-2 rounded border border-white/5 bg-black/20 p-2">
                                                        <div className="mb-1 flex items-center justify-between">
                                                            <span className="text-[11px] text-gray-400">{ti(s.menuItemN, { n: ii + 1 })}</span>
                                                            <button type="button" aria-label={`Remove item ${ii + 1} from category ${ci + 1}`} onClick={() => removeNestedItem('categories', ci, ii)}
                                                                className="text-xs text-red-400 hover:text-red-300 transition-colors"><X className="h-4 w-4" aria-hidden /></button>
                                                        </div>
                                                        <Input defaultValue={plainText(item.name)} placeholder={s.name}
                                                            onFocus={() => { focusedBlockIndexRef.current = currentBlockIndex }}
                                                            onBlur={(e: FieldBlurEvent) => { if (focusedBlockIndexRef.current === currentBlockIndex) updateNestedItem('categories', ci, ii, 'name', e.target.value) }}
                                                            variant="editor" className={editorInputClassName} />
                                                        <Input defaultValue={plainText(item.description || '')} placeholder={s.description}
                                                            onFocus={() => { focusedBlockIndexRef.current = currentBlockIndex }}
                                                            onBlur={(e: FieldBlurEvent) => { if (focusedBlockIndexRef.current === currentBlockIndex) updateNestedItem('categories', ci, ii, 'description', e.target.value || undefined) }}
                                                            variant="editor" className={cn(editorInputClassName, 'mt-1')} />
                                                        <Input defaultValue={item.price} placeholder={s.price}
                                                            onFocus={() => { focusedBlockIndexRef.current = currentBlockIndex }}
                                                            onBlur={(e: FieldBlurEvent) => { if (focusedBlockIndexRef.current === currentBlockIndex) updateNestedItem('categories', ci, ii, 'price', e.target.value) }}
                                                            variant="editor" className={cn(editorInputClassName, 'mt-1')} />
                                                        <Input defaultValue={item.currency || ''} placeholder={s.currency}
                                                            onFocus={() => { focusedBlockIndexRef.current = currentBlockIndex }}
                                                            onBlur={(e: FieldBlurEvent) => { if (focusedBlockIndexRef.current === currentBlockIndex) updateNestedItem('categories', ci, ii, 'currency', e.target.value || undefined) }}
                                                            variant="editor" className={cn(editorInputClassName, 'mt-1')} />
                                                        <Input defaultValue={item.tag || ''} placeholder={s.tag}
                                                            onFocus={() => { focusedBlockIndexRef.current = currentBlockIndex }}
                                                            onBlur={(e: FieldBlurEvent) => { if (focusedBlockIndexRef.current === currentBlockIndex) updateNestedItem('categories', ci, ii, 'tag', e.target.value || undefined) }}
                                                            variant="editor" className={cn(editorInputClassName, 'mt-1')} />
                                                        <div className="mt-1.5">
                                                            <BlockImageEditor
                                                                imageUrl={
                                                                    typeof item.image === 'object' && item.image !== null
                                                                        ? (item.image as { url?: string }).url ?? ''
                                                                        : typeof item.image === 'string' ? item.image : ''
                                                                }
                                                                altText={
                                                                    typeof item.image === 'object' && item.image !== null
                                                                        ? (item.image as { alt?: string }).alt ?? ''
                                                                        : ''
                                                                }
                                                                onImageChange={(id, url) => {
                                                                    focusedBlockIndexRef.current = currentBlockIndex
                                                                    const prev = typeof item.image === 'object' && item.image !== null ? item.image as { alt?: string } : {}
                                                                    updateNestedItem('categories', ci, ii, 'image', { id, url, alt: prev.alt ?? '' })
                                                                }}
                                                                onAltTextChange={(alt) => {
                                                                    const prev = typeof item.image === 'object' && item.image !== null ? item.image as { id?: number; url?: string } : {}
                                                                    updateNestedItem('categories', ci, ii, 'image', { id: prev.id, url: prev.url, alt })
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => addNestedItem('categories', ci, { name: 'New Item', description: '', price: '', currency: 'RM', tag: '', image: null })}
                                                    className="mt-1 w-full rounded bg-blue-500/10 py-1 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">{s.addMenuItem}</button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addArrayItem('categories', { name: 'New Category', items: [] })}
                                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">{s.addCategory}</button>
                                    </div>
                                )
                            })()}

                            {/* ─── Step Process Configuration ─────────────── */}
                            {bt === 'step-process' && (() => {
                                const steps = (block.steps || []) as StepItem[]
                                const count = steps.length
                                return (
                                    <div className={sectionCls}>
                                        <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setIsStepConfigOpen(!isStepConfigOpen)}
                                                className="w-full flex items-center justify-between px-3 h-12"
                                            >
                                                <span className="text-sm font-medium text-white">{s.stepConfiguration}</span>
                                                <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isStepConfigOpen && 'rotate-180')} />
                                            </button>
                                            {isStepConfigOpen && (
                                                <div className="px-3 pb-3">
                                                    <div className="flex gap-4 items-center">
                                                        <div className="w-[100px] shrink-0">
                                                            <p className="text-[12px] font-medium text-[#94a3b8] leading-4">{s.numberOfSteps}</p>
                                                            <p className="text-[10px] text-[#94a3b8] leading-4">{s.stepsMinMax}</p>
                                                        </div>
                                                        <div className="flex flex-1 items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                aria-label="Decrease step count"
                                                                disabled={count <= 3}
                                                                onClick={() => onBlockUpdate(currentBlockIndex, { steps: steps.slice(0, -1) })}
                                                                className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] text-white text-sm font-medium disabled:opacity-30 hover:bg-white/5 transition-colors"
                                                            >−</button>
                                                            {/* count may display < 3 if block was set externally; − is disabled so it cannot go lower */}
                                                            <div className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#1f2937] flex items-center justify-center text-white text-sm font-medium">
                                                                {count}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                aria-label="Increase step count"
                                                                disabled={count >= 10}
                                                                onClick={() => {
                                                                    const n = count + 1
                                                                    const stepEmojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
                                                                    onBlockUpdate(currentBlockIndex, {
                                                                        steps: [...steps, { title: `Step ${n}`, description: `Description ${n}`, icon: stepEmojis[n - 1] ?? String(n) }]
                                                                    })
                                                                }}
                                                                className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#0b1120] text-white text-sm font-medium disabled:opacity-30 hover:bg-white/10 transition-colors"
                                                            >+</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })()}

                            {bt === 'pricing' && block && (
                                <>
                                    <PricingSettings
                                        block={block as PricingConfig}
                                        blockIndex={currentBlockIndex}
                                        onBlockUpdate={onBlockUpdate}
                                        pages={pages}
                                    />
                                    {/* Layout & Spacing — pricing-specific position (after Plans Management) */}
                                    <div className={sectionCls}>
                                        <label className="text-xs font-medium uppercase text-gray-500">Layout & Spacing</label>
                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Top Spacing</span>
                                                    <span className="text-[10px] text-slate-500">{localPaddingTop}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0} max={120} step={4}
                                                    value={localPaddingTop}
                                                    onChange={(e) => setLocalPaddingTop(Number(e.target.value))}
                                                    onPointerUp={(e) => {
                                                        const val = Number((e.target as HTMLInputElement).value)
                                                        const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                        onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingTop: val } })
                                                    }}
                                                    className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className={labelCls}>Bottom Spacing</span>
                                                    <span className="text-[10px] text-slate-500">{localPaddingBottom}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={0} max={120} step={4}
                                                    value={localPaddingBottom}
                                                    onChange={(e) => setLocalPaddingBottom(Number(e.target.value))}
                                                    onPointerUp={(e) => {
                                                        const val = Number((e.target as HTMLInputElement).value)
                                                        const prevSpacing = ((block.blockSpacing as Record<string, unknown>) || {})
                                                        onBlockUpdate(currentBlockIndex, { blockSpacing: { ...prevSpacing, paddingBottom: val } })
                                                    }}
                                                    className="mt-2 w-full cursor-pointer appearance-none bg-transparent border-0 outline-none p-0 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-xl [&::-webkit-slider-runnable-track]:bg-[#1e293b] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[1.5px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2dd4bf] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-xl [&::-moz-range-track]:bg-[#1e293b] [&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[#2dd4bf]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ─── FAQ Configuration ───────────────────────── */}
                            {bt === 'faq' && block && (
                                <FaqSettings
                                    block={block as FAQConfig}
                                    blockIndex={currentBlockIndex}
                                    onBlockUpdate={onBlockUpdate}
                                />
                            )}

                            {bt === 'team' && block && (
                                <TeamSettings
                                    block={block as TeamConfig}
                                    blockIndex={currentBlockIndex}
                                    onBlockUpdate={onBlockUpdate}
                                />
                            )}

                            {bt === 'socialWidget' && (
                                <div className={sectionCls}>
                                    {(() => {
                                        const normalizedSocialBlock = normalizeSocialWidgetConfig((effectiveBlock ?? block) as Record<string, unknown>)

                                        return (
                                            <>
                                                <label className="text-xs font-medium uppercase text-gray-500">{s.socialWidget}</label>
                                                <div className="mt-3 space-y-3">
                                                    <div>
                                                        <label className={labelCls}>{s.headline}</label>
                                                        <Input
                                                            defaultValue={(normalizedSocialBlock.headline as string) || ''}
                                                            onBlur={(e: FieldBlurEvent) => handleBlockFieldChange('headline', e.target.value)}
                                                            variant="editor"
                                                            className={editorInputClassName}
                                                            placeholder={s.stayConnected}
                                                        />
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                                                            {s.platforms}
                                                        </p>
                                                        <p className="mt-2 text-xs text-slate-400">
                                                            {s.platformsDesc}
                                                        </p>
                                                    </div>
                                                    {(normalizedSocialBlock.links as SocialWidgetLink[]).map((link, i) => (
                                                        <div key={`social-${i}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 space-y-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-3">
                                                                    <span
                                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-[11px] font-black uppercase tracking-[0.04em]"
                                                                        style={{
                                                                            color: SOCIAL_PLATFORM_META[link.platform].accent,
                                                                            borderColor: `${SOCIAL_PLATFORM_META[link.platform].accent}22`,
                                                                        }}
                                                                    >
                                                                        {SOCIAL_PLATFORM_META[link.platform].mark}
                                                                    </span>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-white">
                                                                            {(s.socialPlatforms as Record<string, { label: string }>)[link.platform]?.label || link.platform}
                                                                        </p>
                                                                        <p className="text-[11px] text-slate-500">
                                                                            {link.platform === 'whatsapp' ? s.socialHintWhatsapp : s.socialHintDefault}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateArrayItem('links', i, 'enabled', link.enabled === false)}
                                                                    className={cn(
                                                                        'rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
                                                                        link.enabled === false
                                                                            ? 'bg-white/10 text-slate-400'
                                                                            : 'bg-green-500/15 text-green-300',
                                                                    )}
                                                                >
                                                                    {link.enabled === false ? s.hidden : s.visible}
                                                                </button>
                                                            </div>
                                                            <Input
                                                                defaultValue={link.url || ''}
                                                                placeholder={(s.socialPlatforms as Record<string, { placeholder: string }>)[link.platform]?.placeholder || ''}
                                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('links', i, 'url', e.target.value)}
                                                                variant="editor"
                                                                className={editorInputClassName}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )
                                    })()}
                                </div>
                            )}

                            {bt === 'cartWidget' && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.cartWidget}</label>
                                    <div className="mt-3 space-y-3">
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                                                {s.checkoutBehavior}
                                            </p>
                                            <p className="mt-2 text-xs text-slate-400">
                                                {s.checkoutDesc}
                                            </p>
                                        </div>
                                        <div>
                                            <label className={labelCls}>{s.buttonLabel}</label>
                                            <Input
                                                defaultValue={(effectiveBlock?.label as string) || s.cart}
                                                onBlur={(e: FieldBlurEvent) => handleBlockFieldChange('label', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName}
                                                placeholder={s.cart}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>{s.showTextLabel}</label>
                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleBlockUpdate({ showLabel: !effectiveBlock?.showLabel })}
                                                    className={cn(
                                                        'rounded-full px-3 py-2 text-xs font-medium transition-colors',
                                                        effectiveBlock?.showLabel
                                                            ? 'bg-blue-500/15 text-blue-300'
                                                            : 'bg-white/5 text-slate-400 hover:bg-white/10',
                                                    )}
                                                >
                                                    {effectiveBlock?.showLabel ? s.labelVisible : s.iconOnly}
                                                </button>
                                                <span className="text-[11px] text-slate-500">
                                                    {s.badgeDesc}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── WhatsApp Button Settings ───────────────── */}
                            {bt === 'whatsapp-button' && (
                                <div className={sectionCls}>
                                    <div className="space-y-3">
                                        {/* Phone number with country picker */}
                                        <div>
                                            <label className={labelCls}>{s.phone}</label>
                                            {(() => {
                                                const waCode = (effectiveBlock?.countryCode as string) || '+60'
                                                const waCountry = PHONE_COUNTRIES.find(c => c.code === waCode) ?? PHONE_COUNTRIES[0]
                                                const phoneVal = (effectiveBlock?.phoneNumber as string) || ''
                                                const phoneEmpty = !phoneVal
                                                const phoneTouched = phoneTouchedSet.has(bk)
                                                const showPhoneError = phoneEmpty && phoneTouched
                                                return (
                                                    <>
                                                        <div className={cn('mt-1.5 flex h-[44px] items-center gap-3 rounded-[10px] border bg-[#0b1120] px-[6px] py-[4px]', showPhoneError ? 'border-red-500/50' : 'border-[rgba(59,130,246,0.04)]')}>
                                                            <PhoneCountryPicker
                                                                value={waCode}
                                                                onChange={code => {
                                                                    handleBlockFieldChange('countryCode', code)
                                                                }}
                                                            />
                                                            <div className="h-[31px] w-px shrink-0 bg-white/10" />
                                                            <input
                                                                key={`wa-phone-${bk}-${waCode}`}
                                                                defaultValue={preparePhoneForDisplay(phoneVal, waCode)}
                                                                onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                                                    const v = e.target.value.trim()
                                                                    setPhoneTouchedSet(prev => new Set(prev).add(bk))
                                                                    if (v && /[a-zA-Z]/.test(v)) {
                                                                        toast.error(t.editor.settingsValidation.invalidPhone)
                                                                        return
                                                                    }
                                                                    handleBlockFieldChange('phoneNumber', v)
                                                                }}
                                                                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#fafafa] placeholder:text-[#64748B] focus:outline-none"
                                                                placeholder={waCountry.placeholder}
                                                            />
                                                        </div>
                                                        {showPhoneError && (
                                                            <p className="mt-1 text-[11px] text-red-400">{t.editor.settingsValidation.phoneRequired}</p>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </div>
                                        <div>
                                            <label className={labelCls}>{s.whatsappPosition}</label>
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                {(['bottom-right', 'bottom-left'] as const).map(pos => (
                                                    <button
                                                        key={pos}
                                                        type="button"
                                                        onClick={() => handleBlockUpdate({ position: pos })}
                                                        className={cn(
                                                            'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
                                                            ((effectiveBlock?.position ?? block?.position) || 'bottom-right') === pos
                                                                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                                                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
                                                        )}
                                                    >
                                                        {pos === 'bottom-right' ? '↘ Right' : '↙ Left'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Image Editor — for blocks with image/backgroundImage fields */}
                            {block && (block.image || block.backgroundImage || block.heroImage) && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">Image</label>
                                    <div className="mt-2">
                                        <BlockImageEditor
                                            imageUrl={(() => { const v = block.image || block.backgroundImage || block.heroImage; return v && typeof v === 'object' && 'url' in (v as Record<string,unknown>) ? String((v as Record<string,unknown>).url) : String(v || '') })()}
                                            altText={String(block.imageAlt || block.alt || '')}
                                            onImageChange={(id, url) => {
                                                const field = block.image ? 'image' : block.backgroundImage ? 'backgroundImage' : 'heroImage'
                                                const altField = block.imageAlt !== undefined ? 'imageAlt' : 'alt'
                                                onBlockUpdate(currentBlockIndex, { [field]: { id, url }, [altField]: String(block.imageAlt || block.alt || '') })
                                            }}
                                            onAltTextChange={(alt) => {
                                                const field = block.imageAlt !== undefined ? 'imageAlt' : 'alt'
                                                onBlockFieldChange(currentBlockIndex, field, alt)
                                            }}
                                        />
                                    </div>
                                </div>
                            )}



                            {/* Theme editing removed from Block tab — available in Global tab */}
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export const SettingsPanel = memo(SettingsPanelInner)
