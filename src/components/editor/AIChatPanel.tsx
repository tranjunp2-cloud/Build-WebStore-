'use client'

import React, { memo, useState, useEffect, useRef } from 'react'
import {
    Sparkles, LayoutGrid, Send, GripVertical,
    PanelLeftClose, PanelLeftOpen, Plus, Undo2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'
import type { BlockData, AIAction, ThemeData } from '@/types/editor'
import { useEditorStore } from '@/store/editorStore'

// ─── Types ──────────────────────────────────────────────────────────────
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; historyIndex?: number }

function getBlockInfo(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return { label: meta?.name || blockType, icon: meta?.icon || '🧩', variants: meta?.variants || [] }
}

// ─── Props ──────────────────────────────────────────────────────────────
interface AIChatPanelProps {
    isOpen: boolean
    onToggle: () => void
    blocks: BlockData[]
    onBlockSelect: (idx: number) => void
    selectedBlock: number
    onAIAction: (action: AIAction) => void
    siteName: string
    theme: ThemeData | undefined
}

// ─── Component ──────────────────────────────────────────────────────────
function AIChatPanelInner({
    isOpen, onToggle, blocks, onBlockSelect, selectedBlock,
    onAIAction, siteName, theme,
}: AIChatPanelProps) {
    const storeHistoryIndex = useEditorStore((s) => s.historyIndex)
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
            onAIAction(data as AIAction)

            const actionDesc = data.action === 'update_block' ? '✅ Block updated'
                : data.action === 'update_theme' ? '🎨 Theme updated'
                    : data.action === 'add_block' ? '➕ New block added'
                        : data.action === 'delete_block' ? '🗑️ Block deleted'
                            : '✅ Done'

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(), role: 'assistant',
                content: `${actionDesc}\n${data.message || ''}`,
                historyIndex: useEditorStore.getState().historyIndex
            }])
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error'
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `❌ Error: ${message}` }])
        } finally {
            setIsProcessing(false)
        }
    }

    if (!isOpen) {
        return (
            <button onClick={onToggle}
                aria-label="Open editor panel"
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
                <div className="flex gap-1" role="tablist" aria-label="Editor panel tabs">
                    <button onClick={() => setTab('blocks')} role="tab" aria-selected={tab === 'blocks'}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            tab === 'blocks' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300')}>
                        <LayoutGrid className="h-3 w-3" /> Blocks
                    </button>
                    <button onClick={() => setTab('chat')} role="tab" aria-selected={tab === 'chat'}
                        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                            tab === 'chat' ? 'bg-purple-500/10 text-purple-400' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300')}>
                        <Sparkles className="h-3 w-3" /> AI Chat
                    </button>
                </div>
                <button onClick={onToggle} aria-label="Close editor panel" className="rounded-lg p-1 text-gray-500 hover:bg-white/5 hover:text-white transition-colors">
                    <PanelLeftClose className="h-4 w-4" />
                </button>
            </div>

            {tab === 'blocks' ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-1" role="tabpanel">
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
                                aria-current={selectedBlock === i ? 'true' : undefined}
                                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                                    selectedBlock === i ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-gray-300 hover:bg-white/5 border border-transparent')}>
                                <GripVertical className="h-3 w-3 text-gray-600" />
                                <span className="mr-1">{info.icon}</span>
                                <span className="font-medium">{info.label}</span>
                                {block.variant ? <span className="ml-auto text-[10px] text-gray-600">{String(block.variant)}</span> : null}
                            </button>
                        )
                    })}
                </div>
            ) : (
                <div role="tabpanel" className="flex flex-1 flex-col">
                    {/* AI Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3" role="log" aria-label="AI chat messages">
                        {messages.map(msg => {
                            const isUndone = msg.historyIndex !== undefined && storeHistoryIndex < msg.historyIndex;
                            const isCurrent = msg.historyIndex !== undefined && storeHistoryIndex === msg.historyIndex;
                            const canUndoMsg = isCurrent && useEditorStore.getState().canUndo();

                            return (
                                <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : '', isUndone ? 'opacity-60' : '')}>
                                    {msg.role === 'assistant' && (
                                        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", isUndone ? "bg-gray-800" : "bg-gradient-to-br from-purple-500 to-blue-500")}>
                                            <Sparkles className={cn("h-3 w-3", isUndone ? "text-gray-500" : "text-white")} />
                                        </div>
                                    )}
                                    <div className={cn('relative max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                                        msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-[#1E293B] text-gray-300 rounded-bl-sm border border-white/5',
                                        isUndone ? 'border-dashed border-gray-600 bg-transparent' : ''
                                    )}>
                                        {isUndone && msg.role === 'assistant' && (
                                            <div className="mb-1.5">
                                                <span className="inline-block rounded border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                    Undone
                                                </span>
                                            </div>
                                        )}
                                        <p className={cn("whitespace-pre-wrap", isUndone && msg.role === 'assistant' ? "line-through text-gray-500" : "")}>{msg.content}</p>
                                        
                                        {!isUndone && isCurrent && msg.role === 'assistant' && canUndoMsg && (
                                            <button 
                                                onClick={() => useEditorStore.getState().undo()}
                                                className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-md bg-white/5 py-1.5 text-[11px] font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                                            >
                                                <Undo2 className="h-3 w-3" /> Undo Change
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {isProcessing && (
                            <div className="flex gap-2" role="status" aria-label="AI is thinking">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
                                    <Sparkles className="h-3 w-3 text-white" />
                                </div>
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
                                aria-label="Chat message"
                                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                                disabled={isProcessing}
                            />
                            <button onClick={handleSendChat} disabled={!input.trim() || isProcessing}
                                aria-label="Send message"
                                className="rounded-md bg-purple-600 p-1.5 text-white disabled:opacity-30 hover:bg-purple-500 transition-colors">
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export const AIChatPanel = memo(AIChatPanelInner)
