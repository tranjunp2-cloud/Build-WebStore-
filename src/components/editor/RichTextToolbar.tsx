'use client'

import React, { useState, useEffect } from 'react'
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Link2, Palette, List, ListOrdered, Sparkles, ChevronDown
} from 'lucide-react'
import { useI18n } from '@/i18n'

const FONT_FAMILIES = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Nunito', 'Raleway', 'Georgia', 'Times New Roman',
]

interface RichTextToolbarProps {
    onCommand: (command: string, value?: string) => void
    activeState?: Record<string, unknown>
}

const PRESET_COLORS = [
    '#000000', '#FFFFFF', '#EF4444', '#F97316', '#EAB308',
    '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
]

export function RichTextToolbar({ onCommand, activeState = {} }: RichTextToolbarProps) {
    const { t } = useI18n()
    const rt = t.editor.richText
    const isActive = (cmd: string) => Boolean(activeState[cmd])
    const currentAlign = String(activeState.textAlign || 'left')
    const isAlign = (align: string) => currentAlign === align

    const [fontFamily, setFontFamily] = useState('Inter')
    const [showFontMenu, setShowFontMenu] = useState(false)
    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [hexInput, setHexInput] = useState('#000000')
    const [activeColor, setActiveColor] = useState('#000000')

    const applyColor = (hex: string) => {
        setActiveColor(hex)
        setHexInput(hex)
        onCommand('foreColor', hex)
    }

    const handleHexInput = (val: string) => {
        setHexInput(val)
        if (/^#[0-9a-fA-F]{6}$/.test(val)) applyColor(val)
    }
    const [showListMenu, setShowListMenu] = useState(false)
    const [fontSize, setFontSize] = useState(16)

    // Sync font size + family from active element when toolbar opens or element changes
    useEffect(() => {
        const fs = Number(activeState.fontSize)
        if (fs > 0) setFontSize(fs)
    }, [activeState.fontSize])

    useEffect(() => {
        const ff = String(activeState.fontFamily || '')
        if (ff) setFontFamily(ff)
    }, [activeState.fontFamily])

    const handleFontSize = (delta: number) => {
        const next = Math.max(8, Math.min(96, fontSize + delta))
        setFontSize(next)
        onCommand('fontSize', String(next))
    }

    const btnCls = (active: boolean) =>
        `p-1.5 rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`

    return (
        <div
            data-wysiwyg-toolbar
            className="relative flex items-center gap-1 bg-white border border-gray-200 shadow-xl rounded-lg p-1.5 pointer-events-auto"
            onMouseDown={(e) => e.preventDefault()}
        >
            {/* Font family */}
            <div className="relative">
                <button
                    type="button"
                    className="flex items-center gap-1 h-8 rounded px-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors"
                    style={{ fontFamily, minWidth: 100 }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.preventDefault(); setShowFontMenu(v => !v); setShowColorPicker(false); setShowLinkInput(false); setShowListMenu(false) }}
                >
                    <span className="flex-1 text-left truncate">{fontFamily}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                </button>
                {showFontMenu && (
                    <div
                        className="absolute left-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {FONT_FAMILIES.map((f) => (
                            <button
                                key={f}
                                type="button"
                                className={`flex w-full items-center px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 ${fontFamily === f ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                                style={{ fontFamily: f }}
                                onClick={(e) => { e.preventDefault(); setFontFamily(f); onCommand('fontName', f); setShowFontMenu(false) }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Font size */}
            <div className="flex items-center rounded border border-gray-200 overflow-hidden">
                <button
                    className="flex h-7 w-6 items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-sm leading-none"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.preventDefault(); handleFontSize(-1) }}
                    title="Decrease font size"
                >−</button>
                <input
                    type="number"
                    value={fontSize}
                    min={8}
                    max={96}
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const v = Math.max(8, Math.min(96, Number(e.target.value) || 16))
                        setFontSize(v)
                        onCommand('fontSize', String(v))
                    }}
                    className="h-7 w-9 border-x border-gray-200 bg-gray-50 text-center text-xs text-gray-700 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                    className="flex h-7 w-6 items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors text-sm leading-none"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.preventDefault(); handleFontSize(1) }}
                    title="Increase font size"
                >+</button>
            </div>

            <div className="w-px h-6 bg-gray-200 mx-1" />

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

            <div className="w-px h-6 bg-gray-200 mx-1" />

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

            <div className="w-px h-6 bg-gray-200 mx-1" />

            {/* Link */}
            <div className="relative">
                <button
                    className={btnCls(showLinkInput)}
                    onClick={(e) => { e.preventDefault(); setShowLinkInput(!showLinkInput); setShowColorPicker(false); setShowListMenu(false) }}
                    title="Insert link"
                >
                    <Link2 className="w-4 h-4" />
                </button>
                {showLinkInput && (
                    <div className="absolute left-0 top-full mt-2 z-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                        <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://..."
                            className="h-7 w-[180px] rounded border border-gray-200 px-2 text-xs outline-none focus:border-blue-400"
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
                            className="h-7 rounded px-2 text-[10px] text-gray-500 hover:bg-gray-100"
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
                    onClick={(e) => { e.preventDefault(); setShowColorPicker(!showColorPicker); setShowFontMenu(false); setShowLinkInput(false); setShowListMenu(false) }}
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
                        className="absolute left-0 top-full mt-2 z-20 rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl"
                        style={{ width: 168 }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* Preset swatches — inline grid to avoid Tailwind purge */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className="rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    style={{
                                        width: 24, height: 24,
                                        backgroundColor: color,
                                        border: activeColor === color ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                    }}
                                    onClick={(e) => { e.preventDefault(); applyColor(color) }}
                                    title={color}
                                />
                            ))}
                        </div>

                        {/* Hex input + color preview */}
                        <div className="flex items-center gap-1.5">
                            <label
                                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-gray-200 overflow-hidden"
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
                            <input
                                type="text"
                                value={hexInput}
                                maxLength={7}
                                placeholder="#000000"
                                className="h-7 flex-1 rounded border border-gray-200 px-1.5 text-xs text-gray-700 outline-none focus:border-blue-400 font-mono"
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => handleHexInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) { applyColor(hexInput); setShowColorPicker(false) } }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="relative">
                <button
                    className={btnCls(showListMenu)}
                    onClick={(e) => { e.preventDefault(); setShowListMenu(!showListMenu); setShowLinkInput(false); setShowColorPicker(false) }}
                    title="List"
                >
                    <List className="w-4 h-4" />
                </button>
                {showListMenu && (
                    <div className="absolute left-0 top-full mt-2 z-10 flex flex-col rounded-lg border border-gray-200 bg-white p-1 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                        <button className="flex items-center gap-2 rounded px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={(e) => { e.preventDefault(); onCommand('insertUnorderedList'); setShowListMenu(false) }}>
                            <List className="h-3.5 w-3.5" /> Bullet
                        </button>
                        <button className="flex items-center gap-2 rounded px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" onClick={(e) => { e.preventDefault(); onCommand('insertOrderedList'); setShowListMenu(false) }}>
                            <ListOrdered className="h-3.5 w-3.5" /> Numbered
                        </button>
                    </div>
                )}
            </div>

            {/* AI Edit */}
            <button
                className="p-1.5 rounded transition-colors text-amber-500 hover:bg-amber-50"
                onClick={(e) => { e.preventDefault(); onCommand('aiEdit') }}
                title="Edit with AI"
            >
                <Sparkles className="w-4 h-4" />
            </button>
        </div>
    )
}
