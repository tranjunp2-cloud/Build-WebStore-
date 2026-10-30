/**
 * Pure maths for the limits page: per shop per active day spread (p50/p90/max) and the
 * "would have hit this limit" preview. Client-safe so the preview updates while typing.
 */
import { PLAN_GROUPS, groupOfPlan, type LimitKind } from './plan-groups'
import type { GroupStats, ShopUsage, Spread } from './types'

/** One shop's total on one day, as the SQL returns it. */
export interface ShopDayRow {
  tenantId: number
  name: string | null
  plan: string | null
  budget: number
  pictures: number
}

/** Linear-interpolated percentile of an ascending list; 0 for an empty list. */
export function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  const rank = (sortedAsc.length - 1) * p
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  return sortedAsc[low] + (sortedAsc[high] - sortedAsc[low]) * (rank - low)
}

export function spreadOf(values: readonly number[]): Spread {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
  return { p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9), max: sorted.length ? sorted[sorted.length - 1] : 0 }
}

/** Group shop-days by plan group: spreads over active days, and each shop's worst day. */
export function buildGroupStats(rows: readonly ShopDayRow[]): GroupStats[] {
  return PLAN_GROUPS.map((group) => {
    const inGroup = rows.filter((row) => groupOfPlan(row.plan)?.id === group.id)
    const shops = new Map<number, ShopUsage>()
    for (const row of inGroup) {
      const shop = shops.get(row.tenantId) ?? { id: row.tenantId, name: row.name || `Shop #${row.tenantId}`, maxBudget: 0, maxPictures: 0 }
      shop.maxBudget = Math.max(shop.maxBudget, row.budget)
      shop.maxPictures = Math.max(shop.maxPictures, row.pictures)
      shops.set(row.tenantId, shop)
    }
    return {
      group: group.id,
      shops: [...shops.values()].filter((shop) => shop.maxBudget > 0 || shop.maxPictures > 0),
      budget: spreadOf(inGroup.map((row) => row.budget)),
      pictures: spreadOf(inGroup.map((row) => row.pictures)),
    }
  })
}

export interface HitPreview {
  count: number
  /** the worst offenders first, at most `nameLimit` */
  names: string[]
}

/**
 * Shops whose worst day reached `limit` (a shop at the limit is blocked for the rest of its 24 h).
 * limit null = unlimited → nobody. A limit of 0 turns the feature off, so every shop that used it hits.
 */
export function wouldHaveHit(shops: readonly ShopUsage[], kind: LimitKind, limit: number | null, nameLimit = 2): HitPreview {
  if (limit === null || !Number.isFinite(limit) || limit < 0) return { count: 0, names: [] }
  const valueOf = (shop: ShopUsage) => (kind === 'budget' ? shop.maxBudget : shop.maxPictures)
  const hit = shops.filter((shop) => valueOf(shop) > 0 && valueOf(shop) >= limit).sort((a, b) => valueOf(b) - valueOf(a))
  return { count: hit.length, names: hit.slice(0, nameLimit).map((shop) => shop.name) }
}

/** "N shops would have hit this limit last 7 days: a, b and K more." */
export function hitSentence(preview: HitPreview): string {
  if (preview.count === 0) return 'No shop would have hit this limit last 7 days.'
  const noun = preview.count === 1 ? 'shop' : 'shops'
  const more = preview.count - preview.names.length
  const names = preview.names.length ? `: ${preview.names.join(', ')}${more > 0 ? ` and ${more} more` : ''}` : ''
  return `${preview.count} ${noun} would have hit this limit last 7 days${names}.`
}
