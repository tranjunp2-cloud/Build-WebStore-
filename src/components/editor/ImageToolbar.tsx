'use client'

import React, { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'
import { useI18n } from '@/i18n'

interface ImageToolbarProps {
    onImageSelect: (file: File, compressedUrl: string) => void
    isProcessing?: boolean
}

export function ImageToolbar({ onImageSelect, isProcessing }: ImageToolbarProps) {
    const { t } = useI18n()
    const it = t.editor.imageToolbar
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const processedFile = await processImageFile(file)
            const objectUrl = URL.createObjectURL(processedFile)
            onImageSelect(processedFile, objectUrl)
        } catch (error) {
            console.error('Failed to process image:', error)
        }
        
        // Reset input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="flex items-center gap-1 bg-[var(--editor-surface-elevated)] border border-white/10 shadow-2xl rounded-lg p-1.5 pointer-events-auto">
            <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
            />
            
            <button 
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
            >
                <ImagePlus className="w-4 h-4" />
                {it.changeImage}
            </button>

        </div>
    )
}
