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
    AlertCircle,
    Folder,
    File,
    ChevronLeft,
    X,
    XCircle
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { ImageUploader, UploadedImage } from '@/components/dashboard/ImageUploader'

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

export default function CategoryManager() {
    const { t } = useI18n()
    const router = useRouter()
    
    // State
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set())
    
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
            const res = await fetch('/api/categories?limit=1000&depth=1', {
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Failed to fetch categories')
            const data = await res.json()
            setCategories(data.docs || [])
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

            const method = formData.id ? 'PATCH' : 'POST'
            const url = formData.id ? `/api/categories/${formData.id}` : '/api/categories'

            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err?.errors?.[0]?.message || 'Failed to save category')
            }

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
            const res = await fetch(`/api/categories/${categoryToDelete.id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            if (!res.ok) throw new Error('Failed to delete')
            
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

        const levelColors = {
            1: "text-[#3B82F6]",
            2: "text-[#06B6D4]",
            3: "text-[#A855F7]",
        }

        return (
            <div key={node.id} className="w-full">
                {/* Node Row */}
                <div className={cn(
                    "flex flex-col sm:flex-row sm:items-center py-[14px] px-[20px] border-b border-[#1E293B] group transition-colors hover:bg-[#1E293B]/50",
                    isExpanded && "bg-[#1E293B]/50",
                    node.level === 2 && "pl-[52px]",
                    node.level === 3 && "pl-[84px]"
                )}>
                    <div className="flex items-center flex-1 min-w-0 pr-4">
                        <button 
                            type="button"
                            onClick={() => toggleExpand(node.id)}
                            className={cn(
                                "w-6 h-6 shrink-0 flex items-center justify-center text-[#94A3B8] transition-transform cursor-pointer border-none bg-transparent p-0",
                                !hasChildren && "opacity-0 pointer-events-none"
                            )}
                        >
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        <div className="flex items-center justify-center pt-0.5 pr-2 pl-1">
                            <span className="text-[18px] leading-none grayscale opacity-90">
                                {hasChildren ? '📂' : '📄'}
                            </span>
                        </div>
                        <span className="text-[14px] font-medium text-[#F1F5F9] truncate">{node.name}</span>
                    </div>

                    <div className="flex flex-row items-center gap-0 mt-3 sm:mt-0 pl-14 sm:pl-0 sm:w-auto w-full justify-between sm:justify-end">
                        <div className="w-[80px] hidden sm:flex justify-center">
                            <div className="bg-[#0B1120] px-2 py-[2px] rounded-[20px] flex items-center justify-center">
                                <span className={cn("text-[11px] font-semibold tracking-tight", levelColors[node.level as keyof typeof levelColors] || "text-[#3B82F6]")}>
                                    L{node.level}
                                </span>
                            </div>
                        </div>
                        <div className="w-[100px] text-[12px] text-[#64748B] text-left hidden sm:flex items-center">
                            {/* Dummy product count layout exact to Figma */}
                            {Math.floor(Math.random() * 20) + 5} products
                        </div>
                        <div className="w-auto sm:w-[120px] flex items-center justify-end gap-1 opacity-100">
                            {!isLevel3 && (
                                <button 
                                    type="button"
                                    onClick={() => handleOpenForm(undefined, node.id)}
                                    className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-transparent text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 hover:border-[#3B82F6] transition-colors bg-transparent cursor-pointer"
                                    title={t.dashboard.products.categories.addSubcategory || 'Add Subcategory'}
                                >
                                    <Plus className="w-[16px] h-[16px] stroke-[1.5px]" />
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={() => handleOpenForm(node)}
                                className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-transparent text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 hover:border-[#3B82F6] transition-colors bg-transparent cursor-pointer"
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
                                className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-transparent text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 hover:border-[#EF4444] transition-colors bg-transparent cursor-pointer"
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
                            <div className={cn(
                                "flex items-center py-[10px] px-[20px] border-b border-[#1E293B] cursor-pointer hover:bg-[#1E293B]/50 transition-colors group",
                                node.level === 1 && "pl-[52px]",
                                node.level === 2 && "pl-[84px]"
                            )} onClick={() => handleOpenForm(undefined, node.id)}>
                                <div className="flex items-center justify-center w-[14px] h-[14px]">
                                    <Plus className="w-3.5 h-3.5 text-[#3B82F6] opacity-90 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <span className="text-[13px] font-medium text-[#3B82F6] ml-2 opacity-90 group-hover:opacity-100 transition-opacity">
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
                <Link href="/products" className="flex items-center gap-1 text-blue-500 text-[13px] no-underline hover:underline w-fit">
                    <ChevronLeft className="w-4 h-4" />
                    {t.dashboard.products.categories.backToProducts || 'Products'}
                </Link>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-[24px] font-bold text-white m-0 tracking-tight">
                            {t.dashboard.products.categories.title || 'Category Management'}
                        </h1>
                        <p className="text-[14px] text-[#64748B] mt-1 m-0">
                            {t.dashboard.products.categories.subtitle || 'Manage product categories (up to 3 levels deep)'}
                        </p>
                    </div>
                    <button 
                        onClick={() => handleOpenForm()}
                        className="flex items-center gap-2 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] text-white px-5 py-2.5 rounded-[12px] text-[14px] font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#3B82F6]/20 border-none cursor-pointer w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-4 h-4" /> 
                        {t.dashboard.products.categories.addCategory || 'Add Category'}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="flex items-center gap-3 bg-[#111827] border border-[#1E293B] rounded-[12px] px-4">
                    <Search className="w-4 h-4 text-[#64748B] shrink-0" />
                    <input 
                        type="text" 
                        placeholder={t.dashboard.products.categories.search || 'Search categories...'}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent border-none text-[#F1F5F9] text-[14px] py-3 outline-none placeholder:text-[#64748B]"
                    />
                </div>
            </div>

            {/* Content box */}
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-[16px] overflow-hidden">
                {/* Tree */}
                <div className="flex flex-col min-h-[300px]">
                    {/* Tree Header */}
                    <div className="hidden sm:flex items-center px-[20px] py-[16px] bg-[#1E293B]/50 border-b border-[#1E293B]">
                        <span className="flex-1 text-[13px] font-semibold text-[#94A3B8] uppercase tracking-[0.038em]">
                            {t.dashboard.products.categories.form.name || 'Category Name'}
                        </span>
                        <div className="flex items-center">
                            <span className="w-[80px] text-center text-[13px] font-semibold text-[#94A3B8] uppercase tracking-[0.038em]">
                                LEVEL
                            </span>
                            <span className="w-[100px] text-left text-[13px] font-semibold text-[#94A3B8] uppercase tracking-[0.038em]">
                                PRODUCTS
                            </span>
                            <span className="w-[120px] text-right text-[13px] font-semibold text-[#94A3B8] uppercase tracking-[0.038em]">
                                ACTIONS
                            </span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                        </div>
                    ) : tree.length > 0 ? (
                        <div className="flex flex-col w-full">
                            {tree.map(node => renderNode(node))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-[#111827] border border-[#1E293B] flex items-center justify-center mb-4">
                                <Search className="w-6 h-6 text-[#64748B]" />
                            </div>
                            <h3 className="text-[16px] font-semibold text-[#F1F5F9] mb-1">
                                {searchQuery ? 'No results found' : 'No Categories'}
                            </h3>
                            <p className="text-[14px] text-[#64748B]">
                                {searchQuery 
                                    ? 'Try adjusting your search terms.' 
                                    : (t.dashboard.products.categories.emptyState || 'Start by creating a new category.')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1E293B] border border-white/10 rounded-[16px] shadow-[0_25px_50px_-12px_rgba(59,130,246,0.2)] w-full max-w-[448px] flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-white/10 flex min-h-[0] items-center justify-between">
                            <h2 className="text-[24px] font-bold text-[#F8FAFC] m-0 leading-tight">
                                {formData.id ? t.dashboard.products.categories.form.editTitle : t.dashboard.products.categories.form.newTitle}
                            </h2>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <form id="cat-form" onSubmit={handleSave} className="flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-medium text-[#F8FAFC]">
                                        {t.dashboard.products.categories.form.name || 'Category Name'} <span className="text-[#EF4444]">*</span>
                                    </label>
                                    <input 
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.namePlaceholder}
                                        className="bg-[#0B1120]/50 border border-white/10 rounded-[12px] px-4 py-3 text-[16px] text-white placeholder-[#374151] outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-medium text-[#F8FAFC]">
                                        {t.dashboard.products.categories.form.slug || 'URL Slug'}
                                    </label>
                                    <input 
                                        type="text"
                                        value={formData.slug}
                                        onChange={e => setFormData({...formData, slug: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.slugPlaceholder}
                                        className="bg-[#0B1120]/50 border border-white/10 rounded-[12px] px-4 py-3 text-[16px] text-white placeholder-[#374151] outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-medium text-[#F8FAFC]">
                                        {t.dashboard.products.categories.form.parent || 'Parent Category'}
                                    </label>
                                    <div className="relative">
                                        <select 
                                            value={formData.parent || ''}
                                            onChange={e => setFormData({...formData, parent: e.target.value || null})}
                                            className="w-full bg-[#0B1120]/50 border border-white/10 rounded-[12px] px-4 py-3 pr-10 text-[16px] text-white placeholder-[#374151] outline-none focus:border-blue-500 transition-colors appearance-none"
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
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[14px] font-semibold text-[#F1F5F9] m-0 block">
                                    {t.dashboard.products.categories.form.description || 'Description'} <span className="text-[#94A3B8]">{t.dashboard.products.categories.form.optional || '(Optional)'}</span>
                                    </label>
                                    <textarea 
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        placeholder={t.dashboard.products.categories.form.descriptionPlaceholder || 'Short description for SEO (optional)'}
                                        className="w-full h-[80px] bg-[#111827] border border-[#1E293B] rounded-[12px] px-4 py-3 text-[14px] text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/50 transition-all resize-none"
                                    />
                                </div>

                                <div className="space-y-2 pb-2">
                                    <label className="text-[14px] font-semibold text-[#F1F5F9] m-0 block">
                                    {t.dashboard.products.categories.form.image || 'Category Image'} <span className="text-[#94A3B8]">{t.dashboard.products.categories.form.optional || '(Optional)'}</span>
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
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-[#1E293B] rounded-b-[16px] shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsFormOpen(false)}
                                className="px-6 py-2 h-[46px] rounded-[12px] text-[16px] font-medium text-[#F8FAFC] border border-white/10 bg-[#0B1120]/50 hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                {t.dashboard.products.categories.form.cancel || 'Cancel'}
                            </button>
                            <button 
                                form="cat-form"
                                type="submit" 
                                className="flex items-center gap-2 px-6 py-2 h-[46px] rounded-[12px] text-[16px] font-semibold text-white bg-gradient-to-r from-blue-500 to-teal-400 border-none outline-none shadow-[0_4px_6px_-4px_rgba(59,130,246,0.3),0_10px_15px_-3px_rgba(59,130,246,0.3)] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
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
                    <div className="bg-[#1E293B] border border-white/10 rounded-[16px] shadow-[0_25px_60px_rgba(0,0,0,0.5)] w-full max-w-[420px] flex flex-col max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                            <div className="text-[18px] font-bold text-[#F8FAFC] flex items-center gap-2.5 m-0 leading-none">
                                <span className="text-[20px]">🗑️</span>
                                <span>{t.dashboard.products.categories.deleteModal.title || 'Delete Category'}</span>
                            </div>
                            <button 
                                onClick={() => setIsDeleteOpen(false)}
                                className="w-8 h-8 rounded-[8px] flex items-center justify-center border border-white/10 bg-transparent text-[#94A3B8] hover:border-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer outline-none"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <div className="text-center py-2 flex flex-col items-center">
                                <div className="w-12 h-12 flex items-center justify-center mb-4">
                                    <XCircle className="w-12 h-12 text-[#EF4444]" strokeWidth={1.5} />
                                </div>
                                <p className="text-[14px] text-[#94A3B8] m-0">
                                    {t.dashboard.products.categories.deleteModal.warning1 || 'Are you sure you want to delete'}
                                </p>
                                <div className="text-[16px] font-semibold text-[#F1F5F9] mt-1">
                                    {categoryToDelete.name}
                                </div>
                                
                                {hasChildren && (
                                    <div className="mt-5 p-3 pr-4 shadow-[0_0_0_1px_rgba(245,158,11,0.2)] bg-[#F59E0B]/10 rounded-[8px] text-[13px] text-[#F59E0B] text-left flex items-start gap-2.5 w-full">
                                        <span className="shrink-0 leading-none translate-y-[2px]">⚠️</span>
                                        <span className="leading-snug">
                                            {t.dashboard.products.categories.deleteModal.subCategoryWarning || 'This category has child categories. They will be unlinked from the tree (not permanently deleted).'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#1E293B] rounded-b-[16px]">
                            <button 
                                type="button" 
                                onClick={() => setIsDeleteOpen(false)}
                                className="px-5 py-2.5 rounded-[8px] text-[14px] font-medium text-[#F8FAFC] border border-white/10 bg-transparent hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                {t.dashboard.products.categories.deleteModal.cancel || 'Cancel'}
                            </button>
                            <button 
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-[14px] font-semibold text-white bg-[#EF4444] border-none outline-none hover:bg-[#DC2626] transition-colors cursor-pointer disabled:opacity-50"
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
