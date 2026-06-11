import { useState } from 'react';
import { DetailedProduct } from '../ProductQuickViewModal';
import { ArrowLeft, Package, Trash2, Edit2 } from 'lucide-react';
import Image from 'next/image';
import { ProductImageWithFallback } from '../ProductImageWithFallback';
import { useI18n } from '@/i18n';

interface ProductDetailsMobileProps {
    product: DetailedProduct;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function getImageUrl(image: any): string | null {
    if (!image || typeof image === 'string') return null
    let url = image.url || image.thumbnailURL || null
    if (!url) return null
    
    // Fix existing broken local URLs directly to S3 because MinIO stores them
    if (url.includes('/api/media/file/')) {
        if (process.env.NEXT_PUBLIC_S3_ENDPOINT) {
            const filename = url.split('/').pop()
            url = `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/primeweb-media/${filename}`
        }
    }
    
    return url
}

export function ProductDetailsMobile({ product, onClose, onEdit, onDelete }: ProductDetailsMobileProps) {
    const { t } = useI18n();
    const [activeIdx, setActiveIdx] = useState(0)
    // Process Images
    const displayImages = product.images?.map(img => getImageUrl(img.image)).filter(Boolean) as string[] || [];

    // Description extracting raw text from Payload RichText if available
    let descText = product.shortDescription || ''
    if (!descText && product.description?.root) {
        try {
            descText = product.description.root.children.map((c: any) => c.children?.map((tc: any) => tc?.text || '').join(' ')).join('\n')
        } catch(e) {}
    }
    if (!descText && typeof product.description === 'string') {
        descText = product.description;
    }


    // Helper to calculate total stock if variants exist
    const totalStock = product.hasVariants 
        ? product.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0
        : product.inventory || 0;

    // Helper to get minimum price if variants exist
    const displayPrice = product.hasVariants && product.variants && product.variants.length > 0
        ? Math.min(...product.variants.map(v => Number(v.price) || 0))
        : Number(product.price) || 0;

    const displayComparePrice = product.compareAtPrice 
        ? Number(product.compareAtPrice) 
        : undefined;

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] w-full md:hidden bg-[#0B1120] text-white pt-6 pb-[200px] relative" style={{ fontFamily: "'Inter', sans-serif" }}>
            
            {/* Header */}
            <div className="flex items-center gap-4 px-4 mb-8">
                <button onClick={onClose} className="p-2 -ml-2 rounded-xl shrink-0 transition-opacity hover:opacity-70 bg-transparent border-none appearance-none outline-none">
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
                <h1 className="text-[24px] font-bold text-white uppercase tracking-wider">{t.dashboard?.products?.mobile?.productDetails || 'PRODUCT DETAILS'}</h1>
            </div>

            <div className="flex flex-col gap-6">
                
                {/* Visuals Section (Edge-to-Edge) */}
                <div className="flex flex-col w-full relative mb-2">
                    <div className="relative w-full aspect-[4/5] max-h-[500px] bg-[#1D2026]">
                        <ProductImageWithFallback
                            imgUrl={displayImages[activeIdx] ?? displayImages[0] ?? null}
                            alt={product.name || 'Product Image'}
                            size="lg"
                            sizes="100vw"
                        />
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
                                    <ProductImageWithFallback imgUrl={imgUrl} alt="Thumbnail" size="sm" sizes="64px" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Info Section */}
                <div className="flex flex-col gap-4 px-5">
                    <div className="flex flex-col gap-1">
                        <h2 className="m-0 p-0 text-[24px] font-normal text-[#E1E2EB] leading-[1.25] tracking-[-0.025em]">
                            {product.name || t.dashboard?.products?.mobile?.unnamedProduct || 'Unnamed Product'}
                        </h2>
                        <p className="m-0 p-0 text-[12px] font-normal text-[#C1C6D7] tracking-[0.05em]">
                            SKU: {product.hasVariants ? (t.dashboard?.products?.mobile?.multipleSkus || 'Multiple SKUs') : (product.sku || 'N/A')} | {t.dashboard?.products?.list?.category || 'Category'}: {product.category?.length ? product.category.map(c => typeof c === 'string' ? c : c.name).join(', ') : (t.dashboard?.products?.mobile?.none || 'None')}
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
                    </div>

                    {/* Stock Indicator Card */}
                    <div className="bg-[#191C22] border border-[#414754]/20 rounded-lg p-4 flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-[#C1C6D7]" strokeWidth={1.5} />
                            <div className="flex flex-col">
                                <span className="text-[14px] text-[#E1E2EB] font-medium leading-[1.42]">{t.dashboard?.products?.mobile?.stockLevel || 'Stock Level'}</span>
                                <span className="text-[12px] text-[#C1C6D7] font-normal leading-[1.33]">{t.dashboard?.products?.mobile?.centralWarehouse || 'Central Warehouse'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[20px] font-bold text-[#E1E2EB] leading-[1.4]">{totalStock}</span>
                            <span className="text-[10px] font-bold text-[#44DDC1] uppercase tracking-[-0.05em] leading-[1.5]">{t.dashboard?.products?.mobile?.unitsAvailable || 'Units Available'}</span>
                        </div>
                    </div>

                    {/* Variants List Section */}
                    {product.hasVariants && product.variants && product.variants.length > 0 && (
                        <div className="flex flex-col gap-3 mt-2">
                            <h3 className="m-0 p-0 text-[12px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em] leading-[1.33]">{t.dashboard?.products?.mobile?.productVariants || 'Product Variants'}</h3>
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
                                        <span className="text-[14px] font-normal text-[#C1C6D7] leading-[1.42] font-mono">{t.dashboard?.products?.list?.stock || 'Stock'} {variant.stock}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description Section */}
                    {descText ? (
                        <div className="flex flex-col gap-[7px] mt-2">
                            <h3 className="m-0 p-0 text-[12px] font-bold text-[#C1C6D7] uppercase tracking-[0.1em] leading-[1.33]">{t.dashboard?.products?.mobile?.productFeatures || 'Product Features'}</h3>
                            <div className="m-0 p-0 text-[14px] font-normal text-[#C1C6D7] leading-[1.625] whitespace-pre-wrap">
                                {descText}
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
                        {t.dashboard?.products?.form?.editProduct || 'EDIT PRODUCT'}
                    </button>
                    <button 
                        onClick={() => {
                            onDelete();
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-transparent text-[#FFB4AB] py-2 font-medium text-[12px] leading-[16px] tracking-[0.1em] uppercase hover:bg-white/5 transition-colors rounded-lg border-none appearance-none outline-none"
                    >
                        <Trash2 className="w-[14px] h-[14px]" />
                        {t.dashboard?.products?.form?.delete || 'DELETE PRODUCT'}
                    </button>
                </div>
            </div>
        </div>
    );
}
