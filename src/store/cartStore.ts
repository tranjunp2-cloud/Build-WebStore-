import { create } from 'zustand'

export type CartItem = {
    productId: string
    productSlug: string
    name: string
    price: number
    compareAtPrice?: number
    currency: string
    imageUrl?: string
    quantity: number
    inventory?: number // undefined = unlimited
    variantName?: string
    unavailable?: boolean
}

export type CartChange = {
    productId: string
    variantName?: string
    fields: string[]
    previous?: Pick<CartItem, 'price' | 'quantity'>
    current?: Pick<CartItem, 'price' | 'quantity'>
}

export type CartRefreshStatus = 'idle' | 'refreshing' | 'error'

type ResolverProduct = {
    name: string
    slug: string
    price: number
    compareAtPrice?: number
    currency: string
    imageUrl?: string
    inventory: number | null
    quantity: number
}

type ResolverAvailableLine = {
    productId: number
    variant: string | null
    available: true
    changed?: string[]
    product: ResolverProduct
}

type ResolverUnavailableLine = {
    productId: number
    variant: string | null
    available: false
    reason: 'unavailable'
}

type ResolverLine = ResolverAvailableLine | ResolverUnavailableLine

type CartStore = {
    items: CartItem[]
    isOpen: boolean
    siteId: string
    siteSlug: string
    refreshStatus: CartRefreshStatus
    resolvedSignature: string | null
    cartRevision: number
    changes: CartChange[]
    requiresConfirmation: boolean
    legacyCartCleared: boolean

    activateSiteCart: (siteId: string, siteSlug: string) => void
    addItem: (item: Omit<CartItem, 'quantity' | 'unavailable'>) => void
    removeItem: (productId: string, variantName?: string) => void
    updateQuantity: (productId: string, quantity: number, variantName?: string) => void
    clearCart: () => void
    refreshCart: () => Promise<void>
    clearChanges: () => void
    acknowledgeChanges: () => void
    toggleCart: () => void
    openCart: () => void
    closeCart: () => void
    itemCount: () => number
    subtotal: () => number
}

const LEGACY_CART_KEY = 'primeweb-cart'
const siteCartKey = (siteId: string) => `${LEGACY_CART_KEY}:${siteId}`
let refreshGeneration = 0
let refreshController: AbortController | null = null
let refreshPromise: Promise<void> | null = null

const sameLine = (
    a: Pick<CartItem, 'productId' | 'variantName'>,
    b: Pick<CartItem, 'productId' | 'variantName'>,
) => a.productId === b.productId && (a.variantName ?? '') === (b.variantName ?? '')

const lineKey = (item: Pick<CartItem, 'productId' | 'variantName'>) => `${item.productId}:${item.variantName ?? ''}`

export function cartSignature(items: CartItem[]): string {
    return items
        .map(item => `${lineKey(item)}:${item.quantity}`)
        .sort()
        .join('|')
}

function loadCart(siteId: string): CartItem[] {
    if (typeof window === 'undefined' || !siteId) return []
    try {
        const data = localStorage.getItem(siteCartKey(siteId))
        const parsed: unknown = data ? JSON.parse(data) : []
        return Array.isArray(parsed) ? parsed as CartItem[] : []
    } catch {
        return []
    }
}

function saveCart(siteId: string, items: CartItem[]) {
    if (typeof window === 'undefined' || !siteId) return
    localStorage.setItem(siteCartKey(siteId), JSON.stringify(items))
}

function snapshot(item: CartItem) {
    return {
        name: item.name,
        price: item.price,
        compareAtPrice: item.compareAtPrice ?? null,
        imageUrl: item.imageUrl ?? null,
        inventory: item.inventory ?? null,
    }
}

function canonicalFields(item: CartItem, line: ResolverAvailableLine): CartItem {
    const product = line.product!
    return {
        ...item,
        productSlug: product.slug,
        name: product.name,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: product.currency,
        imageUrl: product.imageUrl,
        inventory: product.inventory ?? undefined,
        quantity: product.quantity,
        unavailable: false,
    }
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    isOpen: false,
    siteId: '',
    siteSlug: '',
    refreshStatus: 'idle',
    resolvedSignature: null,
    cartRevision: 0,
    changes: [],
    requiresConfirmation: false,
    legacyCartCleared: false,

    activateSiteCart: (siteId, siteSlug) => {
        if (!siteId || !siteSlug) return
        const current = get()
        if (current.siteId === siteId && current.siteSlug === siteSlug) return

        refreshGeneration += 1
        refreshController?.abort()
        refreshController = null
        refreshPromise = null

        let legacyCartCleared = current.legacyCartCleared
        if (typeof window !== 'undefined' && localStorage.getItem(LEGACY_CART_KEY) !== null) {
            localStorage.removeItem(LEGACY_CART_KEY)
            legacyCartCleared = true
        }

        set({
            siteId,
            siteSlug,
            items: loadCart(siteId),
            refreshStatus: 'idle',
            resolvedSignature: null,
            changes: [],
            requiresConfirmation: false,
            legacyCartCleared,
            cartRevision: current.cartRevision + 1,
        })
    },

    addItem: (item) => {
        const current = get()
        const existing = current.items.find(candidate => sameLine(candidate, item))
        const maxQty = item.inventory != null ? item.inventory : Infinity
        let newItems: CartItem[]

        if (existing) {
            if (existing.quantity >= maxQty) return
            newItems = current.items.map(candidate =>
                sameLine(candidate, item)
                    ? { ...candidate, ...item, quantity: Math.min(candidate.quantity + 1, maxQty), unavailable: false }
                    : candidate
            )
        } else {
            if (maxQty <= 0) return
            newItems = [...current.items, { ...item, quantity: 1, unavailable: false }]
        }

        saveCart(current.siteId, newItems)
        set({
            items: newItems,
            isOpen: true,
            refreshStatus: 'idle',
            resolvedSignature: null,
            cartRevision: current.cartRevision + 1,
        })
    },

    removeItem: (productId, variantName) => {
        const current = get()
        const removedKey = { productId, variantName }
        const newItems = current.items.filter(item => !sameLine(item, removedKey))
        const remainingChanges = current.changes.filter(change => !sameLine(change, removedKey))
        saveCart(current.siteId, newItems)
        set({ items: newItems, resolvedSignature: null, changes: remainingChanges, requiresConfirmation: remainingChanges.length > 0, cartRevision: current.cartRevision + 1 })
    },

    updateQuantity: (productId, quantity, variantName) => {
        if (!Number.isFinite(quantity) || quantity <= 0) {
            get().removeItem(productId, variantName)
            return
        }
        const current = get()
        const key = { productId, variantName }
        const existing = current.items.find(item => sameLine(item, key))
        if (!existing || existing.unavailable) return
        const maxQty = existing.inventory != null ? existing.inventory : Infinity
        const newItems = current.items.map(item =>
            sameLine(item, key) ? { ...item, quantity: Math.min(quantity, maxQty) } : item
        )
        saveCart(current.siteId, newItems)
        set({ items: newItems, resolvedSignature: null, cartRevision: current.cartRevision + 1 })
    },

    clearCart: () => {
        const current = get()
        saveCart(current.siteId, [])
        set({ items: [], resolvedSignature: null, changes: [], requiresConfirmation: false, cartRevision: current.cartRevision + 1 })
    },

    refreshCart: async () => {
        const current = get()
        if (!current.siteId || !current.siteSlug || current.items.length === 0) return
        if (refreshPromise) return refreshPromise

        const requestItems = current.items.map(item => ({
            productId: Number(item.productId),
            variant: item.variantName,
            quantity: item.quantity,
            snapshot: snapshot(item),
        }))
        if (requestItems.some(item => !Number.isSafeInteger(item.productId) || item.productId <= 0)) {
            set({ refreshStatus: 'error' })
            return
        }

        const generation = ++refreshGeneration
        const signature = cartSignature(current.items)
        const revision = current.cartRevision
        const controller = new AbortController()
        refreshController = controller
        set({ refreshStatus: 'refreshing' })

        let requestPromise!: Promise<void>
        requestPromise = (async () => {
            try {
                const response = await fetch('/api/storefront/cart/resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ siteId: Number(current.siteId), siteSlug: current.siteSlug, items: requestItems }),
                    signal: controller.signal,
                })
                if (!response.ok) throw new Error(`Cart refresh failed: ${response.status}`)
                const result = await response.json() as { lines?: ResolverLine[] }
                if (!Array.isArray(result.lines) || result.lines.length !== requestItems.length) {
                    throw new Error('Cart refresh returned incomplete lines')
                }

                const latest = get()
                if (
                    generation !== refreshGeneration
                    || latest.siteId !== current.siteId
                    || latest.cartRevision !== revision
                    || cartSignature(latest.items) !== signature
                ) return

                const lines = new Map(result.lines.map(line => [`${line.productId}:${line.variant ?? ''}`, line]))
                const changes: CartChange[] = []
                const merged = latest.items.map(item => {
                    const line = lines.get(lineKey(item))
                    if (!line) return item
                    if (!line.available || !line.product) {
                        if (!item.unavailable) changes.push({ productId: item.productId, variantName: item.variantName, fields: ['unavailable'], previous: { price: item.price, quantity: item.quantity } })
                        return { ...item, unavailable: true }
                    }
                    const next = canonicalFields(item, line)
                    const fields = new Set(line.changed ?? [])
                    if (next.quantity !== item.quantity) fields.add('quantity')
                    if (item.unavailable) fields.add('available')
                    if (fields.size > 0) changes.push({ productId: item.productId, variantName: item.variantName, fields: [...fields], previous: { price: item.price, quantity: item.quantity }, current: { price: next.price, quantity: next.quantity } })
                    return next
                })

                saveCart(latest.siteId, merged)
                const mergedSignature = cartSignature(merged)
                const pendingChangesByLine = new Map(latest.changes.map(change => [lineKey(change), change]))
                for (const change of changes) {
                    const key = lineKey(change)
                    const existing = pendingChangesByLine.get(key)
                    pendingChangesByLine.set(key, existing ? {
                        ...change,
                        fields: [...new Set([...existing.fields, ...change.fields])],
                        previous: existing.previous ?? change.previous,
                    } : change)
                }
                const pendingChanges = [...pendingChangesByLine.values()]
                set({
                    items: merged,
                    refreshStatus: 'idle',
                    resolvedSignature: mergedSignature,
                    changes: pendingChanges,
                    requiresConfirmation: latest.requiresConfirmation || changes.length > 0,
                    cartRevision: latest.cartRevision + 1,
                })
            } catch (error) {
                if ((error as DOMException).name === 'AbortError') return
                if (generation === refreshGeneration) set({ refreshStatus: 'error' })
            } finally {
                if (refreshController === controller) refreshController = null
                if (refreshPromise === requestPromise) refreshPromise = null
            }
        })()
        refreshPromise = requestPromise

        return requestPromise
    },

    clearChanges: () => set({ changes: [], legacyCartCleared: false }),
    acknowledgeChanges: () => set({ changes: [], requiresConfirmation: false }),
    toggleCart: () => set(state => ({ isOpen: !state.isOpen })),
    openCart: () => set({ isOpen: true }),
    closeCart: () => set({ isOpen: false }),
    itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: () => get().items.filter(item => !item.unavailable).reduce((sum, item) => sum + item.price * item.quantity, 0),
}))
