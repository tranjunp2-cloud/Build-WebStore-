/**
 * Bulk add: a long product list is parsed in small chunks. One answer for the whole list runs into the model's
 * output limit (~360 tokens per product) and the 55 s budget, and the list came back cut after a few products.
 * A short text keeps the single call; a long one is split into one piece of the merchant's own words per product
 * (`catalog.split-products`), and the pieces are parsed a few products at a time, in parallel.
 */

/** Shorter texts hold a handful of products: one call answers them in time. */
export const BULK_SPLIT_MIN_CHARS = 400
/** Products per parse call. */
export const BULK_CHUNK_SIZE = 5
/** Parse calls in flight at once. */
export const BULK_CHUNK_CONCURRENCY = 3
/** A chunk retry starts only with this much of the budget left. */
export const BULK_RETRY_MIN_MS = 15_000

type Product = Record<string, unknown>

export interface ChunkedParseArgs {
    promptText: string
    /** Epoch ms the whole parse must settle by. */
    deadlineAt: number
    /** The merchant's text → one piece per product; throws on failure. */
    split: (promptText: string, signal: AbortSignal) => Promise<string[]>
    /** One parse call (the `catalog.bulk-parse-products` task); throws on failure. */
    parse: (promptText: string, signal: AbortSignal) => Promise<{ products: Product[] }>
}

export interface ChunkedParseResult {
    products: Product[]
    /** Pieces of the merchant's text no call could read (empty when everything was parsed). */
    unparsed: string[]
}

/** Splits `items` into the fewest chunks of at most `size`, as even as possible (12 → 4 + 4 + 4). */
export function chunkEvenly<T>(items: readonly T[], size: number): T[][] {
    if (items.length === 0) return []
    const chunks = Math.ceil(items.length / size)
    const perChunk = Math.ceil(items.length / chunks)
    return Array.from({ length: chunks }, (_, index) => items.slice(index * perChunk, (index + 1) * perChunk))
}

const squash = (text: string) => text.replace(/\s+/g, '')

/** The split copies the merchant's words: pieces that keep less than half the text dropped products. */
export function splitLooksComplete(promptText: string, pieces: readonly string[]): boolean {
    return squash(pieces.join('')).length >= squash(promptText).length * 0.5
}

/** Chunks answer separately and may reuse a SKU; a later duplicate gets `-2`, `-3`… */
export function dedupeSkus(products: Product[]): Product[] {
    const seen = new Set<string>()
    return products.map((product) => {
        const sku = typeof product.sku === 'string' ? product.sku.trim() : ''
        if (!sku) return product
        let next = sku
        for (let n = 2; seen.has(next.toUpperCase()); n += 1) next = `${sku}-${n}`
        seen.add(next.toUpperCase())
        return next === product.sku ? product : { ...product, sku: next }
    })
}

const budgetSignal = (deadlineAt: number) => AbortSignal.timeout(Math.max(1, deadlineAt - Date.now()))

export async function parseProductsInChunks(args: ChunkedParseArgs): Promise<ChunkedParseResult> {
    const { promptText, deadlineAt, split, parse } = args
    const whole = async () => ({ products: (await parse(promptText, budgetSignal(deadlineAt))).products, unparsed: [] })
    if (promptText.length < BULK_SPLIT_MIN_CHARS) return whole()

    let pieces: string[]
    try {
        pieces = (await split(promptText, budgetSignal(deadlineAt))).map((piece) => piece.trim()).filter(Boolean)
    } catch (error) {
        console.warn('[AI Bulk Parse] split failed, parsing the whole text', error instanceof Error ? error.name : error)
        return whole()
    }
    if (pieces.length <= BULK_CHUNK_SIZE || !splitLooksComplete(promptText, pieces)) return whole()

    const chunks = chunkEvenly(pieces, BULK_CHUNK_SIZE)
    const results: Array<Product[] | null> = chunks.map(() => null)
    const errors: unknown[] = []
    const runChunk = async (index: number) => {
        const text = chunks[index]!.join('\n')
        for (let attempt = 0; attempt < 2; attempt += 1) {
            // a retry only when it can still finish inside the budget
            if (attempt > 0 && deadlineAt - Date.now() < BULK_RETRY_MIN_MS) return
            try {
                results[index] = (await parse(text, budgetSignal(deadlineAt))).products
                return
            } catch (error) {
                errors.push(error)
            }
        }
    }
    let next = 0
    await Promise.all(
        Array.from({ length: Math.min(BULK_CHUNK_CONCURRENCY, chunks.length) }, async () => {
            while (next < chunks.length) {
                const index = next
                next += 1
                await runChunk(index)
            }
        }),
    )

    if (results.every((products) => products === null)) throw errors[0] ?? new Error('Bulk parse failed')
    return {
        products: dedupeSkus(results.flatMap((products) => products ?? [])),
        unparsed: chunks.flatMap((chunk, index) => (results[index] === null ? chunk : [])),
    }
}
