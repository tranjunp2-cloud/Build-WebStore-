'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, RefreshCw, SearchX, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ProductsSkeleton } from '@/components/dashboard/ProductsSkeleton'
import { ProductImageFallback } from '@/components/dashboard/ProductImageFallback'
import { ProductImageWithFallback } from '@/components/dashboard/ProductImageWithFallback'
import { ProductsEmptyState } from '@/components/dashboard/ProductsEmptyState'
import { BulkCreateModal } from '@/components/dashboard/BulkCreateModal'
import { ProductQuickViewModal, DetailedProduct } from '@/components/dashboard/ProductQuickViewModal'
import { ProductDetailsMobile } from '@/components/dashboard/product-form/ProductDetailsMobile'
import { DeleteProductModal } from '@/components/dashboard/DeleteProductModal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableActionButton } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { TablePagination } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'
import { useI18n } from '@/i18n'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import { getProductsAction, updateProductFieldAction } from './actions'
import { getCategoriesAction } from './categories/actions'
import { getDisplayPrice } from '@/lib/products/display-price'

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
    sku?: string
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
    attributes?: Array<{ key: string; value: string }>
    descText?: string
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

function getImageUrl(image: ProductImage | string | null): string | null {
    if (!image || typeof image === 'string') return null
    let url = image.url || image.thumbnailURL || null
    if (!url) return null

    // Fix existing broken local URLs directly to S3 because MinIO stores them
    if (url.includes('/api/media/file/')) {
        if (process.env.NEXT_PUBLIC_S3_ENDPOINT) {
            const filename = url.split('/').pop()
            url = `${process.env.NEXT_PUBLIC_S3_ENDPOINT}/primeweb-media/${filename}`
        }
    }

    return url
}

export default function ProductsPage() {
    const { t } = useI18n()
    const sub = t.common.subscriptionErrors
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
    const [currentPage, setCurrentPage] = useState(1)

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
        setCurrentPage(1)
    }, [filterStatus, searchQuery, showLowStock, saleStatus, selectedCategories, sortBy])

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
            const fetchedDocs = await getProductsAction()

            // Fetch categories for filter panel
            try {
                const catDocs = await getCategoriesAction()
                setCategories(catDocs as Category[] || [])
            } catch (ignore) { }

            setProducts(fetchedDocs as Product[])
        } catch (err) {
            const message = err instanceof Error ? err.message : t.dashboard.products.list.failedToLoad
            setError(message)
            toast.error(t.dashboard.products.list.failedToLoad, {
                action: { label: t.dashboard.products.list.retry, onClick: () => loadProducts() },
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
                    return getDisplayPrice(a).value - getDisplayPrice(b).value
                case 'Price: High > Low':
                    return getDisplayPrice(b).value - getDisplayPrice(a).value
                case 'Inventory: Low > High':
                    return (a.inventory || 0) - (b.inventory || 0)
                default:
                    return 0
            }
        })

    // Rows-per-page stateful so the DS TablePagination selector ([10,25,50,100]) works (GH-1290 Bug 4)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage)
    const paginatedProducts = filteredAndSortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const handleLimitChange = (n: number) => { setItemsPerPage(n); setCurrentPage(1) }

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
            await updateProductFieldAction(prod.id, { status: newStatus })
            toast.success(`${t.dashboard.products.form.successMarkedAs} ${newStatus}`)
        } catch (e: unknown) {
            toast.error(resolveApiError(e instanceof Error ? e.message : null, t.dashboard.products.form.failedUpdateStatus, sub))
            setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: prod.status } : p))
        }
    }

    const handleRestore = async (id: string) => {
        try {
            await updateProductFieldAction(id, { deletedAt: null })
            toast.success(t.dashboard.products.form.restored)
            loadProducts()
        } catch (e: unknown) {
            toast.error(resolveApiError(e instanceof Error ? e.message : null, t.dashboard.products.form.failedRestore, sub))
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
            await updateProductFieldAction(prod.id, { deletedAt: new Date().toISOString() })

            // Wait for transition before unmounting modal completely if we want, but closing immediately is also fine
            setProductToDelete(null)

            // If the deleted product is currently being previewed, close the preview
            if (quickViewProduct?.id === prod.id) {
                setQuickViewProduct(null)
            }

            toast.success(t.dashboard.products.form.productDeleted, {
                action: {
                    label: t.dashboard.products.form.undo,
                    onClick: () => handleRestore(prod.id)
                },
                duration: 5000,
            })
        } catch (e: unknown) {
            toast.error(resolveApiError(e instanceof Error ? e.message : null, t.dashboard.products.form.failedDelete, sub))
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
                    <AlertCircle className="mx-auto h-12 w-12 text-[hsl(var(--destructive))]/60" />
                    <h2 className="mt-4 text-lg font-semibold text-white">{t.dashboard.products.list.failedToLoad}</h2>
                    <p className="mt-1 text-sm text-gray-500">{error}</p>
                    <button onClick={loadProducts}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-5 py-2.5 text-sm font-medium !text-white hover:bg-[hsl(var(--primary))] transition-colors">
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
            <div className="rounded-[16px] border border-[hsl(var(--primary))]/20 bg-gradient-to-r from-blue-500/10 to-teal-400/10 p-[24px] overflow-hidden relative">
                <div className="relative flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <Image src="/images/figma/ai-chat-icon.svg" width={24} height={24} alt="AI" className="shrink-0" />
                        <h2 className="text-[18px] font-semibold text-foreground">{t.dashboard.products.list.aiChatTitle}</h2>
                    </div>
                    <div className="flex flex-col md:flex-row w-full items-stretch md:items-center gap-[12px]">
                        <div className="w-full md:flex-1 flex items-center bg-[hsl(var(--secondary))] border border-white/[0.08] rounded-[16px] px-4 h-[50px] min-h-[50px] shrink-0 focus-within:border-white focus-within:ring-1 focus-within:ring-white transition-all duration-200">
                            <input
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && aiPrompt.trim()) handleCreateAi()
                                }}
                                placeholder={t.dashboard.products.list.aiChatPlaceholder}
                                className="w-full bg-transparent text-[16px] text-foreground outline-none border-none focus:border-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none placeholder:text-slate-400"
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
                            <h1 className="text-[24px] font-bold leading-none text-foreground">{t.dashboard.products.title}</h1>
                            <span className="block text-[14px] leading-none text-foreground/60">{t.dashboard.products.subtitle}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                            <Button asChild variant="dashSecondary" size="dash" className="w-full sm:w-auto justify-center">
                                <Link href="/products/categories">
                                    {t.dashboard.products.list.category}
                                </Link>
                            </Button>
                            <Button asChild variant="dashPrimary" size="dash" className="w-full sm:w-auto justify-center">
                                <Link href="/products/new">
                                    <Image src="/images/figma/add-product.svg" alt="Add" width={16} height={16} className="shrink-0 brightness-0 invert" /> {t.dashboard.products.addProduct}
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center md:gap-4 border-b border-white/[0.08] overflow-x-auto no-scrollbar">
                        {/* All tab */}
                        <button onClick={() => setFilterStatus('all')}
                            className="flex-1 md:flex-none min-w-max bg-transparent flex h-[44px] items-center justify-center px-3 gap-1.5 relative transition-colors cursor-pointer border-none outline-none">

                            <span className={cn("text-[13px] font-medium", filterStatus === 'all' ? "text-[hsl(var(--primary))]" : "text-foreground/60")}>
                                {t.dashboard.products.list.filterAll}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'all' ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "bg-white/5 text-foreground/60")}>
                                {statusCounts.all}
                            </span>
                            {filterStatus === 'all' && (
                                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-teal-400" />
                            )}
                        </button>

                        {/* Active tab */}
                        <button onClick={() => setFilterStatus('active')}
                            className="flex-1 md:flex-none min-w-max bg-transparent flex h-[44px] items-center justify-center px-3 gap-1.5 relative transition-colors cursor-pointer border-none outline-none">
                            <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))] shrink-0" />
                            <span className={cn("text-[13px] font-medium", filterStatus === 'active' ? "text-[hsl(var(--primary))]" : "text-foreground/60")}>
                                {t.dashboard.products.list.filterActive}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'active' ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "bg-white/5 text-foreground/60")}>
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
                            <span className={cn("text-[13px] font-medium", filterStatus === 'draft' ? "text-[hsl(var(--primary))]" : "text-foreground/60")}>
                                {t.dashboard.products.list.filterDraft}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'draft' ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "bg-white/5 text-foreground/60")}>
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
                            <span className={cn("text-[13px] font-medium", filterStatus === 'archived' ? "text-[hsl(var(--primary))]" : "text-foreground/60")}>
                                {t.dashboard.products.list.filterArchived}
                            </span>
                            <span className={cn("flex h-[18px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                                filterStatus === 'archived' ? "bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]" : "bg-white/5 text-foreground/60")}>
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
                            <Image src="/images/figma/search-icon.svg" width={20} height={20} className="absolute left-4 top-1/2 -translate-y-1/2 invert dark:invert-0" alt="Search" />
                            {/* border ở className (không inline) để focus: variant override được — focus state chuẩn DS (GH-1290 Bug 3) */}
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t.dashboard.products.list.search}
                                style={{ background: 'transparent', color: 'var(--dash-text)' }}
                                className="w-full h-full rounded-[16px] border border-[var(--dash-border)] pl-[48px] pr-4 text-[16px] placeholder:text-[var(--dash-text-muted)] outline-none transition-colors focus:border-[hsl(var(--primary))] focus:[box-shadow:0_0_0_3px_hsl(var(--ring)/0.25)]"
                            />
                        </div>

                        {/* Row 2: Sort Button — full-width, label left + icon right */}
                        <div className="relative w-full" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ background: 'transparent', border: isDropdownOpen ? '1px solid hsl(var(--primary)/0.5)' : '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
                                className="w-full h-[50px] flex items-center justify-between px-4 rounded-[16px] text-[16px] font-medium transition-colors outline-none"
                            >
                                <span>{sortTranslateMap[sortBy]}</span>
                                <Image src="/images/figma/dropdown-arrow-icon.svg" width={20} height={20} alt="Sort" className="invert dark:invert-0" />
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-20">
                                    <div className="bg-[hsl(var(--secondary))] rounded-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.3)] flex flex-col py-2">
                                        {SORT_OPTIONS.map((option) => (
                                            // Theme-aware colors (GH-1290 Bug 2): tránh text-white cứng (vô hình ở light mode)
                                            <button key={option} onClick={() => { setSortBy(option); setIsDropdownOpen(false) }}
                                                className="w-full px-4 py-[10px] text-left text-[15px] leading-[22px] bg-transparent transition-colors outline-none border-none hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                                                style={{ color: sortBy === option ? 'var(--dash-text)' : 'var(--dash-text-muted)', fontWeight: sortBy === option ? 500 : 400 }}>
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
                            style={{ background: 'transparent', border: isAdvancedFiltersOpen ? '1px solid hsl(var(--primary)/0.5)' : '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
                            className="w-full h-[50px] flex items-center justify-center gap-2 rounded-[16px] text-[16px] font-medium transition-colors outline-none"
                        >
                            <Image src="/images/figma/filter-icon.svg" width={20} height={20} alt="Filter" className="invert dark:invert-0" />
                            <span>
                                {t.dashboard.products.list.filterBtn}{(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock)
                                    ? ` (${selectedCategories.length + (saleStatus !== 'All Products' ? 1 : 0) + (showLowStock ? 1 : 0)})`
                                    : ''}
                            </span>
                        </button>
                    </div>

                    {/* Search & Filter — Desktop (Figma Node 30882:5844): 3-item row */}
                    <div className="hidden md:flex items-center gap-[17px] w-full">
                        {/* Search Input — shared <TableSearch> (GH-1222 DS) */}
                        <TableSearch
                            value={searchQuery}
                            onSearch={setSearchQuery}
                            debounceMs={0}
                            placeholder={t.dashboard.products.list.search}
                        />

                        {/* Sort — shared <FilterChip> (GH-1290 Bug 2, theme-aware, khớp /orders) */}
                        <FilterChip<string>
                            label={t.dashboard.products.list.sortLabel}
                            value={sortBy}
                            options={SORT_OPTIONS.map((o) => ({ key: o, label: sortTranslateMap[o] }))}
                            onChange={setSortBy}
                        />

                        {/* Filter Button — trigger styled to match DS chips (transparent);
                            the advanced filters panel below is kept as-is. */}
                        <button
                            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                            style={{ background: 'transparent', border: '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
                            className="flex items-center justify-center gap-1.5 h-9 rounded-md px-3 text-[13px] font-medium transition-colors whitespace-nowrap outline-none"
                        >
                            <Image src="/images/figma/filter-icon.svg" width={16} height={16} alt="Filter" className="invert dark:invert-0" />
                            {t.dashboard.products.list.filterBtn}
                        </button>
                    </div>

                    {/* Advanced Filters Panel */}
                    {isAdvancedFiltersOpen && (
                        <div className="bg-[hsl(var(--secondary))]/60 backdrop-blur-[20px] border border-white/[0.08] rounded-[16px] p-4 md:p-[25px] flex flex-col gap-[16px] mt-4 w-full relative z-10 shadow-xl">
                            {/* Panel Header */}
                            <div className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-[10px]">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18.3333 2.5H1.66667L8.33333 10.3833V15.8333L11.6667 17.5V10.3833L18.3333 2.5Z" stroke="hsl(var(--primary))" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="text-foreground text-[16px] md:text-[18px] font-semibold leading-[28px]">{t.dashboard.products.list.advancedFilters}</div>
                                </div>
                                <button
                                    onClick={() => { setSelectedCategories([]); setSaleStatus('All Products'); setShowLowStock(false); setIsAdvancedFiltersOpen(false); }}
                                    className="flex items-center gap-[8px] bg-transparent border-none outline-none text-foreground/50 hover:text-foreground transition-colors"
                                >
                                    <span className="text-[13px] font-medium leading-[20px]">{t.dashboard.products.list.clearAll}</span>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* Filter Sections — stacked on mobile, 3-col on desktop */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-[24px]">

                                {/* ── Category ── */}
                                <div className="flex flex-col gap-[10px] min-w-0">
                                    <div className="text-foreground text-[14px] font-medium leading-[20px] mb-[2px] opacity-80">{t.dashboard.products.list.category}</div>
                                    {/* 2-column grid on mobile, single column on desktop */}
                                    <div className="grid grid-cols-2 md:grid-cols-1 gap-x-3 gap-y-[10px] max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                                        {categories.map(category => {
                                            const cat = category.name;
                                            const isSelected = selectedCategories.includes(cat);
                                            return (
                                                <label key={cat} className="flex items-center gap-[8px] cursor-pointer group min-h-[28px]"
                                                    onClick={(e) => { e.preventDefault(); setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]); }}>
                                                    {isSelected ? (
                                                        <div className="w-5 h-5 flex shrink-0 items-center justify-center rounded-[4px] bg-[hsl(var(--primary))] group-hover:opacity-80 transition-opacity">
                                                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M4.00004 7.8L1.20004 5L0.266708 5.93333L4.00004 9.66667L12 1.66667L11.0667 0.733337L4.00004 7.8Z" fill="white" /></svg>
                                                        </div>
                                                    ) : (
                                                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 stroke-[hsl(var(--input-border))] group-hover:stroke-[hsl(var(--primary))]/50 transition-colors">
                                                            <rect x="1" y="1" width="18" height="18" rx="3" fill="transparent" strokeWidth="2" />
                                                        </svg>
                                                    )}
                                                    <span className={cn("text-[14px] font-medium leading-[20px] truncate", isSelected ? "text-foreground" : "text-foreground/80")}>{cat}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Divider (mobile only) */}
                                <div className="md:hidden w-full h-[1px] bg-white/10" />

                                {/* ── Sale Status ── */}
                                <div className="flex flex-col gap-[10px] min-w-0">
                                    <div className="text-foreground text-[14px] font-medium leading-[20px] mb-[2px] opacity-80">{t.dashboard.products.list.saleStatus}</div>
                                    {/* Horizontal pill-style on mobile */}
                                    <div className="flex md:flex-col flex-wrap gap-2 md:gap-[8px]">
                                        {(['All Products', 'On Sale', 'Regular Price'] as const).map((status) => (
                                            <label key={status} className="flex items-center gap-[8px] cursor-pointer group min-h-[28px]"
                                                onClick={(e) => { e.preventDefault(); setSaleStatus(status); }}>
                                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
                                                    {saleStatus === status ? (
                                                        <>
                                                            <circle cx="10" cy="10" r="9" fill="transparent" stroke="hsl(var(--primary))" strokeWidth="2" />
                                                            <circle cx="10" cy="10" r="5" fill="hsl(var(--primary))" />
                                                        </>
                                                    ) : (
                                                        <circle cx="10" cy="10" r="9" fill="transparent" stroke="var(--dash-border)" strokeWidth="2" className="group-hover:stroke-[hsl(var(--primary))]/50 transition-colors" />
                                                    )}
                                                </svg>
                                                <span className={cn("text-[14px] font-medium leading-[20px] whitespace-nowrap", saleStatus === status ? "text-foreground" : "text-foreground/80")}>{status === 'All Products' ? t.dashboard.products.list.allProducts : status === 'On Sale' ? t.dashboard.products.list.onSale : t.dashboard.products.list.regularPrice}</span>
                                                {status === 'On Sale' && <span className="bg-[#FB2C36]/20 border border-[#FB2C36]/30 text-[hsl(var(--destructive))] rounded-[4px] px-[6px] py-[2px] text-[12px] font-medium leading-[16px]">🔥</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Divider (mobile only) */}
                                <div className="md:hidden w-full h-[1px] bg-white/10" />

                                {/* ── Stock Status ── */}
                                <div className="flex flex-col gap-[10px] min-w-0">
                                    <div className="text-foreground text-[14px] font-medium leading-[20px] mb-[2px] opacity-80">{t.dashboard.products.list.stockStatus}</div>
                                    <div
                                        onClick={(e) => { e.preventDefault(); setShowLowStock(!showLowStock); }}
                                        className={cn("rounded-[16px] h-[50px] flex items-center justify-between px-[17px] transition-colors cursor-pointer", showLowStock ? "bg-[hsl(var(--warning)/0.1)]" : "bg-[hsl(var(--background))]")}
                                        style={{ border: showLowStock ? '1px solid hsl(var(--warning)/0.3)' : '1px solid var(--dash-border)' }}
                                    >
                                        <div className="flex items-center gap-[8px]">
                                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                <path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke={showLowStock ? "hsl(var(--warning))" : "hsl(var(--foreground))"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
                                                <path d="M10 7.5V11.6667" stroke={showLowStock ? "hsl(var(--warning))" : "hsl(var(--foreground))"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
                                                <path d="M10 15H10.0083" stroke={showLowStock ? "hsl(var(--warning))" : "hsl(var(--foreground))"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" className="transition-colors" />
                                            </svg>
                                            <span className={cn("text-[14px] font-medium leading-[20px] transition-colors", showLowStock ? "text-[hsl(var(--warning))]" : "text-foreground")}>{t.dashboard.products.list.showLowStock}</span>
                                        </div>
                                        <div className={cn("w-[44px] h-[24px] rounded-full flex items-center p-[4px] shrink-0 transition-colors duration-300", showLowStock ? "bg-[hsl(var(--warning))]" : "bg-white/10")}>
                                            <div className={cn("w-[16px] h-[16px] bg-white rounded-full shrink-0 transition-transform duration-300 shadow-[0_2px_4px_rgba(0,0,0,0.1)]", showLowStock ? "translate-x-[20px]" : "translate-x-0")} />
                                        </div>
                                    </div>
                                    <div className="text-foreground/50 text-[12px] font-normal leading-[16px]">{t.dashboard.products.list.lowStockDesc}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active Filters Bar */}
                    {(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock) && (
                        <div className="flex flex-wrap items-center gap-[8px] md:gap-[12px] pt-[8px] pb-[16px]">
                            <span className="text-foreground/50 text-[14px] font-medium shrink-0">{t.dashboard.products.list.activeFilters}</span>
                            {selectedCategories.map(cat => (
                                <div key={cat} className="flex items-center gap-[6px] pl-[12px] pr-[6px] h-[32px] rounded-[8px] bg-[hsl(var(--primary)/0.1)] shrink-0 transition-colors" style={{ border: '1px solid hsl(var(--primary)/0.3)' }}>
                                    <span className="text-[hsl(var(--primary))] text-[14px] font-medium leading-[20px] pb-px">{cat}</span>
                                    <span role="button" onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))} className="w-[20px] h-[20px] rounded-[4px] text-[hsl(var(--primary))]/60 hover:text-[hsl(var(--primary))] hover:bg-[#3B82F6]/20 transition-colors cursor-pointer flex items-center justify-center">
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                </div>
                            ))}
                            {saleStatus !== 'All Products' && (
                                <div className="flex items-center gap-[6px] pl-[12px] pr-[6px] h-[32px] rounded-[8px] bg-[hsl(var(--destructive)/0.1)] shrink-0 transition-colors" style={{ border: '1px solid hsl(var(--destructive)/0.3)' }}>
                                    <span className="text-[hsl(var(--destructive))] text-[14px] font-medium leading-[20px] pb-px">{saleStatus === 'On Sale' ? t.dashboard.products.list.onSale : t.dashboard.products.list.regularPrice}{saleStatus === 'On Sale' && ' 🔥'}</span>
                                    <span role="button" onClick={() => setSaleStatus('All Products')} className="w-[20px] h-[20px] rounded-[4px] text-[hsl(var(--destructive))]/60 hover:text-[hsl(var(--destructive))] hover:bg-[#FB2C36]/20 transition-colors cursor-pointer flex items-center justify-center">
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                </div>
                            )}
                            {showLowStock && (
                                <div className="flex items-center gap-[6px] pl-[12px] pr-[6px] h-[32px] rounded-[8px] bg-[hsl(var(--warning)/0.1)] shrink-0 transition-colors" style={{ border: '1px solid hsl(var(--warning)/0.3)' }}>
                                    <span className="text-[hsl(var(--warning))] text-[14px] font-medium leading-[20px] pb-px">{t.dashboard.products.list.showLowStock.split('/')[0]}</span>
                                    <span role="button" onClick={() => setShowLowStock(false)} className="w-[20px] h-[20px] rounded-[4px] text-[hsl(var(--warning))]/60 hover:text-[hsl(var(--warning))] hover:bg-[#FF8904]/20 transition-colors cursor-pointer flex items-center justify-center">
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* List Products */}
                    <div className="flex flex-col gap-4">

                        {/* --- Desktop Table (GH-1222 DS migration) --- */}
                        {filteredAndSortedProducts.length > 0 && (
                            <div className="hidden md:block">
                                <Table
                                    className="table-fixed w-full"
                                    minWidth={860}
                                    footer={
                                        <TablePagination
                                            page={currentPage}
                                            total={filteredAndSortedProducts.length}
                                            limit={itemsPerPage}
                                            onPageChange={setCurrentPage}
                                            onLimitChange={handleLimitChange}
                                            labels={{ unit: 'products' }}
                                        />
                                    }
                                >
                                    <colgroup>
                                        <col style={{ width: '60px' }} />
                                        <col style={{ width: '30%' }} />
                                        <col style={{ width: '16%' }} />
                                        <col style={{ width: '13%' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '13%' }} />
                                        <col style={{ width: '86px' }} />
                                    </colgroup>

                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t.dashboard.products.list.colImg}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colName}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colPrice}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colStock}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colWeight}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colStatus}</TableHead>
                                            <TableHead className="text-right">{t.dashboard.products.list.colActions}</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {paginatedProducts.map(product => {
                                            const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null
                                            const { value: dpValue, isVariant: dpIsVariant } = getDisplayPrice(product)
                                            const priceDisplay = `${dpIsVariant ? (t.dashboard.products.list.fromPrefix || 'From ') : ''}${formatPrice(dpValue, product.currency)}`
                                            const weightDisplay = product.weight != null && product.weight > 0 ? `${product.weight} kg` : '—'
                                            const inv = product.inventory || 0

                                            return (
                                                <TableRow
                                                    key={product.id}
                                                    clickable
                                                    onClick={() => setQuickViewProduct(product as DetailedProduct)}
                                                >
                                                    {/* Thumbnail */}
                                                    <TableCell>
                                                        <div className="relative h-10 w-10 shrink-0 rounded-[8px] bg-[hsl(var(--background))] border border-white/[0.08] overflow-hidden">
                                                            <ProductImageWithFallback imgUrl={imgUrl} alt={product.name} size="sm" sizes="40px" />
                                                        </div>
                                                    </TableCell>

                                                    {/* Name + SKU */}
                                                    <TableCell>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="truncate font-medium text-[14px]" style={{ color: 'var(--dash-text)' }} title={product.name}>
                                                                {product.name}
                                                            </span>
                                                            {product.sku && (
                                                                <span className="text-[12px] truncate" style={{ color: 'var(--dash-text-muted)' }}>
                                                                    {t.dashboard.products.list.sku} {product.sku}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Price */}
                                                    <TableCell>
                                                        <span className="text-[14px] font-medium tabular-nums" style={{ color: 'var(--dash-text)' }}>
                                                            {priceDisplay}
                                                        </span>
                                                    </TableCell>

                                                    {/* Stock */}
                                                    <TableCell>
                                                        {inv === 0 ? (
                                                            <Badge variant="destructive" dot>{inv}</Badge>
                                                        ) : inv <= 5 ? (
                                                            <Badge variant="warning" dot>{inv}</Badge>
                                                        ) : (
                                                            <Badge variant="success" dot>{inv}</Badge>
                                                        )}
                                                    </TableCell>

                                                    {/* Weight */}
                                                    <TableCell>
                                                        <span className="text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>{weightDisplay}</span>
                                                    </TableCell>

                                                    {/* Status toggle */}
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <Switch
                                                            checked={product.status === 'active'}
                                                            onCheckedChange={() => handleUpdateStatus(product, { stopPropagation: () => { } } as React.MouseEvent)}
                                                        />
                                                    </TableCell>

                                                    {/* Actions */}
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <TableActionButton
                                                                onClick={() => router.push(`/products/${product.id}`)}
                                                                title={t.dashboard.products.list.edit}
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </TableActionButton>
                                                            <TableActionButton
                                                                variant="danger"
                                                                onClick={(e) => handleDelete(product, e)}
                                                                title={t.dashboard.products.form.delete}
                                                            >
                                                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                                            </TableActionButton>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* --- Mobile View (Figma Node 30945:1017 - High Fidelity Refinement) --- */}
                        <div className="md:hidden flex flex-col gap-3">
                            {paginatedProducts.map(product => {
                                const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null
                                const inv = product.inventory || 0
                                const { value: dpValue, isVariant: dpIsVariant } = getDisplayPrice(product)
                                const priceDisplay = `${dpIsVariant ? (t.dashboard.products.list.fromPrefix || 'From ') : ''}${formatPrice(dpValue, product.currency)}`

                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => setQuickViewProduct(product as DetailedProduct)}
                                        className="flex flex-col gap-[12px] rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary))]/70 p-[16px] relative group overflow-hidden"
                                    >
                                        {/* Section 1: Thumbnail + Name/Category/Variants/SKU */}
                                        <div className="flex items-start gap-[12px]">
                                            {/* Thumbnail 64×64 */}
                                            <div className="relative h-[64px] w-[64px] shrink-0 rounded-[12px] bg-[hsl(var(--background))] border border-white/[0.08] overflow-hidden">
                                                <ProductImageWithFallback imgUrl={imgUrl} alt={product.name} size="md" sizes="64px" />
                                            </div>

                                            {/* Text Information Block */}
                                            <div className="flex flex-col flex-1 min-w-0 pt-[2px] gap-[2px]">
                                                <div className="text-[14px] font-semibold text-foreground leading-[18px] truncate pb-[1px]">
                                                    {product.name}
                                                </div>
                                                {product.category && product.category.length > 0 && (
                                                    <div className="text-[12px] text-[hsl(var(--primary))] font-medium leading-[16px] truncate">
                                                        {product.category.map(cat => typeof cat === 'string' ? cat : cat.name).join(', ')}
                                                    </div>
                                                )}
                                                {product.hasVariants && product.variants && product.variants.length > 0 && (
                                                    <div className="text-[12px] text-foreground/50 leading-[16px] truncate">
                                                        {t.dashboard.products.form.size} {product.variants.slice(0, 3).map(v => v.name).join(', ')}
                                                    </div>
                                                )}
                                                {product.sku && (
                                                    <div className="text-[12px] text-foreground/40 leading-[16px] truncate">
                                                        {t.dashboard.products.list.sku} {product.sku}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Section 2: Price + Stock/Status */}
                                        <div className="flex items-end justify-between">
                                            {/* Price (Left Aligned) */}
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[12px] font-normal text-foreground/60 leading-[16px]">{t.dashboard.products.list.colPrice.split(' ')[0]}</span>
                                                <span className="text-[18px] font-bold text-foreground leading-[22px]">{priceDisplay}</span>
                                            </div>

                                            {/* Stock + Status Toggle (Right Aligned) */}
                                            <div className="flex items-end gap-3">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="text-[12px] font-normal text-foreground/60 leading-[16px]">{t.dashboard.products.list.colStock}</span>
                                                    {inv === 0 ? (
                                                        <div className="inline-flex h-[26px] items-center justify-center rounded-[8px] px-2 bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)]">
                                                            <span className="text-[13px] font-semibold text-[hsl(var(--destructive))]">{inv}</span>
                                                        </div>
                                                    ) : inv <= 5 ? (
                                                        <div className="inline-flex h-[26px] items-center justify-center gap-1 rounded-[8px] px-2 bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.3)]">
                                                            <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke="hsl(var(--warning))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                            <span className="text-[13px] font-semibold text-[hsl(var(--warning))]">{inv}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex h-[26px] items-center justify-center rounded-[8px] px-2 bg-[hsl(var(--success))]/10 border border-[#05DF72]/30">
                                                            <span className="text-[13px] font-semibold text-[hsl(var(--success))]">{inv}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Status Toggle - Compacted */}
                                                <div
                                                    onClick={(e) => handleUpdateStatus(product, e)}
                                                    className="w-[42px] h-[22px] rounded-full p-[2px] flex items-center shrink-0 transition-all duration-300 cursor-pointer overflow-hidden mb-[2px]"
                                                    style={{
                                                        border: product.status === 'active' ? 'none' : '1px solid var(--dash-border)',
                                                        background: product.status === 'active' ? "linear-gradient(90deg,#3b82f6 0%,#2dd4bf 100%)" : "var(--dash-secondary-bg)",
                                                        boxShadow: product.status === 'active' ? "0px 0px 10px 0px hsl(var(--primary)/0.35)" : undefined
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
                                                className="flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[12px] text-[15px] font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 active:scale-[0.98] transition-all"
                                            >
                                                <Pencil className="w-[18px] h-[18px]" />
                                                {t.dashboard.products.list.edit}
                                            </Link>

                                            {/* Delete Button */}
                                            <button
                                                onClick={e => handleDelete(product, e)}
                                                className="flex items-center justify-center w-[44px] h-[44px] rounded-[12px] text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 border border-destructive/20 active:scale-[0.95] hover:bg-[hsl(var(--destructive))]/20 transition-all"
                                            >
                                                <Trash2 className="w-[18px] h-[18px]" strokeWidth={2} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Empty state — filters produced no results (GH-1222 DS) */}
                        {filteredAndSortedProducts.length === 0 && (
                            <TableEmptyState
                                icon={<SearchX />}
                                title={t.dashboard.products.list.noResults}
                            />
                        )}

                        {/* Mobile Pagination */}
                        {totalPages > 1 && (
                            <div className="md:hidden py-4">
                                <TablePagination
                                    page={currentPage}
                                    total={filteredAndSortedProducts.length}
                                    limit={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onLimitChange={handleLimitChange}
                                    labels={{ unit: 'products' }}
                                />
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
                        <div className="block md:hidden fixed inset-0 z-[9999] bg-[hsl(var(--background))] overflow-y-auto w-full h-full">
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
