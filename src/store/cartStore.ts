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
}

type CartStore = {
    items: CartItem[]
    isOpen: boolean
    siteSlug: string

    // Actions
    setSiteSlug: (slug: string) => void
    addItem: (item: Omit<CartItem, 'quantity'>) => void
    removeItem: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    toggleCart: () => void
    openCart: () => void
    closeCart: () => void

    // Computed
    itemCount: () => number
    subtotal: () => number
}

// Persist to localStorage
const CART_KEY = 'primeweb-cart'

function loadCart(): CartItem[] {
    if (typeof window === 'undefined') return []
    try {
        const data = localStorage.getItem(CART_KEY)
        return data ? JSON.parse(data) : []
    } catch { return [] }
}

function saveCart(items: CartItem[]) {
    if (typeof window === 'undefined') return
    localStorage.setItem(CART_KEY, JSON.stringify(items))
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: loadCart(),
    isOpen: false,
    siteSlug: '',

    setSiteSlug: (slug) => set({ siteSlug: slug }),

    addItem: (item) => {
        const existing = get().items.find(i => i.productId === item.productId)
        let newItems: CartItem[]

        if (existing) {
            const maxQty = item.inventory != null ? item.inventory : Infinity
            if (existing.quantity >= maxQty) return
            newItems = get().items.map(i =>
                i.productId === item.productId
                    ? { ...i, quantity: Math.min(i.quantity + 1, maxQty) }
                    : i
            )
        } else {
            if ((item.inventory ?? Infinity) <= 0) return
            newItems = [...get().items, { ...item, quantity: 1 }]
        }

        saveCart(newItems)
        set({ items: newItems, isOpen: true })
    },

    removeItem: (productId) => {
        const newItems = get().items.filter(i => i.productId !== productId)
        saveCart(newItems)
        set({ items: newItems })
    },

    updateQuantity: (productId, quantity) => {
        if (!Number.isFinite(quantity) || quantity <= 0) {
            get().removeItem(productId)
            return
        }
        const existing = get().items.find(i => i.productId === productId)
        // advisory cap — checkout validates actual stock server-side
        const maxQty = existing?.inventory != null ? existing.inventory : Infinity
        const newItems = get().items.map(i =>
            i.productId === productId ? { ...i, quantity: Math.min(quantity, maxQty) } : i
        )
        saveCart(newItems)
        set({ items: newItems })
    },

    clearCart: () => {
        saveCart([])
        set({ items: [] })
    },

    toggleCart: () => set(s => ({ isOpen: !s.isOpen })),
    openCart: () => set({ isOpen: true }),
    closeCart: () => set({ isOpen: false }),

    itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}))
