'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Search, MoreHorizontal, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ProductsSkeleton } from '@/components/dashboard/ProductsSkeleton'
import { ProductImageFallback } from '@/components/dashboard/ProductImageFallback'
import { ProductsEmptyState } from '@/components/dashboard/ProductsEmptyState'
import { BulkCreateModal } from '@/components/dashboard/BulkCreateModal'
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
    category?: (Category | string)[]
    images?: Array<{ image: ProductImage | string | null; alt?: string }>
    createdAt: string
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

function getImageUrl(image: ProductImage | string | null): string | null {
    if (!image || typeof image === 'string') return null
    return image.url || image.thumbnailURL || null
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        draft: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
        active: 'bg-green-500/15 text-green-400 border-green-500/30',
        archived: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    }
    return (
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize', styles[status] || styles.draft)}>
            {status}
        </span>
    )
}

export default function ProductsPage() {
    const { t } = useI18n()
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<string>('date-desc')
    const [showBulkCreate, setShowBulkCreate] = useState(false)

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
            setProducts(data.docs || [])
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
            if (filterStatus === 'out_of_stock') {
                if (p.inventory > 0) return false
            } else if (filterStatus !== 'all' && p.status !== filterStatus) {
                return false
            }
            if (searchQuery) {
                const query = searchQuery.toLowerCase()
                const matchesName = p.name.toLowerCase().includes(query)
                const matchesSku = p.sku?.toLowerCase().includes(query)
                if (!matchesName && !matchesSku) return false
            }
            return true
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'name-asc': return a.name.localeCompare(b.name)
                case 'name-desc': return b.name.localeCompare(a.name)
                case 'price-asc': return a.price - b.price
                case 'price-desc': return b.price - a.price
                case 'stock-asc': return a.inventory - b.inventory
                case 'stock-desc': return b.inventory - a.inventory
                case 'date-desc':
                default:
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            }
        })

    const statusCounts = {
        all: products.length,
        active: products.filter(p => p.status === 'active').length,
        draft: products.filter(p => p.status === 'draft').length,
        archived: products.filter(p => p.status === 'archived').length,
        out_of_stock: products.filter(p => p.inventory <= 0).length,
    }

    // Loading state — skeleton
    if (isLoading) {
        return <ProductsSkeleton />
    }

    // Error state
    if (error && products.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-400/60" />
                    <h2 className="mt-4 text-lg font-semibold text-white">Failed to load products</h2>
                    <p className="mt-1 text-sm text-gray-500">{error}</p>
                    <button onClick={loadProducts}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors">
                        <RefreshCw className="h-4 w-4" /> Retry
                    </button>
                </div>
            </div>
        )
    }

    // Empty state
    if (products.length === 0 && !isLoading) {
        return <ProductsEmptyState />
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t.dashboard.products.title}</h1>
                    <p className="mt-1 text-sm text-gray-400">{products.length} {t.dashboard.products.list.product.toLowerCase()}{products.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button 
                        onClick={() => setShowBulkCreate(true)}
                        className="flex items-center gap-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                    >
                        <Sparkles className="h-4 w-4" /> Tạo bằng AI
                    </button>
                    <Link href="/products/new"
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25">
                        <Plus className="h-4 w-4" /> {t.dashboard.products.addProduct}
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t.dashboard.products.list.search}
                            className="w-full rounded-lg border border-white/10 bg-[#1E293B] pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50" />
                    </div>
                    
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="rounded-lg border border-white/10 bg-[#1E293B] px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    >
                        <option value="date-desc">{t.dashboard.products.list.sortNewest}</option>
                        <option value="name-asc">{t.dashboard.products.list.sortNameAsc}</option>
                        <option value="name-desc">{t.dashboard.products.list.sortNameDesc}</option>
                        <option value="price-asc">{t.dashboard.products.list.sortPriceAsc}</option>
                        <option value="price-desc">{t.dashboard.products.list.sortPriceDesc}</option>
                        <option value="stock-asc">{t.dashboard.products.list.sortStockAsc}</option>
                        <option value="stock-desc">{t.dashboard.products.list.sortStockDesc}</option>
                    </select>
                </div>

                <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-[#1E293B] p-0.5">
                    {[
                        { id: 'all', label: t.dashboard.products.list.filterAll },
                        { id: 'active', label: 'Active' },
                        { id: 'draft', label: 'Draft' },
                        { id: 'archived', label: 'Archived' },
                        { id: 'out_of_stock', label: t.dashboard.products.list.filterOutOfStock },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setFilterStatus(tab.id)}
                            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2',
                                filterStatus === tab.id ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300')}>
                            {tab.label}
                            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px]">
                                {statusCounts[tab.id as keyof typeof statusCounts]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Products List */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                {/* Table header — desktop only */}
                <div className="hidden sm:grid grid-cols-[1fr_120px_100px_80px_60px] gap-4 border-b border-white/10 px-6 py-3 text-xs font-medium uppercase text-gray-500">
                    <span>{t.dashboard.products.list.product}</span>
                    <span>{t.dashboard.products.list.price}</span>
                    <span>{t.dashboard.products.list.status}</span>
                    <span>{t.dashboard.products.list.stock}</span>
                    <span></span>
                </div>

                {/* Product rows */}
                <div className="divide-y divide-white/5">
                    {filteredAndSortedProducts.map(product => {
                        const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null
                        const isOutOfStock = product.inventory <= 0

                        return (
                            <Link key={product.id} href={`/products/${product.id}`}
                                className="block sm:grid sm:grid-cols-[1fr_120px_100px_80px_60px] gap-4 px-4 sm:px-6 py-4 hover:bg-white/5 transition-colors sm:items-center relative">
                                
                                {/* Mobile Red Badge for Stock */}
                                {(isOutOfStock || product.inventory <= 5) && (
                                    <div className="sm:hidden absolute top-4 right-4 flex flex-col items-end gap-1">
                                        {isOutOfStock ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">{t.dashboard.products.list.outOfStock}</span>
                                        ) : (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">Low Stock</span>
                                        )}
                                    </div>
                                )}

                                {/* Product info container */}
                                <div className="flex items-start sm:items-center gap-3">
                                    <div className="relative h-14 w-14 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-white/5 border border-white/10 overflow-hidden mt-0.5 sm:mt-0">
                                        {imgUrl ? (
                                            <Image src={imgUrl} alt={product.images?.[0]?.alt || product.name}
                                                fill className="object-cover" sizes="(max-width: 640px) 56px, 40px" />
                                        ) : (
                                            <ProductImageFallback size="md" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1 pr-16 sm:pr-0">
                                        <p className="truncate text-sm font-medium text-white">{product.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {product.sku && (
                                                <span className="text-[10px] sm:text-xs text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded text-ellipsis overflow-hidden max-w-[100px] sm:max-w-none">
                                                    {product.sku}
                                                </span>
                                            )}
                                            {product.category && product.category.length > 0 && (
                                                <span className="text-[10px] sm:text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none" title={product.category.map((c) => typeof c === 'string' ? c : (c.breadcrumbs || c.name)).filter(Boolean).join(', ')}>
                                                    {product.category.map((c) => typeof c === 'string' ? c : c.name).filter(Boolean).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                        {/* Mobile Price & Status (Details Right) */}
                                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                                            <p className="text-sm font-bold text-white leading-none">{formatPrice(product.price, product.currency)}</p>
                                            {product.compareAtPrice && product.compareAtPrice > product.price && (
                                                <p className="text-[10px] text-gray-500 line-through leading-none">{formatPrice(product.compareAtPrice, product.currency)}</p>
                                            )}
                                            <div className="ml-auto">
                                                <StatusBadge status={product.status} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Desktop Price */}
                                <div className="hidden sm:block">
                                    <p className="text-sm font-medium text-white">{formatPrice(product.price, product.currency)}</p>
                                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                                        <p className="text-xs text-gray-500 line-through">{formatPrice(product.compareAtPrice, product.currency)}</p>
                                    )}
                                </div>
                                
                                <div className="hidden sm:block"><StatusBadge status={product.status} /></div>
                                
                                <div className="hidden sm:flex items-center gap-1.5">
                                    {isOutOfStock ? (
                                        <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                                    ) : (
                                        <span className={cn('text-sm', product.inventory <= 5 ? 'text-orange-400' : 'text-gray-300')}>
                                            {product.inventory}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="hidden sm:flex justify-end">
                                    <MoreHorizontal className="h-4 w-4 text-gray-600 hover:text-white transition-colors" />
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {filteredAndSortedProducts.length === 0 && (
                    <div className="py-16 text-center text-sm text-gray-500">
                        {t.dashboard.products.list.noResults}
                    </div>
                )}
            </div>

            {showBulkCreate && (
                <BulkCreateModal 
                    onClose={() => setShowBulkCreate(false)}
                    onSuccess={() => loadProducts()}
                />
            )}
        </div>
    )
}
