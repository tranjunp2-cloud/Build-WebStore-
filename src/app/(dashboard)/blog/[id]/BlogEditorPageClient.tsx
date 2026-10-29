'use client'

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Save, Sparkles, Loader2, FileText,
    ImageIcon, Eye, EyeOff, ChevronDown, X,
    Settings2, User, Calendar, Globe, Link2, List, ListOrdered, Upload, Quote,
    Tag, Wand2, Check, Briefcase, Smile, Target, RefreshCw, Lock
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
import { useAgentChanges } from '@/lib/agent-changes/use-agent-changes'
import { AgentChangedNotice, SaveConflictNotice } from '@/components/agent/agent-changed-notice'
import { useSaveVersion } from '@/lib/save-version/use-save-version'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import { CategoryModal } from '../_components/CategoryModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ChangeSet } from '@ech/agent-core'
// types only: the copilot (blog-agent → @ech/agent-react, the chat panel and its styles) is loaded
// on demand, only when it is switched on (BlogAgentShell below)
import type * as BlogAgentModule from '../_components/ai/blog-agent'
import { appliedKey, blogAiPreview, createdPostId, isStaleChange, type BlogAiField } from '../_components/ai/blog-ai-draft'
import { AiMark, BlogAiBar, type BlogAiLabels, type BlogAiPhase } from '../_components/ai/blog-ai-marks'

const BlogRichEditor = dynamic(
    () => import('../_components/BlogRichEditor').then(mod => mod.BlogRichEditor),
    { ssr: false, loading: () => <div className="flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[16px] overflow-hidden min-h-[523px] animate-pulse" /> }
)

type BlogAgentValue = ReturnType<typeof BlogAgentModule.useBlogAgent>
/** The copilot as the editor sees it, plus the key its chat is kept under (blog-agent's own). */
type EditorAgentValue = BlogAgentValue & { threadKey?: (blogId: string) => string }

/** The copilot switched off: the editor works without it (nothing of blog-agent is loaded). */
const AGENT_OFF: EditorAgentValue = {
    enabled: false,
    draft: undefined,
    busy: false,
    decide: async (changeSet) => changeSet,
    undo: undefined,
    askAgainFor: () => undefined,
    threadId: undefined,
    setHandlers: () => undefined,
    panel: null,
}
const EditorAgentContext = createContext<EditorAgentValue>(AGENT_OFF)
const useEditorAgent = () => useContext(EditorAgentContext)

/** The copilot, loaded on demand: blog-agent's provider, its value handed to the editor's context. */
const BlogAgentShell = lazy(() => import('../_components/ai/blog-agent').then((mod) => {
    function BlogAgentBridge({ children }: { children: ReactNode }) {
        const agent = mod.useBlogAgent()
        return <EditorAgentContext.Provider value={{ ...agent, threadKey: mod.blogThreadKey }}>{children}</EditorAgentContext.Provider>
    }
    function LoadedBlogAgentShell({ blogId, children }: { blogId: string; children: ReactNode }) {
        return (
            <mod.BlogAgentProvider blogId={blogId} enabled>
                <BlogAgentBridge>{children}</BlogAgentBridge>
            </mod.BlogAgentProvider>
        )
    }
    return { default: LoadedBlogAgentShell }
}))

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

function BlogEditorInner() {
    const params = useParams()
    const router = useRouter()
    const { t, locale } = useI18n()
    const sub = t.common.subscriptionErrors
    const blogId = params?.id as string
    const isNew = blogId === 'new'

    const [form, setForm] = useState<BlogForm>(initialForm)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
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

    // The post as last loaded from the server: what "unsaved edits" is measured against.
    const baselineRef = useRef<{ form: BlogForm; thumbnailId: string | null }>({ form: initialForm, thumbnailId: null })
    // the post's updatedAt as loaded: sent with each save so a newer change is never written over
    const version = useSaveVersion()
    const s3Url = (url: string) => url.replace(/https?:\/\/minio:\d+/, process.env.NEXT_PUBLIC_S3_ENDPOINT || 'http://localhost:9000')

    // Puts a whole post from the server into the form.
    const applyPost = (data: Awaited<ReturnType<typeof getBlogByIdAction>>) => {
        const next: BlogForm = {
            title: data.title || '',
            slug: data.slug || '',
            content: data.content || '',
            status: data.status || 'draft',
            category: typeof data.category === 'object' ? String(data.category?.id ?? '') : String(data.category ?? ''),
            seoTitle: data.seo?.metaTitle || '',
            seoDescription: data.seo?.metaDescription || '',
        }
        const thumb = data.thumbnail && typeof data.thumbnail === 'object' ? data.thumbnail : null
        const rawThumbId = thumb ? thumb.id : data.thumbnail
        const nextThumbId = rawThumbId ? String(rawThumbId) : null
        // Fix Docker-internal MinIO URL to browser-accessible URL
        // On local: minio:9000 → localhost:9000 (port-mapped)
        // On staging/prod: S3 URL is already correct, no replacement needed
        setForm(next)
        setThumbnailPreview(thumb?.url ? s3Url(thumb.url) : null)
        setThumbnailId(nextThumbId)
        setThumbnailFile(null)
        setPublishDate(new Date(data.publishedAt || data.createdAt))
        baselineRef.current = { form: next, thumbnailId: nextThumbId }
        version.set(data.updatedAt)
    }

    // Load existing blog post when editing
    useEffect(() => {
        if (isNew) return
        async function loadPost() {
            try {
                const data = await getBlogByIdAction(blogId as string)
                if (data) {
                    applyPost(data)
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
            if (aiRef.current?.phase === 'pending') return
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

    // ─── AI writer (ai-platform copilot) ─────────────────────────────────
    // A waiting AI change is shown in the form (locked) until it is kept or
    // discarded; keeping approves it server-side, so the post, its photos and
    // Undo are the server's — the form then shows what was written.
    const agent = useEditorAgent()
    const E = t.dashboard.blog.editor
    const aiLabels: BlogAiLabels = {
        tag: E.aiMarkTag, undoPart: E.aiUndoPart, keepPart: E.aiKeepPart,
        draftTitle: E.aiDraftTitle, editTitle: E.aiEditTitle, pendingNote: E.aiPendingNote,
        appliedTitle: E.aiAppliedTitle, appliedNote: E.aiAppliedNote, savedTitle: E.aiSavedTitle, savedNote: E.aiSavedNote,
        keepAll: E.aiKeepAll, discard: E.aiDiscard, askChanges: E.aiAskChanges, undoAll: E.aiUndoAll, done: E.aiDone,
        parts: { title: E.aiPartTitle, content: E.aiPartContent, cover: E.aiPartCover, seo: E.aiPartSeo },
    }
    const [sideTab, setSideTab] = useState<'ai' | 'settings'>(agent.enabled && isNew ? 'ai' : 'settings')
    type AiSnapshot = Pick<BlogForm, 'title' | 'slug' | 'content' | 'seoTitle' | 'seoDescription'> & { thumbnailPreview: string | null; thumbnailId: string | null }
    type AiState = { phase: BlogAiPhase; kind: 'create' | 'update'; fields: BlogAiField[]; changeSetId: string; before: AiSnapshot; applied?: ChangeSet }
    const [ai, setAi] = useState<AiState | null>(null)
    const [aiBusy, setAiBusy] = useState(false)
    const aiRef = useRef<AiState | null>(null)
    useEffect(() => {
        aiRef.current = ai
    }, [ai])
    const aiPending = ai?.phase === 'pending'
    const phaseOf = (field: BlogAiField): BlogAiPhase | null => (ai && ai.fields.includes(field) ? ai.phase : null)

    const snapshot = (): AiSnapshot => ({
        title: form.title, slug: form.slug, content: form.content, seoTitle: form.seoTitle, seoDescription: form.seoDescription,
        thumbnailPreview, thumbnailId,
    })
    const restore = (before: AiSnapshot, fields?: BlogAiField[]) => {
        const all = !fields
        setForm(prev => ({
            ...prev,
            ...(all || fields.includes('title') ? { title: before.title, slug: before.slug } : {}),
            ...(all || fields.includes('content') ? { content: before.content } : {}),
            ...(all || fields.includes('seo') ? { seoTitle: before.seoTitle, seoDescription: before.seoDescription } : {}),
        }))
        if (all || fields.includes('cover')) {
            setThumbnailPreview(before.thumbnailPreview)
            setThumbnailId(before.thumbnailId)
            setThumbnailFile(null)
        }
        if (all || fields.includes('content')) setEditorKey(k => k + 1)
    }

    // The post as the server has it now (after an approved AI edit): the written values, real photo URLs, the new cover id.
    const refreshFromServer = async (fields: BlogAiField[]) => {
        if (isNew) return
        const data = await getBlogByIdAction(blogId).catch(() => null)
        if (!data) return
        const base = baselineRef.current
        const patch: Partial<BlogForm> = {
            ...(fields.includes('title') ? { title: data.title || '', slug: data.slug || base.form.slug } : {}),
            ...(fields.includes('content') ? { content: data.content || '' } : {}),
            ...(fields.includes('seo') ? { seoTitle: data.seo?.metaTitle || '', seoDescription: data.seo?.metaDescription || '' } : {}),
        }
        setForm(prev => ({ ...prev, ...patch }))
        let nextThumbId = base.thumbnailId
        if (fields.includes('content')) setEditorKey(k => k + 1)
        if (fields.includes('cover')) {
            const thumb = data.thumbnail && typeof data.thumbnail === 'object' ? data.thumbnail : null
            if (thumb?.url) setThumbnailPreview(s3Url(thumb.url))
            const id = thumb?.id ?? (data.thumbnail && typeof data.thumbnail !== 'object' ? data.thumbnail : null)
            if (id) {
                setThumbnailId(String(id))
                nextThumbId = String(id)
            }
        }
        baselineRef.current = { form: { ...base.form, ...patch }, thumbnailId: nextThumbId }
        version.set(data.updatedAt)
    }

    // A new AI change for this post → show it in the form; one that went away undecided here → put the post back.
    useEffect(() => {
        if (isLoading) return
        const draft = agent.draft
        const current = aiRef.current
        if (draft && current?.changeSetId !== draft.id) {
            const preview = blogAiPreview(draft)
            if (!preview) return
            const before = current?.phase === 'pending' ? current.before : snapshot()
            setForm(prev => ({
                ...prev,
                ...(preview.title !== undefined ? { title: preview.title, slug: isNew ? (preview.slug ?? slugify(preview.title)) : prev.slug } : {}),
                ...(preview.contentHtml !== undefined ? { content: preview.contentHtml } : {}),
                ...(preview.seoTitle !== undefined ? { seoTitle: preview.seoTitle.slice(0, 60) } : {}),
                ...(preview.seoDescription !== undefined ? { seoDescription: preview.seoDescription.slice(0, 160) } : {}),
            }))
            if (preview.coverUrl) setThumbnailPreview(preview.coverUrl)
            if (preview.contentHtml !== undefined) setEditorKey(k => k + 1)
            setAi({ phase: 'pending', kind: preview.kind, fields: preview.fields, changeSetId: draft.id, before })
        } else if (!draft && current?.phase === 'pending' && !aiBusy) {
            // approved from the chat card: the approval handler marks it applied in the same moment — only
            // a change that is still "waiting" a beat later was rejected or expired, and the post goes back
            const id = current.changeSetId
            const timer = setTimeout(() => {
                const latest = aiRef.current
                if (latest?.phase !== 'pending' || latest.changeSetId !== id) return
                restore(latest.before)
                setAi(null)
            }, 120)
            return () => clearTimeout(timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agent.draft?.id, isLoading])

    // Changes this editor already applied to the form itself (its handlers below); the bus announces them too.
    const handledRef = useRef(new Set<string>())
    const unsaved = !isNew && !isLoading && (
        thumbnailFile !== null ||
        thumbnailId !== baselineRef.current.thumbnailId ||
        (Object.keys(form) as (keyof BlogForm)[]).some(k => form[k] !== baselineRef.current.form[k])
    )
    const [stale, setStale] = useState(false)
    const reloadSeq = useRef(0)
    const unsavedRef = useRef(unsaved)
    unsavedRef.current = unsaved
    // The assistant changed this post from elsewhere (another tab, another chat). `force`: the merchant chose Reload.
    const reloadFromServer = async (force = false) => {
        const seq = ++reloadSeq.current
        try {
            const data = await getBlogByIdAction(blogId)
            if (!data || seq !== reloadSeq.current) return
            // typing started while the post was on its way: keep what is being typed
            if (!force && unsavedRef.current) return setStale(true)
            if (data.content !== baselineRef.current.form.content) setEditorKey(k => k + 1)
            applyPost(data)
        } catch (err) {
            console.error('[Blog] Reload after assistant change failed:', err)
        }
    }
    useAgentChanges({ kinds: ['blog_post'], ids: [blogId], enabled: !isNew }, (batch) => {
        if (batch.changes.every(c => handledRef.current.has(`${c.action}:${c.changeSetId}`))) return
        if (unsaved) setStale(true)
        else void reloadFromServer()
    })
    // saved or reverted to the server's version: the notice no longer applies
    useEffect(() => {
        if (!unsaved) setStale(false)
    }, [unsaved])

    // Approvals (from the bar, the chat card or the review sheet) come back here.
    useEffect(() => {
        agent.setHandlers({
            onCreated: (changeSet) => {
                handledRef.current.add(`applied:${changeSet.id}`)
                const id = createdPostId(changeSet)
                if (!id) return
                const fields = aiRef.current?.fields ?? blogAiPreview(changeSet)?.fields ?? []
                try {
                    sessionStorage.setItem(appliedKey(id), JSON.stringify({ fields }))
                    if (agent.threadId && agent.threadKey) sessionStorage.setItem(agent.threadKey(id), agent.threadId)
                    localStorage.removeItem(DRAFT_KEY)
                } catch { /* storage off: the post still opens, without the marks */ }
                router.replace(`/blog/${encodeURIComponent(id)}`)
            },
            onUpdated: (changeSet) => {
                handledRef.current.add(`applied:${changeSet.id}`)
                const current = aiRef.current
                const fields = current?.changeSetId === changeSet.id ? current.fields : blogAiPreview(changeSet)?.fields ?? []
                const before = current?.changeSetId === changeSet.id ? current.before : snapshot()
                setAi({ phase: 'applied', kind: 'update', fields, changeSetId: changeSet.id, before, applied: changeSet })
                void refreshFromServer(fields)
            },
            onReverted: (changeSet) => {
                handledRef.current.add(`undone:${changeSet.id}`)
                const current = aiRef.current
                if (current?.changeSetId === changeSet.id) restore(current.before)
                else void refreshFromServer(['title', 'content', 'seo', 'cover'])
                setAi(null)
            },
        })
    })

    // The new post's editor, right after its AI draft was saved: mark what AI wrote.
    useEffect(() => {
        if (isNew || isLoading) return
        try {
            const raw = sessionStorage.getItem(appliedKey(blogId))
            if (!raw) return
            sessionStorage.removeItem(appliedKey(blogId))
            const fields = (JSON.parse(raw) as { fields?: BlogAiField[] }).fields ?? []
            if (fields.length === 0) return
            const empty: AiSnapshot = { title: '', slug: form.slug, content: '', seoTitle: '', seoDescription: '', thumbnailPreview: null, thumbnailId: null }
            setAi({ phase: 'saved', kind: 'create', fields, changeSetId: '', before: empty })
            if (agent.enabled) setSideTab('ai')
        } catch { /* nothing to mark */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, isNew, blogId])

    const keepAll = async () => {
        const draft = agent.draft
        if (!draft) return
        setAiBusy(true)
        try {
            await agent.decide(draft, 'approve')
        } catch (err) {
            if (isStaleChange(err)) {
                // drafted from an older version of the post (it changed since): drop it, put the form back, offer a redo
                const current = aiRef.current
                if (current) restore(current.before)
                setAi(null)
                await agent.decide(draft, 'reject').catch(() => undefined)
                toast.error(E.aiStale, {
                    action: { label: E.aiAskAgain, onClick: () => { setSideTab('ai'); agent.askAgainFor(draft.id) } },
                })
            } else {
                toast.error(err instanceof Error && err.message ? err.message : E.aiKeepFailed)
            }
        } finally {
            setAiBusy(false)
        }
    }
    const discard = async () => {
        const current = aiRef.current
        if (current) restore(current.before)
        setAi(null)
        if (agent.draft) await agent.decide(agent.draft, 'reject').catch(() => undefined)
    }
    const askChanges = () => {
        setSideTab('ai')
        setTimeout(() => document.querySelector<HTMLTextAreaElement>('.blog-ai-panel textarea')?.focus(), 60)
    }
    const undoAll = async () => {
        const applied = aiRef.current?.applied
        if (!applied || !agent.undo) return
        setAiBusy(true)
        try {
            await agent.undo(applied)
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : E.aiKeepFailed)
        } finally {
            setAiBusy(false)
        }
    }
    const dropMark = (field: BlogAiField) => setAi(prev => {
        if (!prev) return prev
        const fields = prev.fields.filter(f => f !== field)
        return fields.length > 0 ? { ...prev, fields } : null
    })
    const undoPart = (field: BlogAiField) => {
        const current = aiRef.current
        if (!current) return
        restore(current.before, [field])
        dropMark(field)
    }
    const markProps = (field: BlogAiField) => ({
        phase: phaseOf(field),
        labels: aiLabels,
        onKeep: () => dropMark(field),
        onUndo: () => undoPart(field),
    })

    // ✦ in the SEO fields: meta title + description in the post's own language (task seo.blog-meta).
    const [seoAi, setSeoAi] = useState<{ busy: boolean; before?: { seoTitle: string; seoDescription: string } }>({ busy: false })
    const writeSeo = async () => {
        if (!form.title.trim() && !form.content.replace(/<[^>]*>/g, '').trim()) {
            toast.error(E.aiSeoNeedsText)
            return
        }
        const before = { seoTitle: form.seoTitle, seoDescription: form.seoDescription }
        setSeoAi({ busy: true })
        try {
            const res = await fetch('/api/ai/blog-seo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title: form.title, content: form.content, fallbackLanguage: locale }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || E.aiSeoFailed)
            setForm(prev => ({
                ...prev,
                seoTitle: String(json.data?.metaTitle ?? prev.seoTitle).slice(0, 60),
                seoDescription: String(json.data?.metaDescription ?? prev.seoDescription).slice(0, 160),
            }))
            setSeoAi({ busy: false, before })
        } catch (err) {
            setSeoAi({ busy: false })
            toast.error(err instanceof Error && err.message ? err.message : E.aiSeoFailed)
        }
    }
    const undoSeo = () => {
        if (seoAi.before) setForm(prev => ({ ...prev, ...seoAi.before }))
        setSeoAi({ busy: false })
    }

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
    // what "Save mine anyway" saves again
    const lastSaveStatus = useRef<'draft' | 'published' | undefined>(undefined)

    const handleSave = async (overrideStatus?: 'draft' | 'published') => {
        if (isSubmittingRef.current) return
        isSubmittingRef.current = true
        lastSaveStatus.current = overrideStatus

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
                expectedUpdatedAt: isNew ? undefined : version.current(),
            })

            if (version.refused(result)) {
                // the edits stay in the form; the notice asks what to do
            } else if (result && typeof result === 'object' && 'error' in result && result.error) {
                toast.error(resolveApiError(result, t.dashboard.blog.editor.saveFailed, sub))
            } else if (result) {
                version.set(result.updatedAt)
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
                <div className="rounded-xl border border-white/10 bg-[hsl(var(--secondary))]/30 p-6 space-y-4">
                    <div className="h-4 w-24 rounded bg-white/5" />
                    <div className="h-12 w-full rounded-lg bg-white/5" />
                    <div className="h-4 w-20 rounded bg-white/5" />
                    <div className="h-10 w-full rounded-lg bg-white/5" />
                </div>
                <div className="rounded-xl border border-white/10 bg-[hsl(var(--secondary))]/30 p-6 space-y-4">
                    <div className="h-4 w-32 rounded bg-white/5" />
                    <div className="h-48 w-full rounded-lg bg-white/5" />
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-full space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-[12px] w-full">
                {/* Row 1: Back + Title + subtitle — GH-1511 #36: header theo đúng chuẩn Add Product
                    (ProductForm.tsx): ArrowLeft h-6 + h1 24px font-outfit + subtitle 14px foreground/60.
                    Breadcrumb Home > Blog bỏ theo baseline (Add Product không có breadcrumb). */}
                <div className="flex flex-row items-center gap-4 min-w-0">
                    <button
                        type="button"
                        onClick={() => router.push('/blog')}
                        aria-label="Back to blog list"
                        className="flex shrink-0 items-center justify-center text-foreground hover:text-foreground/80 transition-colors border-none bg-transparent p-0 cursor-pointer"
                    >
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <div className="flex flex-col gap-1 min-w-0">
                        <h1 className="text-[24px] font-bold font-outfit text-foreground leading-[1.33] m-0 truncate">
                            {isNew ? t.dashboard.blog.editor.createTitle : t.dashboard.blog.editor.editTitle}
                        </h1>
                        <p className="text-[14px] text-foreground/60 leading-[1.43] m-0">{t.dashboard.blog.editor.headerSubtitle}</p>
                    </div>
                </div>

                {/* Row 2: Action Buttons — below on mobile, right-aligned on desktop */}
                <div className="flex flex-row items-center gap-[12px] shrink-0">
                    {/* AI Assistant Button — icon-only on mobile per Figma */}
                    {agent.enabled && <Button
                        type="button"
                        onClick={() => {
                            setSideTab('ai')
                            document.querySelector('.blog-ai-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                        }}
                        size="dash"
                        className="w-auto"
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
                        <span className="hidden sm:inline">{t.dashboard.blog.editor.aiAssistant}</span>
                    </Button>}

                    {/* Save Draft Button — icon-only on mobile per Figma */}
                    <Button
                        type="button"
                        onClick={() => handleSave('draft')}
                        disabled={isSaving || success || aiPending}
                        title={aiPending ? E.aiLocked : undefined}
                        variant="dashSecondary"
                        size="dash"
                        className="w-auto panel-outline"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.6667 2.5C13.1063 2.50626 13.5256 2.68598 13.8333 3L17 6.16667C17.314 6.47438 17.4937 6.89372 17.5 7.33333V15.8333C17.5 16.2754 17.3244 16.6993 17.0118 17.0118C16.6993 17.3244 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H12.6667Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14.1666 17.5007V11.6673C14.1666 11.4463 14.0788 11.2343 13.9225 11.0781C13.7662 10.9218 13.5543 10.834 13.3333 10.834H6.66659C6.44557 10.834 6.23361 10.9218 6.07733 11.0781C5.92105 11.2343 5.83325 11.4463 5.83325 11.6673V17.5007" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5.83325 2.5V5.83333C5.83325 6.05435 5.92105 6.26631 6.07733 6.42259C6.23361 6.57887 6.44557 6.66667 6.66659 6.66667H12.4999" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="hidden sm:inline">{t.dashboard.blog.editor.saveDraft}</span>
                    </Button>

                    {/* Publish Button — always shows icon + text */}
                    <Button
                        type="button"
                        onClick={() => handleSave('published')}
                        disabled={isSaving || success || aiPending}
                        title={aiPending ? E.aiLocked : undefined}
                        size="dash"
                    >
                        {isSaving ? (
                            <Loader2 className="w-[20px] h-[20px] animate-spin" />
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
                        {t.dashboard.blog.editor.publish}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row items-start gap-[24px] w-full mt-6">
                <div className="flex-1 flex flex-col gap-[24px] min-w-0 w-full">


                    {version.conflicted ? (
                        <SaveConflictNotice
                            record="post"
                            onLoadLatest={() => { setStale(false); void reloadFromServer(true) }}
                            onSaveAnyway={() => { version.overwrite(); void handleSave(lastSaveStatus.current) }}
                        />
                    ) : stale && (
                        <AgentChangedNotice
                            record="post"
                            onReload={() => { setStale(false); void reloadFromServer(true) }}
                            onKeep={() => setStale(false)}
                        />
                    )}

                    {showDraftRecovery && (
                        <div className="flex items-center justify-between rounded-lg bg-warning/10 border border-warning/30 px-4 py-3">
                            <p className="text-sm text-warning">
                                {t.dashboard.blog.editor.draftRecoveryMessage || 'Unsaved draft found. Restore it?'}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={restoreDraft}
                                    variant="ghost"
                                    size="sm"
                                    className="bg-warning/20 text-warning hover:bg-warning/30 hover:text-warning"
                                >
                                    {t.dashboard.blog.editor.draftRestore || 'Restore'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={dismissDraft}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                >
                                    {t.dashboard.blog.editor.draftDismiss || 'Dismiss'}
                                </Button>
                            </div>
                        </div>
                    )}

                    <style jsx global>{`
                        .panel-outline {
                            border: 1px solid var(--dash-border) !important;
                        }
                    `}</style>

                    {ai && (
                        <BlogAiBar
                            phase={ai.phase}
                            kind={ai.kind}
                            fields={ai.fields}
                            labels={aiLabels}
                            busy={aiBusy}
                            onKeepAll={keepAll}
                            onDiscard={() => void discard()}
                            onAskChanges={askChanges}
                            onUndoAll={ai.phase === 'applied' && ai.applied && agent.undo ? () => void undoAll() : undefined}
                            onDone={() => setAi(null)}
                        />
                    )}
                    {!ai && agent.busy && isNew && !form.title && !getContentText(form.content).trim() && (
                        <p className="m-0 inline-flex w-fit items-center gap-2 rounded-full bg-[hsl(var(--primary)/0.1)] px-3 py-1 text-[12px] font-semibold text-[hsl(var(--primary))]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {E.aiWriting}
                        </p>
                    )}

                    {/* while an AI draft waits the post is locked: keep or discard it first */}
                    <div className="relative flex flex-col gap-[24px]" aria-busy={aiPending || undefined}>
                    {aiPending && <div className="absolute inset-0 z-[5] cursor-not-allowed rounded-[16px]" title={E.aiLocked} aria-hidden="true" />}
                    <AiMark {...markProps('title')}>
                    <div className="flex flex-col p-[24px] bg-[hsl(var(--card))] panel-outline rounded-[16px]">
                        <div className="flex flex-col gap-[8px]">
                            <div className="flex flex-row justify-between items-center h-[20px]">
                                <Label htmlFor="blog-title" className="font-semibold text-foreground">{t.dashboard.blog.editor.postTitle}</Label>
                                <span className={"font-['Inter'] font-[400] text-[12px] leading-[1.3333333333333333em] " + (form.title.length > 255 ? "text-destructive" : "text-muted-foreground")}>
                                    {form.title.length}/255 {t.dashboard.blog.editor.characters}
                                </span>
                            </div>
                            <Input
                                id="blog-title"
                                type="text"
                                value={form.title}
                                onChange={(e) => updateField('title', e.target.value)}
                                maxLength={255}
                                placeholder={t.dashboard.blog.editor.titlePlaceholder}
                            />
                        </div>
                    </div>

                    </AiMark>

                    <div className="flex flex-col p-[25px] gap-[8px] min-h-[116px] bg-[hsl(var(--card))] panel-outline rounded-[16px] flex-shrink-0">
                        <div className="h-[20px]">
                            <Label htmlFor="blog-slug" className="text-muted-foreground">
                                {t.dashboard.blog.editor.urlSlugLabel}
                            </Label>
                        </div>
                        <div className="flex flex-row items-center gap-[8px]">
                            <span className="w-[124px] text-[14px] text-muted-foreground shrink-0">yoursite.com/blog/</span>
                            <Input
                                id="blog-slug"
                                type="text"
                                value={form.slug}
                                onChange={(e) => updateField('slug', formatSlugInput(e.target.value))}
                                onBlur={(e) => updateField('slug', slugify(e.target.value))}
                                placeholder="ksd-vdf"
                                // GH-1538 follow-up: lock slug once the post is live — changing the
                                // URL of an already-published (SEO-indexed) post breaks existing
                                // links/rankings. Drafts (isNew, or not-yet-published) stay editable.
                                disabled={!isNew && form.status === 'published'}
                                className="flex-1"
                            />
                        </div>
                        {!isNew && form.status === 'published' && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3 shrink-0" />
                                {t.dashboard.blog.editor.slugLockedHint}
                            </p>
                        )}
                        {error === 'slug_invalid' && (
                            <p className="text-xs text-destructive">{t.dashboard.blog.editor.slugInvalid || 'Slug can only contain lowercase letters, numbers, and hyphens'}</p>
                        )}
                    </div>

                    <AiMark {...markProps('cover')}>
                    {/* GH-1511 bug #44: preview matches the storefront blog-list grid ratio (aspect-[4/3],
                        blocks/blog-list/index.tsx) so merchants see the same crop the buyer gets — the old
                        fixed 256px height rendered ~1.8:1 and misled. Card height is now content-driven. */}
                    <div className="flex flex-col p-[25px] gap-[16px] bg-[hsl(var(--card))] panel-outline rounded-[16px] flex-shrink-0">
                        <div className="h-[20px]">
                            <Label className="text-muted-foreground">
                                {t.dashboard.blog.editor.thumbnailLabel}
                            </Label>
                        </div>
                        {thumbnailPreview ? (
                            <div className="relative w-full max-w-[480px] aspect-[4/3] rounded-[16px] mx-auto">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={thumbnailPreview}
                                    alt="Thumbnail preview"
                                    className="w-full h-full object-cover rounded-[16px]"
                                />
                                <Button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); setThumbnailPreview(null); setThumbnailFile(null); setThumbnailId(null) }}
                                    variant="secondary"
                                    size="sm"
                                    className="absolute top-[8px] right-[8px] panel-outline"
                                >
                                    {t.dashboard.blog.editor.replace}
                                </Button>
                            </div>
                        ) : (
                            // Hover = teal active, same pattern as Add Product's ImageUploader dropzone
                            <label className="flex flex-col items-center justify-center cursor-pointer gap-[12px] py-[68px] h-[256px] border-2 border-dashed border-[hsl(var(--border))] rounded-[16px] bg-transparent hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)] transition-colors">
                                <div className="flex items-center justify-center w-[64px] h-[64px] rounded-[33554400px] bg-[hsl(var(--primary)/0.1)]">
                                    <Upload className="w-[32px] h-[32px] text-[hsl(var(--primary))]" strokeWidth={1.5} />
                                </div>
                                <div className="flex flex-col items-center w-full max-w-[250px] gap-[4px]">
                                    <div className="flex items-center justify-center w-full min-h-[20px] text-center">
                                        <span className="font-['Inter'] font-[500] text-[14px] leading-[1.4285714285714286em] text-foreground">{t.dashboard.blog.editor.clickToUpload}</span>
                                    </div>
                                    <div className="flex flex-row justify-center w-full">
                                        <span className="font-['Inter'] font-[500] text-[12px] leading-[1.3333333333333333em] text-[hsl(var(--muted-foreground))]">{t.dashboard.blog.editor.uploadHint}</span>
                                    </div>
                                </div>
                                {/* raw <input type="file"> intentionally kept: hidden file-picker inside <label>,
                                    the shared <Input> component is for visible text inputs only */}
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

                    </AiMark>

                    <AiMark {...markProps('content')}>
                    <BlogRichEditor
                        key={editorKey}
                        content={form.content}
                        onChange={(html: string) => updateField('content', html)}
                        placeholder={t.dashboard.blog.editor.startWriting}
                    />
                    </AiMark>
                    </div>
                </div>

                {/* with the copilot open the whole rail (tabs + chat) stays in view while the post scrolls: sticky under the 56px header */}
                <div className={cn("w-full flex flex-col gap-[24px] flex-shrink-0", agent.enabled && sideTab === 'ai' ? "xl:w-[440px] xl:max-w-[440px] gap-[12px] xl:sticky xl:top-[72px] xl:self-start" : "xl:w-[512px] xl:max-w-[512px]")}>
                    {agent.enabled && (
                        <div role="tablist" aria-label={E.aiTab} className="flex gap-1 rounded-xl p-1 bg-[hsl(var(--card))] panel-outline">
                            {(['ai', 'settings'] as const).map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    role="tab"
                                    aria-selected={sideTab === tab}
                                    onClick={() => setSideTab(tab)}
                                    className={cn(
                                        "flex-1 inline-flex h-9 items-center justify-center gap-2 rounded-lg border-0 text-[13px] font-medium transition-colors cursor-pointer",
                                        sideTab === tab ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]" : "bg-transparent text-foreground/70 hover:text-foreground hover:bg-[hsl(var(--muted))]",
                                    )}
                                >
                                    {tab === 'ai' ? <Sparkles className="h-[15px] w-[15px]" strokeWidth={1.75} /> : <Settings2 className="h-[15px] w-[15px]" strokeWidth={1.75} />}
                                    {tab === 'ai' ? E.aiTab : E.settingsTab}
                                    {tab === 'ai' && sideTab !== 'ai' && (agent.busy || aiPending) && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" aria-hidden="true" />}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* the copilot stays mounted while Settings is open: the chat and its composer keep their state */}
                    {agent.enabled && (
                        <div className={cn("blog-ai-panel h-[calc(100vh-220px)] min-h-[560px] xl:h-[calc(100vh-148px)] xl:min-h-[480px] overflow-hidden rounded-[16px]", sideTab !== 'ai' && "hidden")}>
                            {agent.panel}
                        </div>
                    )}
                    <div className={cn("flex flex-col gap-[24px]", agent.enabled && sideTab !== 'settings' && "hidden")}>
                    <div className="flex flex-col p-[25px] gap-[20px] bg-[hsl(var(--card))] panel-outline rounded-[16px]">
                        <div className="flex flex-row items-center gap-[12px] h-[28px]">
                            <Tag className="w-[20px] h-[20px] text-[hsl(var(--primary))]" strokeWidth={1.5} />
                            <span className="font-['Inter'] font-[700] text-[18px] leading-[1.5555555555555556em] text-foreground">{t.dashboard.blog.editor.postSettings}</span>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="h-[20px]">
                                <Label className="text-muted-foreground">{t.dashboard.blog.editor.category}</Label>
                            </div>
                            <Popover open={isCategoryDropdownOpen} onOpenChange={setIsCategoryDropdownOpen}>
                                <PopoverTrigger asChild>
                                    <div className="w-full flex items-center justify-between h-10 bg-[hsl(var(--card))] [border:1px_solid_hsl(var(--input-border))] rounded-lg px-[12px] font-['Inter'] font-[400] text-[14px] leading-[1.4285714285714286em] text-foreground cursor-pointer outline-none">
                                        <span className="truncate">{categories.find(c => String(c.id) === String(form.category))?.name || t.dashboard.blog.editor.noCategory}</span>
                                        <ChevronDown className="w-[16px] h-[16px] text-[hsl(var(--muted-foreground))] shrink-0" />
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1.5 rounded-xl relative shadow-xl" style={{ minWidth: 'var(--radix-popover-trigger-width)', backgroundColor: 'var(--dash-secondary-bg)', border: '1px solid var(--dash-border)' }} align="start">
                                    <div className="flex flex-col max-h-[250px] overflow-y-auto px-0.5 gap-0.5 scrollbar-thin scrollbar-track-transparent" style={{ scrollbarColor: 'var(--dash-border) transparent' }}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className={cn("w-full justify-start px-3 py-[10px] text-[14px] h-auto rounded-lg", !form.category ? "font-medium bg-[var(--dash-surface-hover)]" : "font-normal")}
                                            style={{ color: 'var(--dash-text)' }}
                                            onClick={() => { updateField('category', ''); setIsCategoryDropdownOpen(false) }}
                                        >
                                            <span className="truncate w-full">{t.dashboard.blog.editor.noCategory}</span>
                                        </Button>
                                        {categories.map((cat) => (
                                            <Button
                                                key={cat.id}
                                                type="button"
                                                variant="ghost"
                                                className={cn("w-full justify-start px-3 py-[10px] text-[14px] h-auto rounded-lg", String(form.category) === String(cat.id) ? "font-medium bg-[var(--dash-surface-hover)]" : "font-normal")}
                                                style={{ color: 'var(--dash-text)' }}
                                                onClick={() => { updateField('category', String(cat.id)); setIsCategoryDropdownOpen(false) }}
                                            >
                                                <span className="truncate w-full">{cat.name}</span>
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="h-px my-1.5 mx-1 bg-border" />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start gap-2 px-3 py-[10px] text-[14px] font-medium h-auto rounded-lg text-primary hover:text-primary"
                                        onClick={() => { setIsCategoryDropdownOpen(false); setIsCategoryModalOpen(true) }}
                                    >
                                        <Settings2 className="w-4 h-4 shrink-0" />
                                        <span>{t.dashboard.blog.editor.manageCategories}</span>
                                    </Button>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="h-[20px]">
                                <Label className="text-muted-foreground">{t.dashboard.blog.editor.author}</Label>
                            </div>
                            {/* Author is read-only — display shell intentionally kept as div */}
                            <div className="flex flex-row items-center h-10 bg-[hsl(var(--card))] [border:1px_solid_hsl(var(--input-border))] rounded-lg px-[12px] gap-[10px]">
                                <User className="w-[16px] h-[16px] text-muted-foreground" strokeWidth={1.5} />
                                <span className="text-[14px] text-foreground">
                                    {getAuthorName()}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[8px]">
                            <div className="h-[20px]">
                                <Label className="text-muted-foreground">{t.dashboard.blog.editor.publishDate}</Label>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        // Match the shared <Input>/category trigger look (h-10, card bg, input-border) so
                                        // the date field is consistent with the rest of Post/SEO Settings.
                                        className="flex flex-row items-center w-full h-10 px-3 gap-[10px] justify-start font-normal rounded-lg bg-[hsl(var(--card))] [border:1px_solid_hsl(var(--input-border))] hover:bg-[hsl(var(--card))] focus-visible:border-[hsl(var(--ring))]"
                                    >
                                        <Calendar className="w-[16px] h-[16px] text-muted-foreground shrink-0" strokeWidth={1.5} />
                                        <span className={cn(
                                            "text-[14px] flex-grow truncate text-left",
                                            !publishDate ? "text-muted-foreground" : "text-foreground"
                                        )}>
                                            {publishDate ? format(publishDate, "MMM d, yyyy") : ""}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="dash-shell w-auto p-0 border-[hsl(var(--border))] text-foreground" align="start" style={{ backgroundColor: 'var(--dash-bg)' }}>
                                    <CalendarUI
                                        mode="single"
                                        selected={publishDate}
                                        onSelect={setPublishDate}
                                        initialFocus
                                        className="bg-[hsl(var(--background))] rounded-[8px] [&_.rdp-day_button:hover]:bg-[hsl(var(--secondary))] [&_.rdp-day_button:focus]:bg-[hsl(var(--secondary))] [&_.rdp-day_button.rdp-selected]:bg-[hsl(var(--primary))] [&_.rdp-day_button.rdp-selected]:text-white"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <AiMark {...markProps('seo')}>
                    <div className="relative flex flex-col p-[25px] gap-[20px] bg-[hsl(var(--card))] panel-outline rounded-[16px]">
                        {aiPending && <div className="absolute inset-0 z-[5] cursor-not-allowed rounded-[16px]" title={E.aiLocked} aria-hidden="true" />}
                        <div className="flex flex-row items-center justify-between w-full h-[32px]">
                            <div className="flex flex-row items-center gap-[12px] h-[28px]">
                                <Sparkles className="w-[20px] h-[20px] text-[hsl(var(--primary))]" strokeWidth={1.5} />
                                <span className="font-['Inter'] font-[700] text-[18px] leading-[1.5555555555555556em] text-foreground">{t.dashboard.blog.editor.seoTitle}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[7px]">
                            <div className="h-[20px] w-full">
                                <Label htmlFor="seo-title" className="text-muted-foreground">{t.dashboard.blog.editor.metaTitle}</Label>
                            </div>
                            <div className="relative">
                                <Input
                                    id="seo-title"
                                    type="text"
                                    value={form.seoTitle}
                                    onChange={e => updateField('seoTitle', e.target.value)}
                                    maxLength={60}
                                    placeholder={t.dashboard.blog.editor.seoTitlePlaceholder}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => void writeSeo()}
                                    disabled={seoAi.busy}
                                    aria-label={E.aiSeoFill}
                                    title={E.aiSeoFill}
                                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] cursor-pointer disabled:cursor-default"
                                >
                                    {seoAi.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.75} />}
                                </button>
                            </div>
                            <div className="h-[16px] w-full flex items-center">
                                <span className="text-[12px] text-muted-foreground">
                                    {form.seoTitle.length}/60 {t.dashboard.blog.editor.characters}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-[9px]">
                            <div className="h-[20px] w-full">
                                <Label htmlFor="seo-desc" className="text-muted-foreground">{t.dashboard.blog.editor.metaDesc}</Label>
                            </div>
                            <div className="relative">
                                <Textarea
                                    id="seo-desc"
                                    value={form.seoDescription}
                                    onChange={e => updateField('seoDescription', e.target.value)}
                                    maxLength={160}
                                    placeholder={t.dashboard.blog.editor.seoDescPlaceholder}
                                    className="h-[113px] pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => void writeSeo()}
                                    disabled={seoAi.busy}
                                    aria-label={E.aiSeoFill}
                                    title={E.aiSeoFill}
                                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] cursor-pointer disabled:cursor-default"
                                >
                                    {seoAi.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.75} />}
                                </button>
                            </div>
                            <div className="h-[16px] w-full flex items-center">
                                <span className="text-[12px] text-muted-foreground">
                                    {form.seoDescription.length}/160 {t.dashboard.blog.editor.characters}
                                </span>
                            </div>
                        </div>
                        {(seoAi.busy || seoAi.before) && (
                            <p role="status" className="m-0 -mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                                {seoAi.busy ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin text-[hsl(var(--primary))]" />{E.aiSeoWriting}</>
                                ) : (
                                    <>
                                        <Check className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />{E.aiSeoFilled} ·
                                        <button type="button" onClick={undoSeo} className="inline-flex min-h-7 items-center rounded px-1 border-0 bg-transparent text-foreground/80 hover:text-foreground underline-offset-2 hover:underline cursor-pointer">{E.aiSeoUndo}</button>
                                    </>
                                )}
                            </p>
                        )}
                    </div>
                    </AiMark>
                    </div>
                </div>
            </div>

            {isCategoryModalOpen && (
                <CategoryModal
                    onClose={() => setIsCategoryModalOpen(false)}
                    onCategoryUpdated={() => {
                        getBlogCategoriesAction()
                            .then(docs => setCategories(docs || []))
                            .catch(() => { })
                    }}
                />
            )}
        </div >
    )
}

/**
 * The blog editor with its copilot: the AI writer lives in the side column
 * (inline panel, one chat per post) and every AI change shows in the form.
 * With the copilot off its code is never loaded.
 */
export default function BlogEditorPageClient({ agentEnabled = false }: { agentEnabled?: boolean }) {
    const params = useParams()
    const blogId = (params?.id as string) ?? 'new'
    if (!agentEnabled) return <BlogEditorInner key={blogId} />
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[400px] items-center justify-center" aria-busy="true">
                    <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
            }
        >
            <BlogAgentShell key={blogId} blogId={blogId}>
                <BlogEditorInner />
            </BlogAgentShell>
        </Suspense>
    )
}
