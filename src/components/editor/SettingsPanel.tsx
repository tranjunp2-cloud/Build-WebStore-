'use client'

import React, { memo, useEffect, useMemo, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronDown, Globe2, Loader2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NavigationEditor, type NavLinkItem } from './NavigationEditor'
import { LogoEditor } from './LogoEditor'
import { OgImageEditor } from './og-image-editor'
import { BlockImageEditor } from './BlockImageEditor'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { BreadcrumbEditor } from './BreadcrumbEditor'
import { FooterLinkEditor } from './footer-link-editor'
import { SOCIAL_ICONS } from '@/blocks/shared/social-icons'
import type { BlockData, ThemeData, CtaButton, NavLink, FeatureItem, TestimonialItem, FooterColumn } from '@/types/editor'
import type { PageData } from '@/store/editorStore'
import { useI18n } from '@/i18n'
import { useEditorStore } from '@/store/editorStore'
import { toast } from 'sonner'

/** Strip HTML tags for display in text inputs (block fields may contain inline formatting) */
function stripHtmlForDisplay(value: unknown): string {
    if (!value || typeof value !== 'string') return ''
    return value.replace(/<[^>]*>/g, '')
}

/** Strip HTML tags from input to prevent XSS */
function sanitizeInput(value: string): string {
    return value.replace(/<[^>]*>/g, '').trim()
}

/** Check if input contains HTML/script injection */
function containsHtml(value: string): boolean {
    return /<[^>]*>/i.test(value)
}

/** Validate URL format — only allow http/https */
function isValidUrl(value: string): boolean {
    if (!value) return true
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
const FONT_OPTIONS = ['Outfit', 'Inter', 'DM Sans', 'Playfair Display', 'Roboto', 'Poppins', 'Plus Jakarta Sans']
const labelCls = "text-[11px] font-medium text-slate-400"
const sectionCls = "border-t border-white/10 pt-4"
// Hide newsletter variants from footer UI — feature not ready for users
const FOOTER_HIDDEN_VARIANTS = new Set(['expanded', 'mega-footer'])

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
}

// ─── Component ──────────────────────────────────────────────────────────
function SettingsPanelInner({
    block, blockIndex, theme, site, siteName, siteStatus, headerBlock, footerBlock, pages, currentPageId,
    onThemeChange, onBlockFieldChange, onBlockUpdate,
    onHeaderUpdate, onFooterUpdate, onLogoChange, onSiteSettingsChange, onPageUpdate,
    requestedTab,
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

    const [localPaddingTop, setLocalPaddingTop] = useState(() => Number((block?.blockSpacing as Record<string, unknown>)?.paddingTop ?? 32))
    const [localPaddingBottom, setLocalPaddingBottom] = useState(() => Number((block?.blockSpacing as Record<string, unknown>)?.paddingBottom ?? 32))
    useEffect(() => {
        setLocalPaddingTop(Number((block?.blockSpacing as Record<string, unknown>)?.paddingTop ?? 32))
        setLocalPaddingBottom(Number((block?.blockSpacing as Record<string, unknown>)?.paddingBottom ?? 32))
    }, [block?.blockSpacing])

    // Resolve navigation links: prefer headerBlock.links, fallback to layout nav block
    const storeBlocks = useEditorStore(state => state.blocks)
    // Breadcrumb config stored globally in headerBlock.breadcrumbConfig
    const breadcrumbCfg = (headerBlock as Record<string, unknown> | null | undefined)?.breadcrumbConfig as
        { homeLabel?: string; separator?: string; showOnAllPages?: boolean } | undefined
    const resolvedNavLinks = useMemo(() => {
        const headerLinks = (((headerBlock as Record<string, unknown>)?.links as Array<Record<string, unknown>>) || [])
        if (headerLinks.length > 0) return normalizeNavLinkItems(headerLinks, pages)
        // Fallback: find navigation block in page layout
        const navBlock = Array.isArray(storeBlocks) ? storeBlocks.find(b => (b as Record<string, unknown>).blockType === 'navigation') : undefined
        const navLinks = (((navBlock as Record<string, unknown>)?.links as Array<Record<string, unknown>>) || [])
        return normalizeNavLinkItems(navLinks, pages)
    }, [headerBlock, pages, storeBlocks])

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
    const [isUploadingFooterLogo, setIsUploadingFooterLogo] = useState(false)
    const footerLogoRef = React.useRef<HTMLInputElement>(null)
    const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
    const [seoSlugInput, setSeoSlugInput] = useState('')
    const [seoTitleInput, setSeoTitleInput] = useState('')
    const [seoDescriptionInput, setSeoDescriptionInput] = useState('')
    const [seoFieldError, setSeoFieldError] = useState<string | null>(null)

    const breadcrumbSectionRef = React.useRef<HTMLDivElement>(null)
    const breadcrumbScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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
            return () => {
                if (breadcrumbScrollTimerRef.current) clearTimeout(breadcrumbScrollTimerRef.current)
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
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            </div>
            <div>
                <label className="text-xs text-gray-400">{s.bodyFont}</label>
                <select value={(theme.fontBody as string) || 'Inter'} onChange={e => onThemeChange('fontBody', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
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
                        currentOgImage={typeof site?.seo?.ogImage === 'string' ? site.seo.ogImage : null}
                        onOgImageChange={(url) => {
                            void onSiteSettingsChange?.({ seo: { ...siteSeo, ogImage: url } })
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
                            <span>✨</span>
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
        const menuHeaderLogoRaw = (headerBlock as Record<string, unknown>)?.logo
        const menuHeaderLogo =
            (typeof menuHeaderLogoRaw === 'string'
                ? menuHeaderLogoRaw
                : (menuHeaderLogoRaw as { url?: string } | undefined)?.url) || null
        return (
            <div className="space-y-5">
                {/* Logo Editor (AC-2) */}
                <LogoEditor
                    currentLogo={menuHeaderLogo}
                    onLogoChange={(logoUrl, faviconUrl) => {
                        const changes: Record<string, unknown> = {
                            logo: logoUrl ? { url: logoUrl, alt: '' } : null,
                        }
                        if (faviconUrl) {
                            changes.favicon = faviconUrl
                        } else if (!logoUrl) {
                            changes.favicon = ''
                        }
                        onHeaderUpdate?.(changes)
                        if (onLogoChange) onLogoChange(logoUrl, faviconUrl)
                    }}
                />

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

                {/* ─── Nav CTA Button ──────────────────────────────────── */}
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
                        <Input
                            key={`nav-cta-url-${((headerBlock?.ctaButton as Record<string, unknown>)?.url as string) || ''}`}
                            defaultValue={((headerBlock?.ctaButton as Record<string, unknown>)?.url as string) || ''}
                            placeholder={s.navCtaUrl}
                            variant="editor"
                            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                const raw = e.target.value.trim()
                                const current = (headerBlock?.ctaButton as Record<string, unknown>) || { show: true, label: '', url: '' }
                                // Block javascript:/data:/vbscript: URIs — relative paths (/contact, #section) are allowed.
                                if (raw && /^(javascript|data|vbscript):/i.test(raw)) {
                                    toast.error(s.invalidSocialUrl)
                                    e.target.value = (current.url as string) || ''
                                    return
                                }
                                onHeaderUpdate?.({ ctaButton: { ...current, url: raw } })
                            }}
                        />
                    </div>
                </div>

                {/* Navigation Editor (AC-1) */}
                <div className={sectionCls}>
                    <NavigationEditor
                        links={resolvedNavLinks}
                        onUpdate={(links) => onHeaderUpdate?.({ links })}
                        pages={pages}
                    />
                </div>

                {/* ─── Breadcrumb Settings ─────────────────────────────────── */}
                <div ref={breadcrumbSectionRef} className={sectionCls}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-base leading-none">🍞</span>
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
                    <div className={sectionCls}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-base leading-none">🎨</span>
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
                                <span>🏢 {s.brandLogo}</span>
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
                                key={`footer-copyright-${fbk}`}
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

    // Helper: update item in an array field
    const updateArrayItem = (field: string, index: number, key: string, val: unknown) => {
        const arr = [...(((block?.[field] as Record<string, unknown>[] | undefined) || []))]
        arr[index] = { ...arr[index], [key]: val }
        onBlockUpdate(currentBlockIndex, { [field]: arr })
    }

    // Helper: add item to array field
    const addArrayItem = (field: string, template: Record<string, unknown>) => {
        const arr = [...(((block?.[field] as Record<string, unknown>[] | undefined) || [])), template]
        onBlockUpdate(currentBlockIndex, { [field]: arr })
    }

    // Helper: remove item from array field
    const removeArrayItem = (field: string, index: number) => {
        const arr = (((block?.[field] as Record<string, unknown>[] | undefined) || [])).filter((_: unknown, i: number) => i !== index)
        onBlockUpdate(currentBlockIndex, { [field]: arr })
    }

    const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; disabled?: boolean }> = [
        { id: 'global', label: s.tabGlobal, icon: <span aria-hidden="true" className="text-[15px] leading-none">⚙️</span> },
        { id: 'seo', label: s.tabSeo, icon: <span aria-hidden="true" className="text-[15px] leading-none">🔍</span> },
        { id: 'menu', label: s.tabMenu, icon: <span aria-hidden="true" className="text-[15px] leading-none">🧭</span> },
        { id: 'block', label: s.tabBlock, icon: <span aria-hidden="true" className="text-[15px] leading-none">🎨</span>, disabled: !block },
    ]

    return (
        <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/5 bg-[#111827]">
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

            <div className="flex-1 overflow-y-auto px-4 py-5">
                <div className="mb-6">
                    <div className="flex items-start gap-4">
                        <div>
                            <div className="flex items-start gap-2">
                                <span className="text-[16px] font-semibold leading-6 text-[#2DD4BF]">
                                    {activeTab === 'global' ? '⚙️' : activeTab === 'seo' ? '🔍' : activeTab === 'menu' ? '🧭' : '🎨'}
                                </span>
                                <p className="pt-[2px] text-[14px] font-semibold uppercase leading-5 tracking-normal text-[#2DD4BF]">{panelTitle}</p>
                            </div>
                            {activeTab === 'block' && block ? (
                                <p className="mt-1 pl-7 text-[11px] text-slate-500">[{block.blockType}]</p>
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
                            {block.blockType !== 'navigation' && block.blockType !== 'footer' && (
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
                                                className="mt-1 w-full accent-blue-500"
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
                                                className="mt-1 w-full accent-blue-500"
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
                                        <Input defaultValue={(block.ctaUrl as string) || ''} key={`ctaurl-${bk}`}
                                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'ctaUrl', e.target.value)}
                                            variant="editor"
                                            className={editorInputClassName} placeholder={s.buttonUrl} />
                                    </div>
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
                            {bt === 'hero' && ((block.ctaButtons || []) as CtaButton[]).length > 0 && (
                                <div className={sectionCls}>
                                    <label className="text-xs font-medium uppercase text-gray-500">{s.ctaButtons}</label>
                                    {((block.ctaButtons || []) as CtaButton[]).map((btn, i) => (
                                        <div key={`cta-${btn.label}-${btn.url}-${i}`} className="mt-3 rounded-lg bg-white/5 p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500">{ti(s.buttonN, { n: i + 1 })}</span>
                                                <button onClick={() => removeArrayItem('ctaButtons', i)} aria-label={`Remove button ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                            </div>
                                            <Input defaultValue={stripHtmlForDisplay(btn.label)} placeholder={s.label}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('ctaButtons', i, 'label', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                            <Input defaultValue={btn.url || ''} placeholder={s.url}
                                                onBlur={(e: FieldBlurEvent) => updateArrayItem('ctaButtons', i, 'url', e.target.value)}
                                                variant="editor"
                                                className={editorInputClassName} />
                                        </div>
                                    ))}
                                    <button onClick={() => addArrayItem('ctaButtons', { label: 'New Button', url: '#' })}
                                        className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">{s.addButton}</button>
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
                                            <Input defaultValue={(block.ctaButton as CtaButton)?.url || ''} placeholder={s.buttonUrl}
                                                onBlur={(e: FieldBlurEvent) => onBlockUpdate(currentBlockIndex, { ctaButton: { ...(block.ctaButton as CtaButton), url: e.target.value } })}
                                                variant="editor"
                                                className={editorInputClassName} />
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
                                                <button onClick={() => removeArrayItem('features', i)} aria-label={`Remove feature ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
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
                                                <button onClick={() => removeArrayItem('testimonials', i)} aria-label={`Remove testimonial ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
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


                            {bt === 'socialWidget' && (
                                <div className={sectionCls}>
                                    {(() => {
                                        const normalizedSocialBlock = normalizeSocialWidgetConfig(block as Record<string, unknown>)

                                        return (
                                            <>
                                                <label className="text-xs font-medium uppercase text-gray-500">{s.socialWidget}</label>
                                                <div className="mt-3 space-y-3">
                                                    <div>
                                                        <label className={labelCls}>{s.headline}</label>
                                                        <Input
                                                            defaultValue={(normalizedSocialBlock.headline as string) || ''}
                                                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'headline', e.target.value)}
                                                            variant="editor"
                                                            className={editorInputClassName}
                                                            placeholder={s.stayConnected}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelCls}>{s.displayStyle}</label>
                                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                                            {['floating', 'inline'].map(variant => (
                                                                <button
                                                                    key={variant}
                                                                    type="button"
                                                                    onClick={() => onBlockUpdate(currentBlockIndex, { variant })}
                                                                    className={cn(
                                                                        'rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors',
                                                                        (block.variant || 'floating') === variant
                                                                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                                                            : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
                                                                    )}
                                                                >
                                                                    {variant}
                                                                </button>
                                                            ))}
                                                        </div>
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
                                            <label className={labelCls}>{s.displayStyle}</label>
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                {['floating', 'inline'].map(variant => (
                                                    <button
                                                        key={variant}
                                                        type="button"
                                                        onClick={() => onBlockUpdate(currentBlockIndex, { variant })}
                                                        className={cn(
                                                            'rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors',
                                                            (block.variant || 'floating') === variant
                                                                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                                                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10',
                                                        )}
                                                    >
                                                        {variant}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>{s.buttonLabel}</label>
                                            <Input
                                                defaultValue={(block.label as string) || s.cart}
                                                onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'label', e.target.value)}
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
                                                    onClick={() => onBlockUpdate(currentBlockIndex, { showLabel: !block.showLabel })}
                                                    className={cn(
                                                        'rounded-full px-3 py-2 text-xs font-medium transition-colors',
                                                        block.showLabel
                                                            ? 'bg-blue-500/15 text-blue-300'
                                                            : 'bg-white/5 text-slate-400 hover:bg-white/10',
                                                    )}
                                                >
                                                    {block.showLabel ? s.labelVisible : s.iconOnly}
                                                </button>
                                                <span className="text-[11px] text-slate-500">
                                                    {s.badgeDesc}
                                                </span>
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
                                            imageUrl={String(block.image || block.backgroundImage || block.heroImage || '')}
                                            altText={String(block.imageAlt || block.alt || '')}
                                            onImageChange={(url) => {
                                                const field = block.image ? 'image' : block.backgroundImage ? 'backgroundImage' : 'heroImage'
                                                onBlockFieldChange(currentBlockIndex, field, url)
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
