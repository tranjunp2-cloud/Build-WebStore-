'use client'

import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { uploadMediaAction } from '@/app/(dashboard)/actions/media'
import { compressImage } from '@/lib/media/compress-image'

interface BlockImageEditorProps {
    imageUrl: string
    altText: string
    onImageChange: (id: number, url: string) => void
    onAltTextChange?: (alt: string) => void
    onRemove?: () => void
    onUploadingChange?: (isUploading: boolean) => void
}

export function BlockImageEditor({ imageUrl, altText, onImageChange, onAltTextChange, onRemove, onUploadingChange }: BlockImageEditorProps) {
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
        onUploadingChange?.(true)
        try {
            const compressed = await compressImage(file)
            const formData = new FormData()
            formData.append('file', compressed)
            formData.append('alt', altText || 'Block image')

            const uploaded = await uploadMediaAction(formData)
            onImageChange(uploaded.id, uploaded.url)
            toast.success('Image updated')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to upload image'
            toast.error(msg)
        } finally {
            setIsUploading(false)
            onUploadingChange?.(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    return (
        <div className="space-y-2">
            <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
            />

            {imageUrl ? (
                <div className="rounded-[12px] border border-white/[0.08] bg-white/5 p-2">
                    <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.03]">
                        <img src={imageUrl} alt={altText} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={isUploading}
                            className="text-[11px] text-slate-300 hover:text-white disabled:opacity-50"
                        >
                            {isUploading ? 'Uploading…' : 'Replace'}
                        </button>
                        {onRemove && (
                            <button
                                type="button"
                                onClick={onRemove}
                                disabled={isUploading}
                                className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 disabled:opacity-50"
                            >
                                <Trash2 className="h-3 w-3" />
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-white/20 bg-white/5 px-0 py-6 text-center transition-colors hover:bg-white/10 disabled:opacity-60"
                >
                    {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : (
                        <Upload className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
                    )}
                    <span className="text-xs font-medium text-slate-400">
                        {isUploading ? 'Uploading…' : 'Click to upload'}
                    </span>
                </button>
            )}

            {onAltTextChange && (
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
            )}
        </div>
    )
}
