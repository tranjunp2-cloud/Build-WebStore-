'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Save, Sparkles, Loader2, FileText,
    ImageIcon, Eye, EyeOff, ChevronDown, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type BlogCategory = {
    id: string
    name: string
}

type BlogForm = {
    title: string
    slug: string
    content: string
    status: 'draft' | 'published'
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

export default function BlogEditorPage() {
    const params = useParams()
    const router = useRouter()
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

    // AI Generator State
    const [showAIGenerator, setShowAIGenerator] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiLanguage, setAiLanguage] = useState('en')
    const [isGenerating, setIsGenerating] = useState(false)

    // Load categories
    useEffect(() => {
        fetch('/api/blog-categories', { credentials: 'include' })
            .then(r => r.json())
            .then(json => setCategories(json.data || []))
            .catch(() => { })
    }, [])

    // Load existing blog post when editing
    useEffect(() => {
        if (isNew) return
        async function loadPost() {
            try {
                const res = await fetch(`/api/blogs/${blogId}`, { credentials: 'include' })
                if (res.ok) {
                    const json = await res.json()
                    const data = json.data
                    setForm({
                        title: data.title || '',
                        slug: data.slug || '',
                        content: data.content || '',
                        status: data.status || 'draft',
                        category: typeof data.category === 'object' ? String(data.category?.id ?? '') : String(data.category ?? ''),
                        seoTitle: data.seo?.metaTitle || '',
                        seoDescription: data.seo?.metaDescription || '',
                    })
                    if (data.thumbnail?.url) {
                        // Strip origin to get relative path (Payload returns absolute URLs)
                        const thumbUrl = data.thumbnail.url.replace(/^https?:\/\/[^/]+/, '')
                        setThumbnailPreview(thumbUrl)
                        const existingThumbId = typeof data.thumbnail === 'object' ? data.thumbnail.id : data.thumbnail
                        if (existingThumbId) setThumbnailId(existingThumbId)
                    }
                } else {
                    toast.error('Failed to load post')
                    setError('Failed to load post')
                }
            } catch {
                toast.error('Network error')
                setError('Network error')
            } finally {
                setIsLoading(false)
            }
        }
        loadPost()
    }, [blogId, isNew])

    const updateField = useCallback((field: keyof BlogForm, value: string) => {
        setForm(prev => {
            const updated = { ...prev, [field]: value }
            // AC: Auto-generate slug from title (only for new posts or while slug is empty)
            if (field === 'title' && (isNew || !prev.slug)) {
                updated.slug = slugify(value)
            }
            return updated
        })
        setError(null)
    }, [isNew])

    // AC-2: Validation
    const validate = (): string | null => {
        if (!form.title.trim()) return 'Title is required'
        if (form.title.length > 100) return 'Title must be less than 100 characters'
        return null
    }

    const handleSave = async (overrideStatus?: 'draft' | 'published') => {
        const validationError = validate()
        if (validationError) {
            setError(validationError)
            toast.error(validationError)
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            // Upload thumbnail if a new file was selected
            let resolvedThumbnailId = thumbnailId
            if (thumbnailFile) {
                try {
                    const formData = new FormData()
                    formData.append('file', thumbnailFile)
                    formData.append('_payload', JSON.stringify({ alt: form.title || thumbnailFile.name }))
                    const uploadRes = await fetch('/api/media', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    })
                    if (uploadRes.ok) {
                        const uploadJson = await uploadRes.json()
                        resolvedThumbnailId = uploadJson.doc?.id || uploadJson.id || null
                        if (resolvedThumbnailId) setThumbnailId(resolvedThumbnailId)
                    } else {
                        toast.error('Failed to upload thumbnail')
                    }
                } catch {
                    toast.error('Thumbnail upload error')
                }
            }

            const body: Record<string, any> = {
                title: form.title.trim(),
                slug: form.slug || slugify(form.title),
                content: form.content,
                status: overrideStatus ?? form.status,
                category: form.category || null,
                thumbnail: resolvedThumbnailId || (thumbnailPreview ? undefined : null),
                seo: {
                    metaTitle: form.seoTitle,
                    metaDescription: form.seoDescription,
                },
            }

            const url = isNew ? '/api/blogs' : `/api/blogs/${blogId}`
            const method = isNew ? 'POST' : 'PATCH'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            })

            if (res.ok) {
                setSuccess(true)
                toast.success(isNew ? 'Post created!' : 'Post saved!')
                if (overrideStatus) {
                    setForm(prev => ({ ...prev, status: overrideStatus }))
                }
                setTimeout(() => {
                    router.push('/blog')
                }, 1000)
            } else {
                const data = await res.json()
                const errObj = data.error
                let displayMsg = 'Failed to save'
                if (typeof errObj === 'string') {
                    displayMsg = errObj
                } else if (errObj?.details?.fieldErrors) {
                    // Zod validation errors → extract field-level messages
                    const fieldErrors = errObj.details.fieldErrors as Record<string, string[]>
                    const messages = Object.entries(fieldErrors)
                        .map(([field, errs]) => `${field}: ${errs.join(', ')}`)
                        .join('; ')
                    displayMsg = messages || errObj.code || 'Validation error'
                } else if (typeof errObj?.details === 'string') {
                    displayMsg = errObj.details
                } else if (errObj?.message) {
                    displayMsg = errObj.message
                } else if (errObj?.code) {
                    displayMsg = errObj.code
                }
                setError(displayMsg)
                toast.error(displayMsg)
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error'
            setError(msg)
            toast.error(msg)
        } finally {
            setIsSaving(false)
        }
    }

    // Helper: safely extract plain text from content (richText JSON or string)
    const getContentText = (content: any): string => {
        if (!content) return ''
        if (typeof content === 'string') return content.replace(/<[^>]*>/g, '')
        // Payload richText (Lexical) → extract text from JSON
        try {
            const extractText = (node: any): string => {
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

    // AC-3: AI generate SEO metadata from blog content
    const handleGenerateSEO = async () => {
        const contentText = getContentText(form.content)
        if (!form.title.trim() && !contentText) {
            toast.error('Enter title or content first')
            return
        }
        setIsGeneratingSEO(true)
        setError(null)
        try {
            // Use generate-blog API with SEO-focused prompt
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
                    toast.success('SEO metadata generated!')
                } else {
                    // AI returned but no SEO fields → fallback
                    setForm(prev => ({
                        ...prev,
                        seoTitle: prev.title.substring(0, 60),
                        seoDescription: contentText.substring(0, 155),
                    }))
                    setShowSEO(true)
                    toast.success('SEO auto-filled from content')
                }
            } else {
                // API error → Fallback: auto-fill from title/content
                setForm(prev => ({
                    ...prev,
                    seoTitle: prev.title.substring(0, 60),
                    seoDescription: contentText.substring(0, 155),
                }))
                setShowSEO(true)
                toast.success('SEO auto-filled from content')
            }
        } catch {
            // Network error → Fallback
            setForm(prev => ({
                ...prev,
                seoTitle: prev.title.substring(0, 60),
                seoDescription: contentText.substring(0, 155),
            }))
            setShowSEO(true)
            toast.success('SEO auto-filled from content')
        } finally {
            setIsGeneratingSEO(false)
        }
    }

    // Loading skeleton
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
            toast.loading('AI is writing your post...', { id: 'ai-blog' })

            const res = await fetch('/api/ai/generate-blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, language: aiLanguage })
            })

            const json = await res.json()
            if (!res.ok || !json.success) throw new Error(json.error || 'Failed to generate')

            const { title, content, seoTitle, seoDescription } = json.data

            setForm(prev => ({
                ...prev,
                title: title || prev.title,
                content: content || prev.content,
                seoTitle: seoTitle || prev.seoTitle,
                seoDescription: seoDescription || prev.seoDescription
            }))

            if (isNew && title) {
                setForm(prev => ({ ...prev, slug: slugify(title) }))
            }

            toast.success('Post generated successfully!', { id: 'ai-blog' })
            setShowAIGenerator(false)
        } catch (error: any) {
            toast.error(error.message || 'AI generation failed', { id: 'ai-blog' })
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/blog"
                        aria-label="Back to blog list"
                        className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <h1 className="truncate text-xl font-bold text-white">
                        {isNew ? 'New Blog Post' : `Edit: ${form.title || 'Untitled'}`}
                    </h1>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => setShowAIGenerator(true)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-colors"
                    >
                        <Sparkles className="w-4 h-4" />
                        AI Write
                    </button>
                    {/* Save as Draft */}
                    <button
                        onClick={() => handleSave('draft')}
                        disabled={isSaving || success}
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Save Draft
                    </button>
                    {/* Save / Publish */}
                    <button
                        onClick={() => handleSave()}
                        disabled={isSaving || success}
                        className={cn(
                            'flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors shadow-lg',
                            success
                                ? 'bg-green-600 shadow-green-500/25'
                                : 'bg-cyan-600 shadow-cyan-500/25 hover:bg-cyan-500'
                        )}
                    >
                        {isSaving ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                        ) : success ? (
                            <><FileText className="h-4 w-4" /> Saved!</>
                        ) : (
                            <><Save className="h-4 w-4" /> Save</>
                        )}
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Basic Info Card */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Post Details</h2>

                {/* Title — AC-2 */}
                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-400">
                            Title <span className="text-red-400">*</span>
                        </label>
                        <span className={cn("text-[10px]", form.title.length > 100 ? "text-red-400" : "text-gray-600")}>
                            {form.title.length}/100
                        </span>
                    </div>
                    <input
                        id="blog-title"
                        value={form.title}
                        onChange={e => updateField('title', e.target.value)}
                        maxLength={100}
                        placeholder="e.g. How to grow your online store in 2026"
                        className={cn(
                            "mt-1.5 w-full rounded-lg border bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1",
                            !form.title.trim() && error === 'Title is required'
                                ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
                                : "border-white/10 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                        )}
                    />
                    {!form.title.trim() && error === 'Title is required' && (
                        <p className="mt-1 text-xs text-red-400">Title is required</p>
                    )}
                </div>

                {/* Slug — auto from title */}
                <div>
                    <label className="text-xs font-medium text-gray-400">URL Slug</label>
                    <div className="mt-1.5 flex items-center rounded-lg border border-white/10 bg-[#0B1120] overflow-hidden focus-within:border-cyan-500/50">
                        <span className="hidden sm:flex px-3 text-xs text-gray-600 border-r border-white/10 py-2.5 whitespace-nowrap">/blog/</span>
                        <input
                            value={form.slug}
                            onChange={e => updateField('slug', slugify(e.target.value))}
                            placeholder="my-blog-post-slug"
                            className="flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-300 outline-none min-w-0"
                        />
                    </div>
                </div>

                {/* Category + Status row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Category — AC-1 */}
                    <div>
                        <label className="text-xs font-medium text-gray-400">Category</label>
                        <div className="relative mt-1.5">
                            <select
                                value={form.category}
                                onChange={e => updateField('category', e.target.value)}
                                className="w-full appearance-none rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50 pr-8"
                            >
                                <option value="">— No category —</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-xs font-medium text-gray-400">Status</label>
                        <div className="mt-1.5 flex gap-2">
                            {(['draft', 'published'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => updateField('status', s)}
                                    className={cn(
                                        'flex-1 rounded-lg py-2.5 text-xs font-medium transition-colors capitalize border',
                                        form.status === s
                                            ? s === 'published'
                                                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                                : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                            : 'bg-white/5 text-gray-500 border-transparent hover:bg-white/10 hover:text-gray-300'
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Card — AC-1 */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Content</h2>
                    <span className="text-xs text-gray-600">{getContentText(form.content).length} chars</span>
                </div>
                <textarea
                    id="blog-content"
                    value={form.content}
                    onChange={e => updateField('content', e.target.value)}
                    placeholder="Write your blog post content here..."
                    rows={16}
                    className="w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 resize-y font-mono leading-relaxed"
                />
            </div>

            {/* Thumbnail Card — AC-1 */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Thumbnail</h2>
                {thumbnailPreview ? (
                    <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={thumbnailPreview}
                            alt="Thumbnail preview"
                            className="w-full max-h-48 object-cover rounded-lg border border-white/10"
                        />
                        <button
                            onClick={() => { setThumbnailPreview(null); setThumbnailFile(null); setThumbnailId(null) }}
                            className="absolute top-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80 transition-colors"
                        >
                            Remove
                        </button>
                    </div>
                ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 py-10 hover:border-cyan-500/50 hover:bg-white/8 transition-colors">
                        <ImageIcon className="h-8 w-8 text-gray-600" />
                        <span className="text-sm text-gray-500">Click to upload thumbnail</span>
                        <span className="text-xs text-gray-600">PNG, JPG, WebP — max 5MB</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    const url = URL.createObjectURL(file)
                                    setThumbnailPreview(url)
                                    setThumbnailFile(file)
                                }
                            }}
                        />
                    </label>
                )}
                <p className="text-xs text-gray-600">
                    PNG, JPG, WebP — max 5MB. Image will be uploaded when you save.
                </p>
            </div>

            {/* SEO Panel — AC-3 */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                <div
                    onClick={() => setShowSEO(prev => !prev)}
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">SEO Settings</h2>
                        {(form.seoTitle || form.seoDescription) && (
                            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400 border border-green-500/20">
                                Filled
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* AI generate SEO button — AC-3 */}
                        <button
                            onClick={e => {
                                e.stopPropagation()
                                handleGenerateSEO()
                            }}
                            disabled={isGeneratingSEO || (!form.title.trim() && !form.content.trim())}
                            className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-1 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-40"
                        >
                            {isGeneratingSEO ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                            ) : (
                                <><Sparkles className="h-3 w-3" /> ✨ Optimise SEO with AI</>
                            )}
                        </button>
                        {showSEO ? (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                            <Eye className="h-4 w-4 text-gray-500" />
                        )}
                    </div>
                </div>

                {showSEO && (
                    <div className="px-6 pb-6 space-y-4 border-t border-white/10 pt-5">
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-400">Meta Title</label>
                                <span className="text-[10px] text-gray-600">{form.seoTitle.length}/60</span>
                            </div>
                            <input
                                value={form.seoTitle}
                                onChange={e => updateField('seoTitle', e.target.value)}
                                maxLength={60}
                                placeholder="SEO title for search engines"
                                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-gray-400">Meta Description</label>
                                <span className="text-[10px] text-gray-600">{form.seoDescription.length}/155</span>
                            </div>
                            <textarea
                                value={form.seoDescription}
                                onChange={e => updateField('seoDescription', e.target.value)}
                                rows={3}
                                maxLength={155}
                                placeholder="Brief description for search results"
                                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 resize-none"
                            />
                        </div>

                        {/* Search preview */}
                        {(form.seoTitle || form.title) && (
                            <div className="rounded-lg bg-[#0B1120] border border-white/5 p-4">
                                <p className="text-[10px] text-gray-600 mb-2">Google Preview</p>
                                <p className="text-sm text-blue-400 hover:underline cursor-pointer line-clamp-1">
                                    {form.seoTitle || form.title}
                                </p>
                                <p className="text-xs text-green-500/80 mt-0.5">
                                    yoursite.com/blog/{form.slug || 'post-slug'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                    {form.seoDescription || getContentText(form.content).substring(0, 155) || 'No description'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* AI Generator Modal */}
            {showAIGenerator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1120] p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                AI Blog Assistant
                            </h3>
                            <button onClick={() => setShowAIGenerator(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-gray-400 mb-1.5 block">What should the post be about?</label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    placeholder="e.g. 5 essential tips to start a successful online store in Malaysia in 2026"
                                    className="w-full h-24 rounded-lg border border-white/10 bg-[#1E293B]/50 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-400 mb-1.5 block">Language</label>
                                <div className="relative">
                                    <select
                                        value={aiLanguage}
                                        onChange={e => setAiLanguage(e.target.value)}
                                        className="w-full rounded-lg border border-white/10 bg-[#1E293B]/50 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 appearance-none"
                                    >
                                        <option value="en">English</option>
                                        <option value="vi">Tiếng Việt</option>
                                        <option value="ms">Bahasa Melayu</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <ChevronDown className="h-4 w-4 text-gray-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAIGenerator(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateWithAI}
                                disabled={!aiPrompt.trim() || isGenerating}
                                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Writing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Generate Post
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
