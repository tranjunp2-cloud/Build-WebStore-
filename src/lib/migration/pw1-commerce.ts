/** Absent metadata preserves ordinary PW2 generation behavior. */
export function migrationAllowsTracking(globalBlocks: unknown): boolean {
    if (!globalBlocks || typeof globalBlocks !== 'object') return true
    const metadata = (globalBlocks as Record<string, unknown>).pw1Commerce
    return !(metadata && typeof metadata === 'object' && (metadata as Record<string, unknown>).orderTracking === false)
}
