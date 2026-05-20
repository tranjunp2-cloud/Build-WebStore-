/**
 * Variant pool resolver — translates rubric sentinels like "@hero.nonDefault"
 * to actual variant arrays sourced from app block configs at runtime.
 *
 * Sentinel format: "@<blockType>.<pool>"
 *   pool = 'variants' | 'nonDefault' | 'defaultOnly'
 *
 * Single source of truth: src/blocks/{type}/config.ts → exported meta.
 * When app adds a variant to block config, this resolver picks it up automatically.
 *
 * Note: blockRegistry dynamic import fails in tsx (getBlockMeta undefined),
 * so we import meta objects directly from block config files.
 */

import { heroMeta } from '../../../src/blocks/hero/config'
import { navigationMeta } from '../../../src/blocks/navigation/config'

type BlockMeta = { variants: readonly string[]; defaultVariant?: string }

/** Map of blockType → meta. Add new entries here when blocks gain sentinel support. */
const BLOCK_METAS: Record<string, BlockMeta> = {
    hero: heroMeta as unknown as BlockMeta,
    navigation: navigationMeta as unknown as BlockMeta,
}

const SENTINEL_RE = /^@([a-z][a-z0-9-]*)\.(variants|nonDefault|defaultOnly)$/

/**
 * Returns true if `value` is a string matching the sentinel pattern.
 * Used to guard the resolver before calling resolveVariantSentinel.
 */
export function isVariantSentinel(value: unknown): value is string {
    return typeof value === 'string' && SENTINEL_RE.test(value)
}

/**
 * Resolves a sentinel string to a concrete string[].
 *
 * @example
 *   resolveVariantSentinel('@hero.nonDefault')
 *   // → ['split-left', 'split-right', 'fullscreen', ...] (all except 'centered')
 *
 * @throws if sentinel is malformed or blockType is not registered in BLOCK_METAS
 */
export function resolveVariantSentinel(sentinel: string): string[] {
    const m = sentinel.match(SENTINEL_RE)
    if (!m) throw new Error(`[variant-pools] invalid sentinel: ${sentinel}`)
    const [, blockType, pool] = m as [string, string, string]

    const meta = BLOCK_METAS[blockType]
    if (!meta) throw new Error(`[variant-pools] unknown blockType "${blockType}". Register it in BLOCK_METAS.`)

    const all: string[] = [...(meta.variants ?? [])]
    const def = meta.defaultVariant

    switch (pool) {
        case 'variants':    return all
        case 'nonDefault':  return def ? all.filter((v) => v !== def) : all
        case 'defaultOnly': return def ? [def] : []
        default:            throw new Error(`[variant-pools] unknown pool: ${pool}`)
    }
}
