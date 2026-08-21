'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Edit,
    Trash,
    Loader2,
    SearchX,
    AlertTriangle,
    FolderOpen,
    File,
    ArrowLeft,
    Layers,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableSearch } from '@/components/ui/table-search'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { TablePagination, shouldShowTablePagination, useTablePageClamp } from '@/components/ui/table-pagination'
import { getCategoriesAction, saveCategoryAction, deleteCategoryAction, checkCategoryNameAvailable } from '../actions'

// Types
export type Category = {
    id: string | number
    name: string
    slug?: string
    parent?: string | number | Category | null
    description?: string
    breadcrumbs?: string
    createdAt?: string
    updatedAt?: string
    children?: Category[]
    level?: number
    productCount?: number
}

// Helper to generate slug from name
const generateSlug = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD') // Remove diacritics
        .replace(/[̀-ͯ]/g, '')
        .replace(/[đĐ]/g, 'd') // Handle Vietnamese 'đ'
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

// Private-use markers preserve the translated placeholder boundary without HTML in locale files.
const PARENT_NAME_EMPHASIS_TOKEN = '\uE000category-parent-name\uE001'

const renderEmphasizedParentName = (text: string, parentName: string): React.ReactNode => {
    const start = text.indexOf(PARENT_NAME_EMPHASIS_TOKEN)
    if (start < 0) return text

    return (
        <>
            {text.slice(0, start)}
            <strong className="font-bold">{parentName}</strong>
            {text.slice(start + PARENT_NAME_EMPHASIS_TOKEN.length)}
        </>
    )
}

// Helper to calculate depth of a category before saving. Capped at 5 hops — same safety
// margin as isDescendant below — so a cyclic ancestor chain (pre-existing data corruption,
// not otherwise reachable via the backend guard) can't spin this loop forever and freeze the
// tab; the backend beforeValidate hook remains the source of truth for actual enforcement.
// Exported for direct unit testing (pure function, no component render needed).
export const getCategoryDepth = (parentId: string | number | null, flatList: Category[]): number => {
    if (!parentId) return 1
    let depth = 1
    let currentParent = flatList.find(c => c.id === parentId)
    let hops = 0
    while (currentParent) {
        hops++
        if (hops > 5) break
        depth++
        const nextParentId = typeof currentParent.parent === 'object' && currentParent.parent !== null
            ? currentParent.parent.id
            : currentParent.parent
        if (!nextParentId) break
        currentParent = flatList.find(c => c.id === nextParentId)
    }
    return depth
}

// Search results must show each match's REAL level, not a hardcoded 1 — the badge display and
// the L3-add-lock (isLevel3) both derive from `level`, so a hardcoded 1 mislabeled real L2/L3
// matches and incorrectly re-enabled the "+ Add Subcategory" button for an actual L3 category
// (which then always failed the depth check on save — a guaranteed dead-end interaction).
// Exported for direct unit testing (pure function, no component render needed).
export const annotateSearchMatchLevel = (category: Category, flatList: Category[]): Category => {
    const parentId = typeof category.parent === 'object' && category.parent !== null
        ? category.parent.id
        : (category.parent ?? null)
    const level = getCategoryDepth(parentId, flatList)
    return { ...category, level, children: [] }
}

// Client-side mirror of the backend cycle guard (Categories.ts beforeValidate): walks UP the
// ancestor chain from candidateId; true if selfId is reached (covers both "parent = self" and
// "parent = descendant of self", since a descendant's ancestor chain passes through self).
// UX-only guard — backend hook is the source of truth. Capped at 5 hops, same safety margin.
export const isDescendant = (candidateId: string | number | null, selfId: string | number | null | undefined, flatList: Category[]): boolean => {
    if (candidateId == null || selfId == null) return false
    let currentId: string | number | null = candidateId
    let hops = 0
    while (currentId != null) {
        hops++
        if (hops > 5) break
        if (String(currentId) === String(selfId)) return true
        const currentCat = flatList.find(c => String(c.id) === String(currentId))
        const rawParent = currentCat ? currentCat.parent : null
        currentId = (rawParent && typeof rawParent === 'object' ? rawParent.id : rawParent) ?? null
    }
    return false
}

const getParentId = (category: Category): string | null => {
    const rawParent = category.parent
    const parentId = rawParent && typeof rawParent === 'object' ? rawParent.id : rawParent
    return parentId == null ? null : String(parentId)
}

const compareCategories = (a: Category, b: Category): number => {
    return a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id))
}

// Parent dropdown options must follow tree preorder, regardless of the flat order returned by
// Payload. Only root-reachable categories belong to this UI contract; malformed orphan/cycle
// display policy remains outside this focused ordering fix.
export const flattenCategoryHierarchy = (flatList: Category[]): Category[] => {
    const childrenByParent = new Map<string | null, Category[]>()

    for (const category of flatList) {
        const parentId = getParentId(category)
        const siblings = childrenByParent.get(parentId) ?? []
        siblings.push(category)
        childrenByParent.set(parentId, siblings)
    }

    for (const siblings of childrenByParent.values()) {
        siblings.sort(compareCategories)
    }

    const ordered: Category[] = []
    const visited = new Set<string>()

    const visit = (category: Category, level: number) => {
        const id = String(category.id)
        if (visited.has(id)) return

        visited.add(id)
        ordered.push({ ...category, level })

        for (const child of childrenByParent.get(id) ?? []) {
            visit(child, level + 1)
        }
    }

    for (const root of childrenByParent.get(null) ?? []) {
        visit(root, 1)
    }

    return ordered
}

// Level text colors — semantic accents, not surface tokens. L1 teal (--primary), L2 blue
// (--info), L3 violet — no dedicated semantic token for violet exists yet (only --ai-glow, which
// carries unrelated AI-feature meaning), so L3 references the underlying --p-violet-300 palette
// primitive directly (same primitive layer --primary/--info are themselves built from).
const levelTextColors = {
    1: '!text-[hsl(var(--primary))]',
    2: '!text-[hsl(var(--info))]',
    3: '!text-[hsl(var(--p-violet-300))]',
} as const

export default function CategoryManager() {
    const { t, ti } = useI18n()
    const router = useRouter()
    const nameInputRef = useRef<HTMLInputElement>(null)

    // State
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set())
    const [currentPage, setCurrentPage] = useState(1)
    // Rows-per-page stateful for the DS pagination selector ([10,25,50,100]) (GH-1290 Bug 4)
    const [pageSize, setPageSize] = useState(10)
    const handleLimitChange = (n: number) => { setPageSize(n); setCurrentPage(1) }

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false)
    // True only when opened via a row's "+" button (add-subcategory entry point) — drives the
    // contextual title and locks the Parent field to the prefilled node. Toolbar/edit keep it false.
    const [isSubcategoryMode, setIsSubcategoryMode] = useState(false)
    const [formData, setFormData] = useState<{
        id?: string | number
        name: string
        slug: string
        parent: string | number | null
        description: string
    }>({
        name: '',
        slug: '',
        parent: null,
        description: '',
    })
    const [isSaving, setIsSaving] = useState(false)
    // Debounced async name-dedup check — UX-only, backend saveCategoryAction is source of truth
    const [nameError, setNameError] = useState<string | null>(null)

    useEffect(() => {
        if (!isFormOpen || !formData.name.trim()) {
            setNameError(null)
            return
        }
        let cancelled = false
        const timer = setTimeout(async () => {
            try {
                const available = await checkCategoryNameAvailable(formData.name, formData.parent, formData.id)
                // Guard against a stale in-flight response landing after the name/parent/modal
                // changed again — clearTimeout alone only cancels timers that haven't fired yet.
                if (cancelled) return
                setNameError(available ? null : (t.dashboard.products.categories.form.errors?.nameDuplicate || 'Category name already exists in this level.'))
            } catch {
                // Best-effort UX check only — ignore failures silently, backend remains authoritative.
            }
        }, 400)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [formData.name, formData.parent, formData.id, isFormOpen])

    useEffect(() => {
        if (isFormOpen) {
            nameInputRef.current?.focus()
        }
    }, [isFormOpen])

    // Delete Modal
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Fetch Categories
    const fetchCategories = async () => {
        try {
            setIsLoading(true)
            const docs = await getCategoriesAction()
            setCategories(docs as Category[] || [])
        } catch (error) {
            console.error(error)
            toast.error(t.dashboard.products.categories.toast.loadError)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    // Build Tree
    const tree = useMemo(() => {
        const buildTree = (cats: Category[], parentId: string | number | null = null, level = 1): Category[] => {
            return cats
                .filter(c => {
                    const pId = typeof c.parent === 'object' && c.parent !== null ? c.parent.id : c.parent
                    return (pId || null) === parentId
                })
                .map(c => ({
                    ...c,
                    level,
                    children: buildTree(cats, c.id, level + 1)
                }))
                // Sort alphabetically
                .sort((a, b) => a.name.localeCompare(b.name))
        }

        // Apply Search Filter locally: If search exists, flatten tree or just show matched items and their parents
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            const matched = categories.filter(c => c.name.toLowerCase().includes(query))
            return matched.map(m => annotateSearchMatchLevel(m, categories))
        }

        return buildTree(categories, null, 1)
    }, [categories, searchQuery])

    // Parent <Select> options for the Add/Edit modal — tree-ordered, level-annotated (for
    // indentation + L3-disable), and excludes self + descendants (cycle prevention, Phase 03).
    const parentOptions = useMemo(() => {
        return flattenCategoryHierarchy(categories)
            .filter(c => !formData.id || !isDescendant(c.id, formData.id, categories))
            .map(c => ({ id: c.id, label: c.breadcrumbs || c.name, level: c.level ?? 1 }))
    }, [categories, formData.id])

    const subcategoryContext = useMemo(() => {
        if (!isSubcategoryMode || formData.parent == null) return null

        const parent = categories.find(category => String(category.id) === String(formData.parent))
        if (!parent) return null

        const parentId = typeof parent.parent === 'object' && parent.parent
            ? parent.parent.id
            : (parent.parent ?? null)
        const currentLevel = getCategoryDepth(parentId, categories)
        const newLevel = currentLevel + 1
        if (currentLevel < 1 || newLevel > 3) return null

        return { parentName: parent.name, currentLevel, newLevel }
    }, [categories, formData.parent, isSubcategoryMode])

    // GH-1579: snap back when deletions strand currentPage past the last page
    useTablePageClamp(currentPage, tree.length, pageSize, setCurrentPage)

    // Handlers
    const toggleExpand = (id: string | number) => {
        const newSet = new Set(expandedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setExpandedIds(newSet)
    }

    const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return

        const target = e.target as HTMLElement
        if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) return
        if (target instanceof HTMLInputElement && ['submit', 'button', 'checkbox', 'radio', 'file'].includes(target.type)) return

        e.preventDefault()
    }

    const handleOpenForm = (cat?: Category, overrideParentId?: string | number) => {
        setNameError(null)
        // Subcategory mode = opened via a row's "+" (no cat, but a parent to prefill+lock).
        setIsSubcategoryMode(!cat && overrideParentId != null)
        if (cat) {
            // Edit mode
            setFormData({
                id: cat.id,
                name: cat.name,
                slug: cat.slug || '',
                parent: typeof cat.parent === 'object' && cat.parent ? cat.parent.id : (cat.parent || null),
                description: cat.description || '',
            })
        } else {
            // Add mode (toolbar, or subcategory via row "+")
            setFormData({
                name: '',
                slug: '',
                parent: overrideParentId || null,
                description: '',
            })
        }
        setIsFormOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) return

        // Validate cycle Client-Side (UX-only; backend beforeValidate hook is authoritative)
        if (formData.id && isDescendant(formData.parent, formData.id, categories)) {
            toast.error(t.dashboard.products.categories.toast.cycleError || 'Cannot set a category as a child of its own subcategory.')
            return
        }

        // Validate Depth Client-Side
        const newDepth = getCategoryDepth(formData.parent, categories)
        if (newDepth > 3) {
            toast.error(t.dashboard.products.categories.toast.maxDepthError || 'Cannot nest deeper than 3 levels')
            return
        }

        try {
            setIsSaving(true)
            const payload: any = {
                name: formData.name,
                description: formData.description,
            }
            if (formData.slug) payload.slug = formData.slug
            if (formData.parent) payload.parent = formData.parent
            else payload.parent = null // explicit null to clear parent

            const result = await saveCategoryAction(payload, formData.id)
            if (typeof result === 'object' && result !== null && 'success' in result && result.success === false) {
                const errMsg = result.error === 'CATEGORY_NAME_DUPLICATE'
                    ? (t.dashboard.products.categories.form.errors?.nameDuplicate || 'Category name already exists in this level.')
                    : result.error === 'CATEGORY_PARENT_ID_INVALID'
                        ? t.dashboard.products.categories.toast.parentInvalid
                        : result.error === 'CATEGORY_SLUG_DUPLICATE'
                            ? (t.dashboard.products.categories.form.errors?.slugDuplicate || 'This URL slug is already used in your store.')
                            : t.dashboard.products.categories.toast.saveError
                if (result.error === 'CATEGORY_NAME_DUPLICATE') setNameError(errMsg)
                toast.error(errMsg)
                return
            }

            const msg = formData.id
                ? t.dashboard.products.categories.toast.updated.replace('{name}', formData.name)
                : t.dashboard.products.categories.toast.created.replace('{name}', formData.name);
            toast.success(msg)
            setIsFormOpen(false)
            fetchCategories()
        } catch (error: any) {
            const message = error?.message || ''
            if (message === 'CATEGORY_NAME_DUPLICATE') {
                const errMsg = t.dashboard.products.categories.form.errors?.nameDuplicate || 'Category name already exists in this level.'
                setNameError(errMsg)
                toast.error(errMsg)
            } else if (message === 'CATEGORY_SLUG_DUPLICATE') {
                toast.error(t.dashboard.products.categories.form.errors?.slugDuplicate || 'This URL slug is already used in your store.')
            } else if (message === 'CATEGORY_CYCLE_ERROR') {
                toast.error(t.dashboard.products.categories.toast.cycleError)
            } else if (message === 'CATEGORY_MAX_DEPTH_ERROR') {
                toast.error(t.dashboard.products.categories.toast.maxDepthError)
            } else if (message === 'CATEGORY_PARENT_ID_INVALID') {
                toast.error(t.dashboard.products.categories.toast.parentInvalid)
            } else if (message === 'CATEGORY_PARENT_TENANT_MISMATCH') {
                toast.error(t.dashboard.products.categories.toast.parentTenantMismatch)
            } else if (message === 'CATEGORY_PARENT_SOFT_DELETED') {
                toast.error(t.dashboard.products.categories.toast.parentSoftDeleted)
            } else {
                toast.error(message || t.dashboard.products.categories.toast.saveError)
            }
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!categoryToDelete) return
        try {
            setIsDeleting(true)
            const result = await deleteCategoryAction(categoryToDelete.id)
            if (typeof result === 'object' && result !== null && 'success' in result && result.success === false) {
                const count = result.count ?? 0
                const message = result.error === 'CATEGORY_HAS_PRODUCTS'
                    ? t.dashboard.products.categories.deleteModal.hasProductsError.replace('{count}', String(count))
                    : t.dashboard.products.categories.deleteModal.reparentNameConflictError.replace('{count}', String(count))
                toast.error(message)
                return
            }

            toast.success(t.dashboard.products.categories.toast.deleted.replace('{name}', categoryToDelete.name))
            setIsDeleteOpen(false)
            setCategoryToDelete(null)
            await fetchCategories()
        } catch (error: any) {
            const message = error?.message || ''
            if (message.startsWith('CATEGORY_HAS_PRODUCTS:')) {
                const count = message.split(':')[1]
                toast.error(t.dashboard.products.categories.deleteModal.hasProductsError.replace('{count}', count))
                // Keep modal open so the user can reassign products before retrying.
            } else if (message.startsWith('CATEGORY_TOO_MANY_CHILDREN:')) {
                const count = message.split(':')[1]
                toast.error(t.dashboard.products.categories.deleteModal.tooManyChildrenError.replace('{count}', count))
                // Keep modal open — same rationale as CATEGORY_HAS_PRODUCTS above.
            } else if (message.startsWith('CATEGORY_REPARENT_NAME_CONFLICT:')) {
                const count = message.split(':')[1]
                toast.error(t.dashboard.products.categories.deleteModal.reparentNameConflictError.replace('{count}', count))
                // Keep modal open so the user can resolve the conflicting top-level names first.
            } else if (message === 'CATEGORY_BUSY_RETRY') {
                toast.error(t.dashboard.products.categories.deleteModal.busyRetryError)
                // The competing save/delete is bounded; keep the modal open for an immediate retry.
            } else {
                toast.error(t.dashboard.products.categories.toast.deleteError)
                setIsDeleteOpen(false)
                setCategoryToDelete(null)
            }
        } finally {
            setIsDeleting(false)
        }
    }

    // Render Tree Node
    const renderNode = (node: Category) => {
        const isExpanded = expandedIds.has(node.id)
        const hasChildren = node.children && node.children.length > 0
        const isLevel3 = (node.level || 1) >= 3

        return (
            <div key={node.id} className="w-full">
                {/* Node Row */}
                <div
                    className={cn(
                        'flex flex-col sm:flex-row sm:items-center py-[14px] px-[20px] group transition-colors',
                        isExpanded
                            ? 'bg-[var(--dash-surface-hover)]'
                            : 'hover:bg-[var(--dash-surface-hover)]',
                        node.level === 2 && 'pl-[52px]',
                        node.level === 3 && 'pl-[84px]'
                    )}
                    style={{ borderBottom: '1px solid var(--dash-border)' }}
                >
                    <div className="flex items-center flex-1 min-w-0 pr-4">
                        <button
                            type="button"
                            onClick={() => toggleExpand(node.id)}
                            aria-expanded={isExpanded}
                            className={cn(
                                'w-6 h-6 shrink-0 flex items-center justify-center text-[var(--dash-text-muted)] transition-transform cursor-pointer border-none bg-transparent p-0',
                                !hasChildren && 'opacity-0 pointer-events-none'
                            )}
                        >
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        <div className="flex items-center justify-center pt-0.5 pr-2 pl-1 text-[var(--dash-text-muted)]">
                            {hasChildren
                                ? <FolderOpen className="w-[18px] h-[18px] shrink-0" aria-hidden />
                                : <File className="w-[18px] h-[18px] shrink-0" aria-hidden />}
                        </div>
                        <span className="text-[14px] font-medium text-[var(--dash-text)] truncate">{node.name}</span>
                    </div>

                    <div className="flex flex-row items-center gap-0 mt-3 sm:mt-0 pl-14 sm:pl-0 sm:w-auto w-full justify-between sm:justify-end">
                        <div className="w-[80px] hidden sm:flex justify-center">
                            {/* Level badge — theme-aware container via Badge outline variant */}
                            <Badge
                                variant="outline"
                                className={cn(
                                    'text-[11px] font-semibold tracking-tight',
                                    levelTextColors[node.level as keyof typeof levelTextColors] || levelTextColors[1]
                                )}
                            >
                                L{node.level || '?'}
                            </Badge>
                        </div>
                        <div className="w-[100px] text-[12px] text-[var(--dash-text-muted)] text-left hidden sm:flex items-center">
                            {node.productCount || 0} products
                        </div>
                        <div className="w-auto sm:w-[120px] flex items-center justify-end gap-1 opacity-100">
                            {!isLevel3 && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenForm(undefined, node.id)}
                                    className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-transparent text-[var(--dash-text-muted)] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] hover:border-[hsl(var(--primary))] transition-colors bg-transparent cursor-pointer"
                                    title={t.dashboard.products.categories.addSubcategory || 'Add Subcategory'}
                                >
                                    <Plus className="w-[16px] h-[16px] stroke-[1.5px]" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => handleOpenForm(node)}
                                className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-transparent text-[var(--dash-text-muted)] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] hover:border-[hsl(var(--primary))] transition-colors bg-transparent cursor-pointer"
                                title={t.dashboard.products.categories.edit || 'Edit'}
                            >
                                <Edit className="w-[16px] h-[16px] stroke-[1.5px]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setCategoryToDelete(node)
                                    setIsDeleteOpen(true)
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-transparent text-[var(--dash-text-muted)] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] hover:border-[hsl(var(--destructive))] transition-colors bg-transparent cursor-pointer"
                                title={t.dashboard.products.categories.delete || 'Delete'}
                            >
                                <Trash className="w-[16px] h-[16px] stroke-[1.5px]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Children — single add-subcategory affordance is the row's "+" icon button
                    above (GH-1587 decision 2026-07-12); no separate inline "+ Add subcategory"
                    row here anymore. */}
                {isExpanded && hasChildren && (
                    <div className="flex flex-col w-full">
                        {node.children!.map(child => renderNode(child))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="w-full pb-12">
            {/* Header — GH-1538: back arrow synced to Discount page style
                (ArrowLeft icon-only, inline with title, no text label/underline link). */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <Link
                            href="/products"
                            className="flex shrink-0 items-center justify-center text-foreground hover:text-foreground/80 transition-colors"
                            title={t.dashboard.products.categories.backToProducts || 'Products'}
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-[24px] font-bold text-[var(--dash-text)] m-0 tracking-tight">
                                {t.dashboard.products.categories.title || 'Category Management'}
                            </h1>
                            <p className="text-[14px] text-[var(--dash-text-muted)] mt-1 m-0">
                                {t.dashboard.products.categories.subtitle || 'Manage product categories (up to 3 levels deep)'}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => handleOpenForm()}
                        variant="dashPrimary"
                        size="dash"
                        className="w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        {t.dashboard.products.categories.addCategory || 'Add Category'}
                    </Button>
                </div>
            </div>

            {/* Search Bar — shared <TableSearch> (same as Products list / Blog) */}
            <div className="mb-6">
                <TableSearch
                    value={searchQuery}
                    onSearch={setSearchQuery}
                    placeholder={t.dashboard.products.categories.search || 'Search categories...'}
                    className="max-w-full"
                />
            </div>

            {/* Content box */}
            <div
                className="bg-[var(--dash-surface)] rounded-[16px] overflow-hidden"
                style={{ border: '1px solid var(--dash-border)' }}
            >
                {/* Tree */}
                <div className="flex flex-col min-h-[300px]">
                    {/* Tree Header */}
                    <div
                        className="hidden sm:flex items-center px-[20px] py-[16px] bg-[var(--dash-surface-hover)]"
                        style={{ borderBottom: '1px solid var(--dash-border)' }}
                    >
                        <span className="flex-1 text-[13px] font-semibold text-[var(--dash-text-muted)] uppercase tracking-[0.038em]">
                            {t.dashboard.products.categories.form.name || 'Category Name'}
                        </span>
                        <div className="flex items-center">
                            <span className="w-[80px] text-center text-[13px] font-semibold text-[var(--dash-text-muted)] uppercase tracking-[0.038em]">
                                {t.dashboard?.products?.categories?.table?.level || 'LEVEL'}
                            </span>
                            <span className="w-[100px] text-left text-[13px] font-semibold text-[var(--dash-text-muted)] uppercase tracking-[0.038em]">
                                {t.dashboard?.products?.categories?.table?.products || 'PRODUCTS'}
                            </span>
                            <span className="w-[120px] text-right text-[13px] font-semibold text-[var(--dash-text-muted)] uppercase tracking-[0.038em]">
                                {t.dashboard?.products?.categories?.table?.actions || 'ACTIONS'}
                            </span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
                            <Loader2 className="w-8 h-8 text-[hsl(var(--primary))] animate-spin mb-4" />
                        </div>
                    ) : tree.length > 0 ? (
                        <div className="flex flex-col w-full">
                            {tree.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(node => renderNode(node))}
                        </div>
                    ) : (
                        <div className="p-6">
                            {searchQuery ? (
                                <TableEmptyState
                                    icon={<SearchX />}
                                    title={t.dashboard?.products?.categories?.table?.noResults || 'No results found'}
                                    subtitle={t.dashboard?.products?.categories?.table?.tryAdjusting || 'Try adjusting your search terms.'}
                                />
                            ) : (
                                <TableEmptyState
                                    icon={<FolderOpen />}
                                    title={t.dashboard?.products?.categories?.table?.noCategories || 'No Categories'}
                                    subtitle={t.dashboard.products.categories.emptyState || 'Start by creating a new category.'}
                                />
                            )}
                        </div>
                    )}
                    {!isLoading && shouldShowTablePagination(tree.length) && (
                        <div
                            className="p-[16px]"
                            style={{ borderTop: '1px solid var(--dash-border)' }}
                        >
                            {/* Shared DS pager + rows-per-page selector (GH-1290 Bug 4) */}
                            <TablePagination
                                page={currentPage}
                                total={tree.length}
                                limit={pageSize}
                                onPageChange={setCurrentPage}
                                onLimitChange={handleLimitChange}
                                labels={{ unit: 'categories' }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        role="dialog"
                        aria-modal="true"
                        onKeyDown={(e) => { if (e.key === 'Escape') setIsFormOpen(false) }}
                        tabIndex={-1}
                        className="bg-[var(--dash-secondary-bg)] rounded-[16px] shadow-[0_25px_50px_-12px_hsl(var(--primary)/0.2)] w-full max-w-[448px] flex flex-col max-h-[90vh] outline-none"
                        style={{ border: '1px solid var(--dash-border)' }}
                    >
                        <div
                            className="px-6 py-5 flex min-h-[0] items-center justify-between"
                            style={{ borderBottom: '1px solid var(--dash-border)' }}
                        >
                            <h2 className="text-[24px] font-bold text-[var(--dash-text)] m-0 leading-tight">
                                {formData.id
                                    ? t.dashboard.products.categories.form.editTitle
                                    : (isSubcategoryMode
                                        ? (t.dashboard.products.categories.form.addSubcategoryTitle || 'Add Subcategory')
                                        : t.dashboard.products.categories.form.newTitle)}
                            </h2>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <form id="cat-form" onSubmit={handleSave} onKeyDown={handleFormKeyDown} className="flex flex-col gap-6">
                                {subcategoryContext && (
                                    <div
                                        role="note"
                                        className="flex items-start gap-3 rounded-[8px] [border:1px_solid_hsl(var(--info)/0.55)] bg-[hsl(var(--info)/0.12)] px-3 py-3 text-[hsl(var(--info))]"
                                    >
                                        <Layers className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
                                        <p className="m-0 text-[13px] font-medium leading-5">
                                            {renderEmphasizedParentName(
                                                ti(t.dashboard.products.categories.form.subcategoryContext, {
                                                    parentName: PARENT_NAME_EMPHASIS_TOKEN,
                                                    currentLevel: subcategoryContext.currentLevel,
                                                    newLevel: subcategoryContext.newLevel,
                                                }),
                                                subcategoryContext.parentName,
                                            )}
                                        </p>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    <Label>
                                        {t.dashboard.products.categories.form.name || 'Category Name'} <span className="text-[hsl(var(--destructive))]">*</span>
                                    </Label>
                                    <Input
                                        ref={nameInputRef}
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => {
                                            const newName = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                name: newName,
                                                slug: !prev.id ? generateSlug(newName) : prev.slug
                                            }));
                                        }}
                                        placeholder={t.dashboard.products.categories.form.namePlaceholder}
                                        aria-invalid={!!nameError}
                                    />
                                    {nameError && (
                                        <span className="text-[12px] text-[hsl(var(--destructive))]">{nameError}</span>
                                    )}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label>
                                        {t.dashboard.products.categories.form.parent || 'Parent Category'}
                                    </Label>
                                    <Select
                                        value={formData.parent ? String(formData.parent) : '__none__'}
                                        onValueChange={val => setFormData({...formData, parent: val === '__none__' ? null : val})}
                                        disabled={isSubcategoryMode}
                                    >
                                        <SelectTrigger aria-describedby={subcategoryContext ? 'category-parent-locked-help' : undefined}>
                                            <SelectValue placeholder={t.dashboard.products.categories.form.parentNone || '--None--'} />
                                        </SelectTrigger>
                                        {/* z-[110]: SelectContent portals to <body> with a default z-50, which renders
                                            BEHIND this modal's z-[100] overlay — dropdown opens but is covered, so
                                            items are unclickable. Same convention as ShipOrderModal/CancelOrderModal. */}
                                        <SelectContent className="z-[110]">
                                            <SelectItem value="__none__">{t.dashboard.products.categories.form.parentNone || '--None--'}</SelectItem>
                                            {parentOptions.map(opt => (
                                                <SelectItem
                                                    key={opt.id}
                                                    value={String(opt.id)}
                                                    disabled={opt.level >= 3}
                                                    style={{ paddingLeft: `${8 + (opt.level - 1) * 16}px` }}
                                                >
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {subcategoryContext && (
                                        <p
                                            id="category-parent-locked-help"
                                            className="m-0 text-[12px] leading-5 text-[var(--dash-text-muted)]"
                                        >
                                            {t.dashboard.products.categories.form.parentLockedHelp}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        {t.dashboard.products.categories.form.description || 'Description'} <span className="text-muted-foreground">{t.dashboard.products.categories.form.optional || '(Optional)'}</span>
                                    </Label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.descriptionPlaceholder || 'Short description for SEO (optional)'}
                                        className="h-[80px]"
                                    />
                                </div>

                                <div className="flex flex-col gap-2 pt-2">
                                    <Label>
                                        {t.dashboard.products.categories.form.slug || 'URL Slug'}
                                    </Label>
                                    <Input
                                        type="text"
                                        value={formData.slug}
                                        onChange={e => setFormData({...formData, slug: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.slugPlaceholder || 'category-url'}
                                    />
                                </div>
                            </form>
                        </div>

                        <div
                            className="px-6 py-4 flex justify-end gap-3 bg-[var(--dash-secondary-bg)] rounded-b-[16px] shrink-0"
                            style={{ borderTop: '1px solid var(--dash-border)' }}
                        >
                            <Button
                                type="button"
                                variant="dashSecondary"
                                size="dash"
                                onClick={() => setIsFormOpen(false)}
                            >
                                {t.dashboard.products.categories.form.cancel || 'Cancel'}
                            </Button>
                            <Button
                                form="cat-form"
                                type="submit"
                                variant="dashPrimary"
                                size="dash"
                                disabled={isSaving || !!nameError}
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isSaving ? t.dashboard.products.categories.form.saving : (t.dashboard.products.categories.form.save || 'Save Category')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {categoryToDelete && (() => {
                const hasChildren = categories.some(c => {
                    const parentId = typeof c.parent === 'object' && c.parent ? c.parent.id : c.parent;
                    return parentId === categoryToDelete.id;
                });

                return (
                    <ConfirmModal
                        open={isDeleteOpen}
                        onConfirm={handleDelete}
                        onCancel={() => { setIsDeleteOpen(false) }}
                        title={t.dashboard.products.categories.deleteModal.title || 'Delete Category'}
                        description={
                            <span className="flex flex-col gap-3">
                                <span>
                                    {t.dashboard.products.categories.deleteModal.warning1 || 'Are you sure you want to delete'}{' '}
                                    <span className="font-semibold text-foreground">{categoryToDelete.name}</span>?
                                </span>
                                {hasChildren && (
                                    <span className="flex items-start gap-2 rounded-lg bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-[13px] text-[hsl(var(--warning))] text-left shadow-[0_0_0_1px_rgba(245,158,11,0.2)]">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-[1px]" aria-hidden />
                                        <span className="leading-snug">
                                            {t.dashboard.products.categories.deleteModal.subCategoryWarning || 'This category has child categories. They will be unlinked from the tree (not permanently deleted).'}
                                        </span>
                                    </span>
                                )}
                            </span>
                        }
                        confirmLabel={isDeleting ? (t.dashboard.products.categories.deleteModal.deleting || 'Deleting...') : (t.dashboard.products.categories.deleteModal.confirm || 'Delete')}
                        cancelLabel={t.dashboard.products.categories.deleteModal.cancel || 'Cancel'}
                        variant="danger"
                        loading={isDeleting}
                    />
                );
            })()}
        </div>
    )
}
