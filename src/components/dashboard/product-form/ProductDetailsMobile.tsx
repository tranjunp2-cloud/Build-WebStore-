import React from 'react';
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
    if (!image || typeof image === 'string') return null;
    return image.url || image.thumbnailURL || null;
}

export function ProductDetailsMobile({ product, onClose, onEdit, onDelete }: ProductDetailsMobileProps) {
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
        <div className="flex flex-col min-h-[calc(100vh-80px)] w-full md:hidden bg-[#0B1120] text-white pt-6 pb-[200px] relative">
            
            {/* Header */}
            <div className="flex items-center gap-4 px-4 mb-8">
                <button onClick={onClose} className="p-2 -ml-2 rounded-xl shrink-0 transition-opacity hover:opacity-70 bg-transparent border-none appearance-none outline-none">
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
                <h1 className="text-[24px] font-bold text-white uppercase tracking-wider">PRODUCT DETAILS</h1>
            </div>

            <div className="flex flex-col gap-6 px-4">
                
                {/* Visuals Section */}
                <div className="flex flex-col gap-2">
                    <div className="w-full h-[350px] bg-[#1D2026] rounded-2xl overflow-hidden relative border border-white/10 flex items-center justify-center">
                        {displayImages.length > 0 ? (
                            <Image 
                                src={displayImages[0]} 
                                alt={product.name || 'Product Image'}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 opacity-50">
                                <Package className="w-12 h-12 text-white" />
                                <span className="text-sm">No Image</span>
                            </div>
                        )}
                    </div>
                    {/* Thumbnails */}
                    {displayImages.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                            {displayImages.map((imgUrl, idx) => (
                                <div key={idx} className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden relative border ${idx === 0 ? 'border-[#ADC7FF]' : 'border-transparent'} shadow-md`}>
                                    <Image src={imgUrl} alt="Thumbnail" fill className="object-cover" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Info Section */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-[20px] font-semibold text-white leading-tight">
                            {product.name || 'Unnamed Product'}
                        </h2>
                        <p className="text-[12px] text-[#94A3B8]">
                            SKU: {product.hasVariants ? 'Multiple SKUs' : (product.sku || 'N/A')} | Category: {product.category?.length ? product.category.map(c => typeof c === 'string' ? c : c.name).join(', ') : 'None'}
                        </p>
                    </div>

                    {/* Price Module */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-end gap-1">
                            <span className="text-sm text-white/70 mb-1">RM</span>
                            <span className="text-[32px] font-bold text-white leading-none">
                                {displayPrice.toFixed(2)}
                            </span>
                        </div>
                        {displayComparePrice ? (
                            <div className="flex items-end gap-1 opacity-50 line-through">
                                <span className="text-xs mb-1">RM</span>
                                <span className="text-xl font-medium">{displayComparePrice.toFixed(2)}</span>
                            </div>
                        ) : null}
                        <div className="ml-auto bg-[#1D2026] px-3 py-1.5 rounded text-[11px] text-[#94A3B8] whitespace-nowrap">
                            Taxes: SST (6%)<br />Incl.
                        </div>
                    </div>

                    {/* Stock Indicator Card */}
                    <div className="bg-[#121827] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center shrink-0">
                                <Package className="w-5 h-5 text-[#38BDF8]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm text-white font-medium">Stock Level</span>
                                <span className="text-xs text-[#94A3B8]">Central Warehouse</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xl font-bold text-white">{totalStock}</span>
                            <span className="text-[10px] text-green-400">Units Available</span>
                        </div>
                    </div>
                </div>

                {/* Variants List Section */}
                {product.hasVariants && product.variants && product.variants.length > 0 && (
                    <div className="flex flex-col gap-4 mt-2">
                        <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">Product Variants</h3>
                        <div className="flex flex-col gap-2">
                            {product.variants.map((variant, idx) => (
                                <div key={variant.id || idx} className="bg-white/5 rounded-xl p-4 flex items-center justify-between border border-white/5">
                                    <span className="text-sm font-medium text-white">{variant.name}</span>
                                    <span className="text-xs text-[#94A3B8] bg-white/10 px-2 py-1 rounded-md">Stock {variant.stock}</span>
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
