// Navigation config currently has no cart button field — always returns false.
// Kept as a future-proof guard: if navigation gains showCart/cartButton, this activates.
export function hasHeaderCart(headerBlock: unknown): boolean {
    if (!headerBlock || typeof headerBlock !== 'object') return false
    const cfg = headerBlock as { showCart?: boolean; cartButton?: { show?: boolean } }
    return cfg.showCart === true || cfg.cartButton?.show === true
}
