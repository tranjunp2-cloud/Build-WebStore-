'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Save, Sparkles, Loader2, FileText,
    ImageIcon, Eye, EyeOff, ChevronDown, X,
    Settings2, User, Calendar, Globe, Link2, List, ListOrdered, Upload, Quote,
    Tag, Wand2, Check, Briefcase, Smile, Target, RefreshCw
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarUI } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { getBlogCategoriesAction, getCurrentUserAction, saveBlogAction, getBlogByIdAction } from '../actions'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { validateImageMagicBytes, MAX_IMAGE_SIZE } from '@/lib/validate-image'
import { useI18n } from '@/i18n'
import { CategoryModal } from '../_components/CategoryModal'

const BlogRichEditor = dynamic(
    () => import('../_components/BlogRichEditor').then(mod => mod.BlogRichEditor),
    { ssr: false, loading: () => <div className="flex flex-col bg-[rgba(30,41,59,0.6)] border border-[rgba(255,255,255,0.08)] rounded-[16px] overflow-hidden min-h-[523px] animate-pulse" /> }
)

type BlogCategory = {
    id: string
    name: string
}

type BlogForm = {
    title: string
    slug: string
    content: string
    status: 'draft' | 'published' | 'scheduled'
    category: string
    seoTitle: string
    seoDescription: string
}

const initialForm: BlogForm = {
    title: '',
    slug: '',
    content: '',
    status: 'draft',
    category: '',
    seoTitle: '',
    seoDescription: '',
}

function slugify(text: string) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '')
}

function formatSlugInput(text: string) {
    return text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
}

export default function BlogEditorPage() {
    const params = useParams()
    const router = useRouter()
    const { t, locale } = useI18n()
    const blogId = params?.id as string
    const isNew = blogId === 'new'

    const [form, setForm] = useState<BlogForm>(initialForm)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [categories, setCategories] = useState<BlogCategory[]>([])
    const [showSEO, setShowSEO] = useState(false)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
    const [thumbnailId, setThumbnailId] = useState<string | null>(null)

    type TenantRef = { tenant: { id: string } | string; role?: string; status?: string }
    type CurrentUser = { id: string; email: string; firstName?: string; lastName?: string; tenants?: TenantRef[] }
    // Current User, Category Dropdown, and Date State
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
    // Current User, Category Dropdown, and Date State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
    const [publishDate, setPublishDate] = useState<Date | undefined>()

    // Editor key — increment to force CKEditor remount when AI inserts content
    const [editorKey, setEditorKey] = useState(0)

    // AI Generator State
    const [showAIGenerator, setShowAIGenerator] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiTone, setAiTone] = useState('Professional')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedAiContent, setGeneratedAiContent] = useState('')
    type GeneratedAIData = { title?: string; content?: string; seoTitle?: string; seoDescription?: string }
    const [generatedAiData, setGeneratedAiData] = useState<GeneratedAIData | null>(null)

    // Load categories
    useEffect(() => {
        getBlogCategoriesAction()
            .then(docs => setCategories(docs || []))
            .catch((err) => { console.error('Failed to load categories', err) })
    }, [])

    // Load current user & click outside listener
    useEffect(() => {
        getCurrentUserAction()
            .then(user => {
                if (user) {
                    setCurrentUser(user as CurrentUser)
                }
            })
            .catch((err) => { console.error('Failed to load user', err) })
    }, [])

    const getAuthorName = () => {
        if (!currentUser) return t.dashboard.blog.editor.authorLoading
        return currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser.email?.split('@')[0] || t.dashboard.blog.editor.authorFallback
    }

    // Load existing blog post when editing
    useEffect(() => {
        if (isNew) return
        async function loadPost() {
            try {
                const data = await getBlogByIdAction(blogId as string)
                if (data) {
                    setForm({
                        title: data.title || '',
                        slug: data.slug || '',
                        content: data.content || '',
                        status: data.status || 'draft',
                        category: typeof data.category === 'object' ? String(data.category?.id ?? '') : String(data.category ?? ''),
                        seoTitle: data.seo?.metaTitle || '',
                        seoDescription: data.seo?.metaDescription || '',
                    })
                    if (data.thumbnail) {
                        const thumb = typeof data.thumbnail === 'object' ? data.thumbnail : null
                        if (thumb?.url) {
                            // Fix Docker-internal MinIO URL to browser-accessible URL
                            // On local: minio:9000 → localhost:9000 (port-mapped)
                            // On staging/prod: S3 URL is already correct, no replacement needed
                            const thumbUrl = thumb.url.replace(/https?:\/\/minio:\d+/, process.env.NEXT_PUBLIC_S3_ENDPOINT || 'http://localhost:9000')
                            setThumbnailPreview(thumbUrl)
                        }
                        const existingThumbId = thumb?.id || (typeof data.thumbnail === 'number' ? String(data.thumbnail) : data.thumbnail)
                        if (existingThumbId) setThumbnailId(String(existingThumbId))
                    }

                    setPublishDate(new Date(data.publishedAt || data.createdAt))
                } else {
                    toast.error(t.dashboard.blog.editor.loadFailed)
                    setError(t.dashboard.blog.editor.loadFailed)
                }
            } catch {
                toast.error(t.dashboard.blog.editor.networkError)
                setError(t.dashboard.blog.editor.networkError)
            } finally {
                setIsLoading(false)
            }
        }
        loadPost()
    }, [blogId, isNew])

    // ─── localStorage auto-save (TC-F17-02-17) ───────────────────────────
    const DRAFT_KEY = `blog-draft-${blogId}`
    const [showDraftRecovery, setShowDraftRecovery] = useState(false)
    const draftCheckedRef = useRef(false)

    // Check for unsaved draft on mount
    useEffect(() => {
        if (draftCheckedRef.current) return
        draftCheckedRef.current = true
        try {
            const saved = localStorage.getItem(DRAFT_KEY)
            if (saved) {
                const draft = JSON.parse(saved)
                if (draft.updatedAt && Date.now() - draft.updatedAt < 24 * 60 * 60 * 1000) {
                    setShowDraftRecovery(true)
                } else {
                    localStorage.removeItem(DRAFT_KEY)
                }
            }
        } catch (err) {
            console.error('[Draft] Failed to parse saved draft', err)
            localStorage.removeItem(DRAFT_KEY)
        }
    }, [DRAFT_KEY])

    const restoreDraft = () => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY)
            if (saved) {
                const draft = JSON.parse(saved)
                setForm(prev => ({
                    ...prev,
                    title: draft.title ?? prev.title,
                    content: draft.content ?? prev.content,
                    slug: draft.slug ?? prev.slug,
                    category: draft.category ?? prev.category,
                    seoTitle: draft.seoTitle ?? prev.seoTitle,
                    seoDescription: draft.seoDescription ?? prev.seoDescription,
                }))
                toast.success(t.dashboard.blog.editor.draftRestored)
            }
        } catch (err) {
            console.error('[Draft] Failed to restore draft', err)
            localStorage.removeItem(DRAFT_KEY)
        }
        setShowDraftRecovery(false)
    }

    const dismissDraft = () => {
        localStorage.removeItem(DRAFT_KEY)
        setShowDraftRecovery(false)
    }

    // Auto-save to localStorage every 30s
    useEffect(() => {
        if (isLoading) return
        const timer = setInterval(() => {
            if (form.title || form.content) {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({
                    title: form.title,
                    content: form.content,
                    slug: form.slug,
                    category: form.category,
                    seoTitle: form.seoTitle,
                    seoDescription: form.seoDescription,
                    updatedAt: Date.now(),
                }))
            }
        }, 30000)
        return () => clearInterval(timer)
    }, [DRAFT_KEY, form, isLoading])

    const updateField = useCallback((field: keyof BlogForm, value: string) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value }
            if (field === 'title' && (isNew || !prev.slug)) {
                updated.slug = slugify(value)
            }
            return updated
        })
        setError(null)
    }, [isNew])

    type RichTextNode = { text?: string; children?: RichTextNode[]; root?: RichTextNode }
    const getContentText = (content: string | RichTextNode | null): string => {
        if (!content) return ''
        if (typeof content === 'string') return content.replace(/<[^>]*>/g, '')
        try {
            const extractText = (node: RichTextNode): string => {
                if (!node) return ''
                if (node.text) return node.text
                if (node.children) return node.children.map(extractText).join(' ')
                return ''
            }
            return extractText(content.root || content).trim()
        } catch {
            return ''
        }
    }

    const validate = (): string | null => {
        if (!form.title.trim()) return 'title_required'
        if (form.title.length > 255) return 'title_max_length'
        if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) return 'slug_invalid'
        const contentText = getContentText(form.content)
        if (!contentText.trim()) return 'content_required'
        return null
    }

    const isSubmittingRef = useRef(false)

    const handleSave = async (overrideStatus?: 'draft' | 'published') => {
        if (isSubmittingRef.current) return
        isSubmittingRef.current = true

        const validationError = validate()
        if (validationError) {
            setError(validationError)
            const messages: Record<string, string> = {
                title_required: t.dashboard.blog.editor.titleRequired,
                title_max_length: t.dashboard.blog.editor.titleMaxLength,
                slug_invalid: t.dashboard.blog.editor.slugInvalid,
                content_required: t.dashboard.blog.editor.contentRequired,
            }
            toast.error(messages[validationError] || validationError)
            isSubmittingRef.current = false
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            let resolvedThumbnailId = thumbnailId
            if (thumbnailFile) {
                try {
                    const formData = new FormData()
                    formData.append('file', thumbnailFile)
                    const uploadDoc = await uploadMediaAction(formData)
                    resolvedThumbnailId = uploadDoc?.id || null
                    if (resolvedThumbnailId) setThumbnailId(resolvedThumbnailId)
                } catch (uploadErr) {
                    console.error('[Blog] Thumbnail upload failed:', uploadErr)
                    toast.error(t.dashboard.blog.editor.thumbnailUploadError)
                }
            }

            // If publishing with a future date, schedule instead of publish immediately
            const finalStatus = overrideStatus ?? form.status
            let effectiveStatus = finalStatus
            const effectivePublishDate = publishDate || new Date()
            let scheduledPublishDate: string | null = null
            if (finalStatus === 'published' && effectivePublishDate > new Date()) {
                effectiveStatus = 'scheduled'
                scheduledPublishDate = effectivePublishDate.toISOString()
                toast.info(t.dashboard.blog.editor.scheduledPublishWarning)
            }

            const result = await saveBlogAction({
                id: isNew ? undefined : blogId as string,
                title: form.title.trim(),
                slug: form.slug || slugify(form.title),
                content: form.content,
                status: effectiveStatus,
                category: form.category || null,
                thumbnail: resolvedThumbnailId || (thumbnailPreview ? undefined : null),
                publishedAt: effectivePublishDate.toISOString(),
                scheduledPublishDate,
                seo: {
                    metaTitle: form.seoTitle,
                    metaDescription: form.seoDescription,
                },
            })

            if (result) {
                setSuccess(true)
                localStorage.removeItem(DRAFT_KEY)
                toast.success(isNew ? t.dashboard.blog.editor.postCreated : t.dashboard.blog.editor.postSaved)
                if (overrideStatus) {
                    setForm(prev => ({ ...prev, status: effectiveStatus }))
                }
                setTimeout(() => {
                    router.push('/blog')
                }, 1000)
            }
        } catch (err: unknown) {
            console.error('[Blog] Save failed:', err)
            setError(t.dashboard.blog.editor.saveFailed)
            toast.error(t.dashboard.blog.editor.saveFailed)
        } finally {
            setIsSaving(false)
            isSubmittingRef.current = false
        }
    }


    const handleGenerateSEO = async () => {
        const contentText = getContentText(form.content)
        if (!form.title.trim() && !contentText) {
            toast.error(t.dashboard.blog.editor.enterTitleOrContent)
            return
        }
        setIsGeneratingSEO(true)
        setError(null)
        try {
            const res = await fetch('/api/ai/generate-blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    prompt: `Generate ONLY SEO metadata (seoTitle and seoDescription) for this blog post. Title: "${form.title}". Content snippet: "${contentText.substring(0, 500)}"`,
                    language: 'en',
                }),
            })

            if (res.ok) {
                const json = await res.json()
                const data = json.data || json
                if (data.seoTitle || data.metaTitle) {
                    setForm(prev => ({
                        ...prev,
                        seoTitle: data.seoTitle || data.metaTitle || prev.seoTitle,
                        seoDescription: data.seoDescription || data.metaDescription || prev.seoDescription,
                    }))
                    setShowSEO(true)
                    toast.success(t.dashboard.blog.editor.seoGenerated)
                } else {
                    setForm(prev => ({
                        ...prev,
                        seoTitle: prev.title.substring(0, 60),
                        seoDescription: contentText.substring(0, 155),
                    }))
                    setShowSEO(true)
                    toast.warning(t.dashboard.blog.editor.aiUnavailableFallback)
                }
            } else {
                setForm(prev => ({
                    ...prev,
                    seoTitle: prev.title.substring(0, 60),
                    seoDescription: contentText.substring(0, 155),
                }))
                setShowSEO(true)
                toast.warning(t.dashboard.blog.editor.aiUnavailableFallback)
            }
        } catch {
            setForm(prev => ({
                ...prev,
                seoTitle: prev.title.substring(0, 60),
                seoDescription: contentText.substring(0, 155),
            }))
            setShowSEO(true)
            toast.warning(t.dashboard.blog.editor.aiUnavailableFallback)
        } finally {
            setIsGeneratingSEO(false)
        }
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-white/5" />
                        <div className="h-7 w-48 rounded bg-white/5" />
                    </div>
                    <div className="h-10 w-32 rounded-lg bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                    <div className="h-4 w-24 rounded bg-white/5" />
                    <div className="h-12 w-full rounded-lg bg-white/5" />
                    <div className="h-4 w-20 rounded bg-white/5" />
                    <div className="h-10 w-full rounded-lg bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                    <div className="h-4 w-32 rounded bg-white/5" />
                    <div className="h-48 w-full rounded-lg bg-white/5" />
                </div>
            </div>
        )
    }

    const handleGenerateWithAI = async () => {
        if (!aiPrompt.trim()) return

        try {
            setIsGenerating(true)
            setGeneratedAiContent('')
            setGeneratedAiData(null)

            const res = await fetch('/api/ai/generate-blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, tone: aiTone, language: locale })
            })

            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error || t.dashboard.blog.editor.generateFailed)

            const { title, content, seoTitle, seoDescription } = json.data

            setGeneratedAiData({ title, content, seoTitle, seoDescription })
            setGeneratedAiContent(content || t.dashboard.blog.editor.noContentGenerated)

            toast.success(t.dashboard.blog.editor.aiGenerated, { id: 'ai-blog' })
        } catch (error: unknown) {
            console.error('[Blog] AI generation failed:', error)
            toast.error(t.dashboard.blog.editor.aiGenerationFailed, { id: 'ai-blog' })
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="w-full h-full space-y-6">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-[12px] w-full">
                {/* Row 1: Back + Breadcrumb + Title */}
                <div className="flex flex-row items-center gap-[16px] min-w-0">
                    <button
                        onClick={() => router.push('/blog')}
                        aria-label="Back to blog list"
                        className="flex items-center justify-center w-[36px] h-[36px] rounded-[12px] hover:bg-[rgba(248,250,252,0.05)] transition-colors shrink-0"
                    >
                        <ArrowLeft className="w-[18px] h-[18px] text-[rgba(248,250,252,0.6)]" strokeWidth={1.66} />
                    </button>
                    <div className="flex flex-col gap-[4px] min-w-0">
                        <div className="flex flex-row items-center gap-[8px] flex-wrap">
                            <span className="font-['Inter'] font-[400] text-[14px] leading-[20px] text-[rgba(248,250,252,0.6)] cursor-pointer hover:underline" onClick={() => router.push('/dashboard')}>{t.dashboard.blog.editor.home}</span>
                            <span className="font-['Inter'] font-[400] text-[14px] leading-[20px] text-[rgba(248,250,252,0.6)]">&gt;</span>
                            <span className="font-['Inter'] font-[400] text-[14px] leading-[20px] text-[rgba(248,250,252,0.6)] cursor-pointer hover:underline" onClick={() => router.push('/blog')}>{t.dashboard.blog.editor.blog}</span>
                            <span className="font-['Inter'] font-[400] text-[14px] leading-[20px] text-[rgba(248,250,252,0.6)]">&gt;</span>
                            <span className="font-['Inter'] font-[400] text-[14px] leading-[20px] text-[#F8FAFC]">
                                {isNew ? t.dashboard.blog.editor.newPost : `${t.dashboard.blog.editor.editPrefix} ${form.title || t.dashboard.blog.editor.untitled}`}
                            </span>
                        </div>
                        <div className="h-[32px] flex items-center">
                            <h1 className="font-['Inter'] font-[700] text-[24px] leading-[32px] text-[#F8FAFC]">
                                {isNew ? t.dashboard.blog.editor.createTitle : t.dashboard.blog.editor.editTitle}
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Row 2: Action Buttons — below on mobile, right-aligned on desktop */}
                <div className="flex flex-row items-center gap-[12px] shrink-0">
                    {/* AI Assistant Button — icon-only on mobile per Figma */}
                    <button
                        onClick={() => setShowAIGenerator(true)}
                        className="flex flex-row items-center justify-center h-[44px] xl:h-[48px] w-[68px] xl:w-auto xl:px-[24px] gap-[8px] rounded-[16px] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] transition-transform hover:opacity-90 active:scale-95"
                        style={{ background: 'linear-gradient(90deg, rgba(173, 70, 255, 1) 0%, rgba(246, 51, 154, 1) 100%)' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clipPath="url(#clip0_30970_14228)">
                                <path d="M8.28086 12.9162C8.20647 12.6278 8.05615 12.3646 7.84555 12.154C7.63494 11.9434 7.37176 11.7931 7.08336 11.7187L1.97086 10.4004C1.88364 10.3756 1.80687 10.3231 1.75221 10.2508C1.69754 10.1784 1.66797 10.0902 1.66797 9.99956C1.66797 9.90889 1.69754 9.82069 1.75221 9.74835C1.80687 9.67601 1.88364 9.62348 1.97086 9.59872L7.08336 8.27956C7.37166 8.20523 7.63477 8.05503 7.84537 7.84459C8.05596 7.63414 8.20634 7.37113 8.28086 7.08289L9.5992 1.97039C9.6237 1.88282 9.67618 1.80567 9.74863 1.75072C9.82108 1.69576 9.90951 1.66602 10.0004 1.66602C10.0914 1.66602 10.1798 1.69576 10.2523 1.75072C10.3247 1.80567 10.3772 1.88282 10.4017 1.97039L11.7192 7.08289C11.7936 7.37128 11.9439 7.63447 12.1545 7.84507C12.3651 8.05567 12.6283 8.20599 12.9167 8.28039L18.0292 9.59789C18.1171 9.62214 18.1946 9.67456 18.2499 9.74712C18.3052 9.81968 18.3351 9.90836 18.3351 9.99956C18.3351 10.0908 18.3052 10.1794 18.2499 10.252C18.1946 10.3245 18.1171 10.377 18.0292 10.4012L12.9167 11.7187C12.6283 11.7931 12.3651 11.9434 12.1545 12.154C11.9439 12.3646 11.7936 12.6278 11.7192 12.9162L10.4009 18.0287C10.3764 18.1163 10.3239 18.1934 10.2514 18.2484C10.179 18.3033 10.0905 18.3331 9.99961 18.3331C9.90868 18.3331 9.82025 18.3033 9.7478 18.2484C9.67535 18.1934 9.62287 18.1163 9.59836 18.0287L8.28086 12.9162Z" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M16.6667 2.5V5.83333" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M18.3333 4.16602H15" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M3.33325 14.166V15.8327" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M4.16667 15H2.5" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                            <defs>
                                <clipPath id="clip0_30970_14228">
                                    <rect width="20" height="20" fill="white" />
                                </clipPath>
                            </defs>
                        </svg>
                        <span className="hidden xl:inline font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-white">{t.dashboard.blog.editor.aiAssistant}</span>
                    </button>

                    {/* Save Draft Button — icon-only on mobile per Figma */}
                    <button
                        onClick={() => handleSave('draft')}
                        disabled={isSaving || success}
                        className="flex flex-row items-center justify-center h-[46px] xl:h-[50px] w-[70px] xl:w-auto xl:px-[24px] gap-[8px] rounded-[16px] bg-[#1E293B] panel-outline hover:bg-[#1E293B]/80 transition-colors disabled:opacity-50"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.6667 2.5C13.1063 2.50626 13.5256 2.68598 13.8333 3L17 6.16667C17.314 6.47438 17.4937 6.89372 17.5 7.33333V15.8333C17.5 16.2754 17.3244 16.6993 17.0118 17.0118C16.6993 17.3244 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H12.6667Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14.1666 17.5007V11.6673C14.1666 11.4463 14.0788 11.2343 13.9225 11.0781C13.7662 10.9218 13.5543 10.834 13.3333 10.834H6.66659C6.44557 10.834 6.23361 10.9218 6.07733 11.0781C5.92105 11.2343 5.83325 11.4463 5.83325 11.6673V17.5007" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5.83325 2.5V5.83333C5.83325 6.05435 5.92105 6.26631 6.07733 6.42259C6.23361 6.57887 6.44557 6.66667 6.66659 6.66667H12.4999" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="hidden xl:inline font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-[#F8FAFC]">{t.dashboard.blog.editor.saveDraft}</span>
                    </button>

                    {/* Publish Button — always shows icon + text */}
                    <button
                        onClick={() => handleSave('published')}
                        disabled={isSaving || success}
                        className="flex flex-row items-center justify-center px-[24px] h-[48px] gap-[8px] rounded-[16px] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] transition-transform hover:opacity-90 active:scale-95 disabled:opacity-50"
                        style={{ background: 'linear-gradient(90deg, rgba(59, 130, 246, 1) 0%, rgba(57, 137, 243, 1) 7%, rgba(55, 143, 239, 1) 14%, rgba(53, 150, 236, 1) 21%, rgba(51, 156, 233, 1) 29%, rgba(50, 162, 229, 1) 36%, rgba(48, 168, 225, 1) 43%, rgba(47, 174, 222, 1) 50%, rgba(46, 179, 218, 1) 57%, rgba(45, 185, 214, 1) 64%, rgba(45, 191, 209, 1) 71%, rgba(44, 196, 205, 1) 79%, rgba(44, 201, 201, 1) 86%, rgba(45, 207, 196, 1) 93%, rgba(45, 212, 191, 1) 100%)' }}
                    >
                        {isSaving ? (
                            <Loader2 className="w-[20px] h-[20px] text-white animate-spin" />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g clipPath="url(#clip0_30970_13422)">
                                    <path d="M1.71835 10.2908C1.6489 10.1037 1.6489 9.89788 1.71835 9.71079C2.39476 8.07067 3.54294 6.66832 5.01732 5.68154C6.4917 4.69475 8.22588 4.16797 10 4.16797C11.7741 4.16797 13.5083 4.69475 14.9827 5.68154C16.4571 6.66832 17.6053 8.07067 18.2817 9.71079C18.3511 9.89788 18.3511 10.1037 18.2817 10.2908C17.6053 11.9309 16.4571 13.3333 14.9827 14.32C13.5083 15.3068 11.7741 15.8336 10 15.8336C8.22588 15.8336 6.4917 15.3068 5.01732 14.32C3.54294 13.3333 2.39476 11.9309 1.71835 10.2908Z" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                </g>
                                <defs>
                                    <clipPath id="clip0_30970_13422">
                                        <rect width="20" height="20" fill="white" />
                                    </clipPath>
                                </defs>
                            </svg>
                        )}
                        <span className="font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-white">{t.dashboard.blog.editor.publish}</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row items-start gap-[24px] w-full mt-6">
                <div className="flex-1 flex flex-col gap-[24px] min-w-0 w-full">


                    {showDraftRecovery && (
                        <div className="flex items-center justify-between rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3">
                            <p className="text-sm text-yellow-400">
                                {t.dashboard.blog.editor.draftRecoveryMessage || 'Unsaved draft found. Restore it?'}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={restoreDraft}
                                    className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-sm font-medium text-yellow-300 hover:bg-yellow-500/30 transition-colors"
                                >
                                    {t.dashboard.blog.editor.draftRestore || 'Restore'}
                                </button>
                                <button
                                    onClick={dismissDraft}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    {t.dashboard.blog.editor.draftDismiss || 'Dismiss'}
                                </button>
                            </div>
                        </div>
                    )}

                    <style jsx global>{`
                        .panel-outline {
                            border: 1px solid var(--dash-border) !important;
                        }
                    `}</style>

                    <div className="flex flex-col p-[24px] bg-[rgba(30,41,59,0.6)] panel-outline rounded-[16px]">
                        <div className="flex flex-col gap-[8px]">
                            <div className="flex flex-row justify-between items-center h-[20px]">
                                <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[#F8FAFC]">{t.dashboard.blog.editor.postTitle}</label>
                                <span className={"font-['Inter'] font-[400] text-[12px] leading-[1.3333333333333333em] " + (form.title.length > 255 ? "text-red-400" : "text-[rgba(248,250,252,0.5)]")}>
                                    {form.title.length}/255 {t.dashboard.blog.editor.characters}
                                </span>
                            </div>
                            <div className="flex flex-row items-center gap-[10px] pl-[8px] pr-[12px] py-[4px] h-[48px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => updateField('title', e.target.value)}
                                    maxLength={255}
                                    className="w-full bg-transparent border-none focus:outline-none font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[#FAFAFA] placeholder:text-[#737373]"
                                    placeholder={t.dashboard.blog.editor.titlePlaceholder}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col p-[25px] gap-[8px] min-h-[116px] bg-[rgba(30,41,59,0.6)] panel-outline rounded-[16px] flex-shrink-0">
                        <div className="h-[20px]">
                            <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">
                                {t.dashboard.blog.editor.urlSlugLabel}
                            </label>
                        </div>
                        <div className="flex flex-row items-center gap-[8px]">
                            <div className="w-[124px] h-[20px]">
                                <span className="font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.5)]">yoursite.com/blog/</span>
                            </div>
                            <div className="flex-1 flex flex-row items-center gap-[10px] pl-[8px] pr-[12px] py-[4px] h-[48px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                                <input
                                    type="text"
                                    value={form.slug}
                                    onChange={(e) => updateField('slug', formatSlugInput(e.target.value))}
                                    onBlur={(e) => updateField('slug', slugify(e.target.value))}
                                    className="w-full bg-transparent border-none focus:outline-none font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[#FAFAFA] placeholder:text-[#737373]"
                                    placeholder="ksd-vdf"
                                />
                            </div>
                        </div>
                        {error === 'slug_invalid' && (
                            <p className="text-xs text-red-400">{t.dashboard.blog.editor.slugInvalid || 'Slug can only contain lowercase letters, numbers, and hyphens'}</p>
                        )}
                    </div>

                    <div className="flex flex-col p-[25px] gap-[16px] h-[342px] bg-[rgba(30,41,59,0.6)] panel-outline rounded-[16px] flex-shrink-0">
                        <div className="h-[20px]">
                            <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">
                                {t.dashboard.blog.editor.thumbnailLabel}
                            </label>
                        </div>
                        {thumbnailPreview ? (
                            <div className="relative w-full h-[256px] rounded-[16px]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={thumbnailPreview}
                                    alt="Thumbnail preview"
                                    className="w-full h-[256px] object-cover rounded-[16px]"
                                />
                                <button
                                    onClick={(e) => { e.preventDefault(); setThumbnailPreview(null); setThumbnailFile(null); setThumbnailId(null) }}
                                    className="absolute top-[8px] right-[8px] flex items-center justify-center rounded-[8px] bg-[rgba(11,17,32,0.6)] px-[12px] py-[6px] text-[12px] font-[500] text-white hover:bg-[rgba(11,17,32,0.8)] transition-colors panel-outline"
                                >
                                    {t.dashboard.blog.editor.replace}
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center cursor-pointer gap-[12px] py-[68px] h-[256px] border-2 border-dashed border-[rgba(255,255,255,0.08)] rounded-[16px] bg-transparent hover:bg-white/5 transition-colors">
                                <div className="flex items-center justify-center w-[64px] h-[64px] rounded-[33554400px] bg-[rgba(59,130,246,0.1)]">
                                    <Upload className="w-[32px] h-[32px] text-[#3B82F6]" strokeWidth={1.5} />
                                </div>
                                <div className="flex flex-col items-center w-full max-w-[250px] gap-[4px]">
                                    <div className="flex items-center justify-center w-full min-h-[20px] text-center">
                                        <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4285714285714286em] text-[#F8FAFC]">{t.dashboard.blog.editor.clickToUpload}</span>
                                    </div>
                                    <div className="flex flex-row justify-center w-full">
                                        <span className="font-['Inter'] font-[500] text-[12px] leading-[1.3333333333333333em] text-[rgba(248,250,252,0.5)]">{t.dashboard.blog.editor.uploadHint}</span>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg"
                                    className="hidden"
                                    id="thumbnail-upload"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        if (file.size > MAX_IMAGE_SIZE) {
                                            toast.error(t.dashboard.blog.editor.fileTooLarge || 'File exceeds 10MB limit')
                                            e.target.value = ''
                                            return
                                        }
                                        const buffer = await file.slice(0, 8).arrayBuffer()
                                        const { valid } = validateImageMagicBytes(buffer)
                                        if (!valid) {
                                            toast.error(t.dashboard.blog.editor.invalidFileType || 'Only JPEG and PNG files are accepted')
                                            e.target.value = ''
                                            return
                                        }
                                        const url = URL.createObjectURL(file)
                                        setThumbnailPreview(url)
                                        setThumbnailFile(file)
                                    }}
                                />
                            </label>
                        )}
                    </div>

                    <BlogRichEditor
                        key={editorKey}
                        content={form.content}
                        onChange={(html: string) => updateField('content', html)}
                        placeholder={t.dashboard.blog.editor.startWriting}
                    />
                </div>

                <div className="w-full xl:w-[512px] max-w-[512px] flex flex-col gap-[24px] flex-shrink-0">
                    <div className="flex flex-col p-[25px] gap-[20px] bg-[rgba(30,41,59,0.6)] panel-outline rounded-[16px]">
                        <div className="flex flex-row items-center gap-[12px] h-[28px]">
                            <Tag className="w-[20px] h-[20px] text-[#3B82F6]" strokeWidth={1.5} />
                            <span className="font-['Inter'] font-[700] text-[18px] leading-[1.5555555555555556em] text-[#F8FAFC]">{t.dashboard.blog.editor.postSettings}</span>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="h-[20px]">
                                <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">{t.dashboard.blog.editor.category}</label>
                            </div>
                            <Popover open={isCategoryDropdownOpen} onOpenChange={setIsCategoryDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <div className="w-full flex items-center justify-between h-[48px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] px-[12px] font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[#FAFAFA] cursor-pointer outline-none">
                                        <span className="truncate">{categories.find(c => String(c.id) === String(form.category))?.name || t.dashboard.blog.editor.noCategory}</span>
                                        <ChevronDown className="w-[16px] h-[16px] text-[#9F9FA9] shrink-0" />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1.5 rounded-xl relative shadow-xl" style={{ minWidth: 'var(--radix-popover-trigger-width)', backgroundColor: 'var(--dash-secondary-bg)', border: '1px solid var(--dash-border)' }} align="start">
                                    <div className="flex flex-col max-h-[250px] overflow-y-auto px-0.5 gap-0.5 scrollbar-thin scrollbar-track-transparent" style={{ scrollbarColor: 'var(--dash-border) transparent' }}>
                                        <button
                                            className={cn("flex w-full items-center px-3 py-[10px] text-[14px] font-['Inter'] leading-[1.4285714285714286em] rounded-lg text-left transition-colors", !form.category ? "font-[500]" : "font-[400]")}
                                            style={{ backgroundColor: !form.category ? 'var(--dash-surface-hover)' : undefined, color: 'var(--dash-text)' }}
                                            onMouseEnter={e => { if (form.category) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--dash-surface-hover)' }}
                                            onMouseLeave={e => { if (form.category) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                                            onClick={() => { updateField('category', ''); setIsCategoryDropdownOpen(false); }}
                                        >
                                            <span className="truncate w-full">{t.dashboard.blog.editor.noCategory}</span>
                                        </button>
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                className={cn("flex w-full items-center px-3 py-[10px] text-[14px] font-['Inter'] leading-[1.4285714285714286em] rounded-lg text-left transition-colors", String(form.category) === String(cat.id) ? "font-[500]" : "font-[400]")}
                                                style={{ backgroundColor: String(form.category) === String(cat.id) ? 'var(--dash-surface-hover)' : undefined, color: 'var(--dash-text)' }}
                                                onMouseEnter={e => { if (String(form.category) !== String(cat.id)) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--dash-surface-hover)' }}
                                                onMouseLeave={e => { if (String(form.category) !== String(cat.id)) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                                                onClick={() => { updateField('category', String(cat.id)); setIsCategoryDropdownOpen(false); }}
                                            >
                                                <span className="truncate w-full">{cat.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="h-px my-1.5 mx-1" style={{ backgroundColor: 'var(--dash-border)' }} />
                                    <button
                                        onClick={() => { setIsCategoryDropdownOpen(false); setIsCategoryModalOpen(true); }}
                                        className="flex w-full items-center gap-2 px-3 py-[10px] text-[14px] font-[500] font-['Inter'] leading-[1.4285714285714286em] text-cyan-400 hover:text-cyan-300 rounded-lg transition-colors"
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--dash-surface-hover)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                                    >
                                        <Settings2 className="w-4 h-4 shrink-0" />
                                        <span>{t.dashboard.blog.editor.manageCategories}</span>
                                    </button>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="h-[20px]">
                                <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">{t.dashboard.blog.editor.author}</label>
                            </div>
                            <div className="flex flex-row items-center h-[48px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] px-[12px] gap-[10px]">
                                <User className="w-[16px] h-[16px] text-[#9F9FA9]" strokeWidth={1.5} />
                                <span className="font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[#FAFAFA]">
                                    {getAuthorName()}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="h-[20px]">
                                <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">{t.dashboard.blog.editor.publishDate}</label>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button className="flex flex-row items-center w-full h-[48px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] px-[12px] gap-[10px] text-left outline-none cursor-pointer">
                                        <Calendar className="w-[16px] h-[16px] text-[#9F9FA9]" strokeWidth={1.5} />
                                        <span className={cn(
                                            "font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] flex-grow truncate",
                                            !publishDate ? "text-[#737373]" : "text-[#FAFAFA]"
                                        )}>
                                            {publishDate ? format(publishDate, "MMM d, yyyy") : ""}
                                        </span>
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-[#0B1120] border-[rgba(255,255,255,0.08)] text-[#F8FAFC]" align="start">
                                    <CalendarUI
                                        mode="single"
                                        selected={publishDate}
                                        onSelect={setPublishDate}
                                        initialFocus
                                        className="bg-[#0B1120] rounded-[8px] [&_.rdp-day_button:hover]:bg-[#1E293B] [&_.rdp-day_button:focus]:bg-[#1E293B] [&_.rdp-day_button.rdp-selected]:bg-[#2DD4BF] [&_.rdp-day_button.rdp-selected]:text-white"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="flex flex-col p-[25px] gap-[20px] bg-[rgba(30,41,59,0.6)] panel-outline rounded-[16px]">
                        <div className="flex flex-row items-center justify-between w-full h-[32px]">
                            <div className="flex flex-row items-center gap-[12px] h-[28px]">
                                <Sparkles className="w-[20px] h-[20px] text-[#2DD4BF]" strokeWidth={1.5} />
                                <span className="font-['Inter'] font-[700] text-[18px] leading-[1.5555555555555556em] text-[#F8FAFC]">{t.dashboard.blog.editor.seoTitle}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleGenerateSEO()
                                }}
                                disabled={isGeneratingSEO || (!form.title.trim() && !getContentText(form.content).trim())}
                                className="flex flex-row items-center justify-center w-[151.23px] h-[32px] gap-[8px] rounded-[12px] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] transition-transform hover:opacity-90 active:scale-95 disabled:opacity-50"
                                style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(57,137,243,1) 7%, rgba(55,143,239,1) 14%, rgba(53,150,236,1) 21%, rgba(51,156,233,1) 29%, rgba(50,162,229,1) 36%, rgba(48,168,225,1) 43%, rgba(47,174,222,1) 50%, rgba(46,179,218,1) 57%, rgba(45,185,214,1) 64%, rgba(45,191,209,1) 71%, rgba(44,196,205,1) 79%, rgba(44,201,201,1) 86%, rgba(45,207,196,1) 93%, rgba(45,212,191,1) 100%)' }}
                            >
                                {isGeneratingSEO ? <Loader2 className="w-[16px] h-[16px] text-white animate-spin" /> : <Sparkles className="w-[16px] h-[16px] text-white" strokeWidth={1.5} />}
                                <span className="font-['Inter'] font-[600] text-[12px] leading-[1.3333333333333333em] text-white">{t.dashboard.blog.editor.generateSeo}</span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-[7px]">
                            <div className="h-[20px] w-full">
                                <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">{t.dashboard.blog.editor.metaTitle}</label>
                            </div>
                            <div className="flex flex-row items-center px-[12px] py-[4px] h-[48px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 w-full">
                                <input
                                    type="text"
                                    value={form.seoTitle}
                                    onChange={e => updateField('seoTitle', e.target.value)}
                                    maxLength={60}
                                    className="w-full bg-transparent border-none focus:outline-none font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[#FAFAFA] placeholder:text-[#737373]"
                                    placeholder={t.dashboard.blog.editor.seoTitlePlaceholder}
                                />
                            </div>
                            <div className="h-[16px] w-full flex items-center">
                                <span className="font-['Inter'] font-[400] text-[12px] leading-[1.3333333333333333em] text-[rgba(248,250,252,0.5)]">
                                    {form.seoTitle.length}/60 {t.dashboard.blog.editor.characters}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[9px]">
                            <div className="h-[20px] w-full">
                                <label className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[rgba(248,250,252,0.7)]">{t.dashboard.blog.editor.metaDesc}</label>
                            </div>
                            <div className="flex flex-row items-start px-[12px] py-[8px] h-[113px] bg-[#0B1120] panel-outline rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 w-full">
                                <textarea
                                    value={form.seoDescription}
                                    onChange={e => updateField('seoDescription', e.target.value)}
                                    maxLength={160}
                                    className="w-full h-full bg-transparent border-none focus:outline-none font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-[#F8FAFC] placeholder:text-[#737373] resize-none"
                                    placeholder={t.dashboard.blog.editor.seoDescPlaceholder}
                                />
                            </div>
                            <div className="h-[16px] w-full flex items-center">
                                <span className="font-['Inter'] font-[400] text-[12px] leading-[1.3333333333333333em] text-[rgba(248,250,252,0.5)]">
                                    {form.seoDescription.length}/160 {t.dashboard.blog.editor.characters}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Generator Modal */}
            {showAIGenerator && typeof document !== 'undefined' && createPortal(
                <div className="dash-shell">
                <div className="fixed inset-0 w-screen h-screen z-[999] flex items-end xl:items-center justify-center bg-black/60 xl:p-4 animate-in fade-in duration-200">
                    <div className={`flex flex-col w-full xl:w-[768px] h-[85vh] xl:h-auto ${(!isGenerating && generatedAiContent) ? 'xl:h-[826px]' : isGenerating ? 'xl:h-[763px]' : 'xl:h-[417px]'} p-[1px] bg-[#1E293B] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] border-t border-[rgba(255,255,255,0.08)] xl:border rounded-t-[24px] xl:rounded-[16px] transition-all duration-300 overflow-hidden animate-in slide-in-from-bottom xl:slide-in-from-bottom-0 xl:fade-in`}>
                        {/* Mobile drag handle */}
                        <div className="flex xl:hidden items-start justify-center pt-[12px] w-full shrink-0">
                            <div className="bg-[rgba(255,255,255,0.2)] h-[4px] rounded-[9999px] shrink-0 w-[48px]" />
                        </div>
                        {/* Header — mobile: compact 77px / desktop: 97px */}
                        <div
                            className="flex flex-row justify-between items-center w-full px-[24px] h-[77px] xl:h-[97px] flex-shrink-0"
                            style={{ borderBottom: '1px solid var(--dash-border)' }}
                        >
                            <div className="flex flex-row items-center gap-[12px]">
                                <div className="flex flex-row justify-center items-center w-[40px] h-[40px] rounded-[16px] shrink-0" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(45, 212, 191, 1) 100%)' }}>
                                    <Sparkles className="w-[20px] h-[20px] text-white" strokeWidth={1.67} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-['Inter'] font-[700] text-[18px] xl:text-[20px] leading-[28px] text-[#F8FAFC]">{t.dashboard.blog.editor.aiModalTitle}</span>
                                    <span className="font-['Inter'] font-[400] text-[12px] xl:text-[14px] leading-[16px] xl:leading-[20px] text-[rgba(248,250,252,0.6)]">{t.dashboard.blog.editor.aiModalDesc}</span>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.preventDefault(); setShowAIGenerator(false) }}
                                className="flex items-center justify-center w-[36px] h-[36px] rounded-[12px] hover:bg-white/5 transition-colors shrink-0"
                            >
                                <X className="w-[20px] h-[20px] text-[rgba(248,250,252,0.6)]" strokeWidth={1.67} />
                            </button>
                        </div>

                        <div
                            className={`flex flex-col items-start self-stretch flex-1 xl:flex-initial gap-[20px] ${(!isGenerating && generatedAiContent) ? 'xl:h-[628px]' : isGenerating ? 'xl:h-[664px]' : 'xl:h-[318px]'} transition-all duration-300 overflow-y-auto`}
                            style={{ padding: '24px 24px 0 24px' }}
                        >
                            <div className="flex flex-col gap-[8px] w-full">
                                <div className="flex items-center w-full h-[20px]">
                                    <span className="font-['Inter'] font-[600] text-[14px] leading-[20px] text-[#F8FAFC]">{t.dashboard.blog.editor.aiTopicLabel}</span>
                                </div>
                                <div className="flex flex-row items-center px-[16px] py-[16px] xl:py-[4px] h-[58px] xl:h-[48px] bg-[#0B1120] border border-[rgba(255,255,255,0.08)] rounded-[16px] xl:rounded-[8px] focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
                                    <input
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        placeholder={t.dashboard.blog.editor.titlePlaceholder}
                                        className="w-full bg-transparent border-none focus:outline-none font-['Inter'] font-[400] text-[16px] leading-[24px] text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.4)]"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-[12px] w-full">
                                <div className="flex items-center h-[20px] w-full">
                                    <span className="font-['Inter'] font-[600] text-[14px] leading-[20px] text-[#F8FAFC]">{t.dashboard.blog.editor.aiToneLabel}</span>
                                </div>
                                <div className="flex flex-col xl:flex-row justify-between gap-[8px] xl:gap-[12px] w-full">
                                    {([
                                        { key: 'Professional', emoji: '💼', label: t.dashboard.blog.editor.aiToneProfessional, desc: t.dashboard.blog.editor.aiToneProfessionalDesc },
                                        { key: 'Friendly', emoji: '😊', label: t.dashboard.blog.editor.aiToneFriendly, desc: t.dashboard.blog.editor.aiToneFriendlyDesc },
                                        { key: 'Persuasive', emoji: '🎯', label: t.dashboard.blog.editor.aiTonePersuasive, desc: t.dashboard.blog.editor.aiTonePersuasiveDesc },
                                    ] as const).map((tone) => (
                                        <button
                                            key={tone.key}
                                            onClick={(e) => { e.preventDefault(); setAiTone(tone.key) }}
                                            className="flex flex-row items-center gap-[12px] shrink-0 xl:flex-1 h-[70px] xl:h-[56px] px-[17px] xl:px-0 xl:justify-center transition-all relative rounded-[16px]"
                                            style={aiTone === tone.key ? {
                                                border: '1px solid #3B82F6',
                                                background: 'rgba(59, 130, 246, 0.10)',
                                                boxShadow: '0 0 20px 0 rgba(59, 130, 246, 0.30)'
                                            } : {
                                                border: '1px solid var(--dash-border)',
                                                background: 'var(--dash-surface)'
                                            }}
                                        >
                                            <span className="text-[24px] xl:text-[18px] leading-[32px] shrink-0">{tone.emoji}</span>
                                            <div className="flex flex-col items-start xl:items-center flex-1 xl:flex-initial">
                                                <span className={`font-['Inter'] font-[600] xl:font-[500] text-[14px] leading-[20px] ${aiTone === tone.key ? 'text-[#3B82F6]' : 'text-[#F8FAFC]'}`}>{tone.label}</span>
                                                <span className="xl:hidden font-['Inter'] font-[500] text-[12px] leading-[16px] text-[rgba(248,250,252,0.5)]">{tone.desc}</span>
                                            </div>
                                            {aiTone === tone.key && <Check className="xl:hidden w-[20px] h-[20px] text-[#3B82F6] shrink-0" strokeWidth={2} />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(!isGenerating && !generatedAiContent) && (
                                <button
                                    onClick={handleGenerateWithAI}
                                    disabled={!aiPrompt.trim()}
                                    className="flex flex-row justify-center items-center gap-[8px] w-full h-[56px] xl:h-[48px] rounded-[16px] xl:rounded-[10px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transition-all"
                                    style={{ background: !aiPrompt.trim() ? 'rgba(59, 130, 246, 0.5)' : 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(45,212,191,1) 100%)' }}
                                >
                                    <Sparkles className="w-[20px] h-[20px] text-white" strokeWidth={1.67} />
                                    <span className={`font-['Inter'] font-[600] text-[16px] leading-[24px] ${!aiPrompt.trim() ? 'text-[rgba(255,255,255,0.5)]' : 'text-white'}`}>
                                        {t.dashboard.blog.editor.aiGenerateBtn}
                                    </span>
                                </button>
                            )}
                            {isGenerating && (
                                <div className="w-full flex">
                                    <button
                                        disabled
                                        className="flex flex-row justify-center items-center gap-[4px] w-full h-[56px] rounded-[16px] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] transition-all"
                                        style={{ background: 'rgba(59, 130, 246, 0.5)' }}
                                    >
                                        <Loader2 className="w-[28px] h-[28px] text-[rgba(255,255,255,0.5)] animate-spin" />
                                        <span className="font-['Inter'] font-[600] text-[16px] leading-[1.5em] text-[rgba(255,255,255,0.5)]">{t.dashboard.blog.editor.aiGenerating}</span>
                                    </button>
                                </div>
                            )}

                            {(isGenerating || generatedAiContent) && (
                                <div className="flex flex-col items-stretch self-stretch gap-[16px] w-full h-[366px] animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="h-[20px] flex items-center">
                                        <span className="font-['Inter'] font-[600] text-[14px] leading-[1.4285714285714286em] text-[#F8FAFC]">{t.dashboard.blog.editor.aiGeneratedContent}</span>
                                    </div>
                                    <div className={`relative flex flex-col items-stretch w-full ${(!isGenerating && generatedAiContent) ? 'h-[330px]' : 'h-[300px]'} bg-[#0B1120] border-[1px] border-[rgba(255,255,255,0.08)] rounded-[16px] px-[17px] pt-[17px] pb-[1px] overflow-hidden`}>
                                        {isGenerating ? (
                                            <div className="relative w-full h-[156px]">
                                                <div className="absolute left-0 top-[0px] w-[522px] h-[16px] bg-[rgba(255,255,255,0.1)] opacity-[0.523] rounded-[4px] animate-pulse"></div>
                                                <div className="absolute left-0 top-[28px] w-[620px] h-[16px] bg-[rgba(255,255,255,0.1)] opacity-[0.523] rounded-[4px] animate-pulse"></div>
                                                <div className="absolute left-0 top-[56px] w-[556px] h-[16px] bg-[rgba(255,255,255,0.1)] opacity-[0.523] rounded-[4px] animate-pulse"></div>
                                                <div className="absolute left-0 top-[84px] w-[646px] h-[16px] bg-[rgba(255,255,255,0.1)] opacity-[0.523] rounded-[4px] animate-pulse"></div>
                                                <div className="absolute left-0 top-[112px] w-[546px] h-[16px] bg-[rgba(255,255,255,0.1)] opacity-[0.523] rounded-[4px] animate-pulse"></div>
                                                <div className="absolute left-0 top-[140px] w-[657px] h-[16px] bg-[rgba(255,255,255,0.1)] opacity-[0.523] rounded-[4px] animate-pulse"></div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full overflow-y-auto pb-[16px] nice-scrollbar">
                                                {generatedAiData?.title && (
                                                    <div className="mb-4">
                                                        <h3 className="text-lg font-bold text-white mb-1">{generatedAiData.title}</h3>
                                                        <p className="text-xs text-gray-500 mb-4">{t.dashboard.blog.editor.slugLabel} {slugify(generatedAiData.title)}</p>
                                                    </div>
                                                )}
                                                <div className="w-full font-['Inter'] font-[400] text-[14px] leading-[1.625em] tracking-[-0.0107em] text-[rgba(248,250,252,0.9)] whitespace-pre-wrap border-t border-[rgba(255,255,255,0.08)] pt-4">
                                                    {generatedAiContent}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {(!isGenerating && generatedAiContent) && (
                            <div
                                className="flex flex-col xl:flex-row justify-end items-stretch xl:items-center self-stretch gap-[12px] p-[24px] xl:h-[101px] xl:pr-[24px] rounded-b-[16px] animate-in fade-in slide-in-from-bottom-2 duration-300 flex-shrink-0"
                                style={{ background: 'var(--dash-bg)', borderTop: '1px solid var(--dash-border)' }}
                            >
                                <button
                                    onClick={handleGenerateWithAI}
                                    disabled={isGenerating}
                                    className="flex flex-row justify-center items-center gap-[6px] h-[48px] px-[16px] bg-[#0B1120] border-[1px] border-[rgba(255,255,255,0.08)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:bg-white/5 active:scale-95 transition-all w-full xl:w-auto"
                                >
                                    <RefreshCw className="w-[16px] h-[16px] text-[#FAFAFA]" />
                                    <span className="font-['Inter'] font-[500] text-[14px] text-[#FAFAFA]">{t.dashboard.blog.editor.aiRegenerate}</span>
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (generatedAiData) {
                                            setForm(prev => ({
                                                ...prev,
                                                title: generatedAiData.title || prev.title,
                                                slug: generatedAiData.title ? slugify(generatedAiData.title) : prev.slug,
                                                content: generatedAiData.content || prev.content,
                                                seoTitle: generatedAiData.seoTitle || generatedAiData.title || prev.seoTitle,
                                                seoDescription: generatedAiData.seoDescription || prev.seoDescription
                                            }))
                                            if (generatedAiData.content) {
                                                setEditorKey(k => k + 1)
                                            }
                                        }
                                        setShowAIGenerator(false);
                                    }}
                                    className="flex flex-row justify-center items-center gap-[6px] w-full xl:w-[187px] h-[48px] px-[10px] border-[1px] border-[rgba(255,255,255,0.08)] rounded-[10px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)] hover:opacity-90 active:scale-95 transition-all"
                                    style={{ background: 'linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(57,137,243,1) 7%, rgba(55,143,239,1) 14%, rgba(53,150,236,1) 21%, rgba(51,156,233,1) 29%, rgba(50,162,229,1) 36%, rgba(48,168,225,1) 43%, rgba(47,174,222,1) 50%, rgba(46,179,218,1) 57%, rgba(45,185,214,1) 64%, rgba(45,191,209,1) 71%, rgba(44,196,205,1) 79%, rgba(44,201,201,1) 86%, rgba(45,207,196,1) 93%, rgba(45,212,191,1) 100%)' }}
                                >
                                    <Check className="w-[16px] h-[16px] text-[#FAFAFA]" />
                                    <span className="font-['Inter'] font-[500] text-[14px] text-[#FAFAFA]">{t.dashboard.blog.editor.aiInsertBtn}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                </div>,
                document.body
            )}
            {isCategoryModalOpen && typeof document !== 'undefined' && createPortal(
                <CategoryModal
                    onClose={() => setIsCategoryModalOpen(false)}
                    onCategoryUpdated={() => {
                        getBlogCategoriesAction()
                            .then(docs => setCategories(docs || []))
                            .catch(() => { })
                    }}
                />,
                document.body
            )}
        </div >
    )
}
