'use client'

import React from 'react'
import {
    Bold, Italic, Underline,
    AlignLeft, AlignCenter, AlignRight, AlignJustify
} from 'lucide-react'
import { useI18n } from '@/i18n'

interface RichTextToolbarProps {
    onCommand: (command: string, value?: string) => void
    activeState?: Record<string, unknown>
}

export function RichTextToolbar({ onCommand, activeState = {} }: RichTextToolbarProps) {
    const { t } = useI18n()
    const rt = t.editor.richText
    const isActive = (cmd: string) => Boolean(activeState[cmd])
    const currentTag = String(activeState.formatBlock || 'P').toUpperCase()
    const currentValue = ['H1', 'H2', 'H3', 'H4'].includes(currentTag) ? currentTag : 'P'
    const currentAlign = String(activeState.textAlign || 'left')
    const isAlign = (align: string) => currentAlign === align

    return (
        <div
            data-wysiwyg-toolbar
            className="flex items-center gap-1 bg-white border border-gray-200 shadow-xl rounded-lg p-1.5 pointer-events-auto"
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

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button
                className={`p-1.5 rounded transition-colors ${isActive('bold') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('bold') }}
                title={rt.bold}
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                className={`p-1.5 rounded transition-colors ${isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('italic') }}
                title={rt.italic}
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                className={`p-1.5 rounded transition-colors ${isActive('underline') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('underline') }}
                title={rt.underline}
            >
                <Underline className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button
                className={`p-1.5 rounded transition-colors ${isAlign('left') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('justifyLeft') }}
                title={rt.alignLeft}
            >
                <AlignLeft className="w-4 h-4" />
            </button>
            <button
                className={`p-1.5 rounded transition-colors ${isAlign('center') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('justifyCenter') }}
                title={rt.alignCenter}
            >
                <AlignCenter className="w-4 h-4" />
            </button>
            <button
                className={`p-1.5 rounded transition-colors ${isAlign('right') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('justifyRight') }}
                title={rt.alignRight}
            >
                <AlignRight className="w-4 h-4" />
            </button>
            <button 
                className={`p-1.5 rounded transition-colors ${isAlign('justify') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={(e) => { e.preventDefault(); onCommand('justifyFull') }}
                title={rt.justify}
            >
                <AlignJustify className="w-4 h-4" />
            </button>
        </div>
    )
}
