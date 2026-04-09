'use client'

import React, { useRef } from 'react'
import { ImagePlus, Sparkles } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'

interface ImageToolbarProps {
    onImageSelect: (file: File, compressedUrl: string) => void
    onAiGenerate?: () => void
    isProcessing?: boolean
}

export function ImageToolbar({ onImageSelect, onAiGenerate, isProcessing }: ImageToolbarProps) {
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
        <div className="flex items-center gap-1 bg-[#1E293B] border border-white/10 shadow-2xl rounded-lg p-1.5 pointer-events-auto">
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
                Thay ảnh
            </button>

            <div className="w-px h-5 bg-white/10 mx-1" />

            <button 
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-400/10 rounded transition-colors disabled:opacity-50"
                onClick={onAiGenerate}
                disabled={isProcessing}
            >
                <Sparkles className="w-4 h-4" />
                Sinh ảnh AI
            </button>
        </div>
    )
}
