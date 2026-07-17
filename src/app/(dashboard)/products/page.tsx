'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, RefreshCw, SearchX, Pencil, Trash2, Sparkles, Tag, Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { format } from 'date-fns'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
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
import { MissingInfoIndicator } from '@/components/dashboard/MissingInfoIndicator'
import { AiReviewIndicator } from '@/components/dashboard/AiReviewIndicator'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableActionButton } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TablePagination, shouldShowTablePagination, useTablePageClamp } from '@/components/ui/table-pagination'
import { TableEmptyState } from '@/components/ui/table-empty-state'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { TableSearch } from '@/components/ui/table-search'
import { FilterChip } from '@/components/ui/filter-chip'
import { Tabs, TabsList, TabsTrigger, TabsCount } from '@/components/ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { resolveApiError } from '@/lib/ui/resolve-api-error'
import { getProductsAction, updateProductFieldAction } from './actions'
import { getCategoriesAction } from './categories/actions'
import { getDisplayPrice } from '@/lib/products/display-price'
import { getMissingFields } from '@/lib/products/missing-fields'
import { computeStockDisplay, singleSeverity, type StockDisplay, type StockSeverity } from '@/lib/products/stock-display'
import { productPublishBlocks } from '@/lib/products/publish-guard'
import { getAiChatEnterBehavior } from '@/lib/products/ai-chat-enter-behavior'

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
    aiReviewPending?: boolean
}

function formatPrice(price: number, currency: string) {
    if (currency === 'MYR') return `RM ${price.toFixed(2)}`
    if (currency === 'SGD') return `S$${price.toFixed(2)}`
    return `$${price.toFixed(2)}`
}

// Composes the Stock column's final display string. `computeStockDisplay` stays i18n-free
// (mirrors getDisplayPrice's "From " prefix pattern — the pure helper returns raw numbers,
// the caller adds words) — for a variant product this appends "1 variant" / "{N} variants".
function formatStockLabel(stockDisplay: StockDisplay, t: ReturnType<typeof useI18n>['t']) {
    if (!stockDisplay.showVariantCount) return stockDisplay.label
    const suffix = stockDisplay.variantCount === 1
        ? (t.dashboard.products.list.stockVariantCountOne || '1 variant')
        : (t.dashboard.products.list.stockVariantCountMany || '{count} variants').replace('{count}', String(stockDisplay.variantCount))
    return `${stockDisplay.label} / ${suffix}`
}

// Mobile Stock chip styling keyed by `computeStockDisplay` severity (GH-1525 #4).
const STOCK_CHIP_CLASSES: Record<StockSeverity, string> = {
    destructive: 'bg-[hsl(var(--destructive)/0.1)] border-[hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))]',
    warning: 'bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))]',
    success: 'bg-[hsl(var(--success))]/10 border-[#05DF72]/30 text-[hsl(var(--success))]',
}

// Per-variant breakdown row styling (Tooltip/Popover stock detail) — same severity
// tokens as STOCK_CHIP_CLASSES, applied per row via `singleSeverity(v.stock)` so the
// color reflects THAT variant's own stock, not the row's overall range severity.
const STOCK_ROW_DOT_CLASSES: Record<StockSeverity, string> = {
    destructive: 'bg-[hsl(var(--destructive))]',
    warning: 'bg-[hsl(var(--warning))]',
    success: 'bg-[hsl(var(--success))]',
}
const STOCK_ROW_TEXT_CLASSES: Record<StockSeverity, string> = {
    destructive: 'text-[hsl(var(--destructive))]',
    warning: 'text-[hsl(var(--warning))]',
    success: 'text-[hsl(var(--success))]',
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

// Publishing gate (GH-1458) — missingFields keys from productPublishBlocks map to the same
// labels already used by the create/edit form (t.dashboard.products.form.fields.*).
const PUBLISH_GATE_FIELD_KEYS: Record<string, 'basePrice' | 'baseSku' | 'baseInventory' | 'variants' | 'weight'> = {
    price: 'basePrice',
    sku: 'baseSku',
    inventory: 'baseInventory',
    variants: 'variants',
    weight: 'weight',
}

// Server throws Error(JSON.stringify({ code: 'PUBLISH_BLOCKED', missingFields })) — parse it back
// out so the client can show the same modal as the (redundant) client-side check.
function parsePublishBlockedError(e: unknown): string[] | null {
    if (!(e instanceof Error)) return null
    try {
        const parsed = JSON.parse(e.message)
        if (parsed?.code === 'PUBLISH_BLOCKED' && Array.isArray(parsed.missingFields)) {
            return parsed.missingFields
        }
    } catch {
        // Not JSON — a normal error message, fall through to generic handling.
    }
    return null
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
    const aiTextareaRef = useRef<HTMLTextAreaElement>(null)
    const aiPromptComposingRef = useRef(false)
    useAutoResizeTextarea(aiTextareaRef, aiPrompt, 160, t.dashboard.products.list.aiChatPlaceholder)
    const [sortBy, setSortBy] = useState('Latest')
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [saleStatus, setSaleStatus] = useState<string>('All Products')
    const [showLowStock, setShowLowStock] = useState<boolean>(false)
    const [mounted, setMounted] = useState(false)
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
    const paginatedProducts = filteredAndSortedProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const handleLimitChange = (n: number) => { setItemsPerPage(n); setCurrentPage(1) }
    // GH-1579: snap back when deletions strand currentPage past the last page
    useTablePageClamp(currentPage, filteredAndSortedProducts.length, itemsPerPage, setCurrentPage)

    const statusCounts = {
        all: products.length,
        active: products.filter(p => p.status === 'active').length,
        draft: products.filter(p => p.status === 'draft').length,
        archived: products.filter(p => p.status === 'archived').length,
    }

    const handleCreateAi = () => {
        setShowBulkCreate(true)
    }

    const [publishGateFields, setPublishGateFields] = useState<string[] | null>(null)

    const handleUpdateStatus = async (prod: Product | DetailedProduct, e: React.MouseEvent) => {
        e.stopPropagation()
        const newStatus = prod.status === 'active' ? 'archived' : 'active'

        // Soft validation publishing gate (GH-1458) — block Draft/Archived -> Active when core
        // fields are missing, before any optimistic update or server call.
        if (newStatus === 'active') {
            const gate = productPublishBlocks(prod)
            if (!gate.ok) {
                setPublishGateFields(gate.missingFields)
                return
            }
        }

        // Capture the pre-update flag from list state (not `prod`, which may be a DetailedProduct
        // without this field) so a failed activation restores the correct prior value on rollback.
        const prevAiReviewPending = products.find(p => p.id === prod.id)?.aiReviewPending

        // Optimistic update — activating a product means it's been reviewed, so also drop the AI-review dot.
        setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: newStatus, aiReviewPending: newStatus === 'active' ? false : p.aiReviewPending } : p))
        try {
            await updateProductFieldAction(prod.id, { status: newStatus })
            toast.success(`${t.dashboard.products.form.successMarkedAs} ${newStatus}`)
        } catch (e: unknown) {
            const blockedFields = parsePublishBlockedError(e)
            if (blockedFields) {
                setPublishGateFields(blockedFields)
            } else {
                toast.error(resolveApiError(e instanceof Error ? e.message : null, t.dashboard.products.form.failedUpdateStatus, sub))
            }
            setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: prod.status, aiReviewPending: prevAiReviewPending } : p))
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
                    <h2 className="mt-4 text-lg font-semibold text-foreground">{t.dashboard.products.list.failedToLoad}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    <Button onClick={loadProducts} className="mt-4">
                        <RefreshCw className="h-4 w-4" /> {t.dashboard.products.list.retry}
                    </Button>
                </div>
            </div>
        )
    }

    // Empty state without filtering
    const isTotallyEmpty = products.length === 0 && !isLoading

    return (
        <div className="space-y-6 pb-20">
            {/* AI Chat Banner (Figma Node 30882:5804) — flat card + corner-confined radial
                teal glow (design ref: ai-bulk-create.html .ai-box), not a full-width color sweep */}
            <div
                className="rounded-[18px] [border:2px_solid_hsl(var(--border))] bg-[hsl(var(--card))] p-[24px] overflow-hidden relative"
                style={{
                    backgroundImage:
                        'radial-gradient(120% 140% at 85% -10%, hsl(var(--primary) / 0.10), transparent 55%)',
                }}
            >
                <div className="relative flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-3">
                            <Image src="/images/figma/ai-chat-icon.svg" width={24} height={24} alt="AI" className="shrink-0" />
                            <h2 className="text-[18px] font-semibold text-foreground">{t.dashboard.products.list.aiChatTitle}</h2>
                        </div>
                        <p className="text-[12.5px] text-muted-foreground">{t.dashboard.products.list.aiChatSubtitle}</p>
                    </div>
                    {/* Command shell — textarea + footer (hint + Generate button) share one bordered
                        box, chat-input style, matching the issue's design reference (ai-bulk-create.html) */}
                    <div className="w-full rounded-xl [border:2px_solid_hsl(var(--input-border))] bg-[hsl(var(--card))] overflow-hidden focus-within:[border-color:hsl(var(--ring))] focus-within:ring-[3px] focus-within:ring-[hsl(var(--primary))]/10 transition-colors">
                        <textarea
                            ref={aiTextareaRef}
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onCompositionStart={() => {
                                aiPromptComposingRef.current = true
                            }}
                            onCompositionEnd={() => {
                                aiPromptComposingRef.current = false
                            }}
                            onBlur={() => {
                                aiPromptComposingRef.current = false
                            }}
                            onKeyDown={e => {
                                const behavior = getAiChatEnterBehavior({
                                    key: e.key,
                                    prompt: aiPrompt,
                                    shiftKey: e.shiftKey,
                                    ctrlKey: e.ctrlKey,
                                    metaKey: e.metaKey,
                                    isComposing: aiPromptComposingRef.current || e.nativeEvent.isComposing,
                                })
                                if (behavior === 'ignore') return
                                e.preventDefault()
                                if (behavior === 'submit') handleCreateAi()
                            }}
                            placeholder={t.dashboard.products.list.aiChatPlaceholder}
                            rows={1}
                            className="w-full min-h-[46px] resize-none border-none bg-transparent px-4 py-3 text-[14px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] placeholder:text-[11px] md:placeholder:text-[13px] focus:outline-none focus-visible:outline-none"
                        />
                        <div className="flex items-center justify-end md:justify-between gap-3 [border-top:1px_solid_hsl(var(--input-border))] px-3 py-1">
                            <div className="hidden md:flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                                <kbd className="rounded [border:1px_solid_hsl(var(--input-border))] bg-[hsl(var(--background))] px-1.5 py-0.5 font-sans text-[10.5px]">Enter</kbd>
                                <span>{t.dashboard.products.list.aiChatHintGenerate}</span>
                                <span>·</span>
                                <kbd className="rounded [border:1px_solid_hsl(var(--input-border))] bg-[hsl(var(--background))] px-1.5 py-0.5 font-sans text-[10.5px]">Shift</kbd>
                                <span>+</span>
                                <kbd className="rounded [border:1px_solid_hsl(var(--input-border))] bg-[hsl(var(--background))] px-1.5 py-0.5 font-sans text-[10.5px]">Enter</kbd>
                                <span>{t.dashboard.products.list.aiChatHintNewLine}</span>
                            </div>
                            {/* Generate Drafts — shared dashboard primary button (size="dash") */}
                            <Button
                                variant="dashPrimary"
                                size="dash"
                                onClick={handleCreateAi}
                                disabled={!aiPrompt.trim()}
                                className="shrink-0 justify-center !h-6 !px-2.5 !text-[11.5px]"
                            >
                                <Sparkles className="!h-3 !w-3" />
                                {t.dashboard.products.list.aiChatBtn}
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">{t.dashboard.products.list.aiChatSuggestionsLabel}</span>
                        {[
                            { label: t.dashboard.products.list.aiChatSuggestion1Label, fill: t.dashboard.products.list.aiChatSuggestion1 },
                            { label: t.dashboard.products.list.aiChatSuggestion2Label, fill: t.dashboard.products.list.aiChatSuggestion2 },
                            { label: t.dashboard.products.list.aiChatSuggestion3Label, fill: t.dashboard.products.list.aiChatSuggestion3 },
                        ].map((suggestion, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    setAiPrompt(suggestion.fill)
                                    aiTextareaRef.current?.focus()
                                }}
                                className="rounded-full [border:1px_solid_hsl(var(--border))] bg-[hsl(var(--background))]/50 px-3 py-1 text-[12px] text-foreground/80 transition-colors hover:[border-color:hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                            >
                                {suggestion.label}
                            </button>
                        ))}
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
                        <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                            <Button asChild variant="dashSecondary" size="dash" className="flex-1 md:flex-none basis-1/2 md:basis-auto justify-center">
                                <Link href="/products/categories">
                                    <Tag className="w-3.5 h-3.5" />
                                    {t.dashboard.products.list.category}
                                </Link>
                            </Button>
                            <Button asChild variant="dashPrimary" size="dash" className="flex-1 md:flex-none basis-1/2 md:basis-auto justify-center">
                                <Link href="/products/new">
                                    <Image src="/images/figma/add-product.svg" alt="Add" width={16} height={16} className="shrink-0 brightness-0 invert" /> {t.dashboard.products.addProduct}
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Status filter — shared <Tabs variant="underline"> (same component everywhere) */}
                    <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                        <TabsList variant="underline">
                            <TabsTrigger variant="underline" value="all">
                                {t.dashboard.products.list.filterAll}
                                <TabsCount>{statusCounts.all}</TabsCount>
                            </TabsTrigger>
                            <TabsTrigger variant="underline" value="active">

                                {t.dashboard.products.list.filterActive}
                                <TabsCount>{statusCounts.active}</TabsCount>
                            </TabsTrigger>
                            <TabsTrigger variant="underline" value="draft">
                                <Image src="/images/figma/draft-tab.svg" width={14} height={14} alt="Draft" className={cn("shrink-0", filterStatus !== 'draft' && "opacity-60")} />
                                {t.dashboard.products.list.filterDraft}
                                <TabsCount>{statusCounts.draft}</TabsCount>
                            </TabsTrigger>
                            <TabsTrigger variant="underline" value="archived">
                                <Image src="/images/figma/archived-tab.svg" width={14} height={14} alt="Archived" className={cn("shrink-0", filterStatus !== 'archived' && "opacity-60")} />
                                {t.dashboard.products.list.filterArchived}
                                <TabsCount>{statusCounts.archived}</TabsCount>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Search & Filter — Mobile (Figma Node 30945:933): 3 stacked rows */}
                    <div className="flex md:hidden flex-col gap-[12px] w-full">
                        {/* Row 1: Search Input */}
                        <div className="relative w-full h-9">
                            <Image src="/images/figma/search-icon.svg" width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 invert dark:invert-0" alt="Search" />
                            {/* border ở className (không inline) để focus: variant override được — focus state chuẩn DS (GH-1290 Bug 3) */}
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t.dashboard.products.list.search}
                                style={{ background: 'transparent', color: 'var(--dash-text)' }}
                                className="w-full h-full rounded-[16px] border-[var(--dash-border)] pl-9 pr-4 text-[13px] placeholder:text-[var(--dash-text-muted)] focus-visible:border-[hsl(var(--primary))] focus-visible:[box-shadow:0_0_0_3px_hsl(var(--ring)/0.25)]"
                            />
                        </div>

                        {/* Row 2: Sort + Filter — merged into one row (GH-1492) */}
                        <div className="flex flex-row items-center gap-2 w-full">
                            {/* Sort — shadcn Select (design system, themed) */}
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="h-9 flex-1 min-w-0 rounded-[16px] border-[var(--dash-border)] px-4 text-[13px] font-medium text-[var(--dash-text)] shadow-none">
                                    <SelectValue placeholder={t.dashboard.products.list.sortLabel} />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {sortTranslateMap[option]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Filter Button */}
                            <Button
                                variant="dashSecondary"
                                size="dash"
                                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                                style={(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock)
                                    ? { background: 'hsl(var(--primary)/0.12)', border: '1px solid hsl(var(--primary)/0.4)', color: 'hsl(var(--primary))' }
                                    : isAdvancedFiltersOpen
                                        ? { background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary)/0.5)', color: 'var(--dash-text-muted)' }
                                        : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--input-border))', color: 'var(--dash-text-muted)' }}
                                className="shrink-0 rounded-[16px]"
                            >
                                <Filter size={16} className="shrink-0" />
                                <span>
                                    {t.dashboard.products.list.filterBtn}{(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock)
                                        ? ` (${selectedCategories.length + (saleStatus !== 'All Products' ? 1 : 0) + (showLowStock ? 1 : 0)})`
                                        : ''}
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Search & Filter — Desktop (Figma Node 30882:5844): 3-item row */}
                    <div className="hidden md:flex items-center gap-2 w-full">
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
                        {/* Active (teal) khi đang có filter áp dụng — khớp trạng thái active của chip Sort. */}
                        <Button
                            variant="dashSecondary"
                            size="dash"
                            onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                            className="whitespace-nowrap"
                            style={(selectedCategories.length > 0 || saleStatus !== 'All Products' || showLowStock)
                                ? { background: 'hsl(var(--primary)/0.12)', border: '1px solid hsl(var(--primary)/0.4)', color: 'hsl(var(--primary))' }
                                : { background: 'hsl(var(--card))', border: '1px solid hsl(var(--input-border))', color: 'var(--dash-text-muted)' }}
                        >
                            <Filter size={16} className="shrink-0" />
                            {t.dashboard.products.list.filterBtn}
                        </Button>
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
                                <Button
                                    variant="ghost"
                                    onClick={() => { setSelectedCategories([]); setSaleStatus('All Products'); setShowLowStock(false); setIsAdvancedFiltersOpen(false); }}
                                    className="flex items-center gap-[8px] text-foreground/50 hover:text-foreground h-auto px-1 py-0"
                                >
                                    <span className="text-[13px] font-medium leading-[20px]">{t.dashboard.products.list.clearAll}</span>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </Button>
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
                                                <label key={category.id} className="flex items-center gap-[8px] cursor-pointer group min-h-[28px]"
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
                                                    <span className={cn("text-[14px] font-medium leading-[20px] truncate", isSelected ? "text-[hsl(var(--primary))] font-semibold" : "text-foreground/80")}>{cat}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Divider (mobile only) */}
                                <div className="md:hidden w-full h-[1px] bg-border" />

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
                                                <span className={cn("text-[14px] font-medium leading-[20px] whitespace-nowrap", saleStatus === status ? "text-[hsl(var(--primary))] font-semibold" : "text-foreground/80")}>{status === 'All Products' ? t.dashboard.products.list.allProducts : status === 'On Sale' ? t.dashboard.products.list.onSale : t.dashboard.products.list.regularPrice}</span>
                                                {status === 'On Sale' && <span className="bg-[#FB2C36]/20 border border-[#FB2C36]/30 text-[hsl(var(--destructive))] rounded-[4px] px-[6px] py-[2px] text-[12px] font-medium leading-[16px]">🔥</span>}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Divider (mobile only) */}
                                <div className="md:hidden w-full h-[1px] bg-border" />

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
                                        <div className={cn("w-[44px] h-[24px] rounded-full flex items-center p-[4px] shrink-0 transition-colors duration-300", showLowStock ? "bg-[hsl(var(--warning))]" : "bg-muted")}>
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

                        {/* --- Table (iPad Air >=820 and up) — matches orders/blog dash-table-compact
                            convention: below xl the shared `.dash-table-compact` (globals.css) shrinks
                            font + padding so the columns fit; no minWidth floor → table-fixed w-full
                            always fits the pane (no horizontal scroll on iPad Pro with sidebar open).
                            At >=1280 the compact class is a no-op → desktop byte-identical. --- */}
                        {filteredAndSortedProducts.length > 0 && (
                            <div className="hidden min-[820px]:block">
                                <Table
                                    className="table-fixed w-full dash-table-compact"
                                    footer={shouldShowTablePagination(filteredAndSortedProducts.length) ? (
                                        <TablePagination
                                            page={currentPage}
                                            total={filteredAndSortedProducts.length}
                                            limit={itemsPerPage}
                                            onPageChange={setCurrentPage}
                                            onLimitChange={handleLimitChange}
                                            labels={{ unit: 'products' }}
                                        />
                                    ) : undefined}
                                >
                                    <colgroup>
                                        <col style={{ width: '60px' }} />
                                        <col style={{ width: '24%' }} />
                                        <col style={{ width: '15%' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '11%' }} />
                                        <col style={{ width: '116px' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '86px' }} />
                                    </colgroup>

                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t.dashboard.products.list.colImg}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colName}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colPrice}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colStock}</TableHead>
                                            <TableHead>{t.dashboard.products.list.colWeight}</TableHead>
                                            <TableHead
                                                className="cursor-pointer select-none"
                                                onClick={() => setSortBy(prev => (prev === 'Latest' ? 'Oldest' : 'Latest'))}
                                                title={t.dashboard.products.list.colCreated}
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    {t.dashboard.products.list.colCreated}
                                                    {sortBy === 'Latest' ? (
                                                        <ArrowDown className="w-3.5 h-3.5" />
                                                    ) : sortBy === 'Oldest' ? (
                                                        <ArrowUp className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                                                    )}
                                                </span>
                                            </TableHead>
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
                                            const createdDate = product.createdAt ? new Date(product.createdAt) : null
                                            const createdDisplay = createdDate && !isNaN(createdDate.getTime()) ? format(createdDate, 'dd MMM yyyy') : '—'
                                            const stockDisplay = computeStockDisplay(product)
                                            const stockLabel = formatStockLabel(stockDisplay, t)
                                            const missing = getMissingFields(product)

                                            return (
                                                <TableRow
                                                    key={product.id}
                                                    clickable
                                                    onClick={() => setQuickViewProduct(product as DetailedProduct)}
                                                >
                                                    {/* Thumbnail */}
                                                    <TableCell style={{ borderLeft: missing.length ? '2px solid hsl(var(--warning))' : undefined }}>
                                                        <div className="relative h-10 w-10 shrink-0 rounded-[8px] bg-[hsl(var(--background))] border border-white/[0.08] overflow-hidden">
                                                            <ProductImageWithFallback imgUrl={imgUrl} alt={product.images?.[0]?.alt || product.name} size="sm" sizes="40px" />
                                                        </div>
                                                    </TableCell>

                                                    {/* Name + SKU */}
                                                    <TableCell>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="truncate font-medium text-[14px]" style={{ color: 'var(--dash-text)' }} title={product.name}>
                                                                    {product.name}
                                                                </span>
                                                                <MissingInfoIndicator missing={missing} t={t} />
                                                                <AiReviewIndicator pending={product.aiReviewPending} t={t} />
                                                            </div>
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
                                                        {stockDisplay.breakdown && stockDisplay.breakdown.length > 1 ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        tabIndex={0}
                                                                        role="button"
                                                                        aria-label={`${t.dashboard.products.list.colStock}: ${stockLabel}`}
                                                                        className="inline-flex"
                                                                    >
                                                                        <Badge variant={stockDisplay.severity} dot>{stockLabel}</Badge>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent align="start" onClick={(e) => e.stopPropagation()} className="w-52 p-0 overflow-hidden">
                                                                    <p className="border-b border-[hsl(var(--border))] px-3 py-2 text-[12px] font-semibold text-foreground">
                                                                        {t.dashboard.products.list.colStock}
                                                                    </p>
                                                                    <ul className="max-h-48 list-none space-y-0.5 overflow-y-auto p-1.5">
                                                                        {stockDisplay.breakdown.map((v, i) => {
                                                                            const rowSeverity = singleSeverity(v.stock)
                                                                            return (
                                                                                <li key={i} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1">
                                                                                    <span className="flex min-w-0 items-center gap-1.5">
                                                                                        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STOCK_ROW_DOT_CLASSES[rowSeverity])} />
                                                                                        <span className="truncate text-foreground/70">{v.name}</span>
                                                                                    </span>
                                                                                    <span className={cn("shrink-0 font-semibold tabular-nums", STOCK_ROW_TEXT_CLASSES[rowSeverity])}>{v.stock}</span>
                                                                                </li>
                                                                            )
                                                                        })}
                                                                    </ul>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <Badge variant={stockDisplay.severity} dot>{stockLabel}</Badge>
                                                        )}
                                                    </TableCell>

                                                    {/* Weight */}
                                                    <TableCell>
                                                        <span className="text-[14px]" style={{ color: 'var(--dash-text-muted)' }}>{weightDisplay}</span>
                                                    </TableCell>

                                                    {/* Created */}
                                                    <TableCell>
                                                        <span
                                                            className="text-[14px] whitespace-nowrap"
                                                            style={{ color: 'var(--dash-text-muted)' }}
                                                            title={createdDate ? createdDate.toLocaleString() : undefined}
                                                        >
                                                            {createdDisplay}
                                                        </span>
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

                        {/* --- Card View (mobile + iPad mini, < 820px) (Figma Node 30945:1017).
                            1 col on mobile, 2 cols from md; the table takes over from iPad Air (>=820). --- */}
                        <div className="min-[820px]:hidden grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
                            {paginatedProducts.map(product => {
                                const imgUrl = product.images?.[0]?.image ? getImageUrl(product.images[0].image) : null
                                const stockDisplay = computeStockDisplay(product)
                                const stockLabel = formatStockLabel(stockDisplay, t)
                                const { value: dpValue, isVariant: dpIsVariant } = getDisplayPrice(product)
                                const priceDisplay = `${dpIsVariant ? (t.dashboard.products.list.fromPrefix || 'From ') : ''}${formatPrice(dpValue, product.currency)}`
                                const missing = getMissingFields(product)

                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => setQuickViewProduct(product as DetailedProduct)}
                                        className="flex flex-col gap-[12px] rounded-[16px] border border-white/[0.08] bg-[hsl(var(--secondary))]/70 p-[16px] relative group overflow-hidden"
                                        style={{ borderLeft: missing.length ? '2px solid hsl(var(--warning))' : undefined }}
                                    >
                                        {/* Section 1: Thumbnail + Name/Category/Variants/SKU */}
                                        <div className="flex items-start gap-[12px]">
                                            {/* Thumbnail 64×64 */}
                                            <div className="relative h-[64px] w-[64px] shrink-0 rounded-[12px] bg-[hsl(var(--background))] border border-white/[0.08] overflow-hidden">
                                                <ProductImageWithFallback imgUrl={imgUrl} alt={product.images?.[0]?.alt || product.name} size="md" sizes="64px" />
                                            </div>

                                            {/* Text Information Block */}
                                            <div className="flex flex-col flex-1 min-w-0 pt-[2px] gap-[2px]">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="text-[14px] font-semibold text-foreground leading-[18px] truncate pb-[1px]">
                                                        {product.name}
                                                    </div>
                                                    <MissingInfoIndicator missing={missing} t={t} />
                                                    <AiReviewIndicator pending={product.aiReviewPending} t={t} />
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

                                            {/* Price column (right) — level with the name; keeps name/category tight in the middle column */}
                                            <div className="flex flex-col items-end shrink-0 pt-[2px]">
                                                <span className="text-[11px] font-medium text-foreground/50 leading-[16px]">{t.dashboard.products.list.colPrice.split(' ')[0]}</span>
                                                <span className="text-[16px] font-bold text-foreground leading-[20px] whitespace-nowrap">{priceDisplay}</span>
                                            </div>
                                        </div>

                                        {/* Section 2: Stock (left) + Status toggle (right) — price moved up next to name */}
                                        <div className="flex items-center justify-between gap-3">
                                            {/* Stock (Left) */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[12px] font-normal text-foreground/60 leading-[16px]">{t.dashboard.products.list.colStock}</span>
                                                {stockDisplay.breakdown && stockDisplay.breakdown.length > 1 ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className={`inline-flex h-[26px] items-center justify-center gap-1 rounded-[8px] border px-2 ${STOCK_CHIP_CLASSES[stockDisplay.severity]}`}
                                                            >
                                                                {stockDisplay.severity === 'warning' && (
                                                                    <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke="hsl(var(--warning))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                                )}
                                                                <span className="text-[13px] font-semibold">{stockLabel}</span>
                                                            </button>
                                                        </PopoverTrigger>
                                                        <PopoverContent
                                                            align="start"
                                                            className="w-52 p-0 overflow-hidden"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <p className="border-b border-[hsl(var(--border))] px-3 py-2 text-[12px] font-semibold text-foreground">
                                                                {t.dashboard.products.list.colStock}
                                                            </p>
                                                            <ul className="max-h-48 list-none space-y-0.5 overflow-y-auto p-1.5">
                                                                {stockDisplay.breakdown.map((v, i) => {
                                                                    const rowSeverity = singleSeverity(v.stock)
                                                                    return (
                                                                        <li key={i} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-[12px]">
                                                                            <span className="flex min-w-0 items-center gap-1.5">
                                                                                <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STOCK_ROW_DOT_CLASSES[rowSeverity])} />
                                                                                <span className="truncate text-foreground/70">{v.name}</span>
                                                                            </span>
                                                                            <span className={cn("shrink-0 font-semibold tabular-nums", STOCK_ROW_TEXT_CLASSES[rowSeverity])}>{v.stock}</span>
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <div className={`inline-flex h-[26px] items-center justify-center gap-1 rounded-[8px] border px-2 ${STOCK_CHIP_CLASSES[stockDisplay.severity]}`}>
                                                        {stockDisplay.severity === 'warning' && (
                                                            <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M10.0003 2.5L2.50033 15.8333H17.5003L10.0003 2.5Z" stroke="hsl(var(--warning))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                        )}
                                                        <span className="text-[13px] font-semibold">{stockLabel}</span>
                                                    </div>
                                                )}
                                            </div>

                                                {/* Status Toggle - Compacted */}
                                                <div
                                                    onClick={(e) => handleUpdateStatus(product, e)}
                                                    className="w-[42px] h-[22px] rounded-full p-[2px] flex items-center shrink-0 transition-all duration-300 cursor-pointer overflow-hidden"
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

                                            {/* Delete Button — plain <button> mirroring the Edit <Link> classes so both are exactly equal size */}
                                            <button
                                                type="button"
                                                onClick={e => handleDelete(product, e)}
                                                className="flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[12px] text-[15px] font-semibold text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 border border-destructive/20 hover:bg-[hsl(var(--destructive))]/20 active:scale-[0.98] transition-all cursor-pointer"
                                            >
                                                <Trash2 className="w-[18px] h-[18px]" strokeWidth={2} />
                                                {t.dashboard.products.list.delete}
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

                        {/* Card-view Pagination (< 820px) — pairs with the card list; the table's own
                            pager lives in its footer slot from iPad Air up. */}
                        {shouldShowTablePagination(filteredAndSortedProducts.length) && (
                            <div className="min-[820px]:hidden py-4">
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
                        setFilterStatus('draft')
                        setSortBy('Latest')
                        loadProducts()
                    }}
                />
            )}

            {quickViewProduct && (
                <>
                    {/* Desktop 2-col QuickView only from xl (needs ~1024px; overflows on iPad).
                        Tablet + iPad Pro (≤1279) use the fullscreen mobile detail → fits, no overflow. */}
                    <div className="hidden xl:block">
                        <ProductQuickViewModal
                            isOpen={!!quickViewProduct}
                            onClose={() => setQuickViewProduct(null)}
                            product={quickViewProduct}
                            // Close this z-[9999] modal first, then open the confirm popup — otherwise
                            // the ConfirmModal (z-50) renders BEHIND this overlay and is invisible.
                            onDelete={(prod) => { setQuickViewProduct(null); handleDelete(prod) }}
                        />
                    </div>
                    {mounted && typeof document !== 'undefined' && createPortal(
                        <>
                            {/* Backdrop — dim + blur, tap to close. Mirrors the order detail panel. */}
                            <div
                                className="xl:hidden fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
                                onClick={() => setQuickViewProduct(null)}
                            />
                            {/* Product detail panel (< xl / iPad + mobile) — slides in from the right
                                exactly like the order panel: full-width on phones, 488px side panel from
                                md up so the list stays visible (dimmed) behind it. */}
                            <div
                                className="xl:hidden fixed right-0 top-0 z-[9999] h-[100dvh] w-full md:w-[488px] overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300"
                                style={{ background: 'hsl(var(--background))', borderLeft: '1px solid var(--dash-border)' }}
                            >
                                <ProductDetailsMobile
                                    product={quickViewProduct}
                                    onClose={() => setQuickViewProduct(null)}
                                    onEdit={() => router.push(`/products/${quickViewProduct.id}`)}
                                    onDelete={() => { setQuickViewProduct(null); handleDelete(quickViewProduct) }}
                                />
                            </div>
                        </>,
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

            {/* Publishing gate (GH-1458) — alert-style: single acknowledge button, no destructive
                action to confirm/cancel between. See ConfirmModal's `hideCancel` prop. */}
            <ConfirmModal
                open={!!publishGateFields}
                onConfirm={() => setPublishGateFields(null)}
                onCancel={() => setPublishGateFields(null)}
                title={t.dashboard.products.form.publishGateTitle}
                description={publishGateFields && (
                    <span className="flex flex-col gap-2 text-left">
                        <span>{t.dashboard.products.form.checkFields}</span>
                        <ul className="list-disc pl-5">
                            {publishGateFields.map(field => (
                                <li key={field}>
                                    {PUBLISH_GATE_FIELD_KEYS[field]
                                        ? t.dashboard.products.form.fields[PUBLISH_GATE_FIELD_KEYS[field]]
                                        : field}
                                </li>
                            ))}
                        </ul>
                    </span>
                )}
                confirmLabel={t.dashboard.products.form.publishGateAck}
                hideCancel
                variant="default"
            />
        </div>
    )
}
