/**
 * Immutable deep-set for editor block data (extracted from PreviewFrame for GH-1381).
 *
 * Creates missing intermediate containers along the path: blocks render fallback
 * slots that may not exist in persisted data yet (e.g. a generated gallery with
 * `images: []` still renders 6 stock-photo slots). Writing through a missing
 * segment used to throw, which killed the whole field-change handler silently —
 * the user saw a success toast while nothing was applied or saved.
 *
 * Container choice follows the next path segment: numeric → array, string → object.
 * Array writes beyond the current length pad the gap with `{}` items (same shape
 * the ImageToolbar array strategies push), never sparse holes.
 */
export function updateValueAtPath(
    source: Record<string, unknown>,
    path: Array<string | number>,
    nextValue: unknown,
): Record<string, unknown> {
    const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
    let cursor: Record<string, unknown> | Array<unknown> = clone

    for (let index = 0; index < path.length - 1; index += 1) {
        const key = path[index] as string | number
        if (Array.isArray(cursor) && typeof key === 'number') {
            while (cursor.length <= key) cursor.push({})
        }
        const next = (cursor as Record<string, unknown>)[key as string]
        if (next === null || typeof next !== 'object') {
            ;(cursor as Record<string, unknown>)[key as string] =
                typeof path[index + 1] === 'number' ? [] : {}
        }
        cursor = (cursor as Record<string, unknown>)[key as string] as Record<string, unknown> | Array<unknown>
    }

    const finalKey = path[path.length - 1] as string | number
    if (Array.isArray(cursor) && typeof finalKey === 'number') {
        while (cursor.length < finalKey) cursor.push({})
    }
    ;(cursor as Record<string, unknown>)[finalKey as string] = nextValue

    return clone
}
