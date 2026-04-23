'use client'

import React, { useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { toast } from 'sonner'

interface OgImageEditorProps {
    currentOgImage?: string | null
    onOgImageChange: (url: string | null) => void
}

const ACCEPTED = 'image/jpeg,image/png,image/webp'

export function OgImageEditor({ currentOgImage, onOgImageChange }: OgImageEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            toast.error('Please upload a JPG, PNG, or WebP image.')
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }
        setIsUploading(true)
        try {
            const processed = await processImageFile(file)
            const formData = new FormData()
            formData.append('file', processed)
            formData.append('alt', 'Social share image')
            const uploaded = await uploadMediaAction(formData)
            if (!uploaded?.url) throw new Error('Upload returned no URL')
            onOgImageChange(uploaded.url as string)
            toast.success('Social image updated')
        } catch (err) {
            console.error('OG image upload failed', err)
            toast.error('Upload failed. Please try again.')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleRemove = () => onOgImageChange(null)

    return (
        <div className="space-y-2">
            <input ref={fileInputRef} type="file" className="hidden" accept={ACCEPTED} onChange={handleFileSelect} />
            {currentOgImage ? (
                <div className="relative rounded-[12px] border border-white/[0.08] bg-[rgba(11,17,32,0.3)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentOgImage} alt="Social preview" className="w-full aspect-[1200/630] object-cover" />
                    <div className="flex items-center justify-between gap-2 p-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="text-[11px] text-slate-300 hover:text-white"
                        >
                            Replace
                        </button>
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={isUploading}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
                        >
                            <X className="h-3 w-3" /> Remove
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[rgba(59,130,246,0.07)] bg-[rgba(11,17,32,0.3)] px-0 py-[26px] text-center hover:bg-[rgba(17,24,39,0.55)] disabled:opacity-60"
                >
                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.8} />}
                    <span className="text-xs font-medium text-[#94A3B8]">
                        {isUploading ? 'Uploading…' : 'Click to upload social image'}
                    </span>
                </button>
            )}
            <p className="text-[10px] text-slate-500">Recommended: 1200×630 PNG or JPG (used for social share previews)</p>
        </div>
    )
}
