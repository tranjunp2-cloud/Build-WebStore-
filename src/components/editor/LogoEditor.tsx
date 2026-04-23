'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'

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
    const [showRemoveDialog, setShowRemoveDialog] = useState(false)

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
            formData.append('alt', le.altSiteLogo)

            const uploadedLogo = await uploadMediaAction(formData)
            const logoUrl = uploadedLogo.url as string

            // 3. Auto-generate favicon from the uploaded logo
            let faviconUrl: string | undefined

            const faviconBlob = await generateFavicon(logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl)
            if (faviconBlob) {
                const faviconForm = new FormData()
                faviconForm.append('file', new File([faviconBlob], 'favicon.png', { type: 'image/png' }))
                faviconForm.append('alt', le.altFavicon)

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

    const confirmRemove = () => {
        setShowRemoveDialog(false)
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
        }
        setPreviewUrl(null)
        onLogoChange('')
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

            {displayLogo ? (
                <div className="relative rounded-[12px] border border-white/[0.08] bg-[rgba(11,17,32,0.3)] p-3">
                    <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.03]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={displayLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="text-[11px] text-slate-300 hover:text-white"
                        >
                            {isUploading ? le.uploading : le.replace}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowRemoveDialog(true)}
                            disabled={isUploading}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
                            title={le.remove}
                        >
                            <Trash2 className="h-3 w-3" />
                            {le.remove}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-[rgba(59,130,246,0.07)] bg-[rgba(11,17,32,0.3)] px-0 py-[26px] text-center transition-colors hover:bg-[rgba(17,24,39,0.55)] disabled:opacity-60"
                >
                    <div className="flex h-5 w-5 items-center justify-center">
                        {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        ) : (
                            <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
                        )}
                    </div>
                    <span className="text-xs font-medium leading-4 text-[#94A3B8]">
                        {isUploading ? le.uploading : le.clickToUpload}
                    </span>
                </button>
            )}
            <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
                <DialogContent className="max-w-sm border-white/[0.08] bg-[#0F172A] text-white">
                    <DialogHeader>
                        <DialogTitle className="text-white">{le.remove} Logo</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            {le.confirmRemove}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setShowRemoveDialog(false)}
                            className="flex-1 rounded-[10px] border border-white/[0.08] py-2 text-[13px] font-medium text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={confirmRemove}
                            className="flex-1 rounded-[10px] bg-rose-500/20 py-2 text-[13px] font-medium text-rose-400 hover:bg-rose-500/30 transition-colors"
                        >
                            {le.remove}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
