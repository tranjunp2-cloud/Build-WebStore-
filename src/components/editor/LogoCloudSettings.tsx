'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BlockImageEditor } from './BlockImageEditor'
import type { LogoCloudConfig, LogoItem } from '@/blocks/logo-cloud/config'

type FieldBlurEvent = React.FocusEvent<HTMLInputElement>

interface LogoCloudSettingsProps {
    block: LogoCloudConfig
    blockIndex: number
    onBlockUpdate: (idx: number, changes: Record<string, unknown>) => void
}

const makeDefaultLogo = (n: number): LogoItem => ({ name: `Partner ${n}`, logo: { url: '', alt: '' } })

/** Per-variant max: Row 6, Grid 8 (per issue #1191 spec) */
function maxForVariant(variant: string | undefined): number {
    return variant === 'grid' ? 8 : 6
}

/** Safely extract URL from logo field (may be number/MediaID when unpopulated from Payload) */
function getLogoUrl(item: LogoItem): string {
    const l = item.logo as unknown
    if (typeof l === 'object' && l !== null && 'url' in l) return String((l as { url: unknown }).url ?? '')
    return ''
}

/** Safely extract alt text, falling back to company name */
function getLogoAlt(item: LogoItem): string {
    const l = item.logo as unknown
    if (typeof l === 'object' && l !== null && 'alt' in l) return String((l as { alt: unknown }).alt ?? '')
    return item.name
}

/** Safely extract logo as plain object for spread (handles number MediaID edge case) */
function getLogoObj(item: LogoItem): Record<string, unknown> {
    const l = item.logo as unknown
    if (typeof l === 'object' && l !== null) return l as Record<string, unknown>
    return { url: '', alt: item.name }
}

export default function LogoCloudSettings({ block, blockIndex, onBlockUpdate }: LogoCloudSettingsProps) {
    const [removeVersion, setRemoveVersion] = useState(0)

    const logos = block.logos ?? []
    const count = logos.length
    const maxCount = maxForVariant(block.variant)

    const handleAdd = () => {
        if (count >= maxCount) return
        onBlockUpdate(blockIndex, { logos: [...logos, makeDefaultLogo(count + 1)] })
    }

    const handleRemoveAt = (i: number) => {
        if (count <= 1) return
        onBlockUpdate(blockIndex, { logos: logos.filter((_, idx) => idx !== i) })
        setRemoveVersion(v => v + 1)
    }

    const handleMoveUp = (i: number) => {
        if (i === 0) return
        const updated = [...logos]
        ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
        onBlockUpdate(blockIndex, { logos: updated })
    }

    const handleMoveDown = (i: number) => {
        if (i >= count - 1) return
        const updated = [...logos]
        ;[updated[i], updated[i + 1]] = [updated[i + 1], updated[i]]
        onBlockUpdate(blockIndex, { logos: updated })
    }

    const handleNameBlur = (i: number, value: string) => {
        if (logos[i]?.name === value) return
        const updated = logos.map((l, idx) => idx === i ? { ...l, name: value } : l)
        onBlockUpdate(blockIndex, { logos: updated })
    }

    const handleImageChange = (i: number, id: number, url: string) => {
        const updated = logos.map((l, idx) =>
            idx === i ? { ...l, logo: { id, url, alt: getLogoAlt(l) } } : l
        )
        onBlockUpdate(blockIndex, { logos: updated })
    }

    const handleAltChange = (i: number, alt: string) => {
        const updated = logos.map((l, idx) => {
            if (idx !== i) return l
            const logoVal = l.logo as unknown
            // Skip non-object logo values (numeric Payload Media ID, null, etc.) — don't corrupt the relation
            if (typeof logoVal !== 'object' || logoVal === null) return l
            return { ...l, logo: { ...getLogoObj(l), alt } }
        })
        onBlockUpdate(blockIndex, { logos: updated })
    }

    return (
        <div className="border-t border-white/10 pt-4">
            <label className="text-xs font-medium uppercase text-gray-500">Logos ({count})</label>
            {logos.map((logo, i) => (
                <div key={`${i}-${removeVersion}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Logo {i + 1}</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                aria-label={`Move logo ${i + 1} up`}
                                disabled={i === 0}
                                onClick={() => handleMoveUp(i)}
                                className="text-gray-400 hover:text-white disabled:opacity-30 px-1 text-sm leading-none"
                            >↑</button>
                            <button
                                type="button"
                                aria-label={`Move logo ${i + 1} down`}
                                disabled={i >= count - 1}
                                onClick={() => handleMoveDown(i)}
                                className="text-gray-400 hover:text-white disabled:opacity-30 px-1 text-sm leading-none"
                            >↓</button>
                            <button
                                type="button"
                                aria-label={`Remove logo ${i + 1}`}
                                disabled={count <= 1}
                                onClick={() => handleRemoveAt(i)}
                                className="text-red-400 hover:text-red-300 disabled:opacity-30"
                            ><X className="h-4 w-4" aria-hidden /></button>
                        </div>
                    </div>
                    <BlockImageEditor
                        imageUrl={getLogoUrl(logo)}
                        altText={getLogoAlt(logo)}
                        onImageChange={(id, url) => handleImageChange(i, id, url)}
                        onAltTextChange={(alt) => handleAltChange(i, alt)}
                    />
                    <Input
                        defaultValue={logo.name}
                        placeholder="Company name"
                        variant="editor"
                        className="mt-1.5"
                        onBlur={(e: FieldBlurEvent) => handleNameBlur(i, e.target.value)}
                    />
                </div>
            ))}
            <button
                type="button"
                disabled={count >= maxCount}
                onClick={handleAdd}
                className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30"
            >
                + Add Logo ({count}/{maxCount})
            </button>
        </div>
    )
}
