/**
 * Dependency-free on purpose: pages-schema.ts (bundled into the editor client) imports this,
 * so it must not pull in server-only generation modules.
 */

/** Block types whose list field is `required` in the Pages schema: Payload rejects them with no rows. */
const REQUIRED_LIST_FIELD: Record<string, string> = {
  stats: 'stats',
  features: 'features',
  pricing: 'plans',
  'pricing-table': 'plans',
}

/**
 * #2103 A1: grounded generation can leave stats/features/pricing with nothing true to say.
 * Those blocks are dropped instead of saved empty — Payload refuses the whole page otherwise.
 */
export function isEmptyRequiredListBlock(block: unknown): boolean {
  if (!block || typeof block !== 'object') return false
  const b = block as Record<string, unknown>
  const field = typeof b.blockType === 'string' ? REQUIRED_LIST_FIELD[b.blockType] : undefined
  if (!field) return false
  const list = b[field]
  return !Array.isArray(list) || list.length === 0
}
