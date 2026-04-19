'use client'

/**
 * block-card.tsx
 * Single block card in the catalog grid.
 * Shows icon, EN/VI name, variant count, usage stat, hidden badge.
 */
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export type BlockCardData = {
    slug: string
    name: string
    nameVi: string
    description: string
    icon: string
    category: string
    variants: string[]
    usageCount: number
    hiddenFromCatalog: boolean
    curatedPreviewUrl: string | null
}

type Props = {
    block: BlockCardData
}

export function BlockCard({ block }: Props) {
    return (
        <Link
            href={`/studio/blocks/${block.slug}`}
            className="group relative flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10 hover:border-white/20"
        >
            {/* Hidden badge */}
            {block.hiddenFromCatalog && (
                <Badge
                    variant="secondary"
                    className="absolute right-3 top-3 text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                >
                    Hidden
                </Badge>
            )}

            {/* Icon */}
            <span className="text-3xl leading-none" aria-hidden>
                {block.icon}
            </span>

            {/* Names */}
            <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-white leading-tight">
                    {block.nameVi}
                </span>
                <span className="text-xs text-white/50">{block.name}</span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-auto pt-2 border-t border-white/10">
                <span className="text-xs text-white/50">
                    {block.variants.length} variant{block.variants.length !== 1 ? 's' : ''}
                </span>
                {block.usageCount > 0 && (
                    <span className="text-xs text-emerald-400 ml-auto">
                        {block.usageCount} template{block.usageCount !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </Link>
    )
}
