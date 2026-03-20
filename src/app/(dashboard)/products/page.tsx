'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Search, MoreHorizontal, Package, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ProductsSkeleton } from '@/components/dashboard/ProductsSkeleton'

type ProductImage = {
    url?: string
    thumbnailURL?: string
}

type Product = {
    id: string
    name: string
    slug: string
    shortDescription?: string
    price: number
    compareAtPrice?: number
    currency: string
    status: 'draft' | 'active' | 'archived'
    inventory: number
    category?: string
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
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadProducts()
    }, [])

    const loadProducts = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/products', { credentials: 'include' })
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

    const filtered = products.filter(p => {
        if (filterStatus !== 'all' && p.status !== filterStatus) return false
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    // Loading state — skeleton
    if (isLoading) {
        return <ProductsSkeleton />
    }

    // Error state
    if (error && products.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <Package className="mx-auto h-12 w-12 text-red-400/60" />
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
    if (products.length === 0) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-600" />
                    <h2 className="mt-4 text-lg font-semibold text-white">No products yet</h2>
                    <p className="mt-1 text-sm text-gray-500">Start adding products to your store</p>
                    <Link href="/products/new"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25">
                        <Plus className="h-4 w-4" /> Add Product
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Products</h1>
                    <p className="mt-1 text-sm text-gray-400">{products.length} product{products.length !== 1 ? 's' : ''}</p>
                </div>
                <Link href="/products/new"
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25">
                    <Plus className="h-4 w-4" /> Add Product
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full rounded-lg border border-white/10 bg-[#1E293B] pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500/50" />
                </div>
                <div className="flex gap-1 rounded-lg border border-white/10 bg-[#1E293B] p-0.5">
                    {['all', 'active', 'draft', 'archived'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                            className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                                filterStatus === s ? 'bg-blue-500/15 text-blue-400' : 'text-gray-500 hover:text-gray-300')}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products List */}
            <div className="rounded-xl border border-white/10 bg-[#1E293B]/30 overflow-hidden">
                {/* Table header — desktop only */}
                <div className="hidden sm:grid grid-cols-[1fr_120px_100px_80px_60px] gap-4 border-b border-white/10 px-6 py-3 text-xs font-medium uppercase text-gray-500">
                    <span>Product</span>
                    <span>Price</span>
                    <span>Status</span>
                    <span>Stock</span>
                    <span></span>
                </div>

                {/* Product rows */}
                <div className="divide-y divide-white/5">
                    {filtered.map(product => {
                        const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null

                        return (
                            <Link key={product.id} href={`/products/${product.id}`}
                                className="block sm:grid sm:grid-cols-[1fr_120px_100px_80px_60px] gap-4 px-4 sm:px-6 py-4 hover:bg-white/5 transition-colors sm:items-center">
                                {/* Product info */}
                                <div className="flex items-center gap-3">
                                    <div className="relative h-10 w-10 shrink-0 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                                        {imgUrl ? (
                                            <Image src={imgUrl} alt={product.images?.[0]?.alt || product.name}
                                                fill className="object-cover" sizes="40px" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <Package className="h-4 w-4 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-white">{product.name}</p>
                                        {product.category && (
                                            <p className="text-xs text-gray-500">{product.category}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Price + Status + Stock — stacked on mobile */}
                                <div className="mt-2 sm:mt-0 flex items-center gap-3 sm:block">
                                    <p className="text-sm font-medium text-white">{formatPrice(product.price, product.currency)}</p>
                                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                                        <p className="text-xs text-gray-500 line-through">{formatPrice(product.compareAtPrice, product.currency)}</p>
                                    )}
                                </div>
                                <div className="hidden sm:block"><StatusBadge status={product.status} /></div>
                                <span className={cn('hidden sm:block text-sm', product.inventory <= 5 ? 'text-red-400' : 'text-gray-300')}>
                                    {product.inventory}
                                </span>
                                <MoreHorizontal className="hidden sm:block h-4 w-4 text-gray-600" />

                                {/* Mobile: inline status + stock */}
                                <div className="mt-2 flex items-center gap-2 sm:hidden">
                                    <StatusBadge status={product.status} />
                                    <span className={cn('text-xs', product.inventory <= 5 ? 'text-red-400' : 'text-gray-500')}>
                                        {product.inventory} in stock
                                    </span>
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {filtered.length === 0 && (
                    <div className="py-12 text-center text-sm text-gray-500">
                        No products match your filters
                    </div>
                )}
            </div>
        </div>
    )
}
