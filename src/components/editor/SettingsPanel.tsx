'use client'

import React, { memo } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blockRegistry } from '@/blocks/registry'

// ─── Types ──────────────────────────────────────────────────────────────
type BlockData = { blockType: string;[key: string]: any }

// ─── Constants ──────────────────────────────────────────────────────────
const FONT_OPTIONS = ['Outfit', 'Inter', 'DM Sans', 'Playfair Display', 'Roboto', 'Poppins', 'Plus Jakarta Sans']
const inputCls = "mt-1.5 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
const textareaCls = `${inputCls} resize-none`
const labelCls = "text-xs font-medium text-gray-400"
const sectionCls = "border-t border-white/10 pt-4"

function getBlockInfo(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return { label: meta?.name || blockType, icon: meta?.icon || '🧩', variants: meta?.variants || [] }
}

// ─── Props ──────────────────────────────────────────────────────────────
interface SettingsPanelProps {
    block: BlockData | null
    blockIndex: number
    theme: any
    onThemeChange: (key: string, value: string) => void
    onDeleteBlock: (idx: number) => void
    onDuplicateBlock: (idx: number) => void
    onBlockFieldChange: (idx: number, field: string, value: string) => void
    onBlockUpdate: (idx: number, changes: any) => void
}

// ─── Component ──────────────────────────────────────────────────────────
function SettingsPanelInner({
    block, blockIndex, theme, onThemeChange, onDeleteBlock, onDuplicateBlock, onBlockFieldChange, onBlockUpdate,
}: SettingsPanelProps) {
    if (!block) {
        return (
            <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A] items-center justify-center">
                <p className="text-sm text-gray-500">Select a block to edit</p>
            </div>
        )
    }

    const info = getBlockInfo(block.blockType)
    const bt = block.blockType

    // Helper: update item in an array field
    const updateArrayItem = (field: string, index: number, key: string, val: string) => {
        const arr = [...(block[field] || [])]
        arr[index] = { ...arr[index], [key]: val }
        onBlockUpdate(blockIndex, { [field]: arr })
    }

    // Helper: add item to array field
    const addArrayItem = (field: string, template: any) => {
        const arr = [...(block[field] || []), template]
        onBlockUpdate(blockIndex, { [field]: arr })
    }

    // Helper: remove item from array field
    const removeArrayItem = (field: string, index: number) => {
        const arr = (block[field] || []).filter((_: any, i: number) => i !== index)
        onBlockUpdate(blockIndex, { [field]: arr })
    }

    return (
        <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/10 bg-[#0F172A]">
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-medium text-white">{info.icon} {info.label}</span>
                <span className="text-xs text-gray-500">#{blockIndex + 1}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Variant Switcher */}
                {info.variants.length > 1 && (
                    <div>
                        <label className="text-xs font-medium uppercase text-gray-500">Variant</label>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {info.variants.map(v => (
                                <button key={v}
                                    onClick={() => onBlockFieldChange(blockIndex, 'variant', v)}
                                    className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                        block.variant === v ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── Common Text Fields ──────────────────────── */}
                {block.logoText !== undefined && (
                    <div>
                        <label className={labelCls}>Logo Text</label>
                        <input defaultValue={block.logoText} key={`logo-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'logoText', e.target.value)}
                            className={inputCls} />
                    </div>
                )}

                {block.headline !== undefined && (
                    <div>
                        <label className={labelCls}>Headline</label>
                        <input defaultValue={block.headline} key={`hl-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'headline', e.target.value)}
                            className={inputCls} />
                    </div>
                )}

                {block.subheadline !== undefined && (
                    <div>
                        <label className={labelCls}>Subheadline</label>
                        <textarea defaultValue={block.subheadline} rows={2} key={`sub-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'subheadline', e.target.value)}
                            className={textareaCls} />
                    </div>
                )}

                {block.sectionLabel !== undefined && (
                    <div>
                        <label className={labelCls}>Section Label</label>
                        <input defaultValue={block.sectionLabel} key={`sl-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'sectionLabel', e.target.value)}
                            className={inputCls} />
                    </div>
                )}

                {block.body !== undefined && (
                    <div>
                        <label className={labelCls}>Body Text</label>
                        <textarea defaultValue={block.body} rows={4} key={`body-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'body', e.target.value)}
                            className={textareaCls} />
                    </div>
                )}

                {block.subtext !== undefined && (
                    <div>
                        <label className={labelCls}>Description</label>
                        <textarea defaultValue={block.subtext} rows={3} key={`subtext-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'subtext', e.target.value)}
                            className={textareaCls} />
                    </div>
                )}

                {block.tagline !== undefined && (
                    <div>
                        <label className={labelCls}>Tagline</label>
                        <textarea defaultValue={block.tagline} rows={2} key={`tag-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'tagline', e.target.value)}
                            className={textareaCls} />
                    </div>
                )}

                {/* ─── Contact Fields ─────────────────────────── */}
                {(bt === 'contact') && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">📞 Contact Info</label>
                        <div className="mt-3 space-y-3">
                            <div>
                                <label className={labelCls}>Email</label>
                                <input defaultValue={block.email || ''} key={`email-${blockIndex}`}
                                    onBlur={(e: any) => onBlockFieldChange(blockIndex, 'email', e.target.value)}
                                    className={inputCls} placeholder="contact@example.com" />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input defaultValue={block.phone || ''} key={`phone-${blockIndex}`}
                                    onBlur={(e: any) => onBlockFieldChange(blockIndex, 'phone', e.target.value)}
                                    className={inputCls} placeholder="+84 xxx xxx xxx" />
                            </div>
                            <div>
                                <label className={labelCls}>Address</label>
                                <textarea defaultValue={block.address || ''} rows={2} key={`addr-${blockIndex}`}
                                    onBlur={(e: any) => onBlockFieldChange(blockIndex, 'address', e.target.value)}
                                    className={textareaCls} placeholder="123 Street, City" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── CTA Fields ─────────────────────────────── */}
                {(block.ctaLabel !== undefined || block.ctaUrl !== undefined) && (
                    <div>
                        <label className={labelCls}>CTA Button</label>
                        <div className="mt-1.5 space-y-2">
                            <input defaultValue={block.ctaLabel || ''} key={`ctalbl-${blockIndex}`}
                                onBlur={(e: any) => onBlockFieldChange(blockIndex, 'ctaLabel', e.target.value)}
                                className={inputCls} placeholder="Button text" />
                            <input defaultValue={block.ctaUrl || ''} key={`ctaurl-${blockIndex}`}
                                onBlur={(e: any) => onBlockFieldChange(blockIndex, 'ctaUrl', e.target.value)}
                                className={inputCls} placeholder="Button URL" />
                        </div>
                    </div>
                )}

                {block.copyrightText !== undefined && (
                    <div>
                        <label className={labelCls}>Copyright</label>
                        <input defaultValue={block.copyrightText} key={`copy-${blockIndex}`}
                            onBlur={(e: any) => onBlockFieldChange(blockIndex, 'copyrightText', e.target.value)}
                            className={inputCls} />
                    </div>
                )}

                {/* ─── Hero CTA Buttons ───────────────────────── */}
                {bt === 'hero' && (block.ctaButtons || []).length > 0 && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">🔘 CTA Buttons</label>
                        {(block.ctaButtons || []).map((btn: any, i: number) => (
                            <div key={`cta-${i}`} className="mt-3 rounded-lg bg-white/5 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Button {i + 1}</span>
                                    <button onClick={() => removeArrayItem('ctaButtons', i)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <input defaultValue={btn.label || ''} placeholder="Label"
                                    onBlur={(e: any) => updateArrayItem('ctaButtons', i, 'label', e.target.value)}
                                    className={inputCls} />
                                <input defaultValue={btn.url || ''} placeholder="URL"
                                    onBlur={(e: any) => updateArrayItem('ctaButtons', i, 'url', e.target.value)}
                                    className={inputCls} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('ctaButtons', { label: 'New Button', url: '#' })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Button</button>
                    </div>
                )}

                {/* ─── Navigation Links ───────────────────────── */}
                {bt === 'navigation' && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">🔗 Navigation Links</label>
                        {(block.links || []).map((link: any, i: number) => (
                            <div key={`link-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Link {i + 1}</span>
                                    <button onClick={() => removeArrayItem('links', i)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <input defaultValue={link.label || ''} placeholder="Label"
                                    onBlur={(e: any) => updateArrayItem('links', i, 'label', e.target.value)}
                                    className={inputCls} />
                                <input defaultValue={link.url || ''} placeholder="URL"
                                    onBlur={(e: any) => updateArrayItem('links', i, 'url', e.target.value)}
                                    className={inputCls} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('links', { label: 'New Link', url: '#' })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Link</button>
                        {/* Nav CTA */}
                        {block.ctaButton && (
                            <div className="mt-3">
                                <label className={labelCls}>CTA Button</label>
                                <input defaultValue={block.ctaButton?.label || ''} placeholder="CTA Label"
                                    onBlur={(e: any) => onBlockUpdate(blockIndex, { ctaButton: { ...block.ctaButton, label: e.target.value } })}
                                    className={inputCls} />
                                <input defaultValue={block.ctaButton?.url || ''} placeholder="CTA URL"
                                    onBlur={(e: any) => onBlockUpdate(blockIndex, { ctaButton: { ...block.ctaButton, url: e.target.value } })}
                                    className={`${inputCls} mt-1.5`} />
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Features Items ─────────────────────────── */}
                {bt === 'features' && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">✨ Features ({(block.features || []).length})</label>
                        {(block.features || []).map((feat: any, i: number) => (
                            <div key={`feat-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">{feat.icon || '✦'} Feature {i + 1}</span>
                                    <button onClick={() => removeArrayItem('features', i)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <input defaultValue={feat.title || ''} placeholder="Title"
                                    onBlur={(e: any) => updateArrayItem('features', i, 'title', e.target.value)}
                                    className={inputCls} />
                                <textarea defaultValue={feat.description || ''} rows={2} placeholder="Description"
                                    onBlur={(e: any) => updateArrayItem('features', i, 'description', e.target.value)}
                                    className={textareaCls} />
                                <input defaultValue={feat.icon || ''} placeholder="Icon (emoji)"
                                    onBlur={(e: any) => updateArrayItem('features', i, 'icon', e.target.value)}
                                    className={inputCls} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('features', { title: 'New Feature', description: '', icon: '✦' })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Feature</button>
                    </div>
                )}

                {/* ─── Testimonials ───────────────────────────── */}
                {bt === 'testimonials' && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">💬 Testimonials ({(block.testimonials || []).length})</label>
                        {(block.testimonials || []).map((t: any, i: number) => (
                            <div key={`test-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Review {i + 1}</span>
                                    <button onClick={() => removeArrayItem('testimonials', i)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <input defaultValue={t.name || ''} placeholder="Name"
                                    onBlur={(e: any) => updateArrayItem('testimonials', i, 'name', e.target.value)}
                                    className={inputCls} />
                                <input defaultValue={t.title || ''} placeholder="Title / Role"
                                    onBlur={(e: any) => updateArrayItem('testimonials', i, 'title', e.target.value)}
                                    className={inputCls} />
                                <textarea defaultValue={t.quote || ''} rows={2} placeholder="Quote"
                                    onBlur={(e: any) => updateArrayItem('testimonials', i, 'quote', e.target.value)}
                                    className={textareaCls} />
                            </div>
                        ))}
                        <button onClick={() => addArrayItem('testimonials', { name: 'Customer', title: '', quote: 'Great experience!', rating: 5 })}
                            className="mt-2 w-full rounded-lg bg-blue-500/10 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors">+ Add Testimonial</button>
                    </div>
                )}

                {/* ─── Footer Columns ─────────────────────────── */}
                {bt === 'footer' && (
                    <div className={sectionCls}>
                        <label className="text-xs font-medium uppercase text-gray-500">📋 Footer Columns ({(block.columns || []).length})</label>
                        {(block.columns || []).map((col: any, i: number) => (
                            <div key={`col-${i}`} className="mt-2 rounded-lg bg-white/5 p-2.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500">Column {i + 1}</span>
                                    <button onClick={() => removeArrayItem('columns', i)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                                </div>
                                <input defaultValue={col.title || ''} placeholder="Column Title"
                                    onBlur={(e: any) => {
                                        const cols = [...(block.columns || [])]
                                        cols[i] = { ...cols[i], title: e.target.value }
                                        onBlockUpdate(blockIndex, { columns: cols })
                                    }}
                                    className={inputCls} />
                                <div className="text-[10px] text-gray-500 mt-1">{(col.links || []).length} links</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Block actions */}
                <div className="border-t border-white/10 pt-4">
                    <label className="text-xs font-medium uppercase text-gray-500">Actions</label>
                    <div className="mt-2 flex gap-2">
                        <button onClick={() => onDuplicateBlock(blockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                            <Copy className="h-3 w-3" /> Duplicate
                        </button>
                        <button onClick={() => onDeleteBlock(blockIndex)}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors">
                            <Trash2 className="h-3 w-3" /> Delete
                        </button>
                    </div>
                </div>

                {/* Theme editing */}
                {theme && (
                    <div className="border-t border-white/10 pt-4">
                        <label className="text-xs font-medium uppercase text-gray-500">🎨 Global Theme</label>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Primary Color</label>
                            <div className="mt-1 flex items-center gap-2">
                                <input type="color" value={theme.primaryColor || '#0ea5e9'}
                                    onChange={e => onThemeChange('primaryColor', e.target.value)}
                                    className="h-7 w-7 rounded border-0 cursor-pointer bg-transparent" />
                                <input value={theme.primaryColor || '#0ea5e9'}
                                    onChange={e => onThemeChange('primaryColor', e.target.value)}
                                    className="flex-1 rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50" />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Heading Font</label>
                            <select value={theme.fontHeading || 'Outfit'} onChange={e => onThemeChange('fontHeading', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Body Font</label>
                            <select value={theme.fontBody || 'Inter'} onChange={e => onThemeChange('fontBody', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-[#1E293B] px-3 py-1.5 text-xs text-white outline-none">
                                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-gray-400">Color Mode</label>
                            <div className="mt-1 flex gap-2">
                                {(['dark', 'light'] as const).map(mode => (
                                    <button key={mode} onClick={() => onThemeChange('colorMode', mode)}
                                        className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                                            theme.colorMode === mode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-transparent hover:bg-white/10')}>
                                        {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export const SettingsPanel = memo(SettingsPanelInner)
