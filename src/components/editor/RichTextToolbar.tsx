'use client'

import React from 'react'
import {
    Bold, Italic, Underline,
    AlignLeft, AlignCenter, AlignRight, AlignJustify
} from 'lucide-react'

interface RichTextToolbarProps {
    onCommand: (command: string, value?: string) => void
}

export function RichTextToolbar({ onCommand }: RichTextToolbarProps) {
    return (
        <div className="flex items-center gap-1 bg-white border border-gray-200 shadow-xl rounded-lg p-1.5 pointer-events-auto">
            <select 
                defaultValue="p" 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onCommand('formatBlock', e.target.value)}
                className="w-[110px] h-8 text-xs border-0 bg-transparent hover:bg-gray-100 focus:ring-0 cursor-pointer outline-none"
            >
                <option value="H1">Heading 1</option>
                <option value="H2">Heading 2</option>
                <option value="H3">Heading 3</option>
                <option value="H4">Heading 4</option>
                <option value="P">Paragraph</option>
            </select>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('bold') }}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('italic') }}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('underline') }}
                title="Underline"
            >
                <Underline className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('justifyLeft') }}
                title="Align Left"
            >
                <AlignLeft className="w-4 h-4" />
            </button>
            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('justifyCenter') }}
                title="Align Center"
            >
                <AlignCenter className="w-4 h-4" />
            </button>
            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('justifyRight') }}
                title="Align Right"
            >
                <AlignRight className="w-4 h-4" />
            </button>
            <button 
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                onClick={(e) => { e.preventDefault(); onCommand('justifyFull') }}
                title="Justify"
            >
                <AlignJustify className="w-4 h-4" />
            </button>
        </div>
    )
}
