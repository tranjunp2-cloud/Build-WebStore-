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
 *
 * Throws on invalid paths (empty, blocked segments, out-of-range/non-integer array
 * indices) instead of writing somewhere unexpected — callers turn this into a NACK.
 */

/** Prototype-chain keys: assigning through them would pollute Object.prototype. */
const BLOCKED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Hard ceiling for array indices. Block arrays are small (gallery 6, carousel ≤ ~20);
 * the field string arrives via postMessage, so an unbounded index would let a forged
 * message OOM the editor tab through the padding loop.
 */
const MAX_ARRAY_INDEX = 500

function assertValidPath(path: Array<string | number>): void {
    if (path.length === 0) throw new Error('updateValueAtPath: empty path')
    for (const seg of path) {
        if (typeof seg === 'string') {
            if (seg === '') throw new Error('updateValueAtPath: empty path segment')
            if (BLOCKED_SEGMENTS.has(seg)) throw new Error(`updateValueAtPath: blocked path segment "${seg}"`)
        } else if (!Number.isInteger(seg) || seg < 0 || seg > MAX_ARRAY_INDEX) {
            throw new Error(`updateValueAtPath: array index ${seg} out of range (0..${MAX_ARRAY_INDEX})`)
        }
    }
}

export function updateValueAtPath(
    source: Record<string, unknown>,
    path: Array<string | number>,
    nextValue: unknown,
): Record<string, unknown> {
    assertValidPath(path)
    const clone = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
    let cursor: Record<string, unknown> | Array<unknown> = clone

    for (let index = 0; index < path.length - 1; index += 1) {
        const key = path[index] as string | number
        if (Array.isArray(cursor)) {
            // String keys on an array (e.g. "-1") would create own string properties,
            // corrupting the array shape for render/save — reject instead.
            if (typeof key !== 'number') throw new Error(`updateValueAtPath: non-index key "${key}" on array`)
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
    if (Array.isArray(cursor)) {
        if (typeof finalKey !== 'number') throw new Error(`updateValueAtPath: non-index key "${finalKey}" on array`)
        while (cursor.length < finalKey) cursor.push({})
    }
    ;(cursor as Record<string, unknown>)[finalKey as string] = nextValue

    return clone
}
