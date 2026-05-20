'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ProductImageFallback } from './ProductImageFallback'

interface ProductImageWithFallbackProps {
    imgUrl: string | null
    alt: string
    size: 'sm' | 'md' | 'lg'
    sizes: string
    className?: string
}

export function ProductImageWithFallback({ imgUrl, alt, size, sizes, className = 'object-cover' }: ProductImageWithFallbackProps) {
    const [failed, setFailed] = useState(false)

    // Reset error state when URL changes (e.g. user switches image in gallery)
    useEffect(() => {
        setFailed(false)
    }, [imgUrl])

    if (!imgUrl || failed) {
        return <ProductImageFallback size={size} />
    }

    return (
        <Image
            src={imgUrl}
            alt={alt}
            fill
            className={className}
            sizes={sizes}
            onError={() => setFailed(true)}
        />
    )
}
