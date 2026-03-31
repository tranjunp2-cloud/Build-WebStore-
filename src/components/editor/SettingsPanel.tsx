'use client'

import React, { memo, useEffect, useMemo, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ChevronDown, Copy, Globe2, Trash2, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'
import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NavigationEditor, type NavLinkItem } from './NavigationEditor'
import { LogoEditor } from './LogoEditor'
import type { BlockData, ThemeData, CtaButton, NavLink, FeatureItem, TestimonialItem, FooterColumn } from '@/types/editor'
import type { PageData } from '@/store/editorStore'
import { toast } from 'sonner'

type SocialWidgetLink = {
    platform: 'facebook' | 'whatsapp' | 'instagram' | 'linkedin' | 'youtube'
    url: string
    enabled?: boolean
}

const SOCIAL_PLATFORM_META: Record<SocialWidgetLink['platform'], { label: string; mark: string; placeholder: string; accent: string }> = {
    facebook: {
        label: 'Facebook',
        mark: 'f',
        placeholder: 'facebook.com/yourbrand',
        accent: '#2563eb',
    },
    whatsapp: {
        label: 'WhatsApp',
        mark: 'wa',
        placeholder: '60123456789',
        accent: '#16a34a',
    },
    instagram: {
        label: 'Instagram',
        mark: 'ig',
        placeholder: 'instagram.com/yourbrand',
        accent: '#db2777',
    },
    linkedin: {
        label: 'LinkedIn',
        mark: 'in',
        placeholder: 'linkedin.com/company/yourbrand',
        accent: '#0284c7',
    },
    youtube: {
        label: 'YouTube',
        mark: '▶',
        placeholder: 'youtube.com/@yourbrand',
        accent: '#dc2626',
    },
}

// ─── Constants ──────────────────────────────────────────────────────────
const FONT_OPTIONS = ['Outfit', 'Inter', 'DM Sans', 'Playfair Display', 'Roboto', 'Poppins', 'Plus Jakarta Sans']
const labelCls = "text-[11px] font-medium text-slate-400"
const sectionCls = "border-t border-white/10 pt-4"

type FieldBlurEvent = React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
type SettingsTab = 'global' | 'seo' | 'menu' | 'block'

function getBlockInfo(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return { label: meta?.name || blockType, icon: meta?.icon || '🧩', variants: meta?.variants || [] }
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
    onDeleteBlock: (idx: number) => void
    onDuplicateBlock: (idx: number) => void
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
}

// ─── Component ──────────────────────────────────────────────────────────
function SettingsPanelInner({
    block, blockIndex, theme, site, siteName, siteStatus, headerBlock, footerBlock, pages, currentPageId,
    onThemeChange, onDeleteBlock, onDuplicateBlock, onBlockFieldChange, onBlockUpdate,
    onHeaderUpdate, onFooterUpdate, onLogoChange, onSiteSettingsChange, onPageUpdate
}: SettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<SettingsTab>(block ? 'block' : 'global')
    const [openGlobalSections, setOpenGlobalSections] = useState({
        brand: true,
        contact: true,
        social: true,
    })
    const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
    const [seoSlugInput, setSeoSlugInput] = useState('')
    const [seoTitleInput, setSeoTitleInput] = useState('')
    const [seoDescriptionInput, setSeoDescriptionInput] = useState('')
    const [seoFieldError, setSeoFieldError] = useState<string | null>(null)

    useEffect(() => {
        if (block) {
            setActiveTab('block')
            return
        }

        setActiveTab(prev => (prev === 'block' ? 'global' : prev))
    }, [block])

    const siteContactInfo = site?.contactInfo || {}
    const siteSocialLinks = site?.socialLinks || {}
    const siteSeo = site?.seo || {}
    const siteBranding = site?.branding || {}

    const globalAccordionButtonCls = 'flex w-full items-center justify-between rounded-t-[14px] border border-[#25324A] bg-[#1A2437] px-3 py-3 text-left'
    const globalAccordionBodyCls = 'rounded-b-[14px] border border-t-0 border-[#25324A] bg-[#131D2E] px-4 py-4'

    const renderGlobalAccordion = (
        id: keyof typeof openGlobalSections,
        title: string,
        content: React.ReactNode,
    ) => (
        <div className="rounded-[14px]">
            <button
                type="button"
                onClick={() => setOpenGlobalSections(prev => ({ ...prev, [id]: !prev[id] }))}
                className={cn(
                    globalAccordionButtonCls,
                    openGlobalSections[id] ? 'rounded-b-none' : 'rounded-b-[14px]',
                )}
            >
                <span className="text-[15px] font-medium text-white">{openGlobalSections[id] ? '▼' : '▶'} {title}</span>
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

    const renderGlobalContent = () => (
        <div className="space-y-4">
            {renderGlobalAccordion('brand', 'Brand Identity', (
                <div className="space-y-4">
                    <div>
                        <label className="text-[12px] font-medium text-[#A5B4CF]">Business Name</label>
                        <Input
                            defaultValue={siteName || site?.name || ''}
                            key={`business-name-${siteName || site?.name || ''}`}
                            onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ name: e.target.value })}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder="Your Company"
                        />
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-[#A5B4CF]">Upload Logo</label>
                        <div className="mt-2">
                            <LogoEditor
                                currentLogo={(siteBranding.logo as string) || ((headerBlock as Record<string, unknown>)?.logo as string) || null}
                                onLogoChange={(logoUrl, faviconUrl) => {
                                    const siteBrandingChanges: Record<string, unknown> = { logo: logoUrl }
                                    if (faviconUrl) siteBrandingChanges.favicon = faviconUrl
                                    onHeaderUpdate?.(siteBrandingChanges)
                                    onFooterUpdate?.(siteBrandingChanges)
                                    void onSiteSettingsChange?.({ branding: siteBrandingChanges })
                                    if (onLogoChange) onLogoChange(logoUrl, faviconUrl)
                                }}
                            />
                        </div>
                    </div>
                </div>
            ))}

            {renderGlobalAccordion('contact', 'Contact Info', (
                <div className="space-y-4">
                    <div>
                        <label className="text-[12px] font-medium text-[#A5B4CF]">Phone</label>
                        <Input
                            defaultValue={siteContactInfo.phone || ''}
                            key={`contact-phone-${siteContactInfo.phone || ''}`}
                            onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ contactInfo: { ...siteContactInfo, phone: e.target.value } })}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder="+60 12-345-6789"
                        />
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-[#A5B4CF]">Email</label>
                        <Input
                            defaultValue={siteContactInfo.email || ''}
                            key={`contact-email-${siteContactInfo.email || ''}`}
                            onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ contactInfo: { ...siteContactInfo, email: e.target.value } })}
                            variant="editor"
                            className={editorInputClassName}
                            placeholder="hello@company.com"
                        />
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-[#A5B4CF]">Address</label>
                        <Textarea
                            defaultValue={siteContactInfo.address || ''}
                            key={`contact-address-${siteContactInfo.address || ''}`}
                            onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ contactInfo: { ...siteContactInfo, address: e.target.value } })}
                            variant="editor"
                            className={editorTextareaClassName}
                            placeholder="12 Jalan Ampang, Kuala Lumpur"
                        />
                    </div>
                </div>
            ))}

            {renderGlobalAccordion('social', 'Social Links', (
                <div className="space-y-3">
                    <Input
                        defaultValue={siteSocialLinks.facebook || ''}
                        key={`social-facebook-${siteSocialLinks.facebook || ''}`}
                        onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ socialLinks: { ...siteSocialLinks, facebook: e.target.value } })}
                        variant="editor"
                        className={editorInputClassName}
                        placeholder="Facebook URL"
                    />
                    <Input
                        defaultValue={siteSocialLinks.instagram || ''}
                        key={`social-instagram-${siteSocialLinks.instagram || ''}`}
                        onBlur={(e: FieldBlurEvent) => onSiteSettingsChange?.({ socialLinks: { ...siteSocialLinks, instagram: e.target.value } })}
                        variant="editor"
                        className={editorInputClassName}
                        placeholder="Instagram URL"
                    />
                </div>
            ))}
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
    const previewDomain = (site?.domain || `${(siteName || site?.name || 'site').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}.primeweb.app`).replace(/^https?:\/\//, '')
    const metaTitleWarning = seoTitleValue.length > 60 ? 'Title may be truncated on Google Search.' : null
    const metaDescriptionWarning = seoDescriptionValue.length > 160 ? 'Description may be truncated on Google Search.' : null

    const renderSeoContent = () => {
        if (!activePage) {
            return (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                    Select a page to configure SEO settings.
                </div>
            )
        }

        return (
            <div className="space-y-5">
                <div>
                    <label className={labelCls}>URL Slug</label>
                    <Input
                        value={isHomepage ? '/' : seoSlugValue}
                        disabled={isHomepage}
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
                    {seoFieldError ? (
                        <p className="mt-1 text-[10px] text-rose-400">{seoFieldError}</p>
                    ) : null}
                </div>
                <div>
                    <label className={labelCls}>Meta Title</label>
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
                        <span className={cn('text-[10px] text-slate-500', metaTitleWarning && 'text-amber-400')}>{seoTitleValue.length}/60 characters</span>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Meta Description</label>
                    <Textarea
                        rows={4}
                        value={seoDescriptionValue}
                        onChange={(e) => setSeoDescriptionInput(e.target.value)}
                        onBlur={(e: FieldBlurEvent) => void handleSeoUpdate('seoDescription', e.target.value)}
                        variant="editor"
                        className={cn(editorTextareaClassName, metaDescriptionWarning && 'border-amber-500/40 focus-visible:border-amber-400')}
                        placeholder="Tell search engines and social platforms what this page is about."
                    />
                    <div className="mt-1 flex items-center justify-between gap-3">
                        <span className={cn('text-[10px] text-slate-500', metaDescriptionWarning && 'text-amber-400')}>
                            {metaDescriptionWarning || ' '}
                        </span>
                        <span className={cn('text-[10px] text-slate-500', metaDescriptionWarning && 'text-amber-400')}>{seoDescriptionValue.length}/160 characters</span>
                    </div>
                </div>
                
                <div className={sectionCls}>
                    <label className="text-xs font-medium uppercase text-gray-500">Google Preview</label>
                    <div className="mt-3 rounded-[8px] border border-[#25324A] bg-white p-4">
                        <div className="text-[14px] text-[#202124] truncate" style={{fontFamily: 'arial,sans-serif'}}>
                            <span className="text-[12px] text-[#202124] flex items-center gap-2">
                                <Globe2 className="w-4 h-4 text-slate-400" />
                                {siteName || 'Your Website'}
                            </span>
                        </div>
                        <div className="text-[12px] text-[#006621] mt-1 truncate" style={{fontFamily: 'arial,sans-serif'}}>
                            https://{previewDomain}/{normalizedPreviewPath}
                        </div>
                        <div className="text-[18px] text-[#1a0dab] font-normal mt-1 truncate hover:underline cursor-pointer leading-[1.2]" style={{fontFamily: 'arial,sans-serif'}}>
                            {seoTitleValue || 'Page Title'}
                        </div>
                        <div className="text-[13px] text-[#4d5156] mt-1 line-clamp-2 leading-[1.4]" style={{fontFamily: 'arial,sans-serif'}}>
                            {seoDescriptionValue || 'Provide a meta description to help users know what this page is about before they click on the search result.'}
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="button"
                        disabled={isGeneratingSEO}
                        onClick={async () => {
                            if (!currentPageId || !site?.id) return
                            setIsGeneratingSEO(true)
                            const loadingToastId = toast.loading('Generating SEO optimization using AI...')
                            try {
                                const res = await fetch(`/api/sites/${site.id}/pages/${currentPageId}/generate-seo`, {
                                    method: 'POST'
                                })
                                if (res.ok) {
                                const data = await res.json()
                                    if (data.title) setSeoTitleInput(data.title)
                                    if (data.description) setSeoDescriptionInput(data.description)
                                    if (data.slug && !isHomepage) setSeoSlugInput(data.slug)
                                    if (data.title) await handleSeoUpdate('seoTitle', data.title)
                                    if (data.description) await handleSeoUpdate('seoDescription', data.description)
                                    if (data.slug && !isHomepage) await handleSeoUpdate('slug', data.slug)
                                    toast.success('SEO optimization successfully generated!', { id: loadingToastId })
                                } else {
                                    toast.error('Failed to generate SEO', { id: loadingToastId })
                                }
                            } catch (error) {
                                toast.error('Error generating SEO', { id: loadingToastId })
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
                        {isGeneratingSEO ? 'Generating...' : 'Automatic SEO Optimization'}
                    </button>
                </div>
            </div>
        )
    }

    const renderMenuContent = () => (
        <div className="space-y-5">
            {/* Logo Editor (AC-2) */}
            <LogoEditor
                currentLogo={((headerBlock as Record<string, unknown>)?.logo as string) || null}
                onLogoChange={(logoUrl, faviconUrl) => {
                    const changes: Record<string, unknown> = { logo: logoUrl }
                    if (faviconUrl) changes.favicon = faviconUrl
                    onHeaderUpdate?.(changes)
                    if (onLogoChange) onLogoChange(logoUrl, faviconUrl)
                }}
            />

            <div className={sectionCls}>
                <label className={labelCls}>Navigation Style</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    {['standard', 'centered'].map(style => (
                        <button
                            key={style}
                            type="button"
                            onClick={() => onHeaderUpdate?.({ navStyle: style })}
                            className={cn(
                                'rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-colors',
                                (headerBlock as Record<string, unknown>)?.navStyle === style || (!((headerBlock as Record<string, unknown>)?.navStyle) && style === 'standard')
                                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                            )}
                        >
                            {style}
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation Editor (AC-1) */}
            <div className={sectionCls}>
                <NavigationEditor
                    links={((headerBlock as Record<string, unknown>)?.links as NavLinkItem[]) || []}
                    onUpdate={(links) => onHeaderUpdate?.({ links })}
                    pages={pages}
                />
            </div>
        </div>
    )

    const panelTitle = activeTab === 'global'
        ? 'Global Site Settings'
        : activeTab === 'seo'
            ? 'SEO Settings'
            : activeTab === 'menu'
                ? 'Menu Settings'
                : 'Block Settings'

    const panelDescription = activeTab === 'block'
        ? 'Adjust spacing, content, and presentation for the selected block.'
        : activeTab === 'seo'
            ? 'Control metadata and social preview content.'
        : activeTab === 'menu'
            ? 'Configure navigation structure and menu presentation.'
            : 'Manage business identity, contact info, and social channels.'

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
        { id: 'global', label: 'Global', icon: <span aria-hidden="true" className="text-[15px] leading-none">⚙️</span> },
        { id: 'seo', label: 'SEO', icon: <span aria-hidden="true" className="text-[15px] leading-none">🔍</span> },
        { id: 'menu', label: 'Menu', icon: <span aria-hidden="true" className="text-[15px] leading-none">🧭</span> },
        { id: 'block', label: 'Block', icon: <span aria-hidden="true" className="text-[15px] leading-none">🎨</span>, disabled: !block },
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
                                            Please select a block first
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
                        Select a block in preview to unlock block-specific settings.
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
                        <label className="text-xs font-medium uppercase text-gray-500">Variant</label>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {info?.variants.map(v => (
                                <button key={v}
                                    onClick={() => onBlockFieldChange(currentBlockIndex, 'variant', v)}
                                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                        block.variant === v ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Common Text Fields ──────────────────────── */}
                {block.logoText !== undefined && (
                    <div>
                        <label className={labelCls}>Logo Text</label>
                        <Input defaultValue={block.logoText as string} key={`logo-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'logoText', e.target.value)}
                            variant="editor"
                            className={editorInputClassName} />
                    </div>
                )}

                {block.headline !== undefined && (
                    <div>
                        <label className={labelCls}>Headline</label>
                        <Input defaultValue={block.headline as string} key={`hl-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'headline', e.target.value)}
                            variant="editor"
                            className={editorInputClassName} />
                    </div>
                )}

                {block.subheadline !== undefined && (
                    <div>
                        <label className={labelCls}>Subheadline</label>
                        <Textarea defaultValue={block.subheadline as string} rows={2} key={`sub-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'subheadline', e.target.value)}
                            variant="editor"
                            className={editorTextareaClassName} />
                    </div>
                )}

                {block.sectionLabel !== undefined && (
                    <div>
                        <label className={labelCls}>Section Label</label>
                        <Input defaultValue={block.sectionLabel as string} key={`sl-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'sectionLabel', e.target.value)}
                            variant="editor"
                            className={editorInputClassName} />
                    </div>
                )}

                {block.body !== undefined && (
                    <div>
                        <label className={labelCls}>Body Text</label>
                        <Textarea defaultValue={block.body as string} rows={4} key={`body-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'body', e.target.value)}
                            variant="editor"
                            className={editorTextareaClassName} />
                    </div>
                )}

                {block.subtext !== undefined && (
                    <div>
                        <label className={labelCls}>Description</label>
                        <Textarea defaultValue={block.subtext as string} rows={3} key={`subtext-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'subtext', e.target.value)}
                            variant="editor"
                            className={editorTextareaClassName} />
                    </div>
                )}

                {block.tagline !== undefined && (
                    <div>
                        <label className={labelCls}>Tagline</label>
                        <Textarea defaultValue={block.tagline as string} rows={2} key={`tag-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'tagline', e.target.value)}
                            variant="editor"
                            className={editorTextareaClassName} />
                    </div>
                )}

                {/* ─── Contact Fields ─────────────────────────── */}
                {(bt === 'contact') && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">Contact Info</label>
                        <div className="mt-3 space-y-3">
                            <div>
                                <label className={labelCls}>Email</label>
                                <Input defaultValue={(block.email as string) || ''} key={`email-${currentBlockIndex}`}
                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'email', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} placeholder="contact@example.com" />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <Input defaultValue={(block.phone as string) || ''} key={`phone-${currentBlockIndex}`}
                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'phone', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} placeholder="+84 xxx xxx xxx" />
                            </div>
                            <div>
                                <label className={labelCls}>Address</label>
                                <Textarea defaultValue={(block.address as string) || ''} rows={2} key={`addr-${currentBlockIndex}`}
                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'address', e.target.value)}
                                    variant="editor"
                                    className={editorTextareaClassName} placeholder="123 Street, City" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CTA Fields ─────────────────────────────── */}
                {(block.ctaLabel !== undefined || block.ctaUrl !== undefined) && (
                    <div>
                        <label className={labelCls}>CTA Button</label>
                        <div className="mt-1.5 space-y-2">
                            <Input defaultValue={(block.ctaLabel as string) || ''} key={`ctalbl-${currentBlockIndex}`}
                                onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'ctaLabel', e.target.value)}
                                variant="editor"
                                className={editorInputClassName} placeholder="Button text" />
                            <Input defaultValue={(block.ctaUrl as string) || ''} key={`ctaurl-${currentBlockIndex}`}
                                onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'ctaUrl', e.target.value)}
                                variant="editor"
                                className={editorInputClassName} placeholder="Button URL" />
                        </div>
                    </div>
                )}

                {block.copyrightText !== undefined && (
                    <div>
                        <label className={labelCls}>Copyright</label>
                        <Input defaultValue={block.copyrightText as string} key={`copy-${currentBlockIndex}`}
                            onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'copyrightText', e.target.value)}
                            variant="editor"
                            className={editorInputClassName} />
                    </div>
                )}

                {/* ─── Hero CTA Buttons ───────────────────────── */}
                {bt === 'hero' && ((block.ctaButtons || []) as CtaButton[]).length > 0 && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">CTA Buttons</label>
                        {((block.ctaButtons || []) as CtaButton[]).map((btn, i) => (
                            <div key={`cta-${i}`} className="mt-3 rounded-lg bg-white/5 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Button {i + 1}</span>
                                    <button onClick={() => removeArrayItem('ctaButtons', i)} aria-label={`Remove button ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <Input defaultValue={btn.label || ''} placeholder="Label"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('ctaButtons', i, 'label', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} />
                                <Input defaultValue={btn.url || ''} placeholder="URL"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('ctaButtons', i, 'url', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('ctaButtons', { label: 'New Button', url: '#' })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Button</button>
                    </div>
                )}

                {/* ─── Navigation Links ───────────────────────── */}
                {bt === 'navigation' && (
                    <div className={sectionCls}>
                        <NavigationEditor
                            links={((block.links || []) as NavLinkItem[]).map((link: NavLinkItem, i: number) => ({
                                id: link.id || `legacy_${i}`,
                                label: link.label || '',
                                url: link.url || '#',
                                type: link.type || 'external' as const,
                                children: link.children || [],
                            }))}
                            onUpdate={(links) => onBlockUpdate(currentBlockIndex, { links })}
                            pages={pages}
                        />
                        {/* Nav CTA */}
                        {!!block.ctaButton && (
                            <div className="mt-3">
                                <label className={labelCls}>CTA Button</label>
                                <Input defaultValue={(block.ctaButton as CtaButton)?.label || ''} placeholder="CTA Label"
                                    onBlur={(e: FieldBlurEvent) => onBlockUpdate(currentBlockIndex, { ctaButton: { ...(block.ctaButton as CtaButton), label: e.target.value } })}
                                    variant="editor"
                                    className={editorInputClassName} />
                                <Input defaultValue={(block.ctaButton as CtaButton)?.url || ''} placeholder="CTA URL"
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
                        <label className="text-xs font-medium uppercase text-gray-500">Features ({((block.features || []) as FeatureItem[]).length})</label>
                        {((block.features || []) as FeatureItem[]).map((feat, i) => (
                            <div key={`feat-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">{feat.icon || '✦'} Feature {i + 1}</span>
                                    <button onClick={() => removeArrayItem('features', i)} aria-label={`Remove feature ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <Input defaultValue={feat.title || ''} placeholder="Title"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('features', i, 'title', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} />
                                <Textarea defaultValue={feat.description || ''} rows={2} placeholder="Description"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('features', i, 'description', e.target.value)}
                                    variant="editor"
                                    className={editorTextareaClassName} />
                                <Input defaultValue={feat.icon || ''} placeholder="Icon (emoji)"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('features', i, 'icon', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('features', { title: 'New Feature', description: '', icon: '✦' })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Feature</button>
                    </div>
                )}

                {/* ─── Testimonials ───────────────────────────── */}
                {bt === 'testimonials' && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">Testimonials ({((block.testimonials || []) as TestimonialItem[]).length})</label>
                        {((block.testimonials || []) as TestimonialItem[]).map((item, i) => (
                            <div key={`test-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Review {i + 1}</span>
                                    <button onClick={() => removeArrayItem('testimonials', i)} aria-label={`Remove testimonial ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <Input defaultValue={item.name || ''} placeholder="Name"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('testimonials', i, 'name', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} />
                                <Input defaultValue={item.title || ''} placeholder="Title / Role"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('testimonials', i, 'title', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName} />
                                <Textarea defaultValue={item.quote || ''} rows={2} placeholder="Quote"
                                    onBlur={(e: FieldBlurEvent) => updateArrayItem('testimonials', i, 'quote', e.target.value)}
                                    variant="editor"
                                    className={editorTextareaClassName} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('testimonials', { name: 'Customer', title: '', quote: 'Great experience!', rating: 5 })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Testimonial</button>
                    </div>
                )}

                {/* ─── Footer Columns ─────────────────────────── */}
                {bt === 'footer' && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">Footer Columns ({((block.columns || []) as FooterColumn[]).length})</label>
                        {((block.columns || []) as FooterColumn[]).map((col, i) => (
                            <div key={`col-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Column {i + 1}</span>
                                    <button onClick={() => removeArrayItem('columns', i)} aria-label={`Remove column ${i + 1}`} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <Input defaultValue={col.title || ''} placeholder="Column Title"
                                    onBlur={(e: FieldBlurEvent) => {
                                        const cols = [...((block.columns || []) as FooterColumn[])]
                                        cols[i] = { ...cols[i], title: e.target.value }
                                        onBlockUpdate(currentBlockIndex, { columns: cols })
                                    }}
                                    variant="editor"
                                    className={editorInputClassName} />
                                <div className="text-[10px] text-gray-500 mt-1">{(col.links || []).length} links</div>
                            </div>
                        ))}
                    </div>
                )}

                {bt === 'socialWidget' && (
                    <div className={sectionCls}>
                        {(() => {
                            const normalizedSocialBlock = normalizeSocialWidgetConfig(block as Record<string, unknown>)

                            return (
                                <>
                        <label className="text-xs font-medium uppercase text-gray-500">Social Widget</label>
                        <div className="mt-3 space-y-3">
                            <div>
                                <label className={labelCls}>Headline</label>
                                <Input
                                    defaultValue={(normalizedSocialBlock.headline as string) || ''}
                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'headline', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName}
                                    placeholder="Stay connected"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Display Style</label>
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
                                    Platforms
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                    Published site should open each enabled platform in a new tab.
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
                                                    {SOCIAL_PLATFORM_META[link.platform].label}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    {link.platform === 'whatsapp' ? 'Phone number or wa.me link' : 'Public profile URL'}
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
                                            {link.enabled === false ? 'Hidden' : 'Visible'}
                                        </button>
                                    </div>
                                    <Input
                                        defaultValue={link.url || ''}
                                        placeholder={SOCIAL_PLATFORM_META[link.platform].placeholder}
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
                        <label className="text-xs font-medium uppercase text-gray-500">Cart Widget</label>
                        <div className="mt-3 space-y-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                                    Checkout Behavior
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                    In preview, checkout falls back to a toast when storefront checkout is unavailable.
                                </p>
                            </div>
                            <div>
                                <label className={labelCls}>Display Style</label>
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
                                <label className={labelCls}>Button Label</label>
                                <Input
                                    defaultValue={(block.label as string) || 'Cart'}
                                    onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'label', e.target.value)}
                                    variant="editor"
                                    className={editorInputClassName}
                                    placeholder="Cart"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Show Text Label</label>
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
                                        {block.showLabel ? 'Label visible' : 'Icon only'}
                                    </button>
                                    <span className="text-[11px] text-slate-500">
                                        Badge count always stays visible
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Block actions */}
                <div className="border-t border-white/10 pt-4">
                    <label className="text-xs font-medium uppercase text-gray-500">Actions</label>
                    <div className="mt-2 flex gap-2">
                        <button onClick={() => onDuplicateBlock(currentBlockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                            <Copy className="h-3 w-3" /> Duplicate
                        </button>
                        <button onClick={() => onDeleteBlock(currentBlockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-3 w-3" /> Delete
                        </button>
                    </div>
                </div>

                {/* Theme editing */}
                {theme && (
                    <div className="border-t border-white/10 pt-4">
                        <label className="text-xs font-medium uppercase text-gray-500">Global Theme</label>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Primary Color</label>
                            <div className="mt-1 flex items-center gap-2">
                                <input type="color" value={(theme.primaryColor as string) || '#0ea5e9'}
                                    onChange={e => onThemeChange('primaryColor', e.target.value)}
                                    aria-label="Primary color picker"
                                    className="h-7 w-7 rounded border-0 cursor-pointer bg-transparent" />
                                <input value={(theme.primaryColor as string) || '#0ea5e9'}
                                    onChange={e => onThemeChange('primaryColor', e.target.value)}
                                    className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Heading Font</label>
                            <select value={(theme.fontHeading as string) || 'Outfit'} onChange={e => onThemeChange('fontHeading', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Body Font</label>
                            <select value={(theme.fontBody as string) || 'Inter'} onChange={e => onThemeChange('fontBody', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Color Mode</label>
                            <div className="mt-1 flex gap-2">
                                {(['dark', 'light'] as const).map(mode => (
                                    <button key={mode} onClick={() => onThemeChange('colorMode', mode)}
                                        className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                                            theme.colorMode === mode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                                        {mode === 'dark' ? 'Dark' : 'Light'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                    </>
                ) : null}
                </div>
            </div>
        </div>
    )
}

export const SettingsPanel = memo(SettingsPanelInner)
