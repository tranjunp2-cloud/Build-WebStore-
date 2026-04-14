'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'

interface LogoEditorProps {
    currentLogo?: string | null
    onLogoChange: (logoUrl: string, faviconUrl?: string) => void
}

async function generateFavicon(imageUrl: string): Promise<Blob | null> {
    return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = imageUrl
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 32
            canvas.height = 32
            const ctx = canvas.getContext('2d')
            if (!ctx) return resolve(null)

            // Draw image centered/fitted into 32x32
            const ratio = Math.min(32 / img.width, 32 / img.height)
            const w = img.width * ratio
            const h = img.height * ratio
            const x = (32 - w) / 2
            const y = (32 - h) / 2

            ctx.drawImage(img, x, y, w, h)
            canvas.toBlob((blob) => resolve(blob), 'image/png')
        }
        img.onerror = () => resolve(null)
    })
}

export function LogoEditor({ currentLogo, onLogoChange }: LogoEditorProps) {
    const { t } = useI18n()
    const le = t.editor.logoEditor
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

        setIsUploading(true)

        try {
            // 1. Process & compress logo
            const processed = await processImageFile(file)
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
            const localPreview = URL.createObjectURL(processed)
            previewUrlRef.current = localPreview
            setPreviewUrl(localPreview)

            // 2. Upload logo via server action (same as product form)
            const formData = new FormData()
            formData.append('file', processed)
            formData.append('alt', 'Site Logo')

            const uploadedLogo = await uploadMediaAction(formData)
            const logoUrl = uploadedLogo.url as string

            // 3. Auto-generate favicon from the uploaded logo
            let faviconUrl: string | undefined

            const faviconBlob = await generateFavicon(logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl)
            if (faviconBlob) {
                const faviconForm = new FormData()
                faviconForm.append('file', new File([faviconBlob], 'favicon.png', { type: 'image/png' }))
                faviconForm.append('alt', 'Favicon')

                const faviconData = await uploadMediaAction(faviconForm)
                faviconUrl = faviconData.url as string
            }

            onLogoChange(logoUrl, faviconUrl)
            toast.success(le.success + (faviconUrl ? le.faviconGenerated : ''))
        } catch (error) {
            console.error('Logo upload error:', error)
            toast.error(le.error)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const displayLogo = previewUrl || currentLogo

    return (
        <div className="space-y-2">
            <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
            />

            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[rgba(59,130,246,0.07)] bg-[rgba(11,17,32,0.3)] px-0 py-[26px] text-center transition-colors hover:bg-[rgba(17,24,39,0.55)] disabled:opacity-60"
            >
                {displayLogo ? (
                    <div className="mb-1 flex h-16 w-full items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.03]">
                        <img src={displayLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                ) : (
                    <div className="flex h-5 w-5 items-center justify-center">
                        {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        ) : (
                            <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
                        )}
                    </div>
                )}

                <span className="text-xs font-medium leading-4 text-[#94A3B8]">
                    {isUploading ? le.uploading : le.clickToUpload}
                </span>
            </button>

        </div>
    )
}
