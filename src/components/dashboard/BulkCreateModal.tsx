'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
    initialPrompt?: string
}

export function slugify(text: string) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function buildSavePayload(prod: ParsedProduct) {
    const hasVariants = Boolean(prod.variants?.length)
    return {
        name: prod.name,
        slug: slugify(prod.name) + '-' + Math.random().toString(36).substring(2, 7),
        price: prod.price,
        status: 'draft',
        // AI returns string category which is invalid for Payload's Relationship ID field, so we omit for now.
        // Users can attach the correct Category from Drafts later.
        hasVariants,
        variants: hasVariants ? prod.variants!.map(v => ({
            name: v.name || 'Mặc định',
            price: v.price || prod.price,
            stock: v.stock || 0,
            sku: v.sku || ''
        })) : undefined,
        inventory: hasVariants ? 0 : 10, // Top-level stock is mapped to `inventory` in schema
        weight: 1, // Fallback for F14 dimension requirements
    }
}

export function BulkCreateModal({ onClose, onSuccess, initialPrompt = '' }: BulkCreateModalProps) {
    const router = useRouter()
    const [isParsing, setIsParsing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [products, setProducts] = useState<ParsedProduct[]>([])
    const [hasParsed, setHasParsed] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (mounted && initialPrompt && !hasParsed && !isParsing) {
            handleParse(initialPrompt)
        }
    }, [mounted, initialPrompt, hasParsed, isParsing])

    const handleParse = async (promptText: string) => {
        setIsParsing(true)
        try {
            const res = await fetch('/api/ai/products-bulk-parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ promptText })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to parse products summary')

            if (data.products && Array.isArray(data.products)) {
                const initProducts = data.products.map((p: ParsedProduct) => ({
                    ...p,
                    _id: Math.random().toString(36).substring(2, 11),
                    selected: true,
                    category: p.category || '',
                }))
                setProducts(initProducts)
            } else {
                toast.error('Invalid products format received from AI')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to parse products summary')
        } finally {
            setIsParsing(false)
            setHasParsed(true)
        }
    }

    const handleSave = async () => {
        const selectedProducts = products.filter(p => p.selected)
        if (selectedProducts.length === 0) {
            toast.error('Please select at least 1 product')
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
                toast.success(`Saved ${successCount} products as draft`)
                if (onSuccess) onSuccess()
                router.refresh()
                onClose()
            } else {
                toast.error('Failed to save products')
            }

        } catch (error: any) {
            console.error('Bulk save error:', error)
            toast.error('Failed to save products')
        } finally {
            setIsSaving(false)
        }
    }

    const updateProduct = (id: string, field: keyof ParsedProduct, value: string | number | boolean) => {
        setProducts(prev => prev.map(p => p._id === id ? { ...p, [field]: value } : p))
    }

    const toggleSelectAll = (checked: boolean) => {
        setProducts(prev => prev.map(p => ({ ...p, selected: checked })))
    }

    const selectedCount = products.filter(p => p.selected).length

    if (!mounted) return null

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-[#F8FAFC] antialiased"
            style={{ fontFamily: "'Inter', sans-serif" }}
        >
            <div className="flex flex-col max-h-[90vh] w-full max-w-[896px] rounded-[24px] bg-[#1E293B] shadow-2xl border border-white/[0.08] overflow-hidden">
                {/* Header Container 30963:11535 */}
                <div className="flex flex-col gap-1 p-[24px_24px_24px_24px] border-b border-white/[0.08]">
                    {/* Header Row */}
                    <div className="flex items-center gap-[10px]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2L12.5 8.5L19 11L12.5 13.5L10 20L7.5 13.5L1 11L7.5 8.5L10 2Z" stroke="#2DD4BF" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M19 2L20.25 5.25L23.5 6.5L20.25 7.75L19 11L17.75 7.75L14.5 6.5L17.75 5.25L19 2Z" fill="#FBBF24"/>
                        </svg>
                        <h2 className="text-[20px] font-bold text-[#F8FAFC]">
                            Confirm Create Products (AI Preview)
                        </h2>
                    </div>
                    {/* Description */}
                    <p className="text-[14px] text-[#F8FAFC]/60">
                        Review and edit before saving
                    </p>
                </div>

                {/* Body Container 30963:11547 */}
                <div className="flex-1 overflow-y-auto px-[24px] pt-[24px] pb-6 flex flex-col">
                    {isParsing ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
                            <p className="text-[#F8FAFC]/60 text-[14px] font-medium">Bí thuật AI đang hoạt động...</p>
                        </div>
                    ) : (
                        <>
                            {/* Table Container 30963:11548 */}
                            <div className="rounded-2xl bg-[#0B1120]/30 overflow-hidden shrink-0">
                                <table className="w-full text-left border-collapse table-fixed">
                                    {/* Table Header 30963:11550 */}
                                    <thead className="bg-[#0B1120]/60 h-[48px]">
                                        <tr>
                                            <th className="w-[48px] align-middle text-center pl-2">
                                                <input
                                                    type="checkbox"
                                                    checked={products.length > 0 && products.every(p => p.selected)}
                                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                                    className="w-[14px] h-[14px] rounded-[3px] bg-[#1E293B] border-white/20 text-blue-500 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </th>
                                            <th className="align-middle text-[11px] font-bold text-[#F8FAFC]/60 w-[110px] md:w-[322px] px-2 tracking-wider">NAME</th>
                                            <th className="align-middle text-[11px] font-bold text-[#F8FAFC]/60 w-[90px] md:w-[322px] px-2 tracking-wider">PRICE</th>
                                            <th className="align-middle text-[11px] font-bold text-[#F8FAFC]/60 w-[70px] md:w-auto px-2 tracking-wider">VARIANTS</th>
                                        </tr>
                                    </thead>
                                    {/* Table Body 30963:11560 */}
                                    <tbody>
                                        {products.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="h-[62px] text-center text-[#F8FAFC]/60 text-[14px]">
                                                    Danh sách sản phẩm trống.
                                                </td>
                                            </tr>
                                        ) : products.map((p) => {
                                            // Calculate approximate lines for textarea auto-sizing (assuming ~15 chars per line on mobile 110px width)
                                            const nameLines = Math.max(1, Math.ceil((p.name.length || 1) / 14));
                                            
                                            return (
                                                <tr key={p._id} className="h-[64px] border-t border-white/[0.04]">
                                                    <td className="w-[48px] align-middle text-center pl-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={p.selected}
                                                            onChange={(e) => updateProduct(p._id!, 'selected', e.target.checked)}
                                                            className="w-[14px] h-[14px] rounded-[3px] bg-[#1E293B] border-white/20 text-blue-500 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="align-middle px-2 py-3">
                                                        <textarea
                                                            value={p.name}
                                                            onChange={(e) => updateProduct(p._id!, 'name', e.target.value)}
                                                            rows={nameLines}
                                                            className="w-[calc(100%-4px)] md:w-full min-h-[36px] bg-[#1E293B] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] md:text-[14px] text-[#F8FAFC] placeholder-gray-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors resize-none overflow-hidden"
                                                            style={{ height: `${Math.max(36, nameLines * 20 + 16)}px` }}
                                                        />
                                                    </td>
                                                    <td className="align-middle px-2">
                                                        <input
                                                            type="number"
                                                            value={p.price}
                                                            onChange={(e) => updateProduct(p._id!, 'price', parseFloat(e.target.value) || 0)}
                                                            className="w-[calc(100%-4px)] md:w-full h-[36px] bg-[#1E293B] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] md:text-[14px] text-[#F8FAFC] placeholder-gray-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors"
                                                        />
                                                    </td>
                                                    <td className="align-middle px-2">
                                                        <div className="text-[12px] md:text-[14px] text-[#F8FAFC]/70 max-w-[60px] md:max-w-full truncate break-words whitespace-normal leading-tight">
                                                            {p.variants?.length ? p.variants.map(v => v.name).join(', ') : 'Mặc định'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Note Container 30963:11573 */}
                            {products.length > 0 && (
                                <div className="rounded-2xl bg-teal-400/5 border border-teal-400/20 p-4 mt-6 shrink-0">
                                    <p className="text-[14px] leading-snug">
                                        <span className="font-bold text-[#2DD4BF]">Note: </span>
                                        <span className="text-[#F8FAFC]/60">Products will be saved as Draft</span>
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Container 30963:11576 */}
                <div className="flex w-full gap-[12px] p-[24px_24px_24px_24px] border-t border-white/[0.08]">
                    <button 
                        onClick={onClose}
                        className="flex-1 h-[50px] rounded-2xl bg-transparent border border-white/[0.08] text-[16px] font-medium text-[#F8FAFC] hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isParsing || selectedCount === 0}
                        className="flex-1 h-[50px] rounded-2xl bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] text-[16px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save {selectedCount} Products
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
