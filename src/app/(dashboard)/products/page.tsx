'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, RefreshCw, SquarePen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ProductsSkeleton } from '@/components/dashboard/ProductsSkeleton'
import { ProductImageFallback } from '@/components/dashboard/ProductImageFallback'
import { ProductsEmptyState } from '@/components/dashboard/ProductsEmptyState'
import { BulkCreateModal } from '@/components/dashboard/BulkCreateModal'
import { ProductQuickViewModal, DetailedProduct } from '@/components/dashboard/ProductQuickViewModal'
import { ProductDetailsMobile } from '@/components/dashboard/product-form/ProductDetailsMobile'
import { DeleteProductModal } from '@/components/dashboard/DeleteProductModal'
import { useI18n } from '@/i18n'

type ProductImage = {
    url?: string
    thumbnailURL?: string
}

type Category = {
    id: string
    name: string
    breadcrumbs?: string
}

type Variant = {
    id?: string
    name: string
    price: number
    stock: number
    status?: string
}

type Product = {
    id: string
    name: string
    slug: string
    sku?: string
    shortDescription?: string
    price: number
    compareAtPrice?: number
    currency: string
    status: 'draft' | 'active' | 'archived'
    inventory: number
    weight?: number
    category?: (Category | string)[]
    images?: Array<{ image: ProductImage | string | null; alt?: string }>
    createdAt: string
    hasVariants?: boolean
    variants?: Variant[]
    descText?: string
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

function getImageUrl(image: ProductImage | string | null): string | null {
    if (!image || typeof image === 'string') return null
    const url = image.url || image.thumbnailURL || null
    if (!url) return null
    // Next.js Image component throws an error on unconfigured domains. 
    // Since images are hosted internally on /api/media, we just strip the domain.
    try {
        return new URL(url, 'http://localhost').pathname
    } catch {
        return url
    }
}

export default function ProductsPage() {
    const { t } = useI18n()
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showBulkCreate, setShowBulkCreate] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const [sortBy, setSortBy] = useState('Latest')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [saleStatus, setSaleStatus] = useState<string>('All Products')
    const [showLowStock, setShowLowStock] = useState<boolean>(false)
    const [mounted, setMounted] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const SORT_OPTIONS = [
        'Latest',
        'Oldest',
        'Price: Low > High',
        'Price: High > Low',
        'Inventory: Low > High'
    ]

    const sortTranslateMap: Record<string, string> = {
        'Latest': t.dashboard.products.list.sortLatest,
        'Oldest': t.dashboard.products.list.sortOldest,
        'Price: Low > High': t.dashboard.products.list.sortPriceAsc,
        'Price: High > Low': t.dashboard.products.list.sortPriceDesc,
        'Inventory: Low > High': t.dashboard.products.list.sortStockAsc
    }

    useEffect(() => {
        setMounted(true)
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    const [quickViewProduct, setQuickViewProduct] = useState<DetailedProduct | null>(null)

    useEffect(() => {
        loadProducts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadProducts = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/products?limit=100&where[deletedAt][exists]=false', { credentials: 'include' })
            if (!res.ok) throw new Error(`Server returned ${res.status}`)
            const data = await res.json()
            const fetchedDocs = data.docs || []
            
            // Fetch categories for filter panel
            const catRes = await fetch('/api/categories?limit=100', { credentials: 'include' })
            if (catRes.ok) {
                const catData = await catRes.json()
                setCategories(catData.docs || [])
            }

            setProducts(fetchedDocs)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load products'
            setError(message)
            toast.error('Failed to load products', {
                action: { label: 'Retry', onClick: () => loadProducts() },
            })
        } finally {
            setIsLoading(false)
        }
    }

    const filteredAndSortedProducts = products
        .filter(p => {
            if (filterStatus !== 'all' && p.status !== filterStatus) {
                return false
            }
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const matchesName = p.name.toLowerCase().includes(query)
                const matchesSku = p.sku?.toLowerCase().includes(query)
                if (!matchesName && !matchesSku) return false
            }
            if (showLowStock && (p.inventory === undefined || p.inventory > 5)) {
                return false
            }
            if (saleStatus === 'On Sale' && (!p.compareAtPrice || p.compareAtPrice <= p.price)) {
                return false
            }
            if (saleStatus === 'Regular Price' && p.compareAtPrice && p.compareAtPrice > p.price) {
                return false
            }
            if (selectedCategories.length > 0) {
                if (!p.category || p.category.length === 0) return false
                const catNames = p.category.map((c: Category | string) => typeof c === 'object' && c ? c.name : c)
                const hasMatch = selectedCategories.some(selected => catNames.includes(selected))
                if (!hasMatch) return false
            }
            return true
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'Latest':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                case 'Oldest':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                case 'Price: Low > High':
                    return (a.price || 0) - (b.price || 0)
                case 'Price: High > Low':
                    return (b.price || 0) - (a.price || 0)
                case 'Inventory: Low > High':
                    return (a.inventory || 0) - (b.inventory || 0)
                default:
                    return 0
            }
        })

    const statusCounts = {
        all: products.length,
        active: products.filter(p => p.status === 'active').length,
        draft: products.filter(p => p.status === 'draft').length,
        archived: products.filter(p => p.status === 'archived').length,
    }

    const handleCreateAi = () => {
        setShowBulkCreate(true)
    }

    const handleUpdateStatus = async (prod: Product | DetailedProduct, e: React.MouseEvent) => {
        e.stopPropagation()
        const newStatus = prod.status === 'active' ? 'archived' : 'active'
        // Optimistic update
        setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: newStatus } : p))
        try {
            const res = await fetch(`/api/products/${prod.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
                credentials: 'include'
            })
            if (!res.ok) throw new Error()
            toast.success(`${t.dashboard.products.form.successMarkedAs} ${newStatus}`)
        } catch (e: unknown) {
            toast.error(t.dashboard.products.form.failedUpdateStatus)
            setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: prod.status } : p))
        }
    }

    const handleRestore = async (id: string) => {
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deletedAt: null }),
                credentials: 'include'
            })
            if (!res.ok) throw new Error()
            toast.success(t.dashboard.products.form.restored)
            loadProducts()
        } catch(e: unknown) {
            toast.error(t.dashboard.products.form.failedRestore)
        }
    }

    const [productToDelete, setProductToDelete] = useState<Product | DetailedProduct | null>(null)
    const [isDeletingProduct, setIsDeletingProduct] = useState(false)

    const handleDelete = (prod: Product | DetailedProduct, e?: React.MouseEvent) => {
        if (e) e.stopPropagation()
        setProductToDelete(prod)
    }

    const confirmDelete = async () => {
        if (!productToDelete) return
        
        const prod = productToDelete
        setIsDeletingProduct(true)
        // Optimistic delete
        setProducts(prev => prev.filter(p => p.id !== prod.id))
        
        try {
            const res = await fetch(`/api/products/${prod.id}`, { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deletedAt: new Date().toISOString() }),
                credentials: 'include' 
            })
            if (!res.ok) throw new Error()
            
            // Wait for transition before unmounting modal completely if we want, but closing immediately is also fine
            setProductToDelete(null)
            
            toast.success(t.dashboard.products.form.productDeleted, {
                action: {
                    label: t.dashboard.products.form.undo,
                    onClick: () => handleRestore(prod.id)
                },
                duration: 5000,
            })
        } catch(e: unknown) {
            toast.error(t.dashboard.products.form.failedDelete)
            setProductToDelete(null)
            loadProducts()
        } finally {
            setIsDeletingProduct(false)
        }
    }

    // Loading state
    if (isLoading) {
        return <ProductsSkeleton />
    }

    // Error state
    if (error && products.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-400/60" />
                    <h2 className="mt-4 text-lg font-semibold text-white">{t.dashboard.products.list.failedToLoad}</h2>
                    <p className="mt-1 text-sm text-gray-500">{error}</p>
                    <button onClick={loadProducts}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                        <RefreshCw className="h-4 w-4" /> {t.dashboard.products.list.retry}
                    </button>
                </div>
            </div>
        )
    }

    // Empty state without filtering
    const isTotallyEmpty = products.length === 0 && !isLoading

    return (
        <div className="space-y-6 pb-20">
            {/* AI Chat Banner (Figma Node 30882:5804) */}
            <div className="rounded-[16px] border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-teal-400/10 p-[24px] overflow-hidden relative">
                <div className="relative flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <Image src="/images/figma/ai-chat-icon.svg" width={24} height={24} alt="AI" className="shrink-0" />
                        <h2 className="text-[18px] font-semibold text-[#F8FAFC]">{t.dashboard.products.list.aiChatTitle}</h2>
                    </div>
                    <div className="flex flex-col md:flex-row w-full items-stretch md:items-center gap-[12px]">
                        <div className="w-full md:flex-1 flex items-center bg-[#1E293B] border border-white/[0.08] rounded-[16px] px-4 h-[50px] min-h-[50px] shrink-0 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all duration-200">
                            <input 
                                value={aiPrompt} 
                                onChange={e => setAiPrompt(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && aiPrompt.trim()) handleCreateAi()
                                }}
                                placeholder={t.dashboard.products.list.aiChatPlaceholder} 
                                className="w-full bg-transparent text-[16px] text-[#F8FAFC] outline-none border-none focus:border-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none placeholder:text-slate-400"
                            />
                        </div>
                        <button 
                            onClick={() => {
                                if (aiPrompt.trim()) handleCreateAi()
                            }} 
                            className="rounded-[16px] bg-gradient-to-r from-blue-500 to-teal-400 md:w-[100px] w-full h-[48px] md:h-[50px] flex items-center justify-center text-[16px] font-semibold text-white shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)] hover:opacity-90 transition-opacity border-none outline-none focus:outline-none focus:ring-0 focus:ring-offset-0">
                            {t.dashboard.products.list.aiChatBtn}
                        </button>
                    </div>
                </div>
            </div>

            {isTotallyEmpty ? (
                <ProductsEmptyState />
            ) : (
                <>
                    {/* Header (Figma Node 30882:5819) */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-[24px] font-bold leading-none text-[#F8FAFC]">{t.dashboard.products.title}</h1>
                            <span className="block text-[14px] leading-none text-[#F8FAFC]/60">{t.dashboard.products.subtitle}</span>
                        </div>
                        <Link href="/products/new" className="flex items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-blue-500 to-teal-400 px-6 h-[48px] text-[16px] font-semibold text-white shadow-md hover:opacity-90 hover:no-underline no-underline transition-opacity whitespace-nowrap w-full md:w-auto">
                            <Image src="/images/figma/add-product.svg" alt="Add" width={20} height={20} className="shrink-0 brightness-0 invert" /> {t.dashboard.products.addProduct}
                        </Link>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center md:gap-4 border-b border-white/[0.08] overflow-x-auto no-scrollbar">
                        {/* All tab */}
                        <button onClick={() => setFilterStatus('all')}
                            className="flex-1 md:flex-none min-w-max bg-transparent flex h-[44px] items-center justify-center px-3 gap-1.5 relative transition-colors cursor-pointer border-none outline-none">
                            <Image src="/images/figma/all-tab.svg" width={14} height={14} alt="All" className={cn("transition-all shrink-0", filterStatus !== 'all' && "grayscale opacity-60")} />
                            <span className={cn("text-[13px] font-medium", filterStatus === 'all' ? "text-[#3B82F6]" : "text-[#F8FAFC]/60")}>
                                {t.dashboard.products.list.filterAll}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'all' ? "bg-blue-500/20 text-[#3B82F6]" : "bg-white/5 text-[#F8FAFC]/60")}>
                                {statusCounts.all}
                            </span>
                            {filterStatus === 'all' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-teal-400" />
                            )}
                        </button>

                        {/* Active tab */}
                        <button onClick={() => setFilterStatus('active')}
                            className="flex-1 md:flex-none min-w-max bg-transparent flex h-[44px] items-center justify-center px-3 gap-1.5 relative transition-colors cursor-pointer border-none outline-none">
                            <span className="h-2 w-2 rounded-full bg-[#05DF72] shrink-0" />
                            <span className={cn("text-[13px] font-medium", filterStatus === 'active' ? "text-[#3B82F6]" : "text-[#F8FAFC]/60")}>
                                {t.dashboard.products.list.filterActive}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'active' ? "bg-blue-500/20 text-[#3B82F6]" : "bg-white/5 text-[#F8FAFC]/60")}>
                                {statusCounts.active}
                            </span>
                            {filterStatus === 'active' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-teal-400" />
                            )}
                        </button>

                        {/* Draft tab */}
                        <button onClick={() => setFilterStatus('draft')}
                            className="flex-1 md:flex-none min-w-max bg-transparent flex h-[44px] items-center justify-center px-3 gap-1.5 relative transition-colors cursor-pointer border-none outline-none">
                            <Image src="/images/figma/draft-tab.svg" width={14} height={14} alt="Draft" className={cn("shrink-0", filterStatus !== 'draft' && "opacity-60")} />
                            <span className={cn("text-[13px] font-medium", filterStatus === 'draft' ? "text-[#3B82F6]" : "text-[#F8FAFC]/60")}>
                                {t.dashboard.products.list.filterDraft}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'draft' ? "bg-blue-500/20 text-[#3B82F6]" : "bg-white/5 text-[#F8FAFC]/60")}>
                                {statusCounts.draft}
                            </span>
                            {filterStatus === 'draft' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-teal-400" />
                            )}
                        </button>

                        {/* Archived tab */}
                        <button onClick={() => setFilterStatus('archived')}
                            className="flex-1 md:flex-none min-w-max bg-transparent flex h-[44px] items-center justify-center px-3 gap-1.5 relative transition-colors cursor-pointer border-none outline-none">
                            <Image src="/images/figma/archived-tab.svg" width={14} height={14} alt="Archived" className={cn("shrink-0", filterStatus !== 'archived' && "opacity-60")} />
                            <span className={cn("text-[13px] font-medium", filterStatus === 'archived' ? "text-[#3B82F6]" : "text-[#F8FAFC]/60")}>
                                {t.dashboard.products.list.filterArchived}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'archived' ? "bg-blue-500/20 text-[#3B82F6]" : "bg-white/5 text-[#F8FAFC]/60")}>
                                {statusCounts.archived}
                            </span>
                            {filterStatus === 'archived' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-teal-400" />
                            )}
                        </button>
                    </div>

                    {/* Search & Filter — Mobile (Figma Node 30945:933): 3 stacked rows */}
                    <div className="flex md:hidden flex-col gap-[12px] w-full">
                        {/* Row 1: Search Input */}
                        <div className="relative w-full h-[50px]">
                            <Image src="/images/figma/search-icon.svg" width={20} height={20} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" alt="Search" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t.dashboard.products.list.search}
                                className="w-full h-full bg-[#1E293B] border border-white/[0.08] rounded-[16px] pl-[48px] pr-4 text-[16px] text-white placeholder:text-[#F8FAFC]/40 focus:outline-none focus:border-[#3B82F6]/50 transition-colors"
                            />
                        </div>

                        {/* Row 2: Sort Button — full-width, label left + icon right */}
                        <div className="relative w-full" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={cn(
                                    "w-full h-[50px] flex items-center justify-between px-4 bg-[#1E293B] border rounded-[16px] text-[16px] font-medium transition-colors outline-none",
                                    isDropdownOpen ? "border-[#3B82F6]/50 text-white" : "border-white/[0.08] text-[#F8FAFC]"
                                )}
                            >
                                <span>{sortTranslateMap[sortBy]}</span>
                                <Image src="/images/figma/dropdown-arrow-icon.svg" width={20} height={20} alt="Sort" />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-20">
                                    <div className="bg-[#1F2937] rounded-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.3)] flex flex-col py-2">
                                        {SORT_OPTIONS.map((option) => (
                                            <button key={option} onClick={() => { setSortBy(option); setIsDropdownOpen(false) }}
                                                className={cn("w-full px-4 py-[10px] text-left text-[15px] leading-[22px] transition-colors outline-none border-none",
                                                    sortBy === option ? "bg-[#0B1120] text-white" : "bg-transparent text-white/80 hover:text-white hover:bg-white/5")}>
                                                {sortTranslateMap[option]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Row 3: Filter Button — full-width, centered */}
                        <button
                            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                            className={cn(
                                "w-full h-[50px] flex items-center justify-center gap-2 bg-[#1E293B] border rounded-[16px] text-[16px] font-medium transition-colors outline-none",
                                isAdvancedFiltersOpen ? "border-[#3B82F6]/50 text-white" : "border-white/[0.08] text-[#F8FAFC]"
                            )}
                        >
                            <Image src="/images/figma/filter-icon.svg" width={20} height={20} alt="Filter" />
                            <span>
                                {t.dashboard.products.list.filterBtn}{(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock)
                                    ? ` (${selectedCategories.length + (saleStatus !== 'All Products' ? 1 : 0) + (showLowStock ? 1 : 0)})`
                                    : ''}
                            </span>
                        </button>
                    </div>

                    {/* Search & Filter — Desktop (Figma Node 30882:5844): 3-item row */}
                    <div className="hidden md:flex items-center gap-[17px] w-full">
                        {/* Search Input */}
                        <div className="relative flex-1 h-[50px]">
                            <Image src="/images/figma/search-icon.svg" width={20} height={20} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" alt="Search" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t.dashboard.products.list.search}
                                className="w-full h-full bg-[#1E293B] border border-white/[0.08] rounded-[16px] pl-[36px] pr-4 text-[16px] text-white placeholder:text-[#F8FAFC]/40 focus:outline-none focus:border-[#3B82F6]/50 transition-colors"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <div className="relative w-[220px] h-[50px]" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={cn(
                                    "w-full h-full border rounded-[16px] px-5 flex items-center justify-between transition-colors",
                                    isDropdownOpen ? "bg-[#1E293B] border-[#3B82F6]/50 text-white" : "bg-[#1E293B] border-white/[0.08] text-[#F8FAFC] hover:bg-white/5"
                                )}
                            >
                                <span className="text-[16px] font-medium">{sortTranslateMap[sortBy]}</span>
                                <Image src="/images/figma/dropdown-arrow-icon.svg" width={20} height={20} alt="Sort" />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-[189px] z-20">
                                    <div className="absolute left-[32px] -top-[6px] w-0 h-0" style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid #1F2937' }} />
                                    <div className="bg-[#1F2937] rounded-[2px] shadow-[0_8px_24px_rgba(25,32,56,0.1)] flex flex-col py-2">
                                        {SORT_OPTIONS.map((option) => (
                                            <button key={option} onClick={() => { setSortBy(option); setIsDropdownOpen(false) }}
                                                className={cn("w-full px-[12px] py-[5px] text-left text-[14px] leading-[22px] transition-colors outline-none border-none",
                                                    sortBy === option ? "bg-[#0B1120] text-white" : "bg-transparent text-white/80 hover:text-white hover:bg-white/5")}>
                                                {sortTranslateMap[option]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Filter Button */}
                        <button
                            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                            className={cn(
                                "flex items-center justify-center gap-2 h-[50px] bg-[#1E293B] border rounded-[16px] px-6 text-[16px] font-medium transition-colors whitespace-nowrap outline-none",
                                isAdvancedFiltersOpen ? "border-[#3B82F6]/50 text-white" : "border-white/[0.08] text-[#F8FAFC] hover:bg-white/5"
                            )}
                        >
                            <Image src="/images/figma/filter-icon.svg" width={20} height={20} alt="Filter" />
                            {t.dashboard.products.list.filterBtn}
                        </button>
                    </div>

                    {/* Advanced Filters Panel */}
                    {isAdvancedFiltersOpen && (
                        <div className="bg-[#1E293B]/60 backdrop-blur-[20px] border border-white/[0.08] rounded-[16px] p-4 md:p-[25px] flex flex-col gap-[16px] mt-4 w-full relative z-10 shadow-xl">
                            {/* Panel Header */}
                            <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-[10px]">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18.3333 2.5H1.66667L8.33333 10.3833V15.8333L11.6667 17.5V10.3833L18.3333 2.5Z" stroke="#3B82F6" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <div className="text-[#F8FAFC] text-[16px] md:text-[18px] font-semibold leading-[28px]">{t.dashboard.products.list.advancedFilters}</div>
                                </div>
                                <button 
                                    onClick={() => { setSelectedCategories([]); setSaleStatus('All Products'); setShowLowStock(false); setIsAdvancedFiltersOpen(false); }}
                                    className="flex items-center gap-[8px] bg-transparent border-none outline-none text-[#F8FAFC]/50 hover:text-[#F8FAFC] transition-colors"
                                >
                                    <span className="text-[13px] font-medium leading-[20px]">{t.dashboard.products.list.clearAll}</span>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </button>
                            </div>

                            {/* Divider */}
                            {/* <div className="w-full h-[1px] shrink-0 bg-white/10" /> */}

                            {/* Filter Sections — stacked on mobile, 3-col on desktop */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-[24px]">

                                {/* ── Category ── */}
                                <div className="flex flex-col gap-[10px] min-w-0">
                                    <div className="text-[#F8FAFC] text-[14px] font-medium leading-[20px] mb-[2px] opacity-80">{t.dashboard.products.list.category}</div>
                                    {/* 2-column grid on mobile, single column on desktop */}
                                    <div className="grid grid-cols-2 md:grid-cols-1 gap-x-3 gap-y-[10px] max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                                        {categories.map(category => {
                                            const cat = category.name;
                                            const isSelected = selectedCategories.includes(cat);
                                            return (
                                                <label key={cat} className="flex items-center gap-[8px] cursor-pointer group min-h-[28px]"
                                                    onClick={(e) => { e.preventDefault(); setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]); }}>
                                                    {isSelected ? (
                                                        <div className="w-5 h-5 flex shrink-0 items-center justify-center rounded-[4px] bg-[#2DD4BF] group-hover:opacity-80 transition-opacity">
                                                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M4.00004 7.8L1.20004 5L0.266708 5.93333L4.00004 9.66667L12 1.66667L11.0667 0.733337L4.00004 7.8Z" fill="white"/></svg>
                                                        </div>
                                                    ) : (
                                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 stroke-[#374151] group-hover:stroke-[#2DD4BF]/50 transition-colors">
                                                            <rect x="1" y="1" width="18" height="18" rx="3" fill="transparent" strokeWidth="2" />
                                                        </svg>
                                                    )}
                                                    <span className={cn("text-[14px] font-medium leading-[20px] truncate", isSelected ? "text-[#F8FAFC]" : "text-[#F8FAFC]/80")}>{cat}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Divider (mobile only) */}
                                <div className="md:hidden w-full h-[1px] bg-white/10" />

                                {/* ── Sale Status ── */}
                                <div className="flex flex-col gap-[10px] min-w-0">
                                    <div className="text-[#F8FAFC] text-[14px] font-medium leading-[20px] mb-[2px] opacity-80">{t.dashboard.products.list.saleStatus}</div>
                                    {/* Horizontal pill-style on mobile */}
                                    <div className="flex md:flex-col flex-wrap gap-2 md:gap-[8px]">
                                        {(['All Products', 'On Sale', 'Regular Price'] as const).map((status) => (
                                            <label key={status} className="flex items-center gap-[8px] cursor-pointer group min-h-[28px]"
                                                onClick={(e) => { e.preventDefault(); setSaleStatus(status); }}>
                                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                                                    {saleStatus === status ? (
                                                        <>
                                                            <circle cx="10" cy="10" r="9" fill="transparent" stroke="#2DD4BF" strokeWidth="2" />
                                                            <circle cx="10" cy="10" r="5" fill="#2DD4BF" />
                                                        </>
                                                    ) : (
                                                        <circle cx="10" cy="10" r="9" fill="transparent" stroke="#374151" strokeWidth="2" className="group-hover:stroke-[#2DD4BF]/50 transition-colors" />
                                                    )}
                                                </svg>
                                                <span className={cn("text-[14px] font-medium leading-[20px] whitespace-nowrap", saleStatus === status ? "text-[#F8FAFC]" : "text-[#F8FAFC]/80")}>{status === 'All Products' ? t.dashboard.products.list.allProducts : status === 'On Sale' ? t.dashboard.products.list.onSale : t.dashboard.products.list.regularPrice}</span>
                                                {status === 'On Sale' && <span className="bg-[#FB2C36]/20 border border-[#FB2C36]/30 text-[#FF6467] rounded-[4px] px-[6px] py-[2px] text-[12px] font-medium leading-[16px]">🔥</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Divider (mobile only) */}
                                <div className="md:hidden w-full h-[1px] bg-white/10" />

                                {/* ── Stock Status ── */}
                                <div className="flex flex-col gap-[10px] min-w-0">
                                    <div className="text-[#F8FAFC] text-[14px] font-medium leading-[20px] mb-[2px] opacity-80">{t.dashboard.products.list.stockStatus}</div>
                                    <div
                                        onClick={(e) => { e.preventDefault(); setShowLowStock(!showLowStock); }}
                                        className={cn("rounded-[16px] h-[50px] flex items-center justify-between px-[17px] transition-colors cursor-pointer", showLowStock ? "bg-[#FF8904]/10" : "bg-[#0B1120]")}
                                        style={{ border: showLowStock ? '1px solid rgba(255, 137, 4, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)' }}
                                    >
                                        <div className="flex items-center gap-[8px]">
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                <path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke={showLowStock ? "#FF8904" : "#F8FAFC"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
                                                <path d="M10 7.5V11.6667" stroke={showLowStock ? "#FF8904" : "#F8FAFC"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
                                                <path d="M10 15H10.0083" stroke={showLowStock ? "#FF8904" : "#F8FAFC"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
                                            </svg>
                                            <span className={cn("text-[14px] font-medium leading-[20px] transition-colors", showLowStock ? "text-[#FF8904]" : "text-[#F8FAFC]")}>{t.dashboard.products.list.showLowStock}</span>
                                        </div>
                                        <div className={cn("w-[44px] h-[24px] rounded-full flex items-center p-[4px] shrink-0 transition-colors duration-300", showLowStock ? "bg-[#FF6900]" : "bg-white/10")}>
                                            <div className={cn("w-[16px] h-[16px] bg-white rounded-full shrink-0 transition-transform duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)]", showLowStock ? "translate-x-[20px]" : "translate-x-0")} />
                                        </div>
                                    </div>
                                    <div className="text-[#F8FAFC]/50 text-[12px] font-normal leading-[16px]">{t.dashboard.products.list.lowStockDesc}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active Filters Bar */}
                    {(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock) && (
                        <div className="flex flex-wrap items-center gap-[8px] md:gap-[12px] pt-[8px] pb-[16px]">
                            <span className="text-[#F8FAFC]/50 text-[14px] font-medium shrink-0">{t.dashboard.products.list.activeFilters}</span>
                            {selectedCategories.map(cat => (
                                <div key={cat} className="flex items-center gap-[6px] pl-[12px] pr-[6px] h-[32px] rounded-[8px] bg-[#3B82F6]/10 shrink-0 transition-colors" style={{ border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                    <span className="text-[#3B82F6] text-[14px] font-medium leading-[20px] pb-px">{cat}</span>
                                    <span role="button" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} className="w-[20px] h-[20px] rounded-[4px] text-[#3B82F6]/60 hover:text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-colors cursor-pointer flex items-center justify-center">
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </span>
                                </div>
                            ))}
                            {saleStatus !== 'All Products' && (
                                <div className="flex items-center gap-[6px] pl-[12px] pr-[6px] h-[32px] rounded-[8px] bg-[#FB2C36]/10 shrink-0 transition-colors" style={{ border: '1px solid rgba(251, 44, 54, 0.3)' }}>
                                    <span className="text-[#FF6467] text-[14px] font-medium leading-[20px] pb-px">{saleStatus === 'On Sale' ? t.dashboard.products.list.onSale : t.dashboard.products.list.regularPrice}{saleStatus === 'On Sale' && ' 🔥'}</span>
                                    <span role="button" onClick={() => setSaleStatus('All Products')} className="w-[20px] h-[20px] rounded-[4px] text-[#FF6467]/60 hover:text-[#FF6467] hover:bg-[#FB2C36]/20 transition-colors cursor-pointer flex items-center justify-center">
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </span>
                                </div>
                            )}
                            {showLowStock && (
                                <div className="flex items-center gap-[6px] pl-[12px] pr-[6px] h-[32px] rounded-[8px] bg-[#FF8904]/10 shrink-0 transition-colors" style={{ border: '1px solid rgba(255, 137, 4, 0.3)' }}>
                                    <span className="text-[#FF8904] text-[14px] font-medium leading-[20px] pb-px">{t.dashboard.products.list.showLowStock.split('/')[0]}</span>
                                    <span role="button" onClick={() => setShowLowStock(false)} className="w-[20px] h-[20px] rounded-[4px] text-[#FF8904]/60 hover:text-[#FF8904] hover:bg-[#FF8904]/20 transition-colors cursor-pointer flex items-center justify-center">
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* List Products */}
                    <div className="flex flex-col gap-4">

                        {/* --- Desktop Table Container (Figma 30882:5856) --- */}
                        <div className="hidden md:flex flex-col rounded-[16px] border border-white/[0.08] bg-[#1E293B]/60 overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-[80px_minmax(250px,2fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_120px_100px] gap-4 items-center bg-[#0B1120]/50 border-b border-white/5 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.025em] text-[#F8FAFC]/60">
                                <div>{t.dashboard.products.list.colImg}</div>
                                <div>{t.dashboard.products.list.colName}</div>
                                <div>{t.dashboard.products.list.colPrice}</div>
                                <div>{t.dashboard.products.list.colStock}</div>
                                <div>{t.dashboard.products.list.colWeight}</div>
                                <div>{t.dashboard.products.list.colStatus}</div>
                                <div className="text-left">{t.dashboard.products.list.colActions}</div>
                            </div>

                            {/* Table Body */}
                            <div className="flex flex-col divide-y divide-white/5">
                                {filteredAndSortedProducts.map(product => {
                                    const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null
                                    const isOutOfStock = product.inventory <= 0
                                    const priceDisplay = formatPrice(product.price, product.currency)
                                    const weightDisplay = product.weight ? `${product.weight} kg` : '0.5 kg'
                                    
                                    return (
                                        <div key={product.id} onClick={() => setQuickViewProduct(product as DetailedProduct)} className="group grid grid-cols-[80px_minmax(250px,2fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_120px_100px] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] cursor-pointer transition-colors">
                                            {/* IMG */}
                                            <div className="h-[48px] w-[48px] rounded-[12px] bg-[#0B1120] border border-white/[0.08] relative shrink-0 overflow-hidden">
                                                {imgUrl ? (
                                                    <Image src={imgUrl} alt={product.name} fill className="object-cover" sizes="48px" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-50"><Image src="/images/figma/fallback-img.svg" width={20} height={20} alt="Fallback" /></div>
                                                )}
                                            </div>
                                            
                                            {/* Name & Variants */}
                                            <div className="min-w-0 pr-4 flex flex-col gap-[2px]">
                                                <p className="m-0 truncate text-[14px] leading-[20px] font-medium text-[#F8FAFC]">{product.name}</p>
                                                {product.category && product.category.length > 0 && (
                                                    <p className="m-0 text-[12px] leading-[16px] font-normal text-[#2DD4BF] truncate">
                                                        {product.category.map((c: Category | string) => typeof c === 'object' && c ? c.name : c).join(', ')}
                                                    </p>
                                                )}
                                                {product.sku && (
                                                    <p className="m-0 text-[12px] leading-[16px] font-normal text-[#F8FAFC]/40 truncate">{t.dashboard.products.list.sku} {product.sku}</p>
                                                )}
                                            </div>
                                            
                                            {/* Price */}
                                            <div className="text-[14px] font-medium text-[#F8FAFC]">{priceDisplay}</div>
                                            
                                            {/* Stock */}
                                            <div>
                                                {(() => {
                                                    const inv = product.inventory || 0;
                                                    if (inv === 0) {
                                                        return (
                                                            <div className="inline-flex h-[30px] items-center gap-[6px] rounded-[12px] px-[12px]" style={{ backgroundColor: 'rgba(251, 44, 54, 0.1)', border: '1px solid rgba(251, 44, 54, 0.3)' }}>
                                                                <div className="w-[8px] h-[8px] rounded-full bg-[#FB2C36]" />
                                                                <span className="text-[14px] font-medium text-[#FF6467] leading-[20px]">{inv}</span>
                                                            </div>
                                                        )
                                                    }
                                                    if (inv <= 5) {
                                                        return (
                                                            <div className="inline-flex h-[30px] items-center gap-[6px] rounded-[12px] px-[12px]" style={{ backgroundColor: 'rgba(255, 105, 0, 0.1)', border: '1px solid rgba(255, 105, 0, 0.3)' }}>
                                                                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke="#FF8904" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M10 7.5V11.6667" stroke="#FF8904" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                                                    <path d="M10 15H10.0083" stroke="#FF8904" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                                <span className="text-[14px] font-medium text-[#FF8904] leading-[20px]">{inv}</span>
                                                            </div>
                                                        )
                                                    }
                                                    return (
                                                        <div className="inline-flex h-[30px] min-w-[40px] items-center justify-center rounded-[12px] px-[12px]" style={{ backgroundColor: 'rgba(0, 201, 80, 0.1)', border: '1px solid rgba(0, 201, 80, 0.3)' }}>
                                                            <span className="text-[14px] font-medium text-[#05DF72] leading-[20px]">{inv}</span>
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                            
                                            {/* Weight */}
                                            <div className="text-[14px] font-medium text-[#F8FAFC]">{weightDisplay}</div>

                                            {/* Status */}
                                            <div className="flex items-center">
                                                <div 
                                                    onClick={(e) => handleUpdateStatus(product, e)}
                                                    className={cn(
                                                        "w-[56px] h-[32px] rounded-full p-[4px] flex items-center shrink-0 transition-all duration-300 cursor-pointer overflow-hidden relative",
                                                        product.status === 'active' ? "border-transparent" : "bg-[#1E293B]"
                                                    )}
                                                    style={{
                                                        border: product.status === 'active' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                                                        background: product.status === 'active' ? "linear-gradient(90deg, #3B82F6 0%, #3989F3 7%, #378FEF 14%, #3596EC 21%, #339CE9 29%, #32A2E5 36%, #30A8E1 43%, #2FAEDE 50%, #2EB3DA 57%, #2DB9D6 64%, #2DBFD1 71%, #2CC4CD 79%, #2CC9C9 86%, #2DCFC4 93%, #2DD4BF 100%)" : undefined,
                                                        boxShadow: product.status === 'active' ? "0px 0px 12px 0px rgba(59, 130, 246, 0.4)" : undefined
                                                    }}
                                                >
                                                    <div className={cn(
                                                        "w-[24px] h-[24px] bg-white rounded-full shrink-0 transition-transform duration-300 drop-shadow-md",
                                                        product.status === 'active' ? "translate-x-[24px]" : "translate-x-0"
                                                    )} />
                                                </div>
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="flex justify-start gap-2">
                                                <Link href={`/products/${product.id}`} onClick={e => e.stopPropagation()} className="flex items-center justify-center w-8 h-8 hover:bg-white/10 rounded-lg transition-colors text-[#3B82F6] hover:text-[#3B82F6]/80">
                                                    <SquarePen className="w-5 h-5" strokeWidth={1.5} />
                                                </Link>
                                                <button onClick={e => handleDelete(product, e)} className="flex items-center justify-center w-8 h-8 bg-transparent border-none hover:bg-[#FF6467]/10 rounded-lg transition-colors text-[#FF6467] hover:text-[#FF6467]/80">
                                                    <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* --- Mobile View (Figma Node 30945:1017 - High Fidelity Refinement) --- */}
                        <div className="md:hidden flex flex-col gap-3">
                            {filteredAndSortedProducts.map(product => {
                                const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null
                                const inv = product.inventory || 0
                                const priceDisplay = formatPrice(product.price, product.currency)

                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => setQuickViewProduct(product as DetailedProduct)}
                                        className="flex flex-col gap-[12px] rounded-[16px] border border-white/[0.08] bg-[#1E293B]/70 p-[16px] relative group overflow-hidden"
                                    >
                                        {/* Section 1: Thumbnail + Name/Category/Variants/SKU */}
                                        <div className="flex items-start gap-[12px]">
                                            {/* Thumbnail 64×64 */}
                                            <div className="relative h-[64px] w-[64px] shrink-0 rounded-[12px] bg-[#0B1120] border border-white/[0.08] overflow-hidden">
                                                {imgUrl ? (
                                                    <Image src={imgUrl} alt={product.name} fill className="object-cover" sizes="64px" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-50">
                                                        <Image src="/images/figma/fallback-img.svg" width={32} height={32} alt="Fallback" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Text Information Block */}
                                            <div className="flex flex-col flex-1 min-w-0 pt-[2px] gap-[2px]">
                                                <div className="text-[14px] font-semibold text-[#F8FAFC] leading-[18px] truncate pb-[1px]">
                                                    {product.name}
                                                </div>
                                                {product.category && product.category.length > 0 && (
                                                    <div className="text-[12px] text-[#2DD4BF] font-medium leading-[16px] truncate">
                                                        {product.category.map(cat => typeof cat === 'string' ? cat : cat.name).join(', ')}
                                                    </div>
                                                )}
                                                {product.hasVariants && product.variants && product.variants.length > 0 && (
                                                    <div className="text-[12px] text-[#F8FAFC]/50 leading-[16px] truncate">
                                                        {t.dashboard.products.form.size} {product.variants.slice(0, 3).map(v => v.name).join(', ')}
                                                    </div>
                                                )}
                                                {product.sku && (
                                                    <div className="text-[12px] text-[#F8FAFC]/40 leading-[16px] truncate">
                                                        {t.dashboard.products.list.sku} {product.sku}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Section 2: Price + Stock/Status */}
                                        <div className="flex items-end justify-between">
                                            {/* Price (Left Aligned) */}
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[12px] font-normal text-[#F8FAFC]/60 leading-[16px]">{t.dashboard.products.list.colPrice.split(' ')[0]}</span>
                                                <span className="text-[18px] font-bold text-[#F8FAFC] leading-[22px]">{priceDisplay}</span>
                                            </div>

                                            {/* Stock + Status Toggle (Right Aligned) */}
                                            <div className="flex items-end gap-3">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="text-[12px] font-normal text-[#F8FAFC]/60 leading-[16px]">{t.dashboard.products.list.colStock}</span>
                                                    {inv === 0 ? (
                                                        <div className="inline-flex h-[26px] items-center justify-center rounded-[8px] px-2 bg-[#FF6467]/10 border border-[#FF6467]/30">
                                                            <span className="text-[13px] font-semibold text-[#FF6467]">{inv}</span>
                                                        </div>
                                                    ) : inv <= 5 ? (
                                                        <div className="inline-flex h-[26px] items-center justify-center gap-1 rounded-[8px] px-2 bg-[#FF8904]/10 border border-[#FF8904]/30">
                                                            <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke="#FF8904" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                            <span className="text-[13px] font-semibold text-[#FF8904]">{inv}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex h-[26px] items-center justify-center rounded-[8px] px-2 bg-[#05DF72]/10 border border-[#05DF72]/30">
                                                            <span className="text-[13px] font-semibold text-[#05DF72]">{inv}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Status Toggle - Compacted */}
                                                <div
                                                    onClick={(e) => handleUpdateStatus(product, e)}
                                                    className="w-[42px] h-[22px] rounded-full p-[2px] flex items-center shrink-0 transition-all duration-300 cursor-pointer overflow-hidden mb-[2px]"
                                                    style={{
                                                        border: product.status === 'active' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                                                        background: product.status === 'active' ? "linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)" : "#1E293B",
                                                        boxShadow: product.status === 'active' ? "0px 0px 10px 0px rgba(59, 130, 246, 0.35)" : undefined
                                                    }}
                                                >
                                                    <div className={cn(
                                                        "w-[18px] h-[18px] bg-white rounded-full shrink-0 transition-transform duration-300 shadow-sm",
                                                        product.status === 'active' ? "translate-x-[20px]" : "translate-x-0"
                                                    )} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 3: Action Row */}
                                        <div className="flex items-center gap-2">
                                            {/* Edit Button - Compacted */}
                                            <Link
                                                href={`/products/${product.id}`}
                                                onClick={e => e.stopPropagation()}
                                                className="flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[12px] text-[15px] font-semibold text-[#3B82F6] bg-blue-500/10 border border-blue-500/20 active:scale-[0.98] transition-all"
                                            >
                                                <SquarePen className="w-[18px] h-[18px]" strokeWidth={2} />
                                                {t.dashboard.products.list.edit}
                                            </Link>
                                            
                                            {/* Delete Button */}
                                            <button
                                                onClick={e => handleDelete(product, e)}
                                                className="flex items-center justify-center w-[44px] h-[44px] rounded-[12px] text-[#FF6467] bg-red-500/10 border border-red-500/20 active:scale-[0.95] hover:bg-red-500/20 transition-all"
                                            >
                                                <Trash2 className="w-[18px] h-[18px]" strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {filteredAndSortedProducts.length === 0 && (
                            <div className="py-16 text-center text-[15px] text-[#F8FAFC]/40">
                                {t.dashboard.products.list.noResults}
                            </div>
                        )}
                    </div>
                </>
            )}

            {showBulkCreate && (
                <BulkCreateModal 
                    initialPrompt={aiPrompt}
                    onClose={() => setShowBulkCreate(false)}
                    onSuccess={() => {
                        setAiPrompt('')
                        loadProducts()
                    }}
                />
            )}

            {quickViewProduct && (
                <>
                    <div className="hidden md:block">
                        <ProductQuickViewModal 
                            isOpen={!!quickViewProduct} 
                            onClose={() => setQuickViewProduct(null)} 
                            product={quickViewProduct} 
                            onDelete={handleDelete}
                        />
                    </div>
                    {mounted && typeof document !== 'undefined' && createPortal(
                        <div className="block md:hidden fixed inset-0 z-[9999] bg-[#0B1120] overflow-y-auto w-full h-full">
                            <ProductDetailsMobile
                                product={quickViewProduct}
                                onClose={() => setQuickViewProduct(null)}
                                onEdit={() => router.push(`/products/${quickViewProduct.id}`)}
                                onDelete={() => handleDelete(quickViewProduct)}
                            />
                        </div>,
                        document.body
                    )}
                </>
            )}

            <DeleteProductModal
                isOpen={!!productToDelete}
                onClose={() => setProductToDelete(null)}
                onConfirm={confirmDelete}
                productName={productToDelete?.name || ''}
                isDeleting={isDeletingProduct}
            />
        </div>
    )
}
