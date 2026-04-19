'use client'
/**
 * PacksGrid — card grid for content packs + create button.
 */
import { useState } from 'react'
import { ImageOff, Plus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PackDetailDrawer } from './pack-detail-drawer'
import { CreatePackModal } from '../../_components/modals/create-pack-modal'
import type { PackDoc } from '../page'

type Props = { initialPacks: PackDoc[] }

export function PacksGrid({ initialPacks }: Props) {
    const [packs, setPacks] = useState<PackDoc[]>(initialPacks)
    const [selected, setSelected] = useState<PackDoc | null>(null)
    const [showCreate, setShowCreate] = useState(false)

    const handleCreated = async () => {
        setShowCreate(false)
        // Refetch packs
        try {
            const res = await fetch('/api/admin/packs?limit=100')
            const d = await res.json()
            setPacks(d.data ?? [])
        } catch { /* non-fatal */ }
    }

    const handleUpdated = (updated: PackDoc) => {
        setPacks(prev => prev.map(p => p.id === updated.id ? updated : p))
        setSelected(updated)
    }

    const handleDeleted = (id: string) => {
        setPacks(prev => prev.filter(p => p.id !== id))
        setSelected(null)
    }

    return (
        <div className="relative h-full">
            <div className="p-6">
                <div className="flex justify-end mb-4">
                    <Button size="sm" onClick={() => setShowCreate(true)}>
                        <Plus size={14} className="mr-1.5" /> New Pack
                    </Button>
                </div>

                {packs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
                        <Layers size={32} className="opacity-30" />
                        <p className="text-sm">No packs yet — create your first content pack.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {packs.map(pack => (
                            <PackCard
                                key={pack.id}
                                pack={pack}
                                onClick={() => setSelected(pack)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {selected && (
                <PackDetailDrawer
                    pack={selected}
                    onClose={() => setSelected(null)}
                    onUpdated={handleUpdated}
                    onDeleted={() => handleDeleted(selected.id)}
                />
            )}

            {showCreate && (
                <CreatePackModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    )
}

function PackCard({ pack, onClick }: { pack: PackDoc; onClick: () => void }) {
    const templateCount = pack.includedTemplates?.length ?? 0
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-lg border bg-card text-left overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {/* Cover */}
            <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                {pack.coverImage?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pack.coverImage.url} alt={pack.name} className="w-full h-full object-cover" />
                ) : (
                    <ImageOff size={20} className="text-muted-foreground opacity-40" />
                )}
            </div>
            {/* Info */}
            <div className="p-3 space-y-1">
                <p className="text-sm font-medium truncate">{pack.name}</p>
                {pack.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{pack.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Layers size={11} />
                    <span>{templateCount} template{templateCount !== 1 ? 's' : ''}</span>
                    {pack.category && (
                        <span className="ml-auto bg-muted px-1.5 py-0.5 rounded text-xs">{pack.category}</span>
                    )}
                </div>
            </div>
        </button>
    )
}
