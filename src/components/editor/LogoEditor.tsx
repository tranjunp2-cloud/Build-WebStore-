'use client'

import React, { useRef, useState, useEffect } from 'react'
import { ImagePlus, Loader2, Sparkles } from 'lucide-react'
import { processImageFile } from '@/lib/utils/image'
import { toast } from 'sonner'

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

            // 2. Upload logo
            const formData = new FormData()
            formData.append('file', processed)
            formData.append('_payload', JSON.stringify({ alt: 'Site Logo' }))

            const uploadRes = await fetch('/api/media', { method: 'POST', body: formData, credentials: 'include' })
            if (!uploadRes.ok) throw new Error('Logo upload failed')

            const uploadedLogo = await uploadRes.json()
            const logoUrl = uploadedLogo.doc.url as string

            // 3. Auto-generate favicon from the uploaded logo
            let faviconUrl: string | undefined

            const faviconBlob = await generateFavicon(logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl)
            if (faviconBlob) {
                const faviconForm = new FormData()
                faviconForm.append('file', new File([faviconBlob], 'favicon.png', { type: 'image/png' }))
                faviconForm.append('_payload', JSON.stringify({ alt: 'Favicon' }))

                const faviconRes = await fetch('/api/media', { method: 'POST', body: faviconForm, credentials: 'include' })
                if (faviconRes.ok) {
                    const faviconData = await faviconRes.json()
                    faviconUrl = faviconData.doc.url as string
                }
            }

            onLogoChange(logoUrl, faviconUrl)
            toast.success('Logo updated' + (faviconUrl ? ' & Favicon generated' : ''))
        } catch (error) {
            console.error('Logo upload error:', error)
            toast.error('Failed to update logo')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const displayLogo = previewUrl || currentLogo

    return (
        <div className="space-y-2">
            <label className="text-xs font-medium uppercase text-gray-500">Logo</label>

            <div className="flex items-center gap-3">
                {/* Logo preview */}
                <div className="w-16 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {displayLogo ? (
                        <img src={displayLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <span className="text-[10px] text-gray-600">No logo</span>
                    )}
                </div>

                {/* Upload button */}
                <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <ImagePlus className="w-3.5 h-3.5" />
                            Change Logo
                        </>
                    )}
                </button>
            </div>

            <p className="text-[10px] text-gray-600">
                Upload a logo image. Favicon will be auto-generated from your logo.
            </p>
        </div>
    )
}
