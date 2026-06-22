'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Upload, ImageIcon, Search, Trash2, Copy, Check, RefreshCw, Film, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

type MediaDoc = {
    id: string
    filename: string
    alt: string
    caption?: string
    mimeType: string
    filesize: number
    url: string
    sizes?: {
        thumbnail?: { url: string }
        card?: { url: string }
    }
    createdAt: string
    aiGenerated?: boolean
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function MediaIcon({ mimeType }: { mimeType: string }) {
    if (mimeType.startsWith('video/')) return <Film className="h-8 w-8 text-[hsl(var(--info))]" />
    if (mimeType === 'application/pdf') return <FileText className="h-8 w-8 text-[hsl(var(--destructive))]" />
    return <ImageIcon className="h-8 w-8 text-gray-600" />
}

export default function MediaLibraryPage() {
    const { t, ti } = useI18n()
    const ml = t.mediaLibrary
    const [media, setMedia] = useState<MediaDoc[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'pdf'>('all')
    const [isUploading, setIsUploading] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [selectedMedia, setSelectedMedia] = useState<MediaDoc | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        loadMedia()
    }, [])

    const loadMedia = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/media?sort=-createdAt&limit=200', { credentials: 'include' })
            if (!res.ok) throw new Error(`Server returned ${res.status}`)
            const data = await res.json()
            setMedia(data.docs || [])
        } catch {
            toast.error(ml.loadFailed)
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setIsUploading(true)

        let successCount = 0
        for (const file of Array.from(files)) {
            try {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('_payload', JSON.stringify({ alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') }))

                const res = await fetch('/api/media', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                })

                if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
                const doc = await res.json()
                setMedia(prev => [doc.doc || doc, ...prev])
                successCount++
            } catch {
                toast.error(ti(ml.uploadFailed, { name: file.name }))
            }
        }

        if (successCount > 0) {
            toast.success(ti(ml.uploadedCount, { count: successCount }))
        }
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/media/${id}`, { method: 'DELETE', credentials: 'include' })
            if (!res.ok) throw new Error('Delete failed')
            setMedia(prev => prev.filter(m => m.id !== id))
            setSelectedMedia(null)
            toast.success(ml.fileDeleted)
        } catch {
            toast.error(ml.deleteFailed)
        }
    }

    const copyUrl = (url: string, id: string) => {
        navigator.clipboard.writeText(window.location.origin + url)
        setCopiedId(id)
        toast.success(ml.urlCopied)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const filtered = media.filter(m => {
        if (searchQuery && !m.filename.toLowerCase().includes(searchQuery.toLowerCase()) && !m.alt.toLowerCase().includes(searchQuery.toLowerCase())) return false
        if (filterType === 'image' && !m.mimeType.startsWith('image/')) return false
        if (filterType === 'video' && !m.mimeType.startsWith('video/')) return false
        if (filterType === 'pdf' && m.mimeType !== 'application/pdf') return false
        return true
    })

    const totalSize = media.reduce((acc, m) => acc + (m.filesize || 0), 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{ml.title}</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        {media.length} file{media.length !== 1 ? 's' : ''} &middot; {formatFileSize(totalSize)} total
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadMedia()}
                        aria-label="Refresh"
                        className="rounded-lg bg-white/5 p-2 text-gray-400 hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 rounded-lg bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-4 py-2 text-sm font-medium !text-white hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary)/0.25)] disabled:opacity-50"
                    >
                        <Upload className="h-4 w-4" />
                        {isUploading ? ml.uploading : ml.upload}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,application/pdf"
                        onChange={e => handleUpload(e.target.files)}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={ml.searchPlaceholder}
                        className="w-full rounded-lg [border:1px_solid_hsl(var(--input-border))] bg-secondary pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:[border-color:hsl(var(--primary))]"
                    />
                </div>
                <div className="flex gap-1 rounded-lg border border-border bg-secondary p-0.5">
                    {(() => {
                        const filterLabels: Record<string, string> = { all: ml.filterAll, image: ml.filterImages, video: ml.filterVideos, pdf: ml.filterPdf }
                        return (['all', 'image', 'video', 'pdf'] as const).map(filterKey => (
                            <button
                                key={filterKey}
                                onClick={() => setFilterType(filterKey)}
                                className={cn(
                                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                                    filterType === filterKey ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]' : 'text-gray-500 hover:text-gray-300',
                                )}
                            >
                                {filterLabels[filterKey]}
                            </button>
                        ))
                    })()}
                </div>
            </div>

            {/* Loading */}
            {isLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="animate-pulse rounded-xl border border-border bg-secondary/30">
                            <div className="aspect-square bg-white/5 rounded-t-xl" />
                            <div className="p-3 space-y-2">
                                <div className="h-3 w-3/4 rounded bg-white/5" />
                                <div className="h-2 w-1/2 rounded bg-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : media.length === 0 ? (
                /* Empty state */
                <div className="flex h-[50vh] items-center justify-center">
                    <div className="text-center">
                        <ImageIcon className="mx-auto h-12 w-12 text-gray-600" />
                        <h2 className="mt-4 text-lg font-semibold text-white">{ml.emptyTitle}</h2>
                        <p className="mt-1 text-sm text-gray-500">{ml.emptyDescription}</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-5 py-2.5 text-sm font-medium !text-white hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary)/0.25)]"
                        >
                            <Upload className="h-4 w-4" /> {ml.uploadFiles}
                        </button>
                    </div>
                </div>
            ) : (
                /* Media Grid */
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {filtered.map(item => {
                        const thumbUrl = item.sizes?.thumbnail?.url || item.url
                        const isImage = item.mimeType.startsWith('image/')

                        return (
                            <button
                                key={item.id}
                                onClick={() => setSelectedMedia(item)}
                                className="group text-left rounded-xl border border-border bg-secondary/30 overflow-hidden hover:border-[hsl(var(--primary)/0.4)] transition-all"
                            >
                                <div className="relative aspect-square bg-white/5 overflow-hidden">
                                    {isImage ? (
                                        <Image
                                            src={thumbUrl}
                                            alt={item.alt}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <MediaIcon mimeType={item.mimeType} />
                                        </div>
                                    )}
                                    {item.aiGenerated && (
                                        <span className="absolute top-2 left-2 rounded-md bg-[hsl(var(--info))]/80 px-1.5 py-0.5 text-[9px] font-medium text-white">AI</span>
                                    )}
                                </div>
                                <div className="p-3">
                                    <p className="truncate text-xs font-medium text-gray-300">{item.filename}</p>
                                    <p className="text-[10px] text-gray-600">{formatFileSize(item.filesize)}</p>
                                </div>
                            </button>
                        )
                    })}

                    {filtered.length === 0 && (
                        <div className="col-span-full py-12 text-center text-sm text-gray-500">
                            {ml.noMatch}
                        </div>
                    )}
                </div>
            )}

            {/* Detail Panel / Modal */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedMedia(null)} />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
                        {/* Close */}
                        <button
                            onClick={() => setSelectedMedia(null)}
                            className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors z-10"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Preview */}
                        <div className="relative aspect-video bg-white/5 rounded-t-2xl overflow-hidden">
                            {selectedMedia.mimeType.startsWith('image/') ? (
                                <Image
                                    src={selectedMedia.sizes?.card?.url || selectedMedia.url}
                                    alt={selectedMedia.alt}
                                    fill
                                    className="object-contain"
                                    sizes="512px"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <MediaIcon mimeType={selectedMedia.mimeType} />
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="font-medium text-white">{selectedMedia.filename}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {formatFileSize(selectedMedia.filesize)} &middot; {selectedMedia.mimeType} &middot; {new Date(selectedMedia.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            {selectedMedia.alt && (
                                <div>
                                    <p className="text-[10px] uppercase text-gray-600 mb-1">{ml.altText}</p>
                                    <p className="text-sm text-gray-300">{selectedMedia.alt}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={() => copyUrl(selectedMedia.url, selectedMedia.id)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2.5 text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors"
                                >
                                    {copiedId === selectedMedia.id ? <Check className="h-3 w-3 text-[hsl(var(--success))]" /> : <Copy className="h-3 w-3" />}
                                    {copiedId === selectedMedia.id ? ml.copied : ml.copyUrl}
                                </button>
                                <button
                                    onClick={() => handleDelete(selectedMedia.id)}
                                    className="flex items-center justify-center gap-1.5 rounded-lg bg-[hsl(var(--destructive)/0.1)] px-3 py-2.5 text-xs font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.2)] transition-colors"
                                >
                                    <Trash2 className="h-3 w-3" /> {ml.delete}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Drop zone overlay (drag & drop) */}
        </div>
    )
}
