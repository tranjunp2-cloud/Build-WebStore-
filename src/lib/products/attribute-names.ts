// Pure helpers (no payload import) so the form schema can share them.
export const DUPLICATE_ATTRIBUTE_MESSAGE = 'Each attribute name must be unique.'

type AttributeRow = { key?: unknown; value?: unknown } | null | undefined

export const normalizeAttributeName = (key: unknown): string => String(key ?? '').trim().toLowerCase()

/** Indexes of every 2nd+ occurrence of a name (trim, case-insensitive); empty names are ignored. */
export function findDuplicateAttributeIndexes(rows: readonly AttributeRow[]): number[] {
    const seen = new Set<string>()
    const duplicates: number[] = []
    rows.forEach((row, index) => {
        const name = normalizeAttributeName(row?.key)
        if (!name) return
        if (seen.has(name)) duplicates.push(index)
        else seen.add(name)
    })
    return duplicates
}

const signature = (rows: readonly AttributeRow[]): string[] =>
    rows.map(row => `${normalizeAttributeName(row?.key)}\u0000${String(row?.value ?? '').trim()}`)

/** True when the list differs in length, order, normalized key or trimmed value. */
export function attributesChanged(next: readonly AttributeRow[], prev: readonly AttributeRow[] | null | undefined): boolean {
    const a = signature(next)
    const b = signature(prev ?? [])
    return a.length !== b.length || a.some((entry, i) => entry !== b[i])
}
