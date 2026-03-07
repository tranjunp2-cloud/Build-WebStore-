'use client'

import { useState } from 'react'
import Link from 'next/link'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────
type EditorTab = 'chat' | 'blocks'

// ─── AI Chat Panel (Left) ───────────────────────────────────────────────
function AIChatPanel({
    isOpen,
    onToggle,
}: {
    isOpen: boolean
    onToggle: () => void
}) {
    const [input, setInput] = useState('')

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                className="fixed left-0 top-14 z-30 rounded-r-lg bg-[#1E293B] p-2 text-gray-400 hover:text-white transition-colors border border-l-0 border-white/10"
                title="Open AI Chat"
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
                    <button className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400">
                        <MessageSquare className="h-3 w-3" /> AI Chat
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors">
                        <LayoutGrid className="h-3 w-3" /> Blocks
                    </button>
                </div>
                <button
                    onClick={onToggle}
                    className="rounded-lg p-1 text-gray-500 hover:bg-white/5 hover:text-white transition-colors"
                >
                    <PanelLeftClose className="h-4 w-4" />
                </button>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* AI welcome message */}
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
                    </div>
                </div>
            </div>

            {/* Chat input */}
            <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-2 rounded-lg bg-[#1E293B] pr-2 border border-white/10 focus-within:border-blue-500/50 transition-colors">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask AI to edit..."
                        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                    />
                    <button
                        disabled={!input.trim()}
                        className="rounded-md bg-blue-600 p-1.5 text-white disabled:opacity-30 hover:bg-blue-500 transition-colors"
                    >
                        <Send className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Settings Panel (Right) ─────────────────────────────────────────────
function SettingsPanel() {
    return (
        <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A]">
            {/* Header */}
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-medium text-white">Settings</span>
                <button className="text-gray-500 hover:text-white transition-colors">
                    <ChevronDown className="h-4 w-4" />
                </button>
            </div>

            {/* Block settings */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Block type header */}
                <div>
                    <label className="text-xs font-medium uppercase text-gray-500">Selected Block</label>
                    <p className="mt-1 text-sm font-medium text-white">Hero Banner</p>
                </div>

                {/* Variant selector */}
                <div>
                    <label className="text-xs font-medium text-gray-400">Variant</label>
                    <select className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
                        <option value="centered">Centered</option>
                        <option value="split">Split (Image Right)</option>
                        <option value="fullscreen">Fullscreen Background</option>
                    </select>
                </div>

                {/* Content fields */}
                <div>
                    <label className="text-xs font-medium text-gray-400">Heading</label>
                    <input
                        defaultValue="Welcome to our bakery"
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-400">Subheading</label>
                    <textarea
                        defaultValue="Fresh pastries baked daily with love"
                        rows={2}
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-400">CTA Text</label>
                    <input
                        defaultValue="Order Now"
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-gray-400">Background Color</label>
                    <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg border border-white/10" style={{ backgroundColor: '#1E3A5F' }} />
                        <input
                            defaultValue="#1E3A5F"
                            className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                        />
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-white/10 pt-4">
                    <label className="text-xs font-medium uppercase text-gray-500">Block Actions</label>
                    <div className="mt-2 flex gap-2">
                        <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                            <Copy className="h-3 w-3" /> Duplicate
                        </button>
                        <button className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-3 w-3" /> Delete
                        </button>
                    </div>
                </div>

                {/* Theme section */}
                <div className="border-t border-white/10 pt-4">
                    <label className="text-xs font-medium uppercase text-gray-500">🎨 Global Theme</label>

                    <div className="mt-3">
                        <label className="text-xs text-gray-400">Primary Color</label>
                        <div className="mt-1 flex items-center gap-2">
                            <div className="h-6 w-6 rounded border border-white/10" style={{ backgroundColor: '#2563EB' }} />
                            <input
                                defaultValue="#2563EB"
                                className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-3">
                        <label className="text-xs text-gray-400">Heading Font</label>
                        <select className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                            <option>Plus Jakarta Sans</option>
                            <option>Inter</option>
                            <option>DM Sans</option>
                            <option>Poppins</option>
                        </select>
                    </div>

                    <div className="mt-3">
                        <label className="text-xs text-gray-400">Body Font</label>
                        <select className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                            <option>DM Sans</option>
                            <option>Inter</option>
                            <option>Roboto</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Block Item in Preview (placeholder) ────────────────────────────────
function PreviewBlock({ name, isSelected }: { name: string; isSelected?: boolean }) {
    return (
        <div
            className={cn(
                'group relative border-2 transition-colors cursor-pointer',
                isSelected ? 'border-blue-500' : 'border-transparent hover:border-blue-500/30'
            )}
        >
            {/* Drag handle + label */}
            <div
                className={cn(
                    'absolute -left-8 top-2 flex items-center gap-1 rounded bg-[#1E293B] px-1.5 py-0.5 text-[10px] text-gray-400 opacity-0 transition-opacity',
                    isSelected ? 'opacity-100' : 'group-hover:opacity-100'
                )}
            >
                <GripVertical className="h-3 w-3" />
                {name}
            </div>

            {/* Inline AI edit button */}
            <button className="absolute -right-3 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                <Sparkles className="h-3 w-3" />
            </button>

            {/* Placeholder content */}
            <div className="bg-gray-100 p-8 text-center text-gray-400 text-sm">
                [{name} Block]
            </div>
        </div>
    )
}

// ─── Main Editor Page ───────────────────────────────────────────────────
export default function EditorPage() {
    const [isChatOpen, setIsChatOpen] = useState(true)

    return (
        <div className="flex h-screen flex-col bg-[#0B1120]">
            {/* ─── Top Toolbar ──────────────────────────────────────── */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                {/* Left: Back + Undo/Redo */}
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="mx-2 h-5 w-px bg-white/10" />
                    <button className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors" title="Undo (Ctrl+Z)">
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white transition-colors" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 className="h-4 w-4" />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors">
                        <Save className="h-3.5 w-3.5" /> Save
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </button>
                    <button className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25">
                        <Upload className="h-3.5 w-3.5" /> Publish
                    </button>
                </div>
            </div>

            {/* ─── Main Area (3 Panels) ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: AI Chat + Block Library */}
                <AIChatPanel isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} />

                {/* Center: Live Preview */}
                <div className="flex flex-1 flex-col">
                    <div className="flex-1 overflow-auto bg-white p-8">
                        <div className="mx-auto max-w-4xl space-y-0">
                            <PreviewBlock name="Navigation" />
                            <PreviewBlock name="Hero" isSelected />
                            <PreviewBlock name="About" />
                            <PreviewBlock name="Features" />
                            <PreviewBlock name="Testimonials" />
                            <PreviewBlock name="Contact" />
                            <PreviewBlock name="Footer" />
                        </div>
                    </div>
                </div>

                {/* Right: Settings Panel */}
                <SettingsPanel />
            </div>

            {/* ─── Status Bar ───────────────────────────────────────── */}
            <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/10 px-4 text-[11px]">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-green-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        Autosave: ON
                    </span>
                    <span className="text-gray-500">Last saved: 2 min ago</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-gray-500">7 blocks</span>
                    <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-yellow-400 font-medium">
                        Draft
                    </span>
                </div>
            </div>
        </div>
    )
}
