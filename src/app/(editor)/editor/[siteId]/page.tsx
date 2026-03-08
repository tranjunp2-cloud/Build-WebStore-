'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft, Undo2, Redo2, Save, ExternalLink, Upload, Sparkles,
    MessageSquare, LayoutGrid, Send, GripVertical, Trash2, Copy,
    ChevronDown, PanelLeftClose, PanelLeftOpen, Check, Loader2, Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'
import { useEditorStore } from '@/store/editorStore'

// ─── Types ──────────────────────────────────────────────────────────────
type BlockData = { blockType: string;[key: string]: any }
type SiteData = { id: string; name: string; status: string; theme: any; siteType: string }
type PageData = { id: string; title: string; layout: BlockData[] }
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }

// Get block label + icon from registry
function getBlockInfo(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return { label: meta?.name || blockType, icon: meta?.icon || '🧩', variants: meta?.variants || [] }
}

// ─── AI Chat Panel (Left) ───────────────────────────────────────────────
function AIChatPanel({
    isOpen, onToggle, blocks, onBlockSelect, selectedBlock,
    onAIAction, siteName, theme,
}: {
    isOpen: boolean; onToggle: () => void; blocks: BlockData[]
    onBlockSelect: (idx: number) => void; selectedBlock: number
    onAIAction: (action: any) => void; siteName: string; theme: any
}) {
    const [tab, setTab] = useState<'chat' | 'blocks'>('blocks')
    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'welcome', role: 'assistant', content: 'I can help you edit your website. For example:\n• "Change primary colour to green"\n• "Rewrite the About section shorter"\n• "Add a FAQ section"\n• "Change heading font to Playfair Display"' },
    ])
    const [showAddBlock, setShowAddBlock] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSendChat = async () => {
        if (!input.trim() || isProcessing) return
        const userMsg = input.trim()
        setInput('')
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }])
        setIsProcessing(true)

        try {
            const currentBlock = blocks[selectedBlock] || null
            const res = await fetch('/api/ai/edit-block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instruction: userMsg,
                    block: currentBlock,
                    blockIndex: selectedBlock,
                    allBlocks: blocks,
                    theme,
                    siteName,
                }),
                credentials: 'include',
            })

            const data = await res.json()

            if (!res.ok) {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `❌ ${data.error || 'Failed'}` }])
                return
            }

            // Apply the AI action
            onAIAction(data)

            const actionDesc = data.action === 'update_block' ? '✅ Block updated'
                : data.action === 'update_theme' ? '🎨 Theme updated'
                    : data.action === 'add_block' ? '➕ New block added'
                        : data.action === 'delete_block' ? '🗑️ Block deleted'
                            : '✅ Done'

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: 'assistant',
                content: `${actionDesc}\n${data.message || ''}`,
            }])
        } catch (err: any) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `❌ Error: ${err.message}` }])
        } finally {
            setIsProcessing(false)
        }
    }

    if (!isOpen) {
        return (
            <button onClick={onToggle}
                className="fixed left-0 top-14 z-30 rounded-r-lg bg-[#1E293B] p-2 text-gray-400 hover:text-white transition-colors border border-l-0 border-white/10"
                title="Open Panel">
                <PanelLeftOpen className="h-4 w-4" />
            </button>
        )
    }

    const allBlockTypes = blockRegistry.getAllMeta()

    return (
        <div className="flex h-full w-[380px] shrink-0 flex-col border-r border-white/10 bg-[#0B1120]">
            {/* Panel header with tabs */}
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
                <div className="flex gap-1">
                    <button onClick={() => setTab('blocks')}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            tab === 'blocks' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300')}>
                        <LayoutGrid className="h-3 w-3" /> Blocks
                    </button>
                    <button onClick={() => setTab('chat')}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            tab === 'chat' ? 'bg-purple-500/10 text-purple-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300')}>
                        <Sparkles className="h-3 w-3" /> AI Chat
                    </button>
                </div>
                <button onClick={onToggle} className="rounded-lg p-1 text-gray-500 hover:bg-white/5 hover:text-white transition-colors">
                    <PanelLeftClose className="h-4 w-4" />
                </button>
            </div>

            {tab === 'blocks' ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-gray-500">{blocks.length} blocks</p>
                        <button onClick={() => setShowAddBlock(!showAddBlock)}
                            className="flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">
                            <Plus className="h-3 w-3" /> Add
                        </button>
                    </div>

                    {/* Add Block Picker */}
                    {showAddBlock && (
                        <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 space-y-1 max-h-40 overflow-y-auto">
                            {allBlockTypes.map(meta => (
                                <button key={meta.type}
                                    onClick={() => {
                                        onAIAction({ action: 'add_block', afterIndex: selectedBlock, block: { blockType: meta.type, variant: meta.variants[0] } })
                                        setShowAddBlock(false)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-300 hover:bg-white/5 transition-colors">
                                    <span>{meta.icon}</span> {meta.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {blocks.map((block, i) => {
                        const info = getBlockInfo(block.blockType)
                        return (
                            <button key={i} onClick={() => onBlockSelect(i)}
                                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                                    selectedBlock === i ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-white/5 border border-transparent')}>
                                <GripVertical className="h-3 w-3 text-gray-600" />
                                <span className="mr-1">{info.icon}</span>
                                <span className="font-medium">{info.label}</span>
                                {block.variant && <span className="ml-auto text-[10px] text-gray-600">{block.variant}</span>}
                            </button>
                        )
                    })}
                </div>
            ) : (
                <>
                    {/* AI Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.map(msg => (
                            <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                                {msg.role === 'assistant' && (
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-[10px]">✨</div>
                                )}
                                <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-[#1E293B] text-gray-300 rounded-bl-sm border border-white/5')}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-[10px]">✨</div>
                                <div className="rounded-xl rounded-bl-sm border border-white/5 bg-[#1E293B] px-3 py-2">
                                    <div className="flex gap-1">
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '0ms' }} />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '150ms' }} />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* AI Chat Input */}
                    <div className="border-t border-white/10 p-3">
                        <div className="flex items-center gap-2 rounded-lg bg-[#1E293B] pr-2 border border-white/10 focus-within:border-purple-500/50 transition-colors">
                            <input value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                                placeholder="Ask AI to make changes..."
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                                disabled={isProcessing}
                            />
                            <button onClick={handleSendChat} disabled={!input.trim() || isProcessing}
                                className="rounded-md bg-purple-600 p-1.5 text-white disabled:opacity-30 hover:bg-purple-500 transition-colors">
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
    block, blockIndex, theme, onThemeChange, onDeleteBlock, onDuplicateBlock, onBlockFieldChange,
}: {
    block: BlockData | null; blockIndex: number; theme: any
    onThemeChange: (key: string, value: string) => void
    onDeleteBlock: (idx: number) => void; onDuplicateBlock: (idx: number) => void
    onBlockFieldChange: (idx: number, field: string, value: string) => void
}) {
    if (!block) {
        return (
            <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A] items-center justify-center">
                <p className="text-sm text-gray-500">Select a block to edit</p>
            </div>
        )
    }

    const info = getBlockInfo(block.blockType)

    return (
        <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A]">
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-medium text-white">{info.icon} {info.label}</span>
                <span className="text-xs text-gray-500">#{blockIndex + 1}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Variant Switcher */}
                {info.variants.length > 1 && (
                    <div>
                        <label className="text-xs font-medium uppercase text-gray-500">Variant</label>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {info.variants.map(v => (
                                <button key={v}
                                    onClick={() => onBlockFieldChange(blockIndex, 'variant', v)}
                                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                        block.variant === v ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dynamic fields  */}
                {block.headline !== undefined && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Headline</label>
                        <input defaultValue={block.headline}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'headline', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                )}

                {block.subheadline !== undefined && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Subheadline</label>
                        <textarea defaultValue={block.subheadline} rows={2}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'subheadline', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none" />
                    </div>
                )}

                {block.logoText !== undefined && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Logo Text</label>
                        <input defaultValue={block.logoText}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'logoText', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                )}

                {block.copyrightText !== undefined && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">Copyright</label>
                        <input defaultValue={block.copyrightText}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'copyrightText', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                )}

                {block.ctaLabel !== undefined && (
                    <div>
                        <label className="text-xs font-medium text-gray-400">CTA Label</label>
                        <input defaultValue={block.ctaLabel}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'ctaLabel', e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                )}

                {/* Block actions */}
                <div className="border-t border-white/10 pt-4">
                    <label className="text-xs font-medium uppercase text-gray-500">Actions</label>
                    <div className="mt-2 flex gap-2">
                        <button onClick={() => onDuplicateBlock(blockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                            <Copy className="h-3 w-3" /> Duplicate
                        </button>
                        <button onClick={() => onDeleteBlock(blockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-3 w-3" /> Delete
                        </button>
                    </div>
                </div>

                {/* Theme editing */}
                {theme && (
                    <div className="border-t border-white/10 pt-4">
                        <label className="text-xs font-medium uppercase text-gray-500">🎨 Global Theme</label>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Primary Color</label>
                            <div className="mt-1 flex items-center gap-2">
                                <input type="color" value={theme.primaryColor || '#0ea5e9'}
                                    onChange={e => onThemeChange('primaryColor', e.target.value)}
                                    className="h-7 w-7 rounded border-0 cursor-pointer bg-transparent" />
                                <input value={theme.primaryColor || '#0ea5e9'}
                                    onChange={e => onThemeChange('primaryColor', e.target.value)}
                                    className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Heading Font</label>
                            <select value={theme.fontHeading || 'Outfit'} onChange={e => onThemeChange('fontHeading', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Body Font</label>
                            <select value={theme.fontBody || 'Inter'} onChange={e => onThemeChange('fontBody', e.target.value)}
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

    // Editor store (F-06 Undo/Redo + F-07 Auto-Save)
    const editorStore = useEditorStore()

    // ── F-06: Keyboard shortcuts (Cmd+Z / Cmd+Shift+Z) ────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    if (editorStore.canRedo()) {
                        editorStore.redo()
                        setPage(prev => prev ? { ...prev, layout: editorStore.blocks } : prev)
                        setSite(prev => prev ? { ...prev, theme: editorStore.theme } : prev)
                        setHasUnsavedChanges(true)
                        setIframeKey(k => k + 1)
                    }
                } else {
                    if (editorStore.canUndo()) {
                        editorStore.undo()
                        setPage(prev => prev ? { ...prev, layout: editorStore.blocks } : prev)
                        setSite(prev => prev ? { ...prev, theme: editorStore.theme } : prev)
                        setHasUnsavedChanges(true)
                        setIframeKey(k => k + 1)
                    }
                }
            }
            // Cmd+S to save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [editorStore])

    // ── F-07: Auto-save (every 30s if unsaved changes) ────────────────
    useEffect(() => {
        if (!hasUnsavedChanges || !siteId) return
        const timer = setTimeout(() => {
            handleSave()
        }, 30000)
        return () => clearTimeout(timer)
    }, [hasUnsavedChanges, siteId])

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
                    // Init editor store for undo/redo
                    editorStore.init(siteId, data.page?.layout || [], data.site?.theme || {}, data.site?.name || '')
                }
            } catch (err) { console.error('Failed to load site data', err) }
            finally { setIsLoading(false) }
        }
        loadData()
    }, [siteId])

    // AI Action handler — applies structured actions from AI
    const handleAIAction = (action: any) => {
        if (!page) return

        switch (action.action) {
            case 'update_block': {
                const idx = action.blockIndex ?? selectedBlock
                const newLayout = [...page.layout]
                newLayout[idx] = { ...newLayout[idx], ...action.changes }
                setPage({ ...page, layout: newLayout })
                setHasUnsavedChanges(true)
                break
            }
            case 'update_theme': {
                if (!site) return
                setSite({ ...site, theme: { ...site.theme, ...action.changes } })
                setHasUnsavedChanges(true)
                break
            }
            case 'add_block': {
                const afterIdx = action.afterIndex ?? page.layout.length - 1
                const newLayout = [...page.layout]
                newLayout.splice(afterIdx + 1, 0, action.block)
                setPage({ ...page, layout: newLayout })
                setSelectedBlock(afterIdx + 1)
                setHasUnsavedChanges(true)
                break
            }
            case 'delete_block': {
                const idx = action.blockIndex ?? selectedBlock
                const newLayout = page.layout.filter((_, i) => i !== idx)
                setPage({ ...page, layout: newLayout })
                setSelectedBlock(Math.max(0, idx - 1))
                setHasUnsavedChanges(true)
                break
            }
        }

        // Refresh preview
        setIframeKey(k => k + 1)
    }

    // Publish handler
    const handlePublish = async () => {
        if (!siteId || isPublishing) return
        setIsPublishing(true)
        try {
            const res = await fetch(`/api/sites/${siteId}/publish`, { method: 'PATCH', credentials: 'include' })
            if (res.ok) {
                setPublishSuccess(true)
                if (site) setSite({ ...site, status: 'published' })
                setTimeout(() => setPublishSuccess(false), 3000)
            }
        } catch (err) { console.error('Publish failed', err) }
        finally { setIsPublishing(false) }
    }

    const blocks = page?.layout || []
    const currentBlock = blocks[selectedBlock] || null
    const isPublished = site?.status === 'published'

    // Save handler
    const handleSave = async () => {
        if (!siteId || !page) return
        setIsSaving(true)
        try {
            await fetch(`/api/sites/${siteId}/save`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ blocks: page.layout, theme: site?.theme }),
            })
            setSaveSuccess(true)
            setHasUnsavedChanges(false)
            setIframeKey(k => k + 1)
            setTimeout(() => setSaveSuccess(false), 2000)
        } catch (err) { console.error('Save failed', err) }
        finally { setIsSaving(false) }
    }

    const handleThemeChange = (key: string, value: string) => {
        if (!site) return
        setSite({ ...site, theme: { ...site.theme, [key]: value } })
        setHasUnsavedChanges(true)
    }

    const handleDeleteBlock = (idx: number) => {
        if (!page) return
        const newLayout = page.layout.filter((_, i) => i !== idx)
        setPage({ ...page, layout: newLayout })
        setSelectedBlock(Math.max(0, idx - 1))
        setHasUnsavedChanges(true)
    }

    const handleDuplicateBlock = (idx: number) => {
        if (!page) return
        const blockCopy = JSON.parse(JSON.stringify(page.layout[idx]))
        const newLayout = [...page.layout]
        newLayout.splice(idx + 1, 0, blockCopy)
        setPage({ ...page, layout: newLayout })
        setSelectedBlock(idx + 1)
        setHasUnsavedChanges(true)
    }

    const handleBlockFieldChange = (idx: number, field: string, value: string) => {
        if (!page) return
        const newLayout = [...page.layout]
        newLayout[idx] = { ...newLayout[idx], [field]: value }
        setPage({ ...page, layout: newLayout })
        setHasUnsavedChanges(true)
    }

    return (
        <div className="flex h-screen flex-col bg-[#0B1120]">
            {/* ─── Top Toolbar ──────────────────────────────────────── */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="flex items-center gap-2">
                    <Link href="/dashboard" className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors" title="Back to Dashboard">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="mx-2 h-5 w-px bg-white/10" />
                    {site && <span className="text-sm font-medium text-white">{site.name}</span>}
                </div>

                <div className="flex items-center gap-2">
                    {/* F-06: Undo/Redo buttons */}
                    <button onClick={() => { editorStore.undo(); setPage(p => p ? { ...p, layout: editorStore.blocks } : p); setSite(s => s ? { ...s, theme: editorStore.theme } : s); setHasUnsavedChanges(true); setIframeKey(k => k + 1) }}
                        disabled={!editorStore.canUndo()}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-20" title="Undo (⌘Z)">
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => { editorStore.redo(); setPage(p => p ? { ...p, layout: editorStore.blocks } : p); setSite(s => s ? { ...s, theme: editorStore.theme } : s); setHasUnsavedChanges(true); setIframeKey(k => k + 1) }}
                        disabled={!editorStore.canRedo()}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-20" title="Redo (⌘⇧Z)">
                        <Redo2 className="h-4 w-4" />
                    </button>
                    <div className="mx-1 h-5 w-px bg-white/10" />
                    {hasUnsavedChanges && <span className="text-[10px] text-yellow-400 animate-pulse">● Auto-save in 30s</span>}
                    <button onClick={handleSave} disabled={isSaving || saveSuccess || !hasUnsavedChanges}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                            saveSuccess ? 'bg-green-600/20 text-green-400' : hasUnsavedChanges ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white/5 text-gray-500 cursor-default')}>
                        {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : saveSuccess ? <><Check className="h-3.5 w-3.5" /> Saved!</> : <><Save className="h-3.5 w-3.5" /> Save</>}
                    </button>
                    <a href={`/api/preview/${siteId}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </a>
                    <button onClick={handlePublish} disabled={isPublishing || publishSuccess}
                        className={cn('flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors shadow-lg',
                            publishSuccess ? 'bg-green-600 shadow-green-500/25' : isPublished ? 'bg-green-600/80 shadow-green-500/25 hover:bg-green-500' : 'bg-blue-600 shadow-blue-500/25 hover:bg-blue-500')}>
                        {isPublishing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...</> : publishSuccess ? <><Check className="h-3.5 w-3.5" /> Published!</> : isPublished ? <><Check className="h-3.5 w-3.5" /> Published</> : <><Upload className="h-3.5 w-3.5" /> Publish</>}
                    </button>
                </div>
            </div>

            {/* ─── Main Area (3 Panels) ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                <AIChatPanel
                    isOpen={isChatOpen}
                    onToggle={() => setIsChatOpen(!isChatOpen)}
                    blocks={blocks}
                    onBlockSelect={setSelectedBlock}
                    selectedBlock={selectedBlock}
                    onAIAction={handleAIAction}
                    siteName={site?.name || ''}
                    theme={site?.theme}
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
                            <iframe key={iframeKey} src={`/api/preview/${siteId}`} className="h-full w-full border-0" title="Site Preview" />
                        </div>
                    )}
                </div>

                <SettingsPanel
                    block={currentBlock}
                    blockIndex={selectedBlock}
                    theme={site?.theme}
                    onThemeChange={handleThemeChange}
                    onDeleteBlock={handleDeleteBlock}
                    onDuplicateBlock={handleDuplicateBlock}
                    onBlockFieldChange={handleBlockFieldChange}
                />
            </div>

            {/* ─── Status Bar ───────────────────────────────────────── */}
            <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/10 px-4 text-[11px]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Connected
                    </span>
                    <span className="text-gray-500">Site ID: {siteId}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-gray-500">{blocks.length} blocks</span>
                    <span className="text-gray-600">History: {editorStore.historyIndex + 1}/{editorStore.history.length}</span>
                    <span className={cn('rounded px-1.5 py-0.5 font-medium',
                        isPublished ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
                        {isPublished ? 'Published' : 'Draft'}
                    </span>
                </div>
            </div>
        </div>
    )
}
