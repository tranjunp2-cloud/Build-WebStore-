'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft,
    Undo2,
    Redo2,
    Save,
    ExternalLink,
    Upload,
    Sparkles,
    MessageSquare,
    LayoutGrid,
    Send,
    GripVertical,
    Trash2,
    Copy,
    ChevronDown,
    PanelLeftClose,
    PanelLeftOpen,
    Check,
    Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────
type BlockData = {
    blockType: string
    [key: string]: any
}

type SiteData = {
    id: string
    name: string
    status: string
    theme: any
    siteType: string
}

type PageData = {
    id: string
    title: string
    layout: BlockData[]
}

const BLOCK_LABELS: Record<string, string> = {
    navigation: 'Navigation',
    hero: 'Hero Banner',
    about: 'About',
    features: 'Features',
    testimonials: 'Testimonials',
    contact: 'Contact',
    gallery: 'Gallery',
    footer: 'Footer',
}

// ─── AI Chat Panel (Left) ───────────────────────────────────────────────
function AIChatPanel({
    isOpen,
    onToggle,
    blocks,
    onBlockSelect,
    selectedBlock,
}: {
    isOpen: boolean
    onToggle: () => void
    blocks: BlockData[]
    onBlockSelect: (idx: number) => void
    selectedBlock: number
}) {
    const [tab, setTab] = useState<'chat' | 'blocks'>('blocks')
    const [input, setInput] = useState('')

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                className="fixed left-0 top-14 z-30 rounded-r-lg bg-[#1E293B] p-2 text-gray-400 hover:text-white transition-colors border border-l-0 border-white/10"
                title="Open Panel"
            >
                <PanelLeftOpen className="h-4 w-4" />
            </button>
        )
    }

    return (
        <div className="flex h-full w-[380px] shrink-0 flex-col border-r border-white/10 bg-[#0B1120]">
            {/* Panel header with tabs */}
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
                <div className="flex gap-1">
                    <button
                        onClick={() => setTab('blocks')}
                        className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            tab === 'blocks' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                        )}
                    >
                        <LayoutGrid className="h-3 w-3" /> Blocks
                    </button>
                    <button
                        onClick={() => setTab('chat')}
                        className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            tab === 'chat' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                        )}
                    >
                        <MessageSquare className="h-3 w-3" /> AI Chat
                    </button>
                </div>
                <button
                    onClick={onToggle}
                    className="rounded-lg p-1 text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <PanelLeftClose className="h-4 w-4" />
                </button>
            </div>

            {tab === 'blocks' ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <p className="text-xs text-gray-500 mb-3">
                        {blocks.length} blocks trên trang này
                    </p>
                    {blocks.map((block, i) => (
                        <button
                            key={i}
                            onClick={() => onBlockSelect(i)}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                                selectedBlock === i
                                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                    : 'text-gray-300 hover:bg-white/5 border border-transparent'
                            )}
                        >
                            <GripVertical className="h-3 w-3 text-gray-600" />
                            <span className="font-medium">{BLOCK_LABELS[block.blockType] || block.blockType}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className="flex gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-[10px]">
                                ✨
                            </div>
                            <div className="rounded-xl rounded-bl-md border border-white/5 bg-[#1E293B] px-3 py-2 text-sm text-gray-300">
                                <p>Tôi có thể giúp bạn chỉnh sửa website. Ví dụ:</p>
                                <ul className="mt-2 space-y-1 text-xs text-gray-400">
                                    <li>• &quot;Đổi màu chủ đạo thành xanh&quot;</li>
                                    <li>• &quot;Viết lại phần About ngắn hơn&quot;</li>
                                    <li>• &quot;Thêm section FAQ&quot;</li>
                                </ul>
                                <p className="mt-2 text-xs text-gray-500 italic">Coming in Phase 2...</p>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-white/10 p-3">
                        <div className="flex items-center gap-2 rounded-lg bg-[#1E293B] pr-2 border border-white/10 focus-within:border-blue-500/50 transition-colors">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="AI editing coming soon..."
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                                disabled
                            />
                            <button
                                disabled
                                className="rounded-md bg-blue-600 p-1.5 text-white disabled:opacity-30"
                            >
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Settings Panel (Right) ─────────────────────────────────────────────
const FONT_OPTIONS = ['Outfit', 'Inter', 'DM Sans', 'Playfair Display', 'Roboto', 'Poppins', 'Plus Jakarta Sans']

function SettingsPanel({
    block,
    blockIndex,
    theme,
    onThemeChange,
    onDeleteBlock,
    onDuplicateBlock,
}: {
    block: BlockData | null
    blockIndex: number
    theme: any
    onThemeChange: (key: string, value: string) => void
    onDeleteBlock: (idx: number) => void
    onDuplicateBlock: (idx: number) => void
}) {
    if (!block) {
        return (
            <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A] items-center justify-center">
                <p className="text-sm text-gray-500">Select a block to edit</p>
            </div>
        )
    }

    const blockLabel = BLOCK_LABELS[block.blockType] || block.blockType

    return (
        <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A]">
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-medium text-white">Settings</span>
                <span className="text-xs text-gray-500">Block #{blockIndex + 1}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <div>
                    <label className="text-xs font-medium uppercase text-gray-500">Selected Block</label>
                    <p className="mt-1 text-sm font-medium text-white">{blockLabel}</p>
                </div>

                {/* Dynamic fields based on block type */}
                {block.headline && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Headline</label>
                        <input
                            defaultValue={block.headline}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                            readOnly
                        />
                    </div>
                )}

                {block.subheadline && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Subheadline</label>
                        <textarea
                            defaultValue={block.subheadline}
                            rows={2}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none"
                            readOnly
                        />
                    </div>
                )}

                {block.logoText && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Logo Text</label>
                        <input
                            defaultValue={block.logoText}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                            readOnly
                        />
                    </div>
                )}

                {/* Block actions */}
                <div className="border-t border-white/10 pt-4">
                    <label className="text-xs font-medium uppercase text-gray-500">Block Actions</label>
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={() => onDuplicateBlock(blockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <Copy className="h-3 w-3" /> Duplicate
                        </button>
                        <button
                            onClick={() => onDeleteBlock(blockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-3 w-3" /> Delete
                        </button>
                    </div>
                </div>

                {/* Theme — live editing */}
                {theme && (
                    <div className="border-t border-white/10 pt-4">
                        <label className="text-xs font-medium uppercase text-gray-500">🎨 Global Theme</label>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Primary Color</label>
                            <div className="mt-1 flex items-center gap-2">
                                <input
                                    type="color"
                                    value={theme.primaryColor || '#0ea5e9'}
                                    onChange={(e) => onThemeChange('primaryColor', e.target.value)}
                                    className="h-7 w-7 rounded border-0 cursor-pointer bg-transparent"
                                />
                                <input
                                    value={theme.primaryColor || '#0ea5e9'}
                                    onChange={(e) => onThemeChange('primaryColor', e.target.value)}
                                    className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Heading Font</label>
                            <select
                                value={theme.fontHeading || 'Outfit'}
                                onChange={(e) => onThemeChange('fontHeading', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                            >
                                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Body Font</label>
                            <select
                                value={theme.fontBody || 'Inter'}
                                onChange={(e) => onThemeChange('fontBody', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                            >
                                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Color Mode</label>
                            <div className="mt-1 flex gap-2">
                                {['dark', 'light'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => onThemeChange('colorMode', mode)}
                                        className={cn(
                                            'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                                            theme.colorMode === mode
                                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                                : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10'
                                        )}
                                    >
                                        {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Editor Page ───────────────────────────────────────────────────
export default function EditorPage() {
    const params = useParams()
    const router = useRouter()
    const siteId = params?.siteId as string

    const [isChatOpen, setIsChatOpen] = useState(true)
    const [selectedBlock, setSelectedBlock] = useState(0)
    const [site, setSite] = useState<SiteData | null>(null)
    const [page, setPage] = useState<PageData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [publishSuccess, setPublishSuccess] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)

    // Fetch site and page data
    useEffect(() => {
        if (!siteId) return

        async function loadData() {
            try {
                const res = await fetch(`/api/sites/${siteId}/editor-data`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.site) setSite(data.site)
                    if (data.page) setPage(data.page)
                }
            } catch (err) {
                console.error('Failed to load site data', err)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [siteId])

    // Publish handler
    const handlePublish = async () => {
        if (!siteId || isPublishing) return
        setIsPublishing(true)

        try {
            const res = await fetch(`/api/sites/${siteId}/publish`, {
                method: 'PATCH',
                credentials: 'include',
            })

            if (res.ok) {
                setPublishSuccess(true)
                if (site) setSite({ ...site, status: 'published' })
                setTimeout(() => setPublishSuccess(false), 3000)
            }
        } catch (err) {
            console.error('Publish failed', err)
        } finally {
            setIsPublishing(false)
        }
    }

    const blocks = page?.layout || []
    const currentBlock = blocks[selectedBlock] || null
    const isPublished = site?.status === 'published'

    // ─── Save handler ───────────────────────────
    const handleSave = async () => {
        if (!siteId || !page) return
        setIsSaving(true)
        try {
            await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    blocks: page.layout,
                    theme: site?.theme,
                }),
            })
            setSaveSuccess(true)
            setHasUnsavedChanges(false)
            setIframeKey((k) => k + 1) // reload preview
            setTimeout(() => setSaveSuccess(false), 2000)
        } catch (err) {
            console.error('Save failed', err)
        } finally {
            setIsSaving(false)
        }
    }

    // ─── Theme change handler ───────────────────
    const handleThemeChange = (key: string, value: string) => {
        if (!site) return
        setSite({
            ...site,
            theme: { ...site.theme, [key]: value },
        })
        setHasUnsavedChanges(true)
    }

    // ─── Block delete handler ───────────────────
    const handleDeleteBlock = (idx: number) => {
        if (!page) return
        const newLayout = page.layout.filter((_, i) => i !== idx)
        setPage({ ...page, layout: newLayout })
        setSelectedBlock(Math.max(0, idx - 1))
        setHasUnsavedChanges(true)
    }

    // ─── Block duplicate handler ────────────────
    const handleDuplicateBlock = (idx: number) => {
        if (!page) return
        const blockCopy = JSON.parse(JSON.stringify(page.layout[idx]))
        const newLayout = [...page.layout]
        newLayout.splice(idx + 1, 0, blockCopy)
        setPage({ ...page, layout: newLayout })
        setSelectedBlock(idx + 1)
        setHasUnsavedChanges(true)
    }

    return (
        <div className="flex h-screen flex-col bg-[#0B1120]">
            {/* ─── Top Toolbar ──────────────────────────────────────── */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="mx-2 h-5 w-px bg-white/10" />
                    {site && (
                        <span className="text-sm font-medium text-white">{site.name}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                        <span className="text-[10px] text-yellow-400 animate-pulse">● Unsaved</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving || saveSuccess || !hasUnsavedChanges}
                        className={cn(
                            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            saveSuccess
                                ? 'bg-green-600/20 text-green-400'
                                : hasUnsavedChanges
                                    ? 'bg-white/10 text-white hover:bg-white/15'
                                    : 'bg-white/5 text-gray-500 cursor-default'
                        )}
                    >
                        {isSaving ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                        ) : saveSuccess ? (
                            <><Check className="h-3.5 w-3.5" /> Saved!</>
                        ) : (
                            <><Save className="h-3.5 w-3.5" /> Save</>
                        )}
                    </button>
                    <a
                        href={`/api/preview/${siteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                    >
                        <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </a>
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing || publishSuccess}
                        className={cn(
                            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors shadow-lg',
                            publishSuccess
                                ? 'bg-green-600 shadow-green-500/25'
                                : isPublished
                                    ? 'bg-green-600/80 shadow-green-500/25 hover:bg-green-500'
                                    : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500'
                        )}
                    >
                        {isPublishing ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...</>
                        ) : publishSuccess ? (
                            <><Check className="h-3.5 w-3.5" /> Published!</>
                        ) : isPublished ? (
                            <><Check className="h-3.5 w-3.5" /> Published</>
                        ) : (
                            <><Upload className="h-3.5 w-3.5" /> Publish</>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── Main Area (3 Panels) ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Block List + AI Chat */}
                <AIChatPanel
                    isOpen={isChatOpen}
                    onToggle={() => setIsChatOpen(!isChatOpen)}
                    blocks={blocks}
                    onBlockSelect={setSelectedBlock}
                    selectedBlock={selectedBlock}
                />

                {/* Center: Live Preview via iframe */}
                <div className="flex flex-1 flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center bg-[#0F172A]">
                            <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
                                <p className="mt-3 text-sm text-gray-400">Loading site...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-white">
                            <iframe
                                key={iframeKey}
                                src={`/api/preview/${siteId}`}
                                className="h-full w-full border-0"
                                title="Site Preview"
                            />
                        </div>
                    )}
                </div>

                {/* Right: Settings Panel */}
                <SettingsPanel
                    block={currentBlock}
                    blockIndex={selectedBlock}
                    theme={site?.theme}
                    onThemeChange={handleThemeChange}
                    onDeleteBlock={handleDeleteBlock}
                    onDuplicateBlock={handleDuplicateBlock}
                />
            </div>

            {/* ─── Status Bar ───────────────────────────────────────── */}
            <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/10 px-4 text-[11px]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Connected
                    </span>
                    <span className="text-gray-500">Site ID: {siteId}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-gray-500">{blocks.length} blocks</span>
                    <span className={cn(
                        'rounded px-1.5 py-0.5 font-medium',
                        isPublished
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                    )}>
                        {isPublished ? 'Published' : 'Draft'}
                    </span>
                </div>
            </div>
        </div>
    )
}
