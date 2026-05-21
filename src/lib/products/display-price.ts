export function getDisplayPrice(p: { price?: number; hasVariants?: boolean; variants?: Array<{ price: number }> }) {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
        const prices = p.variants.map(v => {
            const n = v.price != null ? Number(v.price) : 0
            return Number.isFinite(n) ? n : 0
        })
        return { value: Math.min(...prices), isVariant: true }
    }
    return { value: p.price || 0, isVariant: false }
}
