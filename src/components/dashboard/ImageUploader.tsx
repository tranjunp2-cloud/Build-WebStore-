'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { UploadCloud, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type UploadedImage = {
    id: string
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

                const res = await fetch('/api/media', {
                    method: 'POST',
                    body: formData,
                })

                if (!res.ok) throw new Error('Failed to upload image')

                const data = await res.json()
                newImages.push({
                    id: data.doc.id,
                    url: data.doc.url,
                })
            } catch (err) {
                toast.error(`Failed to upload ${file.name}`)
            }
        }

        setIsUploading(false)
        onChange(newImages)
    }

    const removeImage = (idToRemove: string) => {
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
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-sm font-medium text-gray-300">{label}</h3>
                    <p className="text-xs text-gray-500 mt-1">{description}</p>
                </div>
                <span className="text-xs font-medium text-gray-400">
                    {value.length} / {maxImages}
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {value.map((img, idx) => (
                    <div key={img.id || idx} className="relative group aspect-square rounded-lg border border-white/10 overflow-hidden bg-[#0B1120]">
                        <Image src={img.url} alt={`Uploaded ${idx + 1}`} fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeImage(img.id)} className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {value.length < maxImages && (
                    <div
                        className={cn(
                            "relative aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-4 transition-colors text-center cursor-pointer",
                            dragActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/30 hover:bg-white/5",
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
                            <>
                                <UploadCloud className={cn("h-6 w-6 mb-2", dragActive ? "text-blue-500" : "text-gray-400")} />
                                <span className={cn("text-xs font-medium", dragActive ? "text-blue-400" : "text-gray-400")}>
                                    Upload or drag
                                </span>
                            </>
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
