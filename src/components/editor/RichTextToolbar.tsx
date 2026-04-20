'use client'

import React, { useState } from 'react'
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Link2, Palette, List, ListOrdered, Sparkles
} from 'lucide-react'
import { useI18n } from '@/i18n'

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
    const currentTag = String(activeState.formatBlock || 'P').toUpperCase()
    const currentValue = ['H1', 'H2', 'H3', 'H4'].includes(currentTag) ? currentTag : 'P'
    const currentAlign = String(activeState.textAlign || 'left')
    const isAlign = (align: string) => currentAlign === align

    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showListMenu, setShowListMenu] = useState(false)
    const [fontSize, setFontSize] = useState(16)

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
            <select
                value={currentValue}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCommand('formatBlock', e.target.value)}
                className="w-[110px] h-8 text-xs border-0 bg-transparent hover:bg-gray-100 focus:ring-0 cursor-pointer outline-none"
            >
                <option value="H1">{rt.heading1}</option>
                <option value="H2">{rt.heading2}</option>
                <option value="H3">{rt.heading3}</option>
                <option value="H4">{rt.heading4}</option>
                <option value="P">{rt.paragraph}</option>
            </select>

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
                    onClick={(e) => { e.preventDefault(); setShowColorPicker(!showColorPicker); setShowLinkInput(false); setShowListMenu(false) }}
                    title="Text color"
                >
                    <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && (
                    <div className="absolute left-0 top-full mt-2 z-10 grid grid-cols-5 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg" onMouseDown={(e) => e.stopPropagation()}>
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color}
                                className="h-6 w-6 rounded-md border border-gray-200 transition-transform hover:scale-110"
                                style={{ backgroundColor: color }}
                                onClick={(e) => { e.preventDefault(); onCommand('foreColor', color); setShowColorPicker(false) }}
                                title={color}
                            />
                        ))}
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
