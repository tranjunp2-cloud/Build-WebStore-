'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export type VariantConfig = {
    name: string
    options: string[]
}

export type Variant = {
    name: string
    sku: string
    price: string
    compareAtPrice?: string
    stock: string
}

type VariantsEditorProps = {
    configs: VariantConfig[]
    variants: Variant[]
    onChange: (configs: VariantConfig[], variants: Variant[]) => void
    currencySymbol: string
}

// Generate permutations
export const generateVariantMatrix = (currentConfigs: VariantConfig[], currentVariants: Variant[]): Variant[] => {
    if (currentConfigs.length === 0 || currentConfigs.every(c => c.options.length === 0)) {
        return []
    }

    const validConfigs = currentConfigs.filter(c => c.name.trim() && c.options.length > 0)
    if (validConfigs.length === 0) return []

    const generateCombinations = (arrays: string[][]): string[][] => {
        if (arrays.length === 0) return []
        if (arrays.length === 1) return arrays[0].map(x => [x])
        
        const result: string[][] = []
        const rest = generateCombinations(arrays.slice(1))
        for (const x of arrays[0]) {
            for (const r of rest) {
                result.push([x, ...r])
            }
        }
        return result
    }

    const optionsArray = validConfigs.map(c => c.options)
    const combinations = generateCombinations(optionsArray)
    
    const newVariants: Variant[] = combinations.map(combo => {
        const name = combo.join(' - ')
        // Find existing
        const existing = currentVariants.find(v => v.name === name)
        return {
            name,
            sku: existing?.sku || '',
            price: existing?.price || '',
            compareAtPrice: existing?.compareAtPrice || '',
            stock: existing?.stock || '0',
        }
    })
    
    return newVariants
}

function DesktopVariantRow({ variant, currencySymbol, vIdx, updateVariant, vt }: { variant: Variant, currencySymbol: string, vIdx: number, updateVariant: (idx: number, field: keyof Variant, val: string) => void, vt: any }) {
    const [localVariant, setLocalVariant] = useState(variant)

    useEffect(() => { setLocalVariant(variant) }, [variant])

    const handleBlur = (field: keyof Variant) => {
        if (localVariant[field] !== variant[field]) {
            updateVariant(vIdx, field, localVariant[field]!)
        }
    }

    const handleChange = (field: keyof Variant, value: string) => {
        setLocalVariant(prev => ({ ...prev, [field]: value }))
    }

    return (
        <tr className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 font-medium text-white">{variant.name}</td>
            <td className="px-4 py-3">
                <input type="number" min="0" step="0.01" value={localVariant.price} onChange={e => handleChange('price', e.target.value)} onBlur={() => handleBlur('price')} required
                    className="w-full rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50" />
            </td>
            <td className="px-4 py-3">
                <input type="number" min="0" step="0.01" value={localVariant.compareAtPrice || ''} onChange={e => handleChange('compareAtPrice', e.target.value)} onBlur={() => handleBlur('compareAtPrice')}
                    className="w-full rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50" />
            </td>
            <td className="px-4 py-3">
                <input type="number" min="0" value={localVariant.stock} onChange={e => handleChange('stock', e.target.value)} onBlur={() => handleBlur('stock')} required
                    className="w-full rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50" />
            </td>
            <td className="px-4 py-3">
                <input type="text" value={localVariant.sku} onChange={e => handleChange('sku', e.target.value)} onBlur={() => handleBlur('sku')}
                    className="w-full rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50" />
            </td>
        </tr>
    )
}

function MobileVariantCard({ variant, currencySymbol, vIdx, updateVariant, vt, isExpanded, toggleAccordion }: { variant: Variant, currencySymbol: string, vIdx: number, updateVariant: (idx: number, field: keyof Variant, val: string) => void, vt: any, isExpanded: boolean, toggleAccordion: () => void }) {
    const [localVariant, setLocalVariant] = useState(variant)

    useEffect(() => { setLocalVariant(variant) }, [variant])

    const handleBlur = (field: keyof Variant) => {
        if (localVariant[field] !== variant[field]) {
            updateVariant(vIdx, field, localVariant[field]!)
        }
    }

    const handleChange = (field: keyof Variant, value: string) => {
        setLocalVariant(prev => ({ ...prev, [field]: value }))
    }

    return (
        <div className="rounded-xl border border-white/10 bg-[#0B1120] overflow-hidden">
            <button type="button" onClick={toggleAccordion}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-white tap-highlight-transparent hover:bg-white/5">
                <span>{variant.name}</span>
                <div className="flex items-center gap-2">
                    {(!localVariant.price || !localVariant.stock || localVariant.stock === '0') && <span className="h-2 w-2 rounded-full bg-red-500"></span>}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
            </button>
            
            {isExpanded && (
                <div className="border-t border-white/5 p-3 sm:p-4 space-y-4 bg-white/[0.02]">
                    <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">{vt.price} ({currencySymbol}) *</label>
                        <input type="number" min="0" step="0.01" value={localVariant.price} onChange={e => handleChange('price', e.target.value)} onBlur={() => handleBlur('price')}
                            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">{vt.compareAtPrice} ({currencySymbol})</label>
                        <input type="number" min="0" step="0.01" value={localVariant.compareAtPrice || ''} onChange={e => handleChange('compareAtPrice', e.target.value)} onBlur={() => handleBlur('compareAtPrice')}
                            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">{vt.stock} *</label>
                        <input type="number" min="0" value={localVariant.stock} onChange={e => handleChange('stock', e.target.value)} onBlur={() => handleBlur('stock')}
                            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">{vt.sku}</label>
                        <input type="text" value={localVariant.sku} onChange={e => handleChange('sku', e.target.value)} onBlur={() => handleBlur('sku')}
                            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
                    </div>
                </div>
            )}
        </div>
    )
}


export function VariantsEditor({ configs, variants, onChange, currencySymbol }: VariantsEditorProps) {
    const { t } = useI18n()
    const vt = t.dashboard.products.form.variants

    const addTier = () => {
        if (configs.length >= 2) return
        const newConfigs = [...configs, { name: '', options: [] }]
        onChange(newConfigs, generateVariantMatrix(newConfigs, variants))
    }

    const removeTier = (index: number) => {
        const newConfigs = configs.filter((_, i) => i !== index)
        onChange(newConfigs, generateVariantMatrix(newConfigs, variants))
    }

    const updateTierName = (index: number, name: string) => {
        const newConfigs = [...configs]
        newConfigs[index].name = name
        onChange(newConfigs, generateVariantMatrix(newConfigs, variants))
    }

    const handleOptionsInput = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const input = e.currentTarget
            const value = input.value.trim()
            if (value && !configs[index].options.includes(value)) {
                const newConfigs = [...configs]
                newConfigs[index].options.push(value)
                onChange(newConfigs, generateVariantMatrix(newConfigs, variants))
                input.value = ''
            }
        }
    }

    const removeOption = (tierIndex: number, optionIndex: number) => {
        const newConfigs = [...configs]
        newConfigs[tierIndex].options = newConfigs[tierIndex].options.filter((_, i) => i !== optionIndex)
        onChange(newConfigs, generateVariantMatrix(newConfigs, variants))
    }

    const updateVariant = (index: number, field: keyof Variant, value: string) => {
        const newVariants = [...variants]
        newVariants[index] = { ...newVariants[index], [field]: value }
        onChange(configs, newVariants)
    }

    const [expandedMobileIndices, setExpandedMobileIndices] = useState<Record<number, boolean>>({})
    const toggleMobileAccordion = (index: number) => {
        setExpandedMobileIndices(prev => ({ ...prev, [index]: !prev[index] }))
    }

    return (
        <div className="space-y-6">
            {/* Tiers Config */}
            <div className="space-y-4">
                {configs.map((tier, tIndex) => (
                    <div key={tIndex} className="p-4 rounded-xl border border-white/10 bg-[#0B1120] space-y-3 relative group">
                        <button onClick={() => removeTier(tIndex)} type="button"
                            className="absolute top-4 right-4 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <div>
                            <label className="text-xs font-medium text-gray-400">{vt.tierName} ({vt.tierConfigDesc})</label>
                            <input value={tier.name} onChange={e => updateTierName(tIndex, e.target.value)}
                                className="mt-1.5 w-full md:w-1/2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white outline-none focus:border-blue-500/50 block" 
                                placeholder={vt.tierNamePlaceholder}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-400">{vt.options} ({vt.optionsPlaceholder})</label>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                                {tier.options.map((opt, oIndex) => (
                                    <div key={oIndex} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-sm text-white">
                                        <span>{opt}</span>
                                        <button onClick={() => removeOption(tIndex, oIndex)} type="button" className="text-gray-400 hover:text-white ml-1">
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <input onKeyDown={e => handleOptionsInput(tIndex, e)}
                                    placeholder={vt.optionsPlaceholder}
                                    className="flex-1 min-w-[120px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder-gray-500 focus:bg-white/5" />
                            </div>
                        </div>
                    </div>
                ))}
                
                {configs.length < 2 && (
                    <button type="button" onClick={addTier}
                        className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                        <Plus className="h-4 w-4" />
                        {vt.addTier}
                    </button>
                )}
            </div>

            {/* Variants Matrix */}
            {variants.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-300">{vt.matrixTitle}</h3>
                    
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10 bg-[#0B1120]">
                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-gray-400">
                                <tr>
                                    <th className="px-4 py-3 min-w-[150px]">Variant</th>
                                    <th className="px-4 py-3 min-w-[150px]">{vt.price} ({currencySymbol}) *</th>
                                    <th className="px-4 py-3 min-w-[150px]">{vt.compareAtPrice} ({currencySymbol})</th>
                                    <th className="px-4 py-3 min-w-[120px]">{vt.stock} *</th>
                                    <th className="px-4 py-3 min-w-[150px]">{vt.sku}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {variants.map((variant, vIdx) => (
                                    <DesktopVariantRow 
                                        key={vIdx} 
                                        variant={variant} 
                                        currencySymbol={currencySymbol} 
                                        vIdx={vIdx} 
                                        updateVariant={updateVariant} 
                                        vt={vt} 
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Accordion */}
                    <div className="md:hidden space-y-2">
                        {variants.map((variant, vIdx) => (
                            <MobileVariantCard 
                                key={vIdx} 
                                variant={variant} 
                                currencySymbol={currencySymbol} 
                                vIdx={vIdx} 
                                updateVariant={updateVariant} 
                                vt={vt} 
                                isExpanded={expandedMobileIndices[vIdx] || false}
                                toggleAccordion={() => toggleMobileAccordion(vIdx)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
