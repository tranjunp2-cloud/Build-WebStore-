export function getDisplayPrice(p: { price?: number; hasVariants?: boolean; variants?: Array<{ price: number }> }) {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
        return { value: Math.min(...p.variants.map(v => v.price != null ? Number(v.price) : 0)), isVariant: true }
    }
    return { value: p.price || 0, isVariant: false }
}
