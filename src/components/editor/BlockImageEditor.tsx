'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { compressImage } from '@/lib/media/compress-image'

interface BlockImageEditorProps {
    imageUrl: string
    altText: string
    onImageChange: (url: string) => void
    onAltTextChange: (alt: string) => void
}

export function BlockImageEditor({ imageUrl, altText, onImageChange, onAltTextChange }: BlockImageEditorProps) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Only JPG, PNG, and WebP images are supported')
            return
        }

        setIsUploading(true)
        try {
            const compressed = await compressImage(file)
            const formData = new FormData()
            formData.append('file', compressed)
            formData.append('alt', altText || 'Block image')

            // Timeout after 30s to prevent frozen button on S3/network issues
            const uploaded = await Promise.race([
                uploadMediaAction(formData),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Upload timeout — check your connection')), 30000)
                ),
            ])
            onImageChange(uploaded.url)
            toast.success('Image updated')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to upload image'
            toast.error(msg)
        } finally {
            setIsUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    return (
        <div className="space-y-3">
            {/* Preview */}
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={altText}
                        className="h-32 w-full object-cover"
                    />
                ) : (
                    <div className="flex h-32 items-center justify-center text-slate-500">
                        <ImagePlus className="h-8 w-8" />
                    </div>
                )}
                {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Change
                </button>
                {/* AI image generation — hidden until feature is implemented */}
            </div>

            <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Alt text */}
            <div>
                <label className="text-[11px] font-medium text-slate-400">Alt text (SEO)</label>
                <input
                    type="text"
                    defaultValue={altText}
                    onBlur={(e) => onAltTextChange(e.target.value)}
                    placeholder="Describe this image..."
                    className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                />
            </div>
        </div>
    )
}
