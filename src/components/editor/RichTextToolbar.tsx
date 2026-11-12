'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Link2, Palette, List, ListOrdered, Sparkles,
} from 'lucide-react'
import { useI18n } from '@/i18n'

interface RichTextToolbarProps {
    onCommand: (command: string, value?: string) => void
    /** Ask AI (the copilot chat) on the text being edited; hidden without the copilot */
    canAskAI?: boolean
    activeState?: Record<string, unknown>
}

const PRESET_COLORS = [
    '#000000', '#FFFFFF', '#EF4444', '#F97316', '#EAB308',
    '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
]

export function RichTextToolbar({ onCommand, activeState = {}, canAskAI = false }: RichTextToolbarProps) {
    const { t } = useI18n()
    const rt = t.editor.richText
    const isActive = (cmd: string) => Boolean(activeState[cmd])
    const currentAlign = String(activeState.textAlign || 'left')
    const isAlign = (align: string) => currentAlign === align
    const activeList = String(activeState.activeList || '')

    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [hexInput, setHexInput] = useState('#000000')
    const [activeColor, setActiveColor] = useState('#000000')
    const [showListMenu, setShowListMenu] = useState(false)
    const [fontSize, setFontSize] = useState(16)
    const [fontSizeRaw, setFontSizeRaw] = useState('16')
    // Ô đã được gõ sửa chưa commit — blur không sửa gì thì không áp lại cỡ chữ cũ
    const fontSizeDirtyRef = useRef(false)

    const applyColor = (hex: string) => {
        setActiveColor(hex)
        setHexInput(hex)
        onCommand('foreColor', hex)
    }

    const handleHexInput = (val: string) => {
        setHexInput(val)
        if (/^#[0-9a-fA-F]{6}$/.test(val)) applyColor(val)
    }

    const commitFontSize = (raw: string) => {
        const v = Math.max(8, Math.min(96, parseInt(raw, 10) || fontSize))
        fontSizeDirtyRef.current = false
        setFontSize(v)
        setFontSizeRaw(String(v))
        onCommand('fontSize', String(v))
    }

    const handleFontSize = (delta: number) => {
        const next = Math.max(8, Math.min(96, fontSize + delta))
        setFontSize(next)
        setFontSizeRaw(String(next))
        onCommand('fontSize', String(next))
    }

    useEffect(() => {
        const fs = Number(activeState.fontSize)
        if (fs > 0) { setFontSize(fs); setFontSizeRaw(String(fs)) }
    }, [activeState.fontSize])

    useEffect(() => {
        const c = String(activeState.color || '')
        if (/^#[0-9a-fA-F]{6}$/.test(c)) {
            setActiveColor(c)
            setHexInput(c)
        }
    }, [activeState.color])

    const btnCls = (active: boolean) =>
        `p-1.5 rounded transition-colors ${active ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`

    return (
        <div
            data-wysiwyg-toolbar
            className="relative flex flex-wrap items-center gap-1 bg-gray-900 border border-gray-700 shadow-2xl rounded-lg p-1.5 pointer-events-auto"
            onMouseDown={(e) => e.preventDefault()}
        >
            {/* Format Tag Selection */}
            <div className="relative flex items-center">
                <select
                    className="h-7 w-[95px] rounded border border-gray-700 bg-gray-800 px-2 py-0 text-[11px] font-medium text-gray-200 outline-none hover:bg-gray-700 transition-colors cursor-pointer"
                    value={(activeState.formatBlock as string)?.toUpperCase() || 'P'}
                    onChange={(e) => onCommand('formatBlock', e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Change formatting style"
                >
                    <option value="P">Paragraph</option>
                    <option value="H1">Heading 1</option>
                    <option value="H2">Heading 2</option>
                    <option value="H3">Heading 3</option>
                    <option value="H4">Heading 4</option>
                    <option value="H5">Heading 5</option>
                    <option value="H6">Heading 6</option>
                </select>
            </div>
            
            <div className="w-px h-6 bg-gray-700 mx-1" />

            {/* Font size */}
            <div className="flex items-center rounded border border-gray-700 overflow-hidden">
                <button
                    className="flex h-7 w-6 items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm leading-none"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.preventDefault(); handleFontSize(-1) }}
                    title="Decrease font size"
                >−</button>
                <input
                    type="text"
                    inputMode="numeric"
                    value={fontSizeRaw}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => { fontSizeDirtyRef.current = true; setFontSizeRaw(e.target.value) }}
                    // Enter đã commit và xóa dirty; blur chỉ commit khi người dùng gõ mà chưa Enter (GH-2089)
                    onBlur={(e) => { if (fontSizeDirtyRef.current) commitFontSize(e.target.value) }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitFontSize((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur() }
                        if (e.key === 'Escape') { fontSizeDirtyRef.current = false; setFontSizeRaw(String(fontSize)); (e.target as HTMLInputElement).blur() }
                    }}
                    className="h-7 w-9 border-x border-gray-700 bg-gray-800 text-center text-xs text-gray-200 outline-none"
                />
                <button
                    className="flex h-7 w-6 items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm leading-none"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.preventDefault(); handleFontSize(1) }}
                    title="Increase font size"
                >+</button>
            </div>

            <div className="w-px h-6 bg-gray-700 mx-1" />

            <button className={btnCls(isActive('bold'))} onClick={(e) => { e.preventDefault(); onCommand('bold') }} title={rt.bold}>
                <Bold className="w-4 h-4" />
            </button>
            <button className={btnCls(isActive('italic'))} onClick={(e) => { e.preventDefault(); onCommand('italic') }} title={rt.italic}>
                <Italic className="w-4 h-4" />
            </button>
            <button className={btnCls(isActive('underline'))} onClick={(e) => { e.preventDefault(); onCommand('underline') }} title={rt.underline}>
                <Underline className="w-4 h-4" />
            </button>
            <button className={btnCls(isActive('strikeThrough'))} onClick={(e) => { e.preventDefault(); onCommand('strikeThrough') }} title="Strikethrough">
                <Strikethrough className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-700 mx-1" />

            <button className={btnCls(isAlign('left'))} onClick={(e) => { e.preventDefault(); onCommand('justifyLeft') }} title={rt.alignLeft}>
                <AlignLeft className="w-4 h-4" />
            </button>
            <button className={btnCls(isAlign('center'))} onClick={(e) => { e.preventDefault(); onCommand('justifyCenter') }} title={rt.alignCenter}>
                <AlignCenter className="w-4 h-4" />
            </button>
            <button className={btnCls(isAlign('right'))} onClick={(e) => { e.preventDefault(); onCommand('justifyRight') }} title={rt.alignRight}>
                <AlignRight className="w-4 h-4" />
            </button>
            <button className={btnCls(isAlign('justify'))} onClick={(e) => { e.preventDefault(); onCommand('justifyFull') }} title={rt.justify}>
                <AlignJustify className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-700 mx-1" />

            {/* Link */}
            <div className="relative">
                <button
                    className={btnCls(showLinkInput)}
                    onClick={(e) => {
                        e.preventDefault()
                        if (!showLinkInput) setLinkUrl(String(activeState.linkHref || ''))
                        setShowLinkInput(!showLinkInput)
                        setShowColorPicker(false)
                        setShowListMenu(false)
                    }}
                    title="Insert link"
                >
                    <Link2 className="w-4 h-4" />
                </button>
                {showLinkInput && (
                    <div className="absolute left-0 top-full mt-2 z-10 flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 p-1.5 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                        <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://..."
                            className="h-7 w-[180px] rounded border border-gray-700 bg-gray-800 text-gray-200 px-2 text-xs outline-none focus:border-blue-400 placeholder-gray-500"
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && linkUrl) {
                                    onCommand('createLink', linkUrl)
                                    setLinkUrl('')
                                    setShowLinkInput(false)
                                }
                            }}
                        />
                        <button
                            className="h-7 rounded bg-blue-500 px-2 text-[10px] font-semibold text-white hover:bg-blue-600"
                            onClick={(e) => { e.preventDefault(); if (linkUrl) { onCommand('createLink', linkUrl); setLinkUrl(''); setShowLinkInput(false) } }}
                        >
                            Apply
                        </button>
                        <button
                            className="h-7 rounded px-2 text-[10px] text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                            onClick={(e) => { e.preventDefault(); setShowLinkInput(false); setLinkUrl('') }}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Color */}
            <div className="relative">
                <button
                    className={btnCls(showColorPicker)}
                    onClick={(e) => { e.preventDefault(); setShowColorPicker(!showColorPicker); setShowLinkInput(false); setShowListMenu(false) }}
                    title="Text color"
                >
                    <span className="relative inline-flex items-center justify-center w-4 h-4">
                        <Palette className="w-4 h-4" />
                        <span
                            className="absolute -bottom-0.5 left-0 right-0 h-[3px] rounded-full"
                            style={{ backgroundColor: activeColor }}
                        />
                    </span>
                </button>
                {showColorPicker && (
                    <div
                        className="absolute left-0 top-full mt-2 z-20 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
                        style={{ width: 196, padding: '10px' }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className="rounded-md transition-transform hover:scale-110 focus:outline-none"
                                    style={{
                                        width: 28, height: 28,
                                        backgroundColor: color,
                                        boxShadow: activeColor === color
                                            ? '0 0 0 2px #111827, 0 0 0 4px #3b82f6'
                                            : color === '#000000' ? 'inset 0 0 0 1px #374151' : 'none',
                                    }}
                                    onClick={(e) => { e.preventDefault(); applyColor(color) }}
                                    title={color}
                                />
                            ))}
                        </div>
                        <div style={{ height: 1, backgroundColor: 'var(--editor-border)', marginBottom: 8 }} />
                        <div className="flex items-center gap-2">
                            <label
                                className="shrink-0 cursor-pointer rounded-md overflow-hidden"
                                style={{ width: 28, height: 28, border: '1px solid var(--editor-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                                title="Pick custom color"
                            >
                                <span className="block w-full h-full" style={{ backgroundColor: activeColor }} />
                                <input
                                    type="color"
                                    className="sr-only"
                                    value={activeColor}
                                    onChange={(e) => applyColor(e.target.value)}
                                />
                            </label>
                            <div className="flex flex-1 items-center rounded-md border border-gray-700 overflow-hidden focus-within:border-blue-400 transition-colors bg-gray-800">
                                <span className="flex h-7 items-center border-r border-gray-700 bg-gray-800 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">HEX</span>
                                <input
                                    type="text"
                                    value={hexInput}
                                    maxLength={7}
                                    placeholder="#000000"
                                    className="h-7 min-w-0 flex-1 bg-gray-800 px-1.5 font-mono text-xs text-gray-200 outline-none"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onChange={(e) => handleHexInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) { applyColor(hexInput); setShowColorPicker(false) } }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="relative">
                <button
                    className={btnCls(showListMenu || activeList === 'ul' || activeList === 'ol')}
                    onClick={(e) => { e.preventDefault(); setShowListMenu(!showListMenu); setShowLinkInput(false); setShowColorPicker(false) }}
                    title="List"
                >
                    <List className="w-4 h-4" />
                </button>
                {showListMenu && (
                    <div className="absolute left-0 top-full mt-2 z-10 flex flex-col rounded-lg border border-gray-700 bg-gray-900 p-1 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                        <button className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-gray-800 ${activeList === 'ul' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-300'}`} onClick={(e) => { e.preventDefault(); onCommand('insertUnorderedList'); setShowListMenu(false) }}>
                            <List className="h-3.5 w-3.5" /> Bullet
                        </button>
                        <button className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-gray-800 ${activeList === 'ol' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-300'}`} onClick={(e) => { e.preventDefault(); onCommand('insertOrderedList'); setShowListMenu(false) }}>
                            <ListOrdered className="h-3.5 w-3.5" /> Numbered
                        </button>
                    </div>
                )}
            </div>

            {/* Ask AI → the copilot chat */}
            {canAskAI && (
                <button
                    type="button"
                    className="p-1.5 rounded transition-colors text-teal-300 hover:bg-teal-400/15"
                    onClick={(e) => { e.preventDefault(); onCommand('aiEdit') }}
                    title="Ask AI"
                    aria-label="Ask AI"
                >
                    <Sparkles className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}
