'use client'

import React, { useRef, useState } from 'react'
import { Minus, Plus, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { FeatureComparisonConfig, ComparisonProduct, ComparisonFeature } from '@/blocks/feature-comparison/config'
import { useI18n } from '@/i18n'
import FeatureComparisonFeatureModal from './FeatureComparisonFeatureModal'

interface FeatureComparisonSettingsProps {
    block: FeatureComparisonConfig
    blockIndex: number
    onBlockUpdate: (idx: number, changes: Partial<FeatureComparisonConfig>) => void
}

const MAX_PRODUCTS = 3

export default function FeatureComparisonSettings({ block, blockIndex, onBlockUpdate }: FeatureComparisonSettingsProps) {
    const { t, ti } = useI18n()
    const s = t.editor.settings
    const [activeTab, setActiveTab] = useState(0)
    const [removeVersion, setRemoveVersion] = useState(0)
    const [modalOpen, setModalOpen] = useState(false)
    const mutatingRef = useRef(false)

    const products = block.products ?? []
    const features = block.features ?? []
    const count = Math.max(products.length, 1)
    const safeTab = Math.min(activeTab, Math.max(products.length - 1, 0))

    const applyUpdate = (nextProducts: ComparisonProduct[], nextFeatures: ComparisonFeature[]) => {
        onBlockUpdate(blockIndex, { products: nextProducts, features: nextFeatures })
    }

    const handleDecrement = () => {
        if (count <= 1 || mutatingRef.current) return
        mutatingRef.current = true
        try {
            const next = products.slice(0, -1)
            const nextFeatures = features.map(f => ({ ...f, values: (f.values || []).slice(0, -1) }))
            setActiveTab(prev => Math.min(prev, next.length - 1))
            setRemoveVersion(v => v + 1)
            applyUpdate(next, nextFeatures)
        } finally {
            setTimeout(() => { mutatingRef.current = false }, 300)
        }
    }

    const handleIncrement = () => {
        if (count >= MAX_PRODUCTS || mutatingRef.current) return
        mutatingRef.current = true
        try {
            const next = [...products, { name: 'New Product', highlighted: false }]
            const nextFeatures = features.map(f => ({ ...f, values: [...(f.values || []), false] }))
            setActiveTab(next.length - 1)
            applyUpdate(next, nextFeatures)
        } finally {
            setTimeout(() => { mutatingRef.current = false }, 300)
        }
    }

    const handleProductFieldChange = (field: keyof ComparisonProduct, value: unknown) => {
        const next = [...products]
        next[safeTab] = { ...next[safeTab], [field]: value }
        onBlockUpdate(blockIndex, { products: next })
    }

    return (
        <div className="mb-3 space-y-3">
            {/* Products Management — stepper card */}
            <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden">
                <div className="flex items-center px-3 h-12">
                    <span className="text-sm font-medium text-white">{s.fcManagement}</span>
                </div>
                <div className="px-3 pb-3">
                    <div className="flex gap-4 items-center">
                        <div className="w-[100px] shrink-0">
                            <p className="text-[12px] font-medium text-[#94a3b8] leading-4">{s.fcNumberOfProducts}</p>
                            <p className="text-[10px] text-[#94a3b8] leading-4">{s.fcProductsMinMax}</p>
                        </div>
                        <div className="flex flex-1 items-center justify-center gap-2">
                            <button
                                type="button"
                                aria-label={s.fcDecreaseProductCount}
                                disabled={count <= 1}
                                onClick={handleDecrement}
                                className="h-[38px] w-[38px] rounded-xl bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.3)] flex items-center justify-center text-blue-400 disabled:opacity-30 transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <div className="h-[38px] w-11 rounded-xl bg-[rgba(31,41,55,0.5)] flex items-center justify-center text-white text-sm font-medium">
                                {count}
                            </div>
                            <button
                                type="button"
                                aria-label={s.fcIncreaseProductCount}
                                disabled={count >= MAX_PRODUCTS}
                                onClick={handleIncrement}
                                className="h-[38px] w-[38px] rounded-xl border border-[rgba(31,41,55,0.3)] flex items-center justify-center text-gray-400 disabled:opacity-30 hover:bg-white/5 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product tabs + fields */}
            <div className="bg-[rgba(30,41,59,0.3)] border border-[rgba(59,130,246,0.04)] rounded-xl overflow-hidden p-px">
                <div className="bg-[#080e1d] flex gap-2 p-1 rounded-xl">
                    {(products.length > 0 ? products : [null]).map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setActiveTab(i)}
                            className={cn(
                                'flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors',
                                safeTab === i
                                    ? 'bg-[rgba(77,142,255,0.1)] text-[#adc6ff]'
                                    : 'text-[#c2c6d6] hover:bg-white/5'
                            )}
                        >
                            {ti(s.productN, { n: i + 1 })}
                        </button>
                    ))}
                </div>
                <div className="p-3 space-y-3">
                    {products[safeTab] && (
                        <div key={`${safeTab}-${removeVersion}`} className="space-y-3">
                            <div>
                                <p className="text-[12px] font-medium text-[#94a3b8] mb-1.5">{s.name}</p>
                                <Input
                                    defaultValue={products[safeTab].name || ''}
                                    placeholder={s.name}
                                    variant="editor"
                                    onBlur={(e) => handleProductFieldChange('name', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[12px] font-medium text-[#94a3b8]">{s.highlighted}</p>
                                <button
                                    type="button"
                                    onClick={() => handleProductFieldChange('highlighted', !products[safeTab].highlighted)}
                                    className={cn(
                                        'rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors',
                                        products[safeTab].highlighted
                                            ? 'bg-amber-500/15 text-amber-300'
                                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    )}
                                >
                                    <Star className="h-3 w-3 fill-current" aria-hidden /> {products[safeTab].highlighted ? s.highlighted : s.fcDefault}
                                </button>
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="mt-2 w-full py-2 rounded-[10px] text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-teal-400 opacity-90 hover:opacity-100 drop-shadow-[0px_1px_1px_rgba(0,0,0,0.1)] transition-opacity"
                    >
                        {s.fcEditFeatures}
                    </button>
                </div>
            </div>

            <FeatureComparisonFeatureModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                features={features}
                productNames={products.map(p => p.name || '')}
                onSave={nextFeatures => onBlockUpdate(blockIndex, { features: nextFeatures })}
            />
        </div>
    )
}
