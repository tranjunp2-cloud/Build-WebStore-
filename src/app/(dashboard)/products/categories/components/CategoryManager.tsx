'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Edit,
    Trash,
    Trash2,
    Loader2,
    Search,
    SearchX,
    AlertTriangle,
    FolderOpen,
    File,
    ChevronLeft,
    X,
    XCircle
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { ImageUploader, UploadedImage } from '@/components/dashboard/ImageUploader'
import { Pagination } from '@/components/ui/Pagination'
import { getCategoriesAction, saveCategoryAction, deleteCategoryAction } from '../actions'

// Types
export type Category = {
    id: string | number
    name: string
    slug?: string
    parent?: string | number | Category | null
    description?: string
    image?: any
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

// Helper to calculate depth of a category before saving
const getCategoryDepth = (parentId: string | number | null, flatList: Category[]): number => {
    if (!parentId) return 1
    let depth = 1
    let currentParent = flatList.find(c => c.id === parentId)
    while (currentParent) {
        depth++
        const nextParentId = typeof currentParent.parent === 'object' && currentParent.parent !== null
            ? currentParent.parent.id
            : currentParent.parent
        if (!nextParentId) break
        currentParent = flatList.find(c => c.id === nextParentId)
    }
    return depth
}

// Level text colors — semantic accents, not surface tokens, kept as-is
const levelTextColors = {
    1: 'text-[hsl(var(--primary))]',
    2: 'text-[hsl(var(--info))]',
    3: 'text-[hsl(var(--info))]',
} as const

export default function CategoryManager() {
    const { t } = useI18n()
    const router = useRouter()

    // State
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set())
    const [currentPage, setCurrentPage] = useState(1)

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery])

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [formData, setFormData] = useState<{
        id?: string | number
        name: string
        slug: string
        parent: string | number | null
        description: string
        image: UploadedImage | null
    }>({
        name: '',
        slug: '',
        parent: null,
        description: '',
        image: null
    })
    const [isSaving, setIsSaving] = useState(false)

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
            // Minimal filtering: just return matched as flat list or pseudo-tree
            return matched.map(m => ({...m, level: 1, children: []}))
        }

        return buildTree(categories, null, 1)
    }, [categories, searchQuery])

    // Handlers
    const toggleExpand = (id: string | number) => {
        const newSet = new Set(expandedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setExpandedIds(newSet)
    }

    const handleOpenForm = (cat?: Category, overrideParentId?: string | number) => {
        if (cat) {
            // Edit mode
            let img = null
            if (cat.image && typeof cat.image === 'object' && cat.image.url) {
                img = { id: cat.image.id, url: cat.image.url }
            }
            setFormData({
                id: cat.id,
                name: cat.name,
                slug: cat.slug || '',
                parent: typeof cat.parent === 'object' && cat.parent ? cat.parent.id : (cat.parent || null),
                description: cat.description || '',
                image: img
            })
        } else {
            // Add mode
            setFormData({
                name: '',
                slug: '',
                parent: overrideParentId || null,
                description: '',
                image: null
            })
        }
        setIsFormOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) return

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

            if (formData.image) payload.image = formData.image.id
            else payload.image = null

            await saveCategoryAction(payload, formData.id)

            const msg = formData.id
                ? t.dashboard.products.categories.toast.updated.replace('{name}', formData.name)
                : t.dashboard.products.categories.toast.created.replace('{name}', formData.name);
            toast.success(msg)
            setIsFormOpen(false)
            fetchCategories()
        } catch (error: any) {
            toast.error(error.message || t.dashboard.products.categories.toast.saveError)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!categoryToDelete) return
        try {
            setIsDeleting(true)
            await deleteCategoryAction(categoryToDelete.id)

            toast.success(t.dashboard.products.categories.toast.deleted.replace('{name}', categoryToDelete.name))
            setIsDeleteOpen(false)
            setCategoryToDelete(null)
            fetchCategories()
        } catch (error) {
            toast.error(t.dashboard.products.categories.toast.deleteError)
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
                                L{node.level}
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

                {/* Children */}
                {isExpanded && (
                    <div className="flex flex-col w-full">
                        {hasChildren && node.children!.map(child => renderNode(child))}
                        {!isLevel3 && (
                            <div
                                className={cn(
                                    'flex items-center py-[10px] px-[20px] cursor-pointer hover:bg-[var(--dash-surface-hover)] transition-colors group',
                                    node.level === 1 && 'pl-[52px]',
                                    node.level === 2 && 'pl-[84px]'
                                )}
                                style={{ borderBottom: '1px solid var(--dash-border)' }}
                                onClick={() => handleOpenForm(undefined, node.id)}
                            >
                                <div className="flex items-center justify-center w-[14px] h-[14px]">
                                    <Plus className="w-3.5 h-3.5 text-[hsl(var(--primary))] opacity-90 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-[13px] font-medium text-[hsl(var(--primary))] ml-2 opacity-90 group-hover:opacity-100 transition-opacity">
                                    {t.dashboard.products.categories.addSubcategory || 'Add subcategory'}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="w-full pb-12">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <Link href="/products" className="flex items-center gap-1 text-[hsl(var(--primary))] text-[13px] no-underline hover:underline w-fit">
                    <ChevronLeft className="w-4 h-4" />
                    {t.dashboard.products.categories.backToProducts || 'Products'}
                </Link>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-[24px] font-bold text-[var(--dash-text)] m-0 tracking-tight">
                            {t.dashboard.products.categories.title || 'Category Management'}
                        </h1>
                        <p className="text-[14px] text-[var(--dash-text-muted)] mt-1 m-0">
                            {t.dashboard.products.categories.subtitle || 'Manage product categories (up to 3 levels deep)'}
                        </p>
                    </div>
                    <button
                        onClick={() => handleOpenForm()}
                        className="flex items-center gap-2 bg-gradient-to-r from-[#3b82f6] to-[#2dd4bf] !text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold hover:opacity-90 transition-all shadow-lg shadow-[hsl(var(--primary)/0.2)] border-none cursor-pointer w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        {t.dashboard.products.categories.addCategory || 'Add Category'}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div
                    className="flex items-center gap-3 bg-[var(--dash-surface)] rounded-[12px] px-4"
                    style={{ border: '1px solid var(--dash-border)' }}
                >
                    <Search className="w-4 h-4 text-[var(--dash-text-muted)] shrink-0" />
                    <input
                        type="text"
                        placeholder={t.dashboard.products.categories.search || 'Search categories...'}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none text-[var(--dash-text)] text-[14px] py-3 outline-none placeholder:text-[var(--dash-text-muted)]"
                    />
                </div>
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
                            {tree.slice((currentPage - 1) * 10, currentPage * 10).map(node => renderNode(node))}
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
                    {!isLoading && tree.length > 0 && Math.ceil(tree.length / 10) > 1 && (
                        <div
                            className="flex justify-end items-center p-[16px]"
                            style={{ borderTop: '1px solid var(--dash-border)' }}
                        >
                            <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(tree.length / 10)}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-[var(--dash-secondary-bg)] rounded-[16px] shadow-[0_25px_50px_-12px_hsl(var(--primary)/0.2)] w-full max-w-[448px] flex flex-col max-h-[90vh]"
                        style={{ border: '1px solid var(--dash-border)' }}
                    >
                        <div
                            className="px-6 py-5 flex min-h-[0] items-center justify-between"
                            style={{ borderBottom: '1px solid var(--dash-border)' }}
                        >
                            <h2 className="text-[24px] font-bold text-[var(--dash-text)] m-0 leading-tight">
                                {formData.id ? t.dashboard.products.categories.form.editTitle : t.dashboard.products.categories.form.newTitle}
                            </h2>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <form id="cat-form" onSubmit={handleSave} className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-medium text-[var(--dash-text)]">
                                        {t.dashboard.products.categories.form.name || 'Category Name'} <span className="text-[hsl(var(--destructive))]">*</span>
                                    </label>
                                    <input
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
                                        className="bg-[var(--dash-bg)] rounded-[12px] px-4 py-3 text-[16px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] outline-none focus:border-[hsl(var(--primary))] transition-colors"
                                        style={{ border: '1px solid var(--dash-border)' }}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-medium text-[var(--dash-text)]">
                                        {t.dashboard.products.categories.form.parent || 'Parent Category'}
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.parent || ''}
                                            onChange={e => setFormData({...formData, parent: e.target.value || null})}
                                            className="w-full bg-[var(--dash-bg)] rounded-[12px] px-4 py-3 pr-10 text-[16px] text-[var(--dash-text)] outline-none focus:border-[hsl(var(--primary))] transition-colors appearance-none"
                                            style={{ border: '1px solid var(--dash-border)' }}
                                        >
                                            <option value="">{t.dashboard.products.categories.form.parentNone || '--None--'}</option>
                                            {categories
                                                .filter(c => c.id !== formData.id) // Prevent self as parent
                                                .map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.breadcrumbs || c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--dash-text-muted)] pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[14px] font-semibold text-[var(--dash-text)] m-0 block">
                                        {t.dashboard.products.categories.form.description || 'Description'} <span className="text-[var(--dash-text-muted)]">{t.dashboard.products.categories.form.optional || '(Optional)'}</span>
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.descriptionPlaceholder || 'Short description for SEO (optional)'}
                                        className="w-full h-[80px] bg-[var(--dash-bg)] rounded-[12px] px-4 py-3 text-[14px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary)/0.5)] transition-all resize-none"
                                        style={{ border: '1px solid var(--dash-border)' }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[14px] font-semibold text-[var(--dash-text)] m-0 block">
                                        {t.dashboard.products.categories.form.image || 'Category Image'} <span className="text-[var(--dash-text-muted)]">{t.dashboard.products.categories.form.optional || '(Optional)'}</span>
                                    </label>
                                    <ImageUploader
                                        value={formData.image ? [formData.image] : []}
                                        onChange={(imgs) => setFormData({...formData, image: imgs.length > 0 ? imgs[0] : null})}
                                        maxImages={1}
                                        variant="wide"
                                        placeholderText="Click to upload or drag and drop"
                                        className="mt-1"
                                    />
                                </div>

                                <div className="flex flex-col gap-2 pt-2">
                                    <label className="text-[14px] font-medium text-[var(--dash-text)]">
                                        {t.dashboard.products.categories.form.slug || 'URL Slug'}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.slug}
                                        onChange={e => setFormData({...formData, slug: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.slugPlaceholder || 'category-url'}
                                        className="bg-[var(--dash-bg)] rounded-[12px] px-4 py-3 text-[16px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] outline-none focus:border-[hsl(var(--primary))] transition-colors"
                                        style={{ border: '1px solid var(--dash-border)' }}
                                    />
                                </div>
                            </form>
                        </div>

                        <div
                            className="px-6 py-4 flex justify-end gap-3 bg-[var(--dash-secondary-bg)] rounded-b-[16px] shrink-0"
                            style={{ borderTop: '1px solid var(--dash-border)' }}
                        >
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="px-6 py-2 h-[46px] rounded-[12px] text-[16px] font-medium text-[var(--dash-text)] bg-[var(--dash-bg)] hover:bg-[var(--dash-surface-hover)] transition-colors cursor-pointer"
                                style={{ border: '1px solid var(--dash-border)' }}
                            >
                                {t.dashboard.products.categories.form.cancel || 'Cancel'}
                            </button>
                            <button
                                form="cat-form"
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2 h-[46px] rounded-[12px] text-[16px] font-semibold !text-white bg-gradient-to-r from-blue-500 to-teal-400 border-none outline-none shadow-[0_4px_6px_-4px_hsl(var(--primary)/0.3),0_10px_15px_-3px_hsl(var(--primary)/0.3)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                            >
                                {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                                {isSaving ? t.dashboard.products.categories.form.saving : (t.dashboard.products.categories.form.save || 'Save Category')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {isDeleteOpen && categoryToDelete && (() => {
                const hasChildren = categories.some(c => {
                    const parentId = typeof c.parent === 'object' && c.parent ? c.parent.id : c.parent;
                    return parentId === categoryToDelete.id;
                });

                return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-[var(--dash-secondary-bg)] rounded-[16px] shadow-[0_25px_60px_rgba(0,0,0,0.5)] w-full max-w-[420px] flex flex-col max-h-[85vh] overflow-y-auto"
                        style={{ border: '1px solid var(--dash-border)' }}
                    >
                        <div
                            className="flex items-center justify-between px-6 py-5"
                            style={{ borderBottom: '1px solid var(--dash-border)' }}
                        >
                            <div className="text-[18px] font-bold text-[var(--dash-text)] flex items-center gap-2.5 m-0 leading-none">
                                <Trash2 className="w-5 h-5 shrink-0" aria-hidden />
                                <span>{t.dashboard.products.categories.deleteModal.title || 'Delete Category'}</span>
                            </div>
                            <button
                                onClick={() => setIsDeleteOpen(false)}
                                className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-transparent text-[var(--dash-text-muted)] hover:border-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] transition-all cursor-pointer outline-none"
                                style={{ border: '1px solid var(--dash-border)' }}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="text-center py-2 flex flex-col items-center">
                                <div className="w-12 h-12 flex items-center justify-center mb-4">
                                    <XCircle className="w-12 h-12 text-[hsl(var(--destructive))]" strokeWidth={1.5} />
                                </div>
                                <p className="text-[14px] text-[var(--dash-text-muted)] m-0">
                                    {t.dashboard.products.categories.deleteModal.warning1 || 'Are you sure you want to delete'}
                                </p>
                                <div className="text-[16px] font-semibold text-[var(--dash-text)] mt-1">
                                    {categoryToDelete.name}
                                </div>

                                {hasChildren && (
                                    <div className="mt-5 p-3 pr-4 shadow-[0_0_0_1px_rgba(245,158,11,0.2)] bg-[hsl(var(--warning)/0.1)] rounded-[8px] text-[13px] text-[hsl(var(--warning))] text-left flex items-start gap-2.5 w-full">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-[1px]" aria-hidden />
                                        <span className="leading-snug">
                                            {t.dashboard.products.categories.deleteModal.subCategoryWarning || 'This category has child categories. They will be unlinked from the tree (not permanently deleted).'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            className="flex justify-end gap-3 px-6 py-4 bg-[var(--dash-secondary-bg)] rounded-b-[16px]"
                            style={{ borderTop: '1px solid var(--dash-border)' }}
                        >
                            <button
                                type="button"
                                onClick={() => setIsDeleteOpen(false)}
                                className="px-5 py-2.5 rounded-[8px] text-[14px] font-medium text-[var(--dash-text)] bg-transparent hover:bg-[var(--dash-surface-hover)] transition-colors cursor-pointer"
                                style={{ border: '1px solid var(--dash-border)' }}
                            >
                                {t.dashboard.products.categories.deleteModal.cancel || 'Cancel'}
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-[14px] font-semibold !text-white bg-[hsl(var(--destructive))] border-none outline-none hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                {isDeleting ? t.dashboard.products.categories.deleteModal.deleting : (t.dashboard.products.categories.deleteModal.confirm || 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    )
}
