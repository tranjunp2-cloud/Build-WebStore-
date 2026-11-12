'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { buildProductAlt } from '@/lib/products/build-product-alt'

type GalleryImage = { image?: { url: string }; alt?: string }

interface ProductImageGalleryProps {
    images: GalleryImage[]
    productName: string
    siteName?: string
    primaryColor: string
}

// transform: translateY(-50%) lives in .gallery-nav-btn CSS class so the :hover override can work
const navBtnStyle: CSSProperties = {
    position: 'absolute', top: '50%',
    zIndex: 10, width: '32px', height: '32px', borderRadius: '50%',
    background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', padding: 0,
}

export function ProductImageGallery({ images, productName, siteName, primaryColor }: ProductImageGalleryProps) {
    const displayCount = images.length
    const [selectedIdx, setSelectedIdx] = useState(0)
    const current = images[selectedIdx]
    const handlePrev = () => setSelectedIdx(i => (i - 1 + displayCount) % displayCount)
    const handleNext = () => setSelectedIdx(i => (i + 1) % displayCount)

    return (
        <div>
            {/* Main image — relative wrapper so nav buttons overlay without being clipped */}
            <div style={{ position: 'relative' }}>
                <div style={{
                    borderRadius: '16px', overflow: 'hidden', background: 'var(--surface, #f8f8f8)',
                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {current?.image?.url ? (
                        <img
                            src={current.image.url}
                            alt={buildProductAlt(current.alt, productName, siteName)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <Package size={80} aria-hidden style={{ opacity: 0.15 }} />
                    )}
                </div>
                {images.length > 1 && (
                    <>
                        <button type="button" onClick={handlePrev} aria-label="Previous image"
                            className="gallery-nav-btn" style={{ ...navBtnStyle, left: '8px' }}>
                            <ChevronLeft size={16} />
                        </button>
                        <button type="button" onClick={handleNext} aria-label="Next image"
                            className="gallery-nav-btn" style={{ ...navBtnStyle, right: '8px' }}>
                            <ChevronRight size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* Thumbnail strip — only shown when product has multiple images */}
            {images.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {images.map((img, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedIdx(i)}
                            aria-label={`View image ${i + 1}`}
                            aria-selected={i === selectedIdx}
                            style={{
                                width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden',
                                border: i === selectedIdx
                                    ? `2px solid ${primaryColor}`
                                    : '1px solid rgba(var(--brand-primary-rgb), 0.125)',
                                padding: 0, background: 'none', cursor: 'pointer',
                                opacity: i === selectedIdx ? 1 : 0.65,
                                transition: 'opacity 0.15s, border-color 0.15s',
                                flexShrink: 0,
                            }}
                        >
                            {img.image?.url && (
                                // No index suffix here (unlike the pre-GH-1458 fallback name) — the
                                // parent <button> already carries aria-label={`View image ${i+1}`},
                                // and appending it to buildProductAlt()'s result would corrupt a
                                // real merchant-authored alt (e.g. "Front view" -> "Front view 2").
                                <img
                                    src={img.image.url}
                                    alt={buildProductAlt(img.alt, productName, siteName)}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
