import React from 'react'
import { Package } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ProductImageFallbackProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

export function ProductImageFallback({ className, size = 'md' }: ProductImageFallbackProps) {
    const iconSizes = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    }

    return (
        <div
            className={cn(
                'flex h-full w-full items-center justify-center bg-muted/30 transition-colors',
                className
            )}
        >
            <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Package className={cn('text-muted-foreground', iconSizes[size])} strokeWidth={1.5} />
            </div>
        </div>
    )
}
