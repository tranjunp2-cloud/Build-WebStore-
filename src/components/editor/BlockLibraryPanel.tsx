'use client'

import { LayoutGrid, Plus } from 'lucide-react'
import { blockRegistry } from '@/blocks/registry'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AIAction, BlockData } from '@/types/editor'

function getBlockInfo(blockType: string) {
    const meta = blockRegistry.getBlockMeta(blockType)
    return {
        label: meta?.name || blockType,
        icon: meta?.icon || '🧩',
    }
}

interface BlockLibraryPanelProps {
    blocks: BlockData[]
    selectedBlock: number | null
    onBlockSelect: (index: number) => void
    onAIAction: (action: AIAction) => Promise<void> | void
}

export function BlockLibraryPanel({
    blocks,
    selectedBlock,
    onBlockSelect,
    onAIAction,
}: BlockLibraryPanelProps) {
    const allBlockTypes = blockRegistry.getAllMeta()

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-white">Component Library</p>
                        <p className="mt-1 text-xs text-gray-500">
                            Add reusable sections and inspect blocks already on the page.
                        </p>
                    </div>
                    <LayoutGrid className="h-4 w-4 text-blue-400" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-4">
                {allBlockTypes.map(meta => (
                    <button
                        key={meta.type}
                        type="button"
                        onClick={() => {
                            const afterIndex = selectedBlock ?? (blocks.length - 1)
                            void onAIAction({
                                action: 'add_block',
                                afterIndex,
                                block: { blockType: meta.type, variant: meta.variants[0] },
                            })
                        }}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/10"
                    >
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                            <span>{meta.icon}</span>
                            <span className="truncate">{meta.name}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Add a ready-made {meta.name.toLowerCase()} block.
                        </p>
                    </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                            Current Blocks
                        </p>
                        <p className="mt-1 text-xs text-gray-600">{blocks.length} blocks on this page</p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                            const defaultMeta = allBlockTypes[0]
                            const afterIndex = selectedBlock ?? (blocks.length - 1)

                            if (!defaultMeta) return

                            void onAIAction({
                                action: 'add_block',
                                afterIndex,
                                block: { blockType: defaultMeta.type, variant: defaultMeta.variants[0] },
                            })
                        }}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Quick Add
                    </Button>
                </div>

                <div className="space-y-2">
                    {blocks.map((block, index) => {
                        const info = getBlockInfo(block.blockType)
                        const isSelected = selectedBlock === index

                        return (
                            <button
                                key={`${block.blockType}-${index}`}
                                type="button"
                                onClick={() => onBlockSelect(index)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                                    isSelected
                                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-100'
                                        : 'border-white/10 bg-white/5 text-gray-200 hover:border-white/20 hover:bg-white/10',
                                )}
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-base">
                                    {info.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{info.label}</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Block #{index + 1}
                                        {block.variant ? ` • ${String(block.variant)}` : ''}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
