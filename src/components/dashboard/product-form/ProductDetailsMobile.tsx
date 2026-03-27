import React, { useState } from 'react';
import { DetailedProduct } from '../ProductQuickViewModal';
import { ArrowLeft, Package, Trash2, Edit2 } from 'lucide-react';
import Image from 'next/image';

interface ProductDetailsMobileProps {
    product: DetailedProduct;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function getImageUrl(image: any): string | null {
    if (!image || typeof image === 'string') return null
    const url = image.url || image.thumbnailURL || null
    if (!url) return null
    try {
        return new URL(url, 'http://localhost').pathname
    } catch {
        return url
    }
}

export function ProductDetailsMobile({ product, onClose, onEdit, onDelete }: ProductDetailsMobileProps) {
    const [activeIdx, setActiveIdx] = useState(0)
    // Process Images
    const displayImages = product.images?.map(img => getImageUrl(img.image)).filter(Boolean) as string[] || [];

    // Helper to calculate total stock if variants exist
    const totalStock = product.hasVariants 
        ? product.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0
        : product.inventory || 0;

    // Helper to get minimum price if variants exist
    const displayPrice = product.hasVariants && product.variants && product.variants.length > 0
        ? Math.min(...product.variants.map(v => Number(v.price) || 0))
        : Number(product.price) || 0;

    const displayComparePrice = !product.hasVariants && product.compareAtPrice 
        ? Number(product.compareAtPrice) 
        : undefined;

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] w-full md:hidden bg-[#0B1120] text-white pt-6 pb-[200px] relative" style={{ fontFamily: "'Inter', sans-serif" }}>
            
            {/* Header */}
            <div className="flex items-center gap-4 px-4 mb-8">
                <button onClick={onClose} className="p-2 -ml-2 rounded-xl shrink-0 transition-opacity hover:opacity-70 bg-transparent border-none appearance-none outline-none">
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
                <h1 className="text-[24px] font-bold text-white uppercase tracking-wider">PRODUCT DETAILS</h1>
            </div>

            <div className="flex flex-col gap-6">
                
                {/* Visuals Section (Edge-to-Edge) */}
                <div className="flex flex-col w-full relative mb-2">
                    <div className="relative w-full aspect-[4/5] max-h-[500px] bg-[#1D2026]">
                        {displayImages.length > 0 ? (
                            <Image 
                                src={displayImages[activeIdx] || displayImages[0]} 
                                alt={product.name || 'Product Image'}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-50 border-y border-white/10">
                                <Package className="w-12 h-12 text-white" />
                                <span className="text-sm">No Image</span>
                            </div>
                        )}
                    </div>
                    {/* Thumbnails Overlay */}
                    {displayImages.length > 1 && (
                        <div className="relative flex items-center gap-2 overflow-x-auto px-4 scrollbar-none z-10 -mt-10 pb-2">
                            {displayImages.map((imgUrl, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setActiveIdx(idx)}
                                    className={`w-16 h-16 shrink-0 rounded overflow-hidden relative transition-all shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] bg-[#10131A] ${
                                        activeIdx === idx 
                                            ? 'border-2 border-[#ADC7FF]' 
                                            : 'border-2 border-transparent'
                                    }`}
                                >
                                    <Image src={imgUrl} alt="Thumbnail" fill className="object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Info Section */}
                <div className="flex flex-col gap-4 px-5">
                    <div className="flex flex-col gap-1">
                        <h2 className="m-0 p-0 text-[24px] font-normal text-[#E1E2EB] leading-[1.25] tracking-[-0.025em]">
                            {product.name || 'Unnamed Product'}
                        </h2>
                        <p className="m-0 p-0 text-[12px] font-normal text-[#C1C6D7] tracking-[0.05em]">
                            SKU: {product.hasVariants ? 'Multiple SKUs' : (product.sku || 'N/A')} | Category: {product.category?.length ? product.category.map(c => typeof c === 'string' ? c : c.name).join(', ') : 'None'}
                        </p>
                    </div>

                    {/* Price Module */}
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex flex-col">
                            <span className="text-[30px] font-bold text-[#E1E2EB] leading-[1.2]">RM</span>
                            <span className="text-[30px] font-bold text-[#E1E2EB] leading-[1.2]">{displayPrice.toFixed(2)}</span>
                        </div>
                        {displayComparePrice ? (
                            <div className="flex flex-col opacity-50 line-through">
                                <span className="text-[18px] text-[#C1C6D7] leading-[1.55]">RM</span>
                                <span className="text-[18px] text-[#C1C6D7] leading-[1.55]">{displayComparePrice.toFixed(2)}</span>
                            </div>
                        ) : null}
                        <div className="ml-auto bg-[#1D2026] rounded-[2px] py-1 pl-2 pr-4 text-[10px] text-[#C1C6D7] uppercase tracking-[0.1em] leading-[1.5]">
                            Taxes: SST (6%)<br />Incl.
                        </div>
                    </div>

                    {/* Stock Indicator Card */}
                    <div className="bg-[#191C22] border border-[#414754]/20 rounded-lg p-4 flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-[#C1C6D7]" strokeWidth={1.5} />
                            <div className="flex flex-col">
                                <span className="text-[14px] text-[#E1E2EB] font-medium leading-[1.42]">Stock Level</span>
                                <span className="text-[12px] text-[#C1C6D7] font-normal leading-[1.33]">Central Warehouse</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[20px] font-bold text-[#E1E2EB] leading-[1.4]">{totalStock}</span>
                            <span className="text-[10px] font-bold text-[#44DDC1] uppercase tracking-[-0.05em] leading-[1.5]">Units Available</span>
                        </div>
                    </div>

                    {/* Variants List Section */}
                    {product.hasVariants && product.variants && product.variants.length > 0 && (
                        <div className="flex flex-col gap-3 mt-2">
                            <h3 className="m-0 p-0 text-[12px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em] leading-[1.33]">Product Variants</h3>
                            <div className="flex flex-col gap-2">
                                {product.variants.map((variant, idx) => (
                                    <div key={variant.id || idx} className="bg-[#272A31]/50 rounded p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Swatch placeholder matching Figma layout_YFHICY exactly */}
                                            <div 
                                                className="w-4 h-4 shrink-0 rounded-[12px] shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)]" 
                                                style={{ 
                                                    backgroundColor: variant.name.toLowerCase().includes('blue') ? '#2563EB' : 
                                                                     variant.name.toLowerCase().includes('red') ? '#DC2626' : 
                                                                     variant.name.toLowerCase().includes('green') ? '#16A34A' : 
                                                                     variant.name.toLowerCase().includes('black') ? '#171717' : 
                                                                     variant.name.toLowerCase().includes('white') ? '#FAFAFA' : 
                                                                     '#3F3F46' 
                                                }}
                                            />
                                            <span className="text-[14px] font-medium text-[#E1E2EB] leading-[1.42]">
                                                {(() => {
                                                    const formatted = variant.name.replace(/\s*-\s*/g, ' | ');
                                                    const parts = formatted.split(' | ');
                                                    if (parts.length > 1) {
                                                        const last = parts[parts.length - 1].trim();
                                                        if (/^(S|M|L|XL|XXL|[0-9]{2})$/i.test(last) && !/^size/i.test(last)) {
                                                            parts[parts.length - 1] = `Size ${last.toUpperCase()}`;
                                                        }
                                                    }
                                                    return parts.join(' | ');
                                                })()}
                                            </span>
                                        </div>
                                        <span className="text-[14px] font-normal text-[#C1C6D7] leading-[1.42] font-mono">Stock {variant.stock}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description Section */}
                    {product.shortDescription || (product.description && typeof product.description === 'string' ? product.description : '') ? (
                        <div className="flex flex-col gap-3 mt-4">
                            <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">Product Features</h3>
                            <div className="text-sm text-white/80 leading-relaxed bg-[#121827] rounded-xl p-4 border border-white/5 whitespace-pre-wrap">
                                {product.shortDescription || (typeof product.description === 'string' ? product.description : 'Detailed description not available in preview.')}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0B1120]/90 backdrop-blur-md border-t border-white/10 p-4 pb-8 z-50">
                <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={onEdit}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-white py-4 rounded-lg font-bold text-[16px] leading-[24px] hover:opacity-90 transition-opacity shadow-[0px_4px_6px_-4px_rgba(68,221,193,0.1),0px_10px_15px_-3px_rgba(68,221,193,0.1)] border-none appearance-none outline-none"
                    >
                        <Edit2 className="w-5 h-5" />
                        EDIT PRODUCT
                    </button>
                    <button 
                        onClick={onDelete}
                        className="w-full flex items-center justify-center gap-2 bg-transparent text-[#FFB4AB] py-2 font-medium text-[12px] leading-[16px] tracking-[0.1em] uppercase hover:bg-white/5 transition-colors rounded-lg border-none appearance-none outline-none"
                    >
                        <Trash2 className="w-[14px] h-[14px]" />
                        DELETE PRODUCT
                    </button>
                </div>
            </div>
        </div>
    );
}
