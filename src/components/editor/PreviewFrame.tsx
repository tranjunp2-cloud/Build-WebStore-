'use client'

import React, { memo } from 'react'
import { Loader2 } from 'lucide-react'

interface PreviewFrameProps {
    siteId: string
    iframeKey: number
    isLoading: boolean
}

/**
 * Memoized preview iframe. Only re-renders when:
 * - iframeKey changes (after save)
 * - isLoading changes
 * - siteId changes
 * 
 * Does NOT re-render when user types in settings panel or switches blocks.
 */
function PreviewFrameInner({ siteId, iframeKey, isLoading }: PreviewFrameProps) {
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
                key={iframeKey}
                src={`/api/preview/${siteId}?v=${iframeKey}`}
                className="h-full w-full border-0"
                title="Site Preview"
            />
        </div>
    )
}

export const PreviewFrame = memo(PreviewFrameInner)
