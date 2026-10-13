'use client'

import React, { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BlockImageEditor } from './BlockImageEditor'
import type { PortfolioGridConfig, PortfolioProject } from '@/blocks/portfolio-grid/config'
import { useI18n } from '@/i18n'

type FieldBlurEvent = React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>

function stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, '')
}

function containsHtml(value: string): boolean {
    return /<[^>]*>/i.test(value)
}

/** Validate URL format — allow http/https and relative paths (/ or #), reject protocol-relative (//host) */
function isValidUrl(value: string): boolean {
    if (!value) return true
    if (value.startsWith('#')) return true
    if (value.startsWith('/') && !value.startsWith('//')) return true
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch { return false }
}

interface PortfolioGridSettingsProps {
    block: PortfolioGridConfig
    blockIndex: number
    onBlockUpdate: (idx: number, changes: Record<string, unknown>) => void
}

const MAX_PROJECTS = 24

const makeDefaultProject = (n: number): PortfolioProject => ({
    title: `Project ${n}`,
    description: '',
    category: '',
    linkUrl: '',
})

/** Safely extract URL from image field (may be number/MediaID when unpopulated from Payload) */
function getImageUrl(project: PortfolioProject): string {
    const img = project.image as unknown
    if (typeof img === 'object' && img !== null && 'url' in img) return String((img as { url: unknown }).url ?? '')
    return project.imageUrl ?? ''
}

function getImageAlt(project: PortfolioProject): string {
    const img = project.image as unknown
    if (typeof img === 'object' && img !== null && 'alt' in img) return String((img as { alt: unknown }).alt ?? '')
    return ''
}

export default function PortfolioGridSettings({ block, blockIndex, onBlockUpdate }: PortfolioGridSettingsProps) {
    const { t } = useI18n()
    const s = t.editor.settings
    const [isOpen, setIsOpen] = useState(true)
    const [removeVersion, setRemoveVersion] = useState(0)
    const [uploadingSlots, setUploadingSlots] = useState<Set<number>>(new Set())

    const projects = block.projects ?? []
    const count = projects.length

    const handleUploadingChange = (i: number, uploading: boolean) => {
        setUploadingSlots(prev => {
            const next = new Set(prev)
            uploading ? next.add(i) : next.delete(i)
            return next
        })
    }

    const handleAdd = () => {
        if (count >= MAX_PROJECTS) return
        onBlockUpdate(blockIndex, { projects: [...projects, makeDefaultProject(count + 1)] })
    }

    const handleRemoveAt = (i: number) => {
        if (count <= 1) return
        onBlockUpdate(blockIndex, { projects: projects.filter((_, idx) => idx !== i) })
        setRemoveVersion(v => v + 1)
    }

    const handleMoveUp = (i: number) => {
        if (i === 0 || uploadingSlots.size > 0) return
        const updated = [...projects]
        ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
        onBlockUpdate(blockIndex, { projects: updated })
    }

    const handleMoveDown = (i: number) => {
        if (i >= count - 1 || uploadingSlots.size > 0) return
        const updated = [...projects]
        ;[updated[i], updated[i + 1]] = [updated[i + 1], updated[i]]
        onBlockUpdate(blockIndex, { projects: updated })
    }

    const handleFieldBlur = (i: number, field: 'title' | 'category' | 'description', value: string, input: HTMLInputElement | HTMLTextAreaElement) => {
        const current = String(projects[i]?.[field] ?? '')
        // title is required in the Payload schema — revert instead of persisting empty
        if (field === 'title' && !value.trim()) {
            input.value = current
            return
        }
        if (current === value || stripHtml(current) === value) return
        const updated = projects.map((p, idx) => idx === i ? { ...p, [field]: value } : p)
        onBlockUpdate(blockIndex, { projects: updated })
    }

    const handleLinkBlur = (i: number, raw: string, input: HTMLInputElement) => {
        const value = raw.trim()
        const current = String(projects[i]?.linkUrl ?? '')
        if (containsHtml(value) || !isValidUrl(value)) {
            toast.error('Invalid URL: only http/https or site-relative paths allowed')
            input.value = current
            return
        }
        if (current === value) return
        const updated = projects.map((p, idx) => idx === i ? { ...p, linkUrl: value } : p)
        onBlockUpdate(blockIndex, { projects: updated })
    }

    const handleImageChange = (i: number, id: number, url: string) => {
        const updated = projects.map((p, idx) =>
            idx === i ? { ...p, image: { id, url, alt: getImageAlt(p) }, imageUrl: undefined } : p
        )
        onBlockUpdate(blockIndex, { projects: updated })
    }

    const handleAltChange = (i: number, alt: string) => {
        const updated = projects.map((p, idx) => {
            if (idx !== i) return p
            const img = p.image as unknown
            const base = typeof img === 'number' ? { id: img, url: '' } : (img ?? {})
            return { ...p, image: { ...base, url: getImageUrl(p), alt } }
        })
        onBlockUpdate(blockIndex, { projects: updated })
    }

    return (
        <div className="mb-3">
            <div className="bg-[var(--editor-surface-elevated)] border border-[var(--editor-border)] rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 h-12"
                >
                    <span className="text-sm font-medium text-white">{s.portfolioConfiguration}</span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                    <div className="px-3 pb-3">
                        <div className="space-y-3">
                            {projects.map((project, i) => (
                                // key includes title so uncontrolled inputs remount with fresh
                                // defaultValue after reorder/title edits (index-only keys go stale)
                                <div key={`${i}-${project.title}-${removeVersion}`} className="relative rounded-lg bg-white/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500">{s.projectLabel} {i + 1}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                aria-label={`Move project ${i + 1} up`}
                                                disabled={i === 0 || uploadingSlots.size > 0}
                                                onClick={() => handleMoveUp(i)}
                                                className="text-gray-400 hover:text-white disabled:opacity-30 px-1 text-sm leading-none"
                                            >↑</button>
                                            <button
                                                type="button"
                                                aria-label={`Move project ${i + 1} down`}
                                                disabled={i >= count - 1 || uploadingSlots.size > 0}
                                                onClick={() => handleMoveDown(i)}
                                                className="text-gray-400 hover:text-white disabled:opacity-30 px-1 text-sm leading-none"
                                            >↓</button>
                                            <button
                                                type="button"
                                                aria-label={`Remove project ${i + 1}`}
                                                disabled={count <= 1 || uploadingSlots.has(i)}
                                                onClick={() => handleRemoveAt(i)}
                                                className="text-red-400 hover:text-red-300 disabled:opacity-30"
                                            ><X className="h-4 w-4" aria-hidden /></button>
                                        </div>
                                    </div>
                                    <BlockImageEditor
                                        imageUrl={getImageUrl(project)}
                                        altText={getImageAlt(project)}
                                        onImageChange={(id, url) => handleImageChange(i, id, url)}
                                        onAltTextChange={(alt) => handleAltChange(i, alt)}
                                        onUploadingChange={(uploading) => handleUploadingChange(i, uploading)}
                                    />
                                    <Input
                                        defaultValue={stripHtml(project.title)}
                                        placeholder={s.projectTitlePlaceholder}
                                        variant="editor"
                                        className="mt-1.5"
                                        onBlur={(e: FieldBlurEvent) => handleFieldBlur(i, 'title', e.target.value, e.target)}
                                    />
                                    <Input
                                        defaultValue={stripHtml(project.category ?? '')}
                                        placeholder={s.projectCategoryPlaceholder}
                                        variant="editor"
                                        className="mt-1.5"
                                        onBlur={(e: FieldBlurEvent) => handleFieldBlur(i, 'category', e.target.value, e.target)}
                                    />
                                    <Textarea
                                        defaultValue={stripHtml(project.description ?? '')}
                                        placeholder={s.projectDescriptionPlaceholder}
                                        variant="editor"
                                        className="mt-1.5 min-h-[72px]"
                                        onBlur={(e: FieldBlurEvent) => handleFieldBlur(i, 'description', e.target.value, e.target)}
                                    />
                                    <Input
                                        defaultValue={project.linkUrl ?? ''}
                                        placeholder={s.projectLinkPlaceholder}
                                        variant="editor"
                                        className="mt-1.5"
                                        onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleLinkBlur(i, e.target.value, e.target)}
                                    />
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={count >= MAX_PROJECTS}
                            onClick={handleAdd}
                            className="mt-3 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30"
                        >
                            + {s.addProject} ({count}/{MAX_PROJECTS})
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
