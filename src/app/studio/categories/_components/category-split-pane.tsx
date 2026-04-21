'use client'
/**
 * Category split-pane: left = category list (280px), right = DNA editor.
 * Matches CategoriesPage layout from bundle pages.jsx.
 * Persists selected category across page refreshes via sessionStorage (Phase 05 polish).
 */
import { useEffect, useState } from 'react'
import { DnaEditor } from './dna-editor'
import { DnaCompliancePreview } from './dna-compliance-preview'
import type { CategoryDNA } from '@/lib/admin/dna-compliance'

const SESSION_KEY = 'pw_studio_category_selected'

export type CategoryItem = {
    id: string
    name: string
    slug: string
    dna: CategoryDNA | null
}

type Props = {
    categories: CategoryItem[]
}

type ActiveTab = 'editor' | 'preview'

/** Read persisted category id from sessionStorage; fall back to first item. */
function getInitialSelected(categories: CategoryItem[]): string {
    if (categories.length === 0) return ''
    try {
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored && categories.some((c) => c.id === stored)) return stored
    } catch {
        // SSR or private-mode — ignore
    }
    return categories[0].id
}

export function CategorySplitPane({ categories }: Props) {
    const [selectedId, setSelectedId] = useState<string>(() => getInitialSelected(categories))
    const [activeTab, setActiveTab] = useState<ActiveTab>('editor')

    // Persist selected category to sessionStorage on change
    useEffect(() => {
        if (!selectedId) return
        try {
            sessionStorage.setItem(SESSION_KEY, selectedId)
        } catch {
            // Ignore write errors in private-mode
        }
    }, [selectedId])

    // Local DNA state — updated optimistically on save
    const [localDna, setLocalDna] = useState<Record<string, CategoryDNA | null>>(
        Object.fromEntries(categories.map((c) => [c.id, c.dna]))
    )

    const selected = categories.find((c) => c.id === selectedId) ?? null

    const handleSaved = (categoryId: string, dna: CategoryDNA) => {
        setLocalDna((prev) => ({ ...prev, [categoryId]: dna }))
    }

    return (
        <div className="cat-split">
            {/* Left: category list */}
            <div className="cat-list-panel">
                {categories.map((cat) => {
                    const hasDna = Boolean(localDna[cat.id])
                    const isActive = selectedId === cat.id
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                                setSelectedId(cat.id)
                                setActiveTab('editor')
                            }}
                            className={`cat-list-item${isActive ? ' active' : ''}`}
                        >
                            <div className={`cat-list-icon${hasDna ? ' has-dna' : ''}`}>
                                {hasDna ? '▣' : '□'}
                            </div>
                            <div className="cat-list-body">
                                <div className="cat-list-name">{cat.name}</div>
                                <div className="cat-list-meta">
                                    {hasDna ? 'DNA defined' : 'no DNA'}
                                </div>
                            </div>
                            {!hasDna && (
                                <span className="cat-setup-badge">setup</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Right: DNA inspector */}
            {selected ? (
                <div className="dna-panel-wrap">
                    {/* Tab bar */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div className="card-head">
                            <span className="card-title">
                                {selected.name} · DNA
                            </span>
                            <span className="card-sub">
                                min {localDna[selected.id]?.minSections ?? '—'} sections
                            </span>
                        </div>
                        <div className="dna-tabbar">
                            {(['editor', 'preview'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    className={`dna-tab${activeTab === tab ? ' active' : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab === 'editor' ? 'DNA Editor' : 'Compliance Preview'}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'editor' ? (
                            <DnaEditor
                                categoryId={selected.id}
                                categoryName={selected.name}
                                initialDna={localDna[selected.id] ?? undefined}
                                onSaved={(dna) => handleSaved(selected.id, dna)}
                            />
                        ) : (
                            <DnaCompliancePreview
                                categoryId={selected.id}
                                dna={localDna[selected.id] ?? null}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="comp-empty">Select a category to edit its DNA</div>
            )}
        </div>
    )
}
