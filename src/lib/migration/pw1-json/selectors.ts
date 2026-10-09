import { MigrationError } from './errors'
import type { StoreSelector } from './types'
export function normalizeStoreId(value: string): string {
  if (!/^[1-9]\d*$/.test(value)) throw new MigrationError('INVALID_STORE_ID')
  return value
}
export function compareStoreIds(a: string, b: string): number {
  return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0
}
export function selectStoreIds(available: readonly string[], selector: StoreSelector): string[] {
  const modes = [selector.store !== undefined, selector.stores !== undefined, selector.fromStore !== undefined || selector.toStore !== undefined, selector.all === true].filter(Boolean).length
  if (modes !== 1) throw new MigrationError('EXACTLY_ONE_STORE_SELECTOR_REQUIRED')
  const sorted = [...new Set(available.map(normalizeStoreId))].sort(compareStoreIds)
  if (selector.all) return sorted
  if (selector.fromStore !== undefined || selector.toStore !== undefined) {
    if (!selector.fromStore || !selector.toStore) throw new MigrationError('STORE_RANGE_BOUNDS_REQUIRED')
    const from = normalizeStoreId(selector.fromStore), to = normalizeStoreId(selector.toStore)
    if (compareStoreIds(from, to) > 0) throw new MigrationError('STORE_RANGE_REVERSED')
    return sorted.filter(id => compareStoreIds(id, from) >= 0 && compareStoreIds(id, to) <= 0)
  }
  const selected = [...new Set((selector.store !== undefined ? [selector.store] : selector.stores!.split(',')).map(normalizeStoreId))].sort(compareStoreIds)
  if (selected.some(id => !sorted.includes(id))) throw new MigrationError('STORE_NOT_IN_ARTIFACT')
  return selected
}
