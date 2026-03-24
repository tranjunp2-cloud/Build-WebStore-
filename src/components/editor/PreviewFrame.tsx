'use client'

import React, { memo, useEffect, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { InlineEdit } from './InlineEdit'
import { useEditorStore } from '@/store/editorStore'

interface PreviewFrameProps {
    siteId: string
    pageId: string | null
    iframeKey: number
    isLoading: boolean
    viewport: 'desktop' | 'mobile'
}

type HoveredElementData = {
    rect: DOMRect | null
    text: string
    blockIndex: number
    blockType: string
}

function PreviewFrameInner({ siteId, pageId, iframeKey, isLoading, viewport }: PreviewFrameProps) {
    const { blocks, updateBlock } = useEditorStore()
    const [hoverData, setHoverData] = useState<HoveredElementData | null>(null)
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'BLOCK_HOVERED') {
                if (isEditing) return
                setHoverData(e.data)
            } else if (e.data?.type === 'BLOCK_MOUSEOUT') {
                if (!isEditing) setHoverData(null)
            } else if (e.data?.type === 'BLOCK_CLICKED') {
                if (hoverData) setIsEditing(true)
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [isEditing, hoverData])

    const handleSave = useCallback((newValue: string) => {
        if (!hoverData) return
        const { blockIndex, text } = hoverData
        const block = blocks[blockIndex]
        if (!block) return
        
        let foundField = ''
        for (const [key, val] of Object.entries(block)) {
            if (typeof val === 'string' && val.includes(text)) {
                foundField = key
                break
            }
        }
        
        let newBlock = { ...block }
        if (!foundField) {
            let updated = false
            for (const [key, val] of Object.entries(block)) {
                if (Array.isArray(val)) {
                    const newArr = val.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            let itemUpdated = false
                            const newItem = { ...item } as any
                            for (const [k, v] of Object.entries(item)) {
                                if (typeof v === 'string' && v.includes(text)) {
                                    newItem[k] = v.replace(text, newValue)
                                    itemUpdated = true
                                    updated = true
                                }
                            }
                            return itemUpdated ? newItem : item
                        }
                        return item
                    })
                    if (updated) {
                        newBlock[key] = newArr
                        break
                    }
                } else if (typeof val === 'object' && val !== null) {
                    // check nested objects like ctaButton
                    const newItem = { ...val } as any
                    let itemUpdated = false
                    for (const [k, v] of Object.entries(val)) {
                        if (typeof v === 'string' && v.includes(text)) {
                            newItem[k] = v.replace(text, newValue)
                            itemUpdated = true
                            updated = true
                        }
                    }
                    if (itemUpdated) {
                        newBlock[key] = newItem
                        break
                    }
                }
            }
            if (updated) {
                updateBlock(blockIndex, newBlock)
            }
        } else {
            updateBlock(blockIndex, { [foundField]: (block[foundField] as string).replace(text, newValue) })
        }

        setIsEditing(false)
        setHoverData(null)
    }, [hoverData, blocks, updateBlock])

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

    const previewUrl = new URL(`/api/preview/${siteId}`, 'http://localhost')
    previewUrl.searchParams.set('v', String(iframeKey))
    if (pageId) {
        previewUrl.searchParams.set('pageId', pageId)
    }

    return (
        <div className="relative flex-1 overflow-hidden bg-[#111827] p-6">
            <div className="flex h-full items-start justify-center overflow-auto rounded-[28px] border border-white/10 bg-[#0F172A] p-4">
                <div
                    className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-2xl transition-all"
                    style={{
                        width: viewport === 'mobile' ? 390 : '100%',
                        maxWidth: viewport === 'mobile' ? 390 : 1280,
                    }}
                >
                    <iframe
                        key={iframeKey}
                        src={previewUrl.pathname + previewUrl.search}
                        className="h-full w-full border-0"
                        title="Site Preview"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                    />
                </div>
            </div>

            {hoverData && hoverData.rect && (
                <div 
                    className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/10 rounded transition-all duration-200"
                    style={{
                        top: hoverData.rect.top - 4,
                        left: hoverData.rect.left - 4,
                        width: hoverData.rect.width + 8,
                        height: hoverData.rect.height + 8,
                        zIndex: 40
                    }}
                >
                    {!isEditing && (
                        <div className="absolute -top-7 right-0 bg-blue-600 hover:bg-blue-500 text-white text-[10px] uppercase font-bold px-2 py-1.5 rounded shadow-lg pointer-events-auto cursor-pointer flex items-center gap-1 transition-colors"
                             onClick={() => setIsEditing(true)}>
                            ✨ Edit with AI
                        </div>
                    )}
                    {isEditing && (
                        <div className="absolute top-0 left-0 pointer-events-auto bg-[#1E293B] border border-blue-500/50 rounded-lg shadow-2xl p-2 z-50 transform -translate-y-1/2" style={{ width: Math.max(hoverData.rect.width, 320), minWidth: 320 }}>
                            <div className="text-[10px] uppercase font-bold text-gray-400 mb-2 border-b border-white/10 pb-1 flex justify-between">
                                <span>Edit {hoverData.blockType}</span>
                                <span className="text-blue-400 cursor-pointer" onClick={() => setIsEditing(false)}>Close</span>
                            </div>
                            <InlineEdit 
                                value={hoverData.text} 
                                onSave={handleSave} 
                                blockType={hoverData.blockType}
                                multiline={hoverData.text.length > 50}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export const PreviewFrame = memo(PreviewFrameInner)
