'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { addTrackedKeyword, deleteTrackedKeyword } from '@/app/(dashboard)/actions'
import { useI18n } from '@/i18n'
import { Switch } from '@/components/ui/switch'

export interface TrackedKeyword {
    id: string | number;
    text: string;
    rank: string | number;
    trend: string;
    trendColor: string;
}

export function SEOKeywordTracker({ initialKeywords }: { initialKeywords: TrackedKeyword[] }) {
    const { t } = useI18n()
    const seo = t.dashboard.seo
    const cols = seo.keywordColumns
    const modal = seo.keywordModal

    const [keywords, setKeywords] = useState(initialKeywords)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newKeyword, setNewKeyword] = useState('')
    const [mounted, setMounted] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    useEffect(() => { setMounted(true) }, [])
    useEffect(() => { setKeywords(initialKeywords) }, [initialKeywords])

    const handleDelete = (id: string | number) => {
        const index = keywords.findIndex(k => k.id === id)
        if (index === -1) return
        setKeywords(prev => prev.filter(k => k.id !== id))
        startTransition(async () => {
            const result = await deleteTrackedKeyword(index)
            if (!result.success) setKeywords(initialKeywords)
            router.refresh()
        })
    }

    const handleAdd = () => {
        if (keywords.length >= 5 || !newKeyword.trim()) return;
        const cleanKeyword = newKeyword.trim()
        setKeywords(prev => [...prev, { id: Date.now(), text: `"${cleanKeyword}"`, rank: 'N/A', trend: '➡️', trendColor: 'text-amber-500' }])
        setNewKeyword('')
        setIsModalOpen(false)
        startTransition(async () => {
            const result = await addTrackedKeyword(cleanKeyword)
            if (!result.success) setKeywords(initialKeywords)
            router.refresh()
        })
    }

    return (
        <div className={`bg-[#161E2E] border border-[#1F2937] rounded-xl p-6 shadow-sm overflow-x-hidden relative transition-opacity ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex flex-row items-center justify-between gap-2 mb-6">
                <div className="text-base font-bold text-white leading-[1.375]">
                    🔑 {seo.keywordTracker?.title || 'Keyword Tracker'}<br className="sm:hidden" /> (Max 5)
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={keywords.length >= 5}
                    className={`flex items-center justify-center px-3 sm:px-[16px] py-2 sm:pt-[8.5px] sm:pb-[9px] bg-transparent rounded-[8px] font-semibold text-[13px] leading-[1.21em] transition-colors shrink-0 ${
                        keywords.length >= 5
                            ? 'border border-solid border-[#374151] text-[#6B7280] cursor-not-allowed'
                            : 'border border-solid border-[#374151] text-white hover:border-[#3B82F6] hover:text-[#3B82F6]'
                    }`}
                >
                    + {seo.keywordTracker?.add || 'Add'}
                </button>
            </div>

            <div className="w-full">
                <div className="grid grid-cols-[1fr_45px_45px_50px] sm:grid-cols-12 gap-2 sm:gap-4 pb-3 border-b border-[#1F2937] text-[10px] sm:text-xs font-bold text-[#9CA3AF] tracking-wider uppercase items-center">
                    <div className="pl-1 sm:pl-2 sm:col-span-5">{cols.keyword || 'Keyword'}</div>
                    <div className="sm:col-span-3 text-center sm:text-left">{cols.rank || 'Rank'}</div>
                    <div className="sm:col-span-2 text-center sm:text-left">{cols.trend || 'Trend'}</div>
                    <div className="text-right sm:col-span-2 pr-1 sm:pr-2">{cols.action || 'Action'}</div>
                </div>

                <div className="flex flex-col">
                    {keywords.map((kw) => (
                        <div key={kw.id} className="grid grid-cols-[1fr_45px_45px_50px] sm:grid-cols-12 gap-2 sm:gap-4 py-3 border-b border-[#1F2937] items-center text-[12px] sm:text-[13px] hover:bg-white/[0.02] transition-colors px-1 sm:px-2 -mx-1 sm:-mx-2">
                            <div className="font-semibold text-white break-words sm:col-span-5 pr-2">{kw.text}</div>
                            <div className="font-medium text-white text-center sm:text-left sm:col-span-3">{kw.rank}</div>
                            <div className={`text-sm sm:text-base font-bold ${kw.trendColor} text-center sm:text-left sm:col-span-2`}>{kw.trend}</div>
                            <div className="text-right sm:col-span-2 flex justify-end">
                                <button
                                    onClick={() => handleDelete(kw.id)}
                                    className="text-[11px] sm:text-xs font-bold text-red-400 hover:text-red-300 bg-transparent hover:bg-red-500/10 border border-[#374151] hover:border-red-500/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-all"
                                >
                                    {cols.delete || 'Del'}
                                </button>
                            </div>
                        </div>
                    ))}

                    {Array.from({ length: 5 - keywords.length }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="grid grid-cols-[1fr_45px_45px_50px] sm:grid-cols-12 gap-2 sm:gap-4 py-3 border-b border-[#1F2937] last:border-0 items-center text-[12px] sm:text-[13px] px-1 sm:px-2 -mx-1 sm:-mx-2">
                            <div className="italic text-[#6B7280] break-words sm:col-span-5 pr-2">{seo.emptySlot || '(Empty slot)'}</div>
                            <div className="sm:col-span-3"></div>
                            <div className="sm:col-span-2"></div>
                            <div className="sm:col-span-2"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Keyword Modal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="dash-shell fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                                className="w-full max-w-[500px] rounded-[16px] bg-[#1E2536] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden antialiased"
                                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
                            >
                                <div className="px-6 py-5">
                                    <h2 className="text-[20px] font-bold text-white leading-tight">{modal.title || 'Add Keyword'}</h2>
                                </div>
                                <div className="h-[1px] w-full bg-[#374151]"></div>
                                <div className="p-6">
                                    <label className="block text-[14px] font-medium text-white mb-2">{modal.label || 'Enter new keyword'}</label>
                                    <input
                                        type="text" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                                        placeholder={modal.placeholder || 'Enter keyword...'}
                                        className="w-full h-10 px-4 bg-[#0F141E] rounded-[10px] text-[14px] text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all border-none"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsModalOpen(false) }}
                                    />
                                </div>
                                <div className="h-[1px] w-full bg-[#374151]"></div>
                                <div className="px-6 py-5 flex shrink-0 justify-end gap-3 bg-[#1E2536]">
                                    <button onClick={() => { setIsModalOpen(false); setNewKeyword('') }}
                                        className="flex h-[40px] px-5 items-center justify-center rounded-[8px] bg-[#0F141E] hover:bg-white/5 text-[14px] font-medium text-white transition-colors border-none">
                                        {modal.cancel || 'Cancel'}
                                    </button>
                                    <button onClick={handleAdd} disabled={!newKeyword.trim()}
                                        className="flex h-[40px] px-6 items-center justify-center rounded-[8px] bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors">
                                        {modal.save || 'Save'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}

export function AutoMetaToggle({ defaultChecked, siteId }: { defaultChecked: boolean; siteId?: string | number }) {
    const { t } = useI18n()
    const autoMeta = t.dashboard.seo.autoMeta
    const [checked, setChecked] = useState(defaultChecked)
    const [saving, setSaving] = useState(false)

    const handleChange = async (newValue: boolean) => {
        setChecked(newValue)
        if (!siteId) return
        setSaving(true)
        try {
            await fetch('/api/seo/auto-meta-toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: String(siteId), enabled: newValue }),
            })
        } catch {
            setChecked(!newValue)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-[2px] min-w-0">
                <span className="text-[14px] font-semibold text-white leading-[1.4]">
                    {autoMeta.label || 'Auto-Generate Meta Tags'}
                </span>
                <span className="text-[12px] leading-[1.5] text-[#9CA3AF]">
                    {autoMeta.description || 'Automatically creates SEO-optimized title and description tags for new pages and products.'}
                </span>
            </div>
            {/* Shared <Switch> — same component as the product status toggle (teal when on). */}
            <Switch
                checked={checked}
                onCheckedChange={handleChange}
                disabled={saving}
                className="shrink-0"
                aria-label={autoMeta.label || 'Auto-Generate Meta Tags'}
            />
        </div>
    )
}
