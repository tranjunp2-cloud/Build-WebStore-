'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

type BreadcrumbItem = {
    label: string
    url: string
}

interface BreadcrumbEditorProps {
    items: BreadcrumbItem[]
    mode: 'auto' | 'manual'
    homeLabel: string
    separator: string
    showIcon: boolean
    onChange: (changes: {
        items?: BreadcrumbItem[]
        mode?: 'auto' | 'manual'
        homeLabel?: string
        separator?: string
        showIcon?: boolean
    }) => void
}

const labelCls = 'text-[11px] font-medium text-slate-400'
const inputCls = 'mt-1 h-8 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50'

export function BreadcrumbEditor({
    items,
    mode,
    homeLabel,
    separator,
    showIcon,
    onChange,
}: BreadcrumbEditorProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className={labelCls}>Navigation Path</label>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
                {(['auto', 'manual'] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => onChange({ mode: m })}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${
                            mode === m
                                ? 'border border-blue-500/30 bg-blue-500/10 text-blue-300'
                                : 'border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            {/* Auto mode settings */}
            {mode === 'auto' && (
                <div className="space-y-3">
                    <div>
                        <label className={labelCls}>Home Label</label>
                        <input
                            type="text"
                            defaultValue={homeLabel}
                            onBlur={(e) => onChange({ homeLabel: e.target.value })}
                            placeholder="Home"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Separator</label>
                        <input
                            type="text"
                            defaultValue={separator}
                            onBlur={(e) => onChange({ separator: e.target.value })}
                            placeholder="/"
                            className={inputCls}
                            maxLength={3}
                        />
                    </div>
                </div>
            )}

            {/* Manual mode — editable items */}
            {mode === 'manual' && (
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex gap-2">
                            <input
                                type="text"
                                defaultValue={item.label}
                                onBlur={(e) => {
                                    const updated = [...items]
                                    updated[index] = { ...updated[index], label: e.target.value }
                                    onChange({ items: updated })
                                }}
                                placeholder="Label"
                                className="h-8 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                            />
                            <input
                                type="text"
                                defaultValue={item.url}
                                onBlur={(e) => {
                                    const updated = [...items]
                                    updated[index] = { ...updated[index], url: e.target.value }
                                    onChange({ items: updated })
                                }}
                                placeholder="/page"
                                className="h-8 w-24 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const updated = items.filter((_, i) => i !== index)
                                    onChange({ items: updated })
                                }}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => onChange({ items: [...items, { label: '', url: '' }] })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 py-2 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-300"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add item
                    </button>
                </div>
            )}

            {/* Show icon toggle */}
            <div className="flex items-center justify-between">
                <label className={labelCls}>Show Icon</label>
                <button
                    type="button"
                    onClick={() => onChange({ showIcon: !showIcon })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${showIcon ? 'bg-blue-500' : 'bg-white/10'}`}
                >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${showIcon ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
            </div>
        </div>
    )
}
