'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'

interface FaviconEditorProps {
    currentFavicon?: string | null
    onFaviconChange: (faviconUrl: string) => void
}

export function FaviconEditor({ currentFavicon, onFaviconChange }: FaviconEditorProps) {
    const { t } = useI18n()
    const fe = t.editor.faviconEditor
    const fileInputRef = useRef<HTMLInputElement>(null)
    const previewUrlRef = useRef<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        }
    }, [])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate format — SVG excluded: no magic bytes → server rejects it
        const allowed = ['image/x-icon', 'image/png']
        if (!allowed.includes(file.type)) {
            toast.error(fe.invalidFormat)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        // Validate size ≤ 100KB
        if (file.size > 100 * 1024) {
            toast.error(fe.tooLarge)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('alt', fe.altFavicon)

            const uploaded = await uploadMediaAction(formData)
            const faviconUrl = uploaded?.url
            if (!faviconUrl) throw new Error('Upload succeeded but returned no URL')

            // Local preview
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
            const localPreview = URL.createObjectURL(file)
            previewUrlRef.current = localPreview
            setPreviewUrl(localPreview)

            onFaviconChange(faviconUrl as string)
            toast.success(fe.success)
        } catch (error) {
            console.error('Favicon upload error:', error)
            toast.error(fe.error)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleRemove = () => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
        }
        setPreviewUrl(null)
        onFaviconChange('')
    }

    const displayFavicon = previewUrl || currentFavicon

    return (
        <div className="space-y-2">
            <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                accept=".ico,.png"
                onChange={handleFileSelect}
            />

            {displayFavicon ? (
                <div className="relative rounded-[12px] border border-white/[0.08] bg-[var(--editor-bg)] p-3">
                    <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.03]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={displayFavicon} alt={fe.altFavicon} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="text-[11px] text-slate-300 hover:text-white"
                        >
                            {isUploading ? fe.uploading : fe.replace}
                        </button>
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={isUploading}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
                            title={fe.remove}
                        >
                            <Trash2 className="h-3 w-3" />
                            {fe.remove}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--editor-border)] bg-[var(--editor-bg)] px-0 py-[26px] text-center transition-colors hover:bg-[var(--editor-surface-elevated)] disabled:opacity-60"
                >
                    <div className="flex h-5 w-5 items-center justify-center">
                        {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        ) : (
                            <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
                        )}
                    </div>
                    <span className="text-xs font-medium leading-4 text-[var(--editor-text-muted)]">
                        {isUploading ? fe.uploading : fe.clickToUpload}
                    </span>
                </button>
            )}
        </div>
    )
}
