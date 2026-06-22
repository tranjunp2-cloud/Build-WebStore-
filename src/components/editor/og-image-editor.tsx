'use client'

import React, { useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

interface OgImageEditorProps {
    currentOgImage?: string | null
    onOgImageChange: (mediaId: number | null, url: string | null) => void
}

const ACCEPTED = 'image/jpeg,image/png,image/webp'

export function OgImageEditor({ currentOgImage, onOgImageChange }: OgImageEditorProps) {
    const { t } = useI18n()
    const oi = t.editor.ogImageEditor
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            toast.error(oi.invalidFormat)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }
        setIsUploading(true)
        try {
            const processed = await processImageFile(file)
            const formData = new FormData()
            formData.append('file', processed)
            formData.append('alt', oi.alt)
            const uploaded = await uploadMediaAction(formData)
            if (!uploaded?.url) throw new Error('Upload returned no URL')
            if (!uploaded?.id) throw new Error('Upload returned no media ID')
            onOgImageChange(uploaded.id as number, uploaded.url as string)
            toast.success(oi.success)
        } catch (err) {
            console.error('OG image upload failed', err)
            toast.error(oi.error)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleRemove = () => onOgImageChange(null, null)

    return (
        <div className="space-y-2">
            <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPTED} onChange={handleFileSelect} />
            {currentOgImage ? (
                <div className="relative rounded-[12px] border border-white/[0.08] bg-[var(--editor-bg)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentOgImage} alt="Social preview" className="w-full aspect-[1200/630] object-cover" />
                    <div className="flex items-center justify-between gap-2 p-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="text-[11px] text-slate-300 hover:text-white"
                        >
                            {oi.replace}
                        </button>
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={isUploading}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
                        >
                            <X className="h-3 w-3" /> {oi.remove}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--editor-border)] bg-[var(--editor-bg)] px-0 py-[26px] text-center hover:bg-[var(--editor-surface-elevated)] disabled:opacity-60"
                >
                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.8} />}
                    <span className="text-xs font-medium text-[var(--editor-text-muted)]">
                        {isUploading ? oi.uploading : oi.clickToUpload}
                    </span>
                </button>
            )}
            <p className="text-[10px] text-slate-500">{oi.hint}</p>
        </div>
    )
}
