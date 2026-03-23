'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2, Play, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ProductImageFallback } from '@/components/dashboard/ProductImageFallback'
import { useI18n } from '@/i18n'

interface VariantPayload {
    name: string
    price: number
    sku: string
    stock: number
}

interface ParsedProduct {
    _id?: string // for grid keys
    selected: boolean
    name: string
    price: number
    category: string
    variants: VariantPayload[]
}

interface BulkCreateModalProps {
    onClose: () => void
    onSuccess?: () => void
}

export function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function buildSavePayload(prod: ParsedProduct) {
    return {
        name: prod.name,
        slug: slugify(prod.name) + '-' + Math.random().toString(36).substr(2, 5),
        price: prod.price,
        status: 'draft',
        category: prod.category?.trim() || undefined,
        variants: prod.variants?.length ? prod.variants : undefined,
        stock: prod.variants?.length ? 0 : 10,
        weight: 1, // Fallback for F14 dimension requirements
    }
}

export function BulkCreateModal({ onClose, onSuccess }: BulkCreateModalProps) {
    const router = useRouter()
    const { t } = useI18n()
    const [prompt, setPrompt] = useState('')
    const [isParsing, setIsParsing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [products, setProducts] = useState<ParsedProduct[]>([])

    const handleParse = async () => {
        if (!prompt.trim()) {
            toast.error(t.dashboard.products.bulkCreate.parseEmptyError)
            return
        }

        setIsParsing(true)
        try {
            const res = await fetch('/api/ai/products-bulk-parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promptText: prompt })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || t.dashboard.products.bulkCreate.parseError)

            if (data.products && Array.isArray(data.products)) {
                const initProducts = data.products.map((p: ParsedProduct) => ({
                    ...p,
                    _id: Math.random().toString(36).substr(2, 9),
                    selected: true,
                    category: p.category || '',
                }))
                setProducts(initProducts)
                toast.success(t.dashboard.products.bulkCreate.parseSuccess.replace('{count}', initProducts.length.toString()))
            } else {
                toast.error(t.dashboard.products.bulkCreate.parseInvalidData)
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : t.dashboard.products.bulkCreate.parseError)
        } finally {
            setIsParsing(false)
        }
    }

    const handleSave = async () => {
        const selectedProducts = products.filter(p => p.selected)
        if (selectedProducts.length === 0) {
            toast.error(t.dashboard.products.bulkCreate.saveEmptyError)
            return
        }

        setIsSaving(true)
        let successCount = 0

        try {
            for (const prod of selectedProducts) {
                const payload = buildSavePayload(prod)

                const res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                })

                if (res.ok) {
                    successCount++
                } else {
                    console.warn('Failed to save product', prod.name)
                }
            }

            if (successCount > 0) {
                toast.success(t.dashboard.products.bulkCreate.saveSuccess.replace('{count}', successCount.toString()))
                if (onSuccess) onSuccess()
                router.refresh()
                onClose()
            } else {
                toast.error(t.dashboard.products.bulkCreate.saveFailed)
            }

        } catch (error: unknown) {
            console.error('Bulk save error:', error)
            toast.error(t.dashboard.products.bulkCreate.saveError)
        } finally {
            setIsSaving(false)
        }
    }

    const updateProduct = (id: string, field: keyof ParsedProduct, value: unknown) => {
        setProducts(prev => prev.map(p => p._id === id ? { ...p, [field]: value } : p))
    }

    const toggleSelectAll = (checked: boolean) => {
        setProducts(prev => prev.map(p => ({ ...p, selected: checked })))
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="flex flex-col max-h-[90vh] w-full max-w-5xl rounded-2xl bg-[#0F172A] shadow-2xl overflow-hidden border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#1E293B]">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">{t.dashboard.products.bulkCreate.title}</h2>
                            <p className="text-sm text-gray-400">{t.dashboard.products.bulkCreate.subtitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Input Area */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-300">{t.dashboard.products.bulkCreate.promptLabel}</label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder={t.dashboard.products.bulkCreate.promptPlaceholder}
                            className="w-full min-h-[120px] rounded-xl border border-white/10 bg-[#1E293B]/50 p-4 text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleParse}
                                disabled={isParsing || !prompt.trim()}
                                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
                            >
                                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                {isParsing ? t.dashboard.products.bulkCreate.parsing : t.dashboard.products.bulkCreate.parseButton}
                            </button>
                        </div>
                    </div>

                    {/* Preview Grid */}
                    {products.length > 0 && (
                        <div className="space-y-3 p-1">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <h3 className="text-base font-semibold text-white">{t.dashboard.products.bulkCreate.previewTitle}</h3>
                                <p className="text-xs text-gray-500">
                                    {t.dashboard.products.bulkCreate.previewSubtitle}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-[#1E293B] overflow-hidden">
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="bg-[#0F172A]/50 border-b border-white/10">
                                        <tr>
                                            <th className="px-3 py-3 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                                                    checked={products.length > 0 && products.every(p => p.selected)}
                                                    onChange={e => toggleSelectAll(e.target.checked)}
                                                />
                                            </th>
                                            <th className="px-3 py-3 w-14 font-medium text-gray-400 text-xs uppercase">{t.dashboard.products.bulkCreate.colImage}</th>
                                            <th className="px-3 py-3 font-medium text-gray-400 text-xs uppercase">{t.dashboard.products.bulkCreate.colName}</th>
                                            <th className="px-3 py-3 font-medium text-gray-400 text-xs uppercase">{t.dashboard.products.bulkCreate.colPrice}</th>
                                            <th className="px-3 py-3 font-medium text-gray-400 text-xs uppercase">{t.dashboard.products.bulkCreate.colCategory}</th>
                                            <th className="px-3 py-3 font-medium text-gray-400 text-xs uppercase">{t.dashboard.products.bulkCreate.colVariants}</th>
                                            <th className="px-3 py-3 font-medium text-gray-400 text-xs uppercase">{t.dashboard.products.bulkCreate.colStatus}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {products.map(p => (
                                            <tr key={p._id} className={cn("hover:bg-white/5 transition-colors", p.selected ? "" : "opacity-40")}>
                                                {/* Checkbox */}
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
                                                        checked={p.selected}
                                                        onChange={e => updateProduct(p._id!, 'selected', e.target.checked)}
                                                    />
                                                </td>

                                                {/* Ảnh fallback — AC-1: "hình ảnh bị TRỐNG, Mặc định thùng carton khi lưu" */}
                                                <td className="px-3 py-3">
                                                    <div className="h-10 w-10 rounded-lg overflow-hidden border border-white/10 bg-[#0F172A]">
                                                        <ProductImageFallback size="sm" />
                                                    </div>
                                                </td>

                                                {/* Tên — editable */}
                                                <td className="px-3 py-3">
                                                    <input
                                                        value={p.name}
                                                        onChange={e => updateProduct(p._id!, 'name', e.target.value)}
                                                        className="w-full min-w-[140px] bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500 p-1 text-white text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500/50 rounded transition-colors"
                                                    />
                                                </td>

                                                {/* Giá — editable */}
                                                <td className="px-3 py-3">
                                                    <input
                                                        type="number"
                                                        value={p.price}
                                                        onChange={e => updateProduct(p._id!, 'price', parseFloat(e.target.value) || 0)}
                                                        className="w-24 bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500 p-1 text-white text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500/50 rounded transition-colors"
                                                    />
                                                </td>

                                                {/* Category — editable, AC-1 */}
                                                <td className="px-3 py-3">
                                                    <input
                                                        value={p.category}
                                                        onChange={e => updateProduct(p._id!, 'category', e.target.value)}
                                                        placeholder="Danh mục..."
                                                        className="w-full min-w-[110px] bg-transparent border border-transparent hover:border-white/10 focus:border-indigo-500 p-1 text-white text-sm placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500/50 rounded transition-colors"
                                                    />
                                                </td>

                                                {/* Variants */}
                                                <td className="px-3 py-3">
                                                    {p.variants?.length ? (
                                                        <span
                                                            className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20"
                                                            title={p.variants.map(v => v.name).join(', ')}
                                                        >
                                                            {t.dashboard.products.bulkCreate.variantsCount.replace('{count}', p.variants.length.toString())}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600 text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* Trạng thái */}
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                                                        Draft
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-600 px-1">
                                {t.dashboard.products.bulkCreate.editorHint}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4 bg-[#1E293B]">
                    <p className="text-xs text-gray-500">
                        {t.dashboard.products.bulkCreate.footerCount.replace('{selected}', products.filter(p => p.selected).length.toString()).replace('{total}', products.length.toString())}
                    </p>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                            {t.dashboard.products.bulkCreate.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || products.filter(p => p.selected).length === 0}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors shadow-lg shadow-green-600/20"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            {t.dashboard.products.bulkCreate.saveButton.replace('{count}', products.filter(p => p.selected).length.toString())}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
