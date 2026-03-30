'use client'

import React, { memo } from 'react'
import { Loader2 } from 'lucide-react'
import { buildFullHTML } from '@/lib/htmlBuilder'
import { detectCategory } from '@/lib/preview'

interface PreviewFrameProps {
    siteName: string
    blocks: any[]
    theme?: any
    isLoading: boolean
}

/**
 * Memoized preview iframe. 
 * Re-renders whenever blocks, theme or siteName change, 
 * providing instant true live-preview for Undo/Redo & user edits without backend saving.
 */
function PreviewFrameInner({ siteName, blocks, theme, isLoading }: PreviewFrameProps) {
    const html = React.useMemo(() => {
        // Skip computing if loading to save CPU
        if (isLoading) return ''
        const cat = detectCategory(blocks, siteName || '')
        return buildFullHTML(blocks, theme, cat, { name: siteName })
    }, [blocks, theme, siteName, isLoading])

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0F172A]">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
                    <p className="mt-3 text-sm text-gray-400">Loading site...</p>
                </div>
            </div>
        )
    }


    return (
        <div className="flex-1 bg-white">
            <iframe
                srcDoc={html}
                className="h-full w-full border-0 transition-opacity duration-300"
                title="Site Preview"
            />
        </div>
    )
}

export const PreviewFrame = memo(PreviewFrameInner)
