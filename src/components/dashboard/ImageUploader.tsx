'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type UploadedImage = {
    id: string | number
    url: string
}

interface ImageUploaderProps {
    value: UploadedImage[]
    onChange: (images: UploadedImage[]) => void
    maxImages?: number
    maxSizeMB?: number
    className?: string
    label?: string
    description?: string
}

export function ImageUploader({
    value,
    onChange,
    maxImages = 5,
    maxSizeMB = 5,
    className,
    label = 'Product Images',
    description = `Upload up to 5 images (Max ${maxSizeMB}MB each. JPG, PNG, WEBP)`
}: ImageUploaderProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
                formData.append('_payload', JSON.stringify({ alt: file.name }))

                const res = await fetch('/api/media', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                })

                if (!res.ok) throw new Error('Failed to upload image')

                const data = await res.json()
                const uploadedDoc = data?.doc || data

                if (!uploadedDoc?.id || !uploadedDoc?.url) {
                    throw new Error('Invalid response format from server')
                }

                // Convert absolute URL to relative path to avoid Next.js unconfigured host errors
                let relativeUrl = String(uploadedDoc.url)
                try {
                    const parsedUrl = new URL(relativeUrl)
                    relativeUrl = parsedUrl.pathname + parsedUrl.search
                } catch (e) {
                    // if it's not a valid absolute URL, it's already relative
                }

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

            <div className="flex flex-wrap gap-4 mt-2">
                {value.map((img, idx) => {
                    const safeUrl = (() => {
                        try {
                            return new URL(img.url, 'http://localhost').pathname
                        } catch {
                            return img.url
                        }
                    })()
                    
                    return (
                    <div key={img.id || idx} className="relative w-[147px] h-[147px] shrink-0">
                        <div className="w-full h-full p-[2px] rounded-[16px] border border-white/10 bg-[#0B1120]">
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
                )})}

                {value.length < maxImages && (
                    <div
                        className={cn(
                            "relative w-[147px] h-[147px] shrink-0 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-colors text-center cursor-pointer bg-[#0B1120]",
                            dragActive ? "border-blue-500 bg-blue-500/10" : "border-white/[0.08] hover:border-white/20 hover:bg-white/5",
                            isUploading && "pointer-events-none opacity-50"
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {isUploading ? (
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                                <Upload className={cn("w-6 h-6", dragActive ? "text-blue-500" : "text-[#F8FAFC]/40")} />
                                <span className={cn("text-[12px] font-medium leading-[1.33]", dragActive ? "text-blue-400" : "text-[#F8FAFC]/40")}>
                                    Upload
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
