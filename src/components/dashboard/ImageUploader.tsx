'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2, AlertCircle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useUploadProgress } from '@/hooks/use-upload-progress'
import { useI18n } from '@/i18n'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'

// Alt-text Popover editor: auto-grows from MIN to MAX, then scrolls internally.
// Same pattern as src/components/editor/AIChatPanel.tsx's chat input auto-resize.
const MIN_ALT_TEXTAREA_HEIGHT = 64
const MAX_ALT_TEXTAREA_HEIGHT = 200
const MAX_ALT_LENGTH = 125

export type UploadedImage = {
    id: string | number
    url: string
    alt?: string
}

interface ImageUploaderProps {
    value: UploadedImage[]
    onChange: (images: UploadedImage[]) => void
    maxImages?: number
    maxSizeMB?: number
    className?: string
    label?: string
    description?: string
    variant?: 'square' | 'wide'
    placeholderText?: string
    showAltInput?: boolean
}

export function ImageUploader({
    value,
    onChange,
    maxImages = 5,
    maxSizeMB = 5,
    className,
    label = 'Product Images',
    description = `Upload up to 5 images (Max ${maxSizeMB}MB each. JPG, PNG, WEBP)`,
    variant = 'square',
    placeholderText = 'Upload',
    showAltInput = false,
}: ImageUploaderProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { upload, progress, isUploading: fileUploading } = useUploadProgress()
    const { t } = useI18n()

    // Alt-text Popover: draft-until-Save editing. `openAltId` controls which image's Popover is
    // open; `draftAlt` is the in-flight (uncommitted) text. Only Save writes back via handleAltChange.
    const [openAltId, setOpenAltId] = useState<string | number | null>(null)
    const [draftAlt, setDraftAlt] = useState('')
    const altTextareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea to fit content: grows from MIN to MAX_ALT_TEXTAREA_HEIGHT, then scrolls
    // internally. Same pattern as src/components/editor/AIChatPanel.tsx's chat input auto-resize.
    useEffect(() => {
        if (openAltId === null) return
        const el = altTextareaRef.current
        if (!el) return
        el.style.height = 'auto'
        const next = Math.min(el.scrollHeight, MAX_ALT_TEXTAREA_HEIGHT)
        el.style.height = `${next}px`
        el.style.overflowY = el.scrollHeight > MAX_ALT_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
    }, [draftAlt, openAltId])

    const handleUpload = async (files: FileList | File[]) => {
        if (value.length + files.length > maxImages) {
            toast.error(`You can only upload up to ${maxImages} images in total.`)
            return
        }

        const validFiles = Array.from(files).filter(file => {
            if (file.size > maxSizeMB * 1024 * 1024) {
                toast.error(`File ${file.name} is too large. Max ${maxSizeMB}MB.`)
                return false
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                toast.error(`File ${file.name} has invalid format. Use JPG, PNG, or WEBP.`)
                return false
            }
            return true
        })

        if (validFiles.length === 0) return

        setIsUploading(true)
        const newImages = [...value]

        for (const file of validFiles) {
            try {
                const formData = new FormData()
                formData.append('file', file)

                const data = await upload(formData)
                const uploadedDoc = data

                if (!uploadedDoc?.id || !uploadedDoc?.url) {
                    throw new Error('Invalid response format from server')
                }

                // Keep the absolute URL as returned from the backend (MinIO or Local)
                let relativeUrl = String(uploadedDoc.url)

                newImages.push({
                    id: uploadedDoc.id,
                    url: relativeUrl,
                })
            } catch (err) {
                toast.error(`Failed to upload ${file.name}`)
            }
        }

        setIsUploading(false)
        onChange(newImages)
    }

    const removeImage = (idToRemove: string | number) => {
        onChange(value.filter(img => img.id !== idToRemove))
        // Guard against a dangling open Popover state if the image being edited is removed.
        if (openAltId === idToRemove) setOpenAltId(null)
    }

    const handleAltChange = (id: string | number, newAlt: string) => {
        onChange(value.map(img => img.id === id ? { ...img, alt: newAlt } : img))
    }

    const openAltPopover = (img: UploadedImage) => {
        setDraftAlt(img.alt || '')
        setOpenAltId(img.id)
    }

    const saveAlt = (id: string | number) => {
        // Clamp on save, not just via the Textarea's maxLength attribute — pre-existing alt text
        // longer than the cap (legacy data, imports) opens uncut for display, but Save must still
        // enforce the cap; maxLength only blocks new keystrokes, not an untouched draft.
        handleAltChange(id, draftAlt.trim().slice(0, MAX_ALT_LENGTH))
        setOpenAltId(null)
    }

    const handleAltTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string | number) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            saveAlt(id)
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUpload(e.dataTransfer.files)
        }
    }

    return (
        <div className={cn('space-y-4', className)}>
            <div className="hidden">
                <div>
                    <h3 className="text-sm font-medium text-gray-300">{label}</h3>
                    <p className="text-xs text-gray-500 mt-1">{description}</p>
                </div>
                <span className="text-xs font-medium text-gray-400">
                    {value.length} / {maxImages}
                </span>
            </div>

            <div className={cn("flex flex-wrap gap-4 mt-2", variant === 'wide' && value.length === 0 ? "" : "")}>
                {value.map((img, idx) => {
                    const safeUrl = (() => {
                        let url = img.url || ''
                        if (!url) return ''
                        if (url.includes('/api/media/file/')) {
                            if (process.env.NEXT_PUBLIC_S3_ENDPOINT) {
                                const filename = url.split('/').pop()
                                url = `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/primeweb-media/${filename}`
                            }
                        }
                        return url
                    })()
                    
                    return (
                    <div key={img.id || idx} className="flex flex-col shrink-0 w-[147px]">
                        <div className="relative w-[147px] h-[147px]">
                            <div className="w-full h-full p-[2px] rounded-[16px] border border-solid border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                                <div className="w-full h-full relative overflow-hidden rounded-[14px]">
                                    <Image src={safeUrl} alt={`Uploaded ${idx + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeImage(img.id)}
                                className="absolute z-10 top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FB2C36] text-white border-0 outline-none ring-0 shadow-none transition-transform hover:scale-110"
                            >
                                <X className="h-[10px] w-[10px]" strokeWidth={2.5} />
                            </button>
                        </div>
                        {showAltInput && (
                            <Popover
                                open={openAltId === img.id}
                                onOpenChange={(open) => { if (open) openAltPopover(img); else setOpenAltId(null) }}
                            >
                                <PopoverTrigger asChild>
                                    {img.alt?.trim() ? (
                                        <button
                                            type="button"
                                            title={img.alt}
                                            aria-label={t.dashboard.imageUploader?.editAltText || 'Edit Alt text'}
                                            className="mt-1 flex w-full items-center gap-1 rounded-[6px] px-0.5 py-[3px] text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                                        >
                                            <span className="min-w-0 flex-1 truncate">{img.alt}</span>
                                            <Pencil className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="mt-1 w-full rounded-[6px] px-0.5 py-[3px] text-left text-[11px] font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--muted))]"
                                        >
                                            {t.dashboard.imageUploader?.addAltText || '+ Add Alt text'}
                                        </button>
                                    )}
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-[260px] p-3">
                                    <p className="mb-2 text-[12px] font-semibold text-[hsl(var(--foreground))]">
                                        {t.dashboard.imageUploader?.label || 'Alt text'}
                                    </p>
                                    <div className="relative">
                                        <Textarea
                                            ref={altTextareaRef}
                                            value={draftAlt}
                                            onChange={(e) => setDraftAlt(e.target.value)}
                                            onKeyDown={(e) => handleAltTextareaKeyDown(e, img.id)}
                                            maxLength={MAX_ALT_LENGTH}
                                            placeholder={t.dashboard.imageUploader?.placeholder || 'Briefly describe this image…'}
                                            className={cn('w-full resize-none pb-5 text-[13px]')}
                                            style={{ minHeight: MIN_ALT_TEXTAREA_HEIGHT, maxHeight: MAX_ALT_TEXTAREA_HEIGHT }}
                                            rows={1}
                                            autoFocus
                                        />
                                        <span className={cn(
                                            'pointer-events-none absolute bottom-1.5 right-2 text-[10px]',
                                            draftAlt.length >= MAX_ALT_LENGTH ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'
                                        )}>
                                            {draftAlt.length}/{MAX_ALT_LENGTH}
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
                                        {t.dashboard.imageUploader?.helperText || 'Briefly describe the image to improve your SEO score on Google.'}
                                    </p>
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setOpenAltId(null)}
                                            className="rounded-[7px] border border-[hsl(var(--input-border))] px-3 py-1.5 text-[12px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
                                        >
                                            {t.dashboard.imageUploader?.cancel || 'Cancel'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => saveAlt(img.id)}
                                            className="rounded-[7px] bg-[hsl(var(--primary))] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                                        >
                                            {t.dashboard.imageUploader?.save || 'Save'}
                                        </button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                )})}

                {value.length < maxImages && (
                    <div
                        className={cn(
                            "group relative shrink-0 flex flex-col items-center justify-center p-4 transition-colors text-center cursor-pointer bg-[hsl(var(--card))]",
                            variant === 'square'
                                ? "w-[147px] h-[147px] rounded-2xl border-2 border-dashed"
                                : "w-full h-[92px] rounded-[12px] border border-solid gap-[6px]",
                            dragActive ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]",
                            isUploading && "pointer-events-none opacity-50"
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2 w-full px-2">
                                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                {fileUploading && (
                                    <div className="w-full h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-blue-500 transition-all duration-150"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={cn("flex items-center justify-center", variant === 'square' ? "flex-col gap-2" : "flex-col gap-[6px]")}>
                                <Upload className={cn("w-6 h-6 transition-colors", dragActive ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))]")} />
                                <span className={cn("font-medium transition-colors",
                                    variant === 'square' ? "text-[12px] leading-[1.33]" : "text-[12px] leading-[1.21]",
                                    dragActive ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]",
                                    !dragActive && "group-hover:text-[hsl(var(--primary))]")}>
                                    {placeholderText}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) handleUpload(e.target.files)
                    e.target.value = ''
                }}
            />
        </div>
    )
}
