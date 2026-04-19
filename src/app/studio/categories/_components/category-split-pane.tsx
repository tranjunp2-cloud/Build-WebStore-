'use client'
/**
 * Category split-pane: left = category list, right = DNA editor.
 */
import { useState } from 'react'
import { DnaEditor } from './dna-editor'
import { DnaCompliancePreview } from './dna-compliance-preview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CategoryDNA } from '@/lib/admin/dna-compliance'

export type CategoryItem = {
    id: string
    name: string
    slug: string
    dna: CategoryDNA | null
}

type Props = {
    categories: CategoryItem[]
}

export function CategorySplitPane({ categories }: Props) {
    const [selected, setSelected] = useState<CategoryItem | null>(
        categories[0] ?? null
    )
    // Local DNA state — updated optimistically on save
    const [localDna, setLocalDna] = useState<Record<string, CategoryDNA | null>>(
        Object.fromEntries(categories.map(c => [c.id, c.dna]))
    )

    const handleSaved = (categoryId: string, dna: CategoryDNA) => {
        setLocalDna(prev => ({ ...prev, [categoryId]: dna }))
        // Keep selected in sync
        if (selected?.id === categoryId) {
            setSelected(prev => prev ? { ...prev, dna } : prev)
        }
    }

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left: category list */}
            <aside className="w-56 border-r flex flex-col overflow-auto flex-shrink-0">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
                    Categories
                </div>
                <ul className="flex-1 overflow-auto py-1">
                    {categories.map((cat) => {
                        const hasDna = Boolean(localDna[cat.id])
                        return (
                            <li key={cat.id}>
                                <button
                                    type="button"
                                    onClick={() => setSelected(cat)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-1 ${
                                        selected?.id === cat.id
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'hover:bg-muted'
                                    }`}
                                >
                                    <span className="truncate">{cat.name}</span>
                                    {hasDna && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="DNA configured" />
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </aside>

            {/* Right: editor + preview */}
            <div className="flex-1 overflow-auto">
                {selected ? (
                    <Tabs defaultValue="editor" className="flex flex-col h-full">
                        <div className="flex items-center gap-4 px-6 pt-4 border-b pb-0">
                            <h2 className="font-semibold text-sm">{selected.name}</h2>
                            <TabsList className="h-8 bg-transparent p-0 gap-1">
                                {(['editor', 'preview'] as const).map(t => (
                                    <TabsTrigger
                                        key={t}
                                        value={t}
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-2 pb-2 text-xs capitalize"
                                    >
                                        {t === 'editor' ? 'DNA Editor' : 'Compliance Preview'}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <TabsContent value="editor" className="flex-1 overflow-auto mt-0">
                            <DnaEditor
                                categoryId={selected.id}
                                categoryName={selected.name}
                                initialDna={localDna[selected.id] ?? undefined}
                                onSaved={(dna) => handleSaved(selected.id, dna)}
                            />
                        </TabsContent>

                        <TabsContent value="preview" className="flex-1 overflow-auto mt-0">
                            <DnaCompliancePreview
                                categoryId={selected.id}
                                dna={localDna[selected.id] ?? null}
                            />
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Select a category to edit its DNA
                    </div>
                )}
            </div>
        </div>
    )
}
