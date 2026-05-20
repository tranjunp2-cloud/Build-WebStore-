'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BlockImageEditor } from './BlockImageEditor'
import type { TeamConfig, TeamMember } from '@/blocks/team/config'
import { useI18n } from '@/i18n'

type FieldBlurEvent = React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>

function stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, '')
}

interface TeamSettingsProps {
    block: TeamConfig
    blockIndex: number
    onBlockUpdate: (idx: number, changes: Record<string, unknown>) => void
}

const makeDefaultMember = (n: number): TeamMember => ({ name: `Team Member ${n}`, role: 'Role', bio: '' })

export default function TeamSettings({ block, blockIndex, onBlockUpdate }: TeamSettingsProps) {
    const { t } = useI18n()
    const s = t.editor.settings
    const [isOpen, setIsOpen] = useState(true)
    const [removeVersion, setRemoveVersion] = useState(0)
    const paddedRef = useRef(false)

    const members = block.members ?? []
    const count = members.length

    // Pad to 3 on first mount if block has no members (new block default)
    useEffect(() => {
        if (members.length >= 1) { paddedRef.current = false; return }
        if (paddedRef.current) return
        paddedRef.current = true
        const padding: TeamMember[] = Array.from({ length: 3 - members.length }, (_, i) =>
            makeDefaultMember(members.length + i + 1)
        )
        onBlockUpdate(blockIndex, { members: [...members, ...padding] })
    // `members` array ref and `onBlockUpdate` excluded: only `members.length === 0`
    // triggers padding — array contents at length=0 are meaningless — and
    // `onBlockUpdate` is a stable useCallback from the parent editor page.
    }, [blockIndex, members.length]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleAdd = () => {
        if (count >= 6) return
        onBlockUpdate(blockIndex, { members: [...members, makeDefaultMember(count + 1)] })
    }

    const handleRemoveLast = () => {
        if (count <= 1) return
        onBlockUpdate(blockIndex, { members: members.slice(0, -1) })
        setRemoveVersion(v => v + 1)
    }

    const handleRemoveAt = (i: number) => {
        if (count <= 1) return
        onBlockUpdate(blockIndex, { members: members.filter((_, idx) => idx !== i) })
        setRemoveVersion(v => v + 1)
    }

    const handleFieldBlur = (i: number, field: 'name' | 'role' | 'bio', value: string) => {
        const current = String(members[i]?.[field] ?? '')
        // Skip if value unchanged. The stripHtml comparison intentionally preserves inline-edited
        // HTML formatting: if user typed "Alice" in sidebar but store has "<b>Alice</b>", we treat
        // them as equal and don't overwrite — inline formatting takes priority over sidebar plain text.
        // Known trade-off: user cannot remove HTML formatting by retyping the same text in sidebar.
        if (current === value || stripHtml(current) === value) return
        const updated = members.map((m, idx) => idx === i ? { ...m, [field]: value } : m)
        onBlockUpdate(blockIndex, { members: updated })
    }

    const handleImageChange = (i: number, id: number, url: string) => {
        const updated = members.map((m, idx) =>
            idx === i ? { ...m, image: { id, url, alt: m.image?.alt ?? '' } } : m
        )
        onBlockUpdate(blockIndex, { members: updated })
    }

    const handleAltChange = (i: number, alt: string) => {
        const updated = members.map((m, idx) =>
            idx === i ? { ...m, image: { ...m.image, alt } } : m
        )
        onBlockUpdate(blockIndex, { members: updated })
    }

    return (
        <div className="mb-3">
            <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 h-12"
                >
                    <span className="text-sm font-medium text-white">{s.teamConfiguration}</span>
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                    <div className="px-3 pb-3">
                        <div className="flex gap-4 items-center">
                            <div className="w-[100px] shrink-0">
                                <p className="text-[12px] font-medium text-[#94a3b8] leading-4">{s.numberOfMembers}</p>
                                <p className="text-[10px] text-[#94a3b8] leading-4">{s.membersMinMax}</p>
                            </div>
                            <div className="flex flex-1 items-center justify-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Decrease team member count"
                                    disabled={count <= 1}
                                    onClick={handleRemoveLast}
                                    className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] text-white text-sm font-medium disabled:opacity-30 hover:bg-white/5 transition-colors"
                                >−</button>
                                <div className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#1f2937] flex items-center justify-center text-white text-sm font-medium">
                                    {count}
                                </div>
                                <button
                                    type="button"
                                    aria-label="Increase team member count"
                                    disabled={count >= 6}
                                    onClick={handleAdd}
                                    className="h-[38px] w-[44px] rounded-xl border border-[rgba(59,130,246,0.04)] bg-[#0b1120] text-white text-sm font-medium disabled:opacity-30 hover:bg-white/10 transition-colors"
                                >+</button>
                            </div>
                        </div>
                        <div className="mt-3 space-y-3">
                            {members.map((member, i) => (
                                <div key={`${i}-${removeVersion}`} className="relative rounded-lg bg-white/5 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500">{s.memberLabel} {i + 1}</span>
                                        <button
                                            type="button"
                                            aria-label={`Remove member ${i + 1}`}
                                            disabled={count <= 1}
                                            onClick={() => handleRemoveAt(i)}
                                            className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-30"
                                        >✕</button>
                                    </div>
                                    <BlockImageEditor
                                        imageUrl={member.image?.url ?? ''}
                                        altText={member.image?.alt ?? ''}
                                        onImageChange={(id, url) => handleImageChange(i, id, url)}
                                        onAltTextChange={(alt) => handleAltChange(i, alt)}
                                    />
                                    <Input
                                        defaultValue={stripHtml(member.name)}
                                        placeholder={s.memberNamePlaceholder}
                                        variant="editor"
                                        className="mt-1.5"
                                        onBlur={(e: FieldBlurEvent) => handleFieldBlur(i, 'name', e.target.value)}
                                    />
                                    <Input
                                        defaultValue={stripHtml(member.role)}
                                        placeholder={s.memberRolePlaceholder}
                                        variant="editor"
                                        className="mt-1.5"
                                        onBlur={(e: FieldBlurEvent) => handleFieldBlur(i, 'role', e.target.value)}
                                    />
                                    <Textarea
                                        defaultValue={stripHtml(member.bio ?? '')}
                                        placeholder={s.memberBioPlaceholder}
                                        variant="editor"
                                        className="mt-1.5 min-h-[72px]"
                                        onBlur={(e: FieldBlurEvent) => handleFieldBlur(i, 'bio', e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
