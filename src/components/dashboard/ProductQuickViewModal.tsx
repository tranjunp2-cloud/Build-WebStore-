'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X, Trash2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

// We extend the Product type locally as page.tsx might not have all fields typed
type Category = {
    id: string
    name: string
    breadcrumbs?: string
}

type Variant = {
    id?: string
    name: string
    sku?: string
    price: number
    compareAtPrice?: number
    stock: number
}

type ProductImage = {
    url?: string
    thumbnailURL?: string
}

export type DetailedProduct = {
    id: string
    name: string
    slug: string
    sku?: string
    shortDescription?: string
    description?: any // RichText
    price: number
    compareAtPrice?: number
    currency: string
    status: 'draft' | 'active' | 'archived'
    inventory: number
    weight?: number
    category?: (Category | string)[]
    images?: Array<{ image: ProductImage | string | null; alt?: string }>
    variants?: Variant[]
    hasVariants?: boolean
}

interface ProductQuickViewModalProps {
    isOpen: boolean
    onClose: () => void
    product: DetailedProduct | null
    onDelete: (product: DetailedProduct) => void
}

function getImageUrl(image: ProductImage | string | null): string | null {
    if (!image || typeof image === 'string') return null
    return image.url || image.thumbnailURL || null
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

export function ProductQuickViewModal({ isOpen, onClose, product, onDelete }: ProductQuickViewModalProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [selectedImageIdx, setSelectedImageIdx] = useState(0)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen) {
            setSelectedImageIdx(0)
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen, product])

    if (!mounted || !isOpen || !product) return null

    // Process Images
    const images = product.images?.map(img => getImageUrl(img.image)).filter(Boolean) as string[] || []
    const displayImages = images.length > 0 ? images : ['/images/placeholder.webp'] // Fallback if no images

    // Process Categories (Assuming populated)
    const categoryNames = product.category?.map(c => typeof c === 'object' ? c.name : 'Unknown').join(' / ') || 'Uncategorized'

    // Pricing
    const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price
    const discountPercent = hasDiscount ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100) : 0

    // Stock Level
    const totalStock = product.hasVariants && product.variants ? product.variants.reduce((acc, v) => acc + (v.stock || 0), 0) : (product.inventory || 0)
    const stockStatus = totalStock > 10 ? 'Healthy' : totalStock > 0 ? 'Low Stock' : 'Out of Stock'
    const stockColor = totalStock > 10 ? 'text-[#05DF72]' : totalStock > 0 ? 'text-amber-400' : 'text-red-400'
    const stockBg = totalStock > 10 ? 'bg-[#05DF72]/10' : totalStock > 0 ? 'bg-amber-400/10' : 'bg-red-400/10'

    // Description extracting raw text from Payload RichText if available
    let descText = product.shortDescription || ''
    if (!descText && product.description?.root) {
        // Simple extraction just to show something
        try {
            descText = product.description.root.children.map((c: any) => c.children?.map((tc: any) => tc.text).join(' ')).join('\n')
        } catch(e) {}
    }

    return createPortal(
        <div className="hidden md:flex fixed inset-0 z-[9999] justify-end bg-[#0B0E14]/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div 
                className="relative flex flex-col md:flex-row w-full max-w-[960px] h-full bg-[#191C22] shadow-[-25px_0_50px_-12px_rgba(0,0,0,0.5)] border-l border-white/[0.05] animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button - absolute to the drawer itself */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Column 1: Visuals & Core Status (Node 30928:3970) */}
                <div className="flex flex-col w-full md:w-[480px] shrink-0 bg-[#0B0E14] border-r border-white/5 h-full overflow-y-auto custom-scrollbar p-[32px] gap-[24px]">
                    
                    {/* Main Image */}
                    <div className="flex flex-col bg-[#1D2026] rounded-[8px] w-full aspect-square shrink-0 overflow-hidden relative border border-white/5">
                        <Image 
                            src={displayImages[selectedImageIdx] || '/images/figma/quick-view-main.png'}
                            alt={product.name || "Main product"} 
                            fill
                            className="object-cover"
                        />
                    </div>

                    {/* Thumbnails */}
                    {displayImages.length > 1 && (
                        <div className="grid grid-cols-3 gap-[16px]">
                            {displayImages.slice(0, 3).map((imgUrl, idx) => (
                                <button key={idx} onClick={() => setSelectedImageIdx(idx)} className={`relative w-full aspect-square rounded-[4px] overflow-hidden ${selectedImageIdx === idx ? 'border-2 border-[#44DDC1]' : 'opacity-60 hover:opacity-100 transition-opacity bg-[#1D2026] border border-white/5'}`}>
                                    <Image src={imgUrl} alt={`Thumb ${idx + 1}`} fill className="object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Stock Level Section */}
                    <div className="mt-auto pt-[40px] flex flex-col justify-end h-full min-h-[147px]">
                        <div className="flex flex-col gap-[8px] p-[20px] bg-[#1D2026] border border-white/[0.05] rounded-[8px]">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-[12px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">Stock Level</span>
                                <div className="flex items-center gap-[8px]">
                                    <div className="w-[8px] h-[8px] rounded-[12px] bg-[#44DDC1]" />
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.05em] ${stockColor}`}>{stockStatus}</span>
                                </div>
                            </div>
                            <div className="pb-[8px]">
                                <p className="font-sans text-[24px] font-black text-[#E1E2EB] tracking-[-0.05em]">Current Stock: {totalStock}</p>
                            </div>
                            <div className="h-[6px] w-full bg-[#10131A] rounded-[12px] overflow-hidden">
                                <div className={`h-full rounded-[12px] transition-all duration-500 ${stockColor.replace('text-', 'bg-')}`} style={{ width: `${Math.min(100, Math.max(5, (totalStock / 50) * 100))}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Details & Actions */}
                <div className="flex flex-col flex-1 h-full bg-[#191C22] p-[48px] justify-between">
                    <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
                        {/* Header Details (Node 30928:3994) */}
                        <div className="flex flex-col pb-[32px]">
                            <div className="flex flex-col gap-[4px]">
                                <span className="text-[10px] font-black text-[#44DDC1] uppercase tracking-[0.2em]">Product Details</span>
                                <h2 className="font-sans text-[30px] font-black text-[#E1E2EB] leading-[1.2] tracking-[-0.05em] uppercase">
                                    {product.name}
                                </h2>
                            </div>
                        </div>

                        {/* Metadata Grid (Node 30928:4004) */}
                        <div className="flex flex-col pb-[40px]">
                            <div className="flex flex-col pb-[32px] border-b border-[#414754]/10">
                                <div className="grid grid-cols-2 gap-y-[24px] gap-x-[16px]">
                                    <div className="flex flex-col gap-[4px]">
                                        <span className="text-[10px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">SKU Identification</span>
                                        <span className="text-[14px] text-[#ADC7FF]">{product.sku || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-[4px]">
                                        <span className="text-[10px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">Tax Configuration</span>
                                        <span className="text-[14px] font-medium text-[#E1E2EB]">Taxes: SST (6%) Incl.</span>
                                    </div>
                                    <div className="flex flex-col gap-[4px] col-span-2">
                                        <span className="text-[10px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">Category Path</span>
                                        <div className="flex items-center gap-[8px] text-[14px] font-medium">
                                            <span className="text-[#E1E2EB]">{categoryNames || 'Uncategorized'}</span>
                                            {/* Note: In a real multi-level category, you would map this. Hardcoded / separated as per Figma */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pricing Configuration (Node 30928:4023) */}
                        <div className="flex flex-col pb-[40px]">
                            <div className="flex flex-col pb-[32px] gap-[8px] border-b border-[#414754]/10">
                                <span className="text-[10px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">Pricing</span>
                                <div className="flex items-end gap-[16px]">
                                    <span className="text-[36px] font-[900] text-[#E1E2EB] leading-[1.11]">
                                        {formatPrice(product.price, product.currency)}
                                    </span>
                                    {hasDiscount && (
                                        <>
                                            <span className="text-[20px] font-normal text-[#C1C6D7]/40 line-through leading-[1.4] mb-[2px]">
                                                {formatPrice(product.compareAtPrice!, product.currency)}
                                            </span>
                                            <div className="flex items-center justify-center px-[8px] py-[2px] bg-[#FFB695]/10 rounded-[2px] mb-[6px]">
                                                <span className="text-[10px] font-bold text-[#FFB695] uppercase">
                                                    {discountPercent}% OFF
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Inventory Variants (Node 30928:4032) */}
                        {product.hasVariants && product.variants && product.variants.length > 0 && (
                            <div className="flex flex-col pb-[40px]">
                                <div className="flex flex-col pb-[32px] gap-[16px] border-b border-[#414754]/10">
                                    <span className="text-[10px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">Inventory Variants</span>
                                    <div className="flex flex-col gap-[12px]">
                                        {product.variants.map((v, idx) => (
                                            <div key={idx} className="flex items-center justify-between px-[16px] py-[12px] rounded-[8px] bg-[#1D2026] border border-white/5">
                                                <div className="flex items-center gap-[8px]">
                                                    <div className="w-[8px] h-[8px] rounded-full bg-[#44DDC1]" />
                                                    <span className="text-[14px] font-medium text-[#E1E2EB]">{v.name}</span>
                                                </div>
                                                <div className="flex items-center justify-center px-[8px] py-[4px] bg-white/5 rounded-[4px]">
                                                    <span className="text-[12px] font-medium text-[#C1C6D7]">
                                                        Stock: {v.stock}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description (Node 30928:4051) */}
                        {descText && (
                            <div className="flex flex-col pb-[48px]">
                                <div className="flex flex-col gap-[11px]">
                                    <span className="text-[10px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em]">Description</span>
                                    <p className="font-sans text-[14px] leading-[1.625] text-[#C1C6D7] whitespace-pre-wrap">
                                        {descText}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Node 30928:4057) */}
                    <div className="mt-auto pt-[24px] border-t border-[#414754]/10 flex justify-between items-center shrink-0">
                        <button 
                            onClick={() => {
                                if (confirm('Are you certain?')) {
                                    onDelete(product)
                                    onClose()
                                }
                            }}
                            className="flex items-center justify-center gap-[8px] px-[16px] py-[8px] rounded-[4px] uppercase tracking-[0.1em] hover:opacity-80 transition-opacity"
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#FFB4AB',
                                fontSize: '12px',
                                fontWeight: 700 
                            }}
                        >
                            <Trash2 className="w-[14px] h-[14px]" />
                            DELETE PRODUCT
                        </button>
                        <button 
                            onClick={() => {
                                router.push(`/products/${product.id}`)
                                onClose()
                            }}
                            className="flex items-center justify-center gap-[8px] px-[32px] py-[12px] rounded-[4px] uppercase tracking-[0.1em] hover:opacity-90 transition-opacity"
                            style={{ 
                                backgroundColor: '#4A8EFF', 
                                border: 'none', 
                                color: '#00285B', 
                                fontSize: '12px', 
                                fontWeight: 900,
                                boxShadow: '0 4px 14px 0 rgba(74,142,255,0.39)' 
                            }}
                        >
                            <Pencil className="w-[14px] h-[14px]" />
                            EDIT PRODUCT
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
