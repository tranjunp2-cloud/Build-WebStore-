/**
 * Block schema version — sha256 hash of registry snapshot per block:
 *   { type, variants[], schemaKeys[] }
 *
 * Used to stamp every seeded Template row (Phase 05 of plan
 * `260419-2022-GH-1-harness-template-block-sync-flow`). Enables per-template
 * staleness: if row.blockSchemaVersion !== computeBlockSchemaVersion() →
 * template was seeded against an older registry snapshot.
 *
 * Hash input is deterministic via:
 *   - `getBlockTypes()` sorted alphabetically.
 *   - variants array sorted (copy before sort — never mutate registry meta).
 *   - schemaKeys = `ZodObject.shape` keys sorted; empty array for non-object schemas.
 *
 * Returns first 16 hex chars of sha256 — plenty of entropy for drift detection.
 */

import crypto from 'node:crypto'

import { blockRegistry } from '@/blocks/registry'

type RegistryEntrySnapshot = {
  type: string
  variants: string[]
  schemaKeys: string[]
}

/**
 * Extract keys from a Zod schema's `.shape` if it's a ZodObject (or .extend()
 * result). Returns sorted keys; empty array if schema has no accessible shape.
 */
function getSchemaKeys(schema: unknown): string[] {
  if (!schema || typeof schema !== 'object') return []
  // ZodObject exposes `.shape` as either a getter or plain object of fields.
  const shape = (schema as { shape?: Record<string, unknown> }).shape
  if (!shape || typeof shape !== 'object') return []
  return Object.keys(shape).sort()
}

/** Compute a stable 16-char hex hash of the current block registry snapshot. */
export function computeBlockSchemaVersion(): string {
  const entries: RegistryEntrySnapshot[] = blockRegistry
    .getBlockTypes()
    .map((type) => {
      const meta = blockRegistry.getBlockMeta(type)
      const schema = blockRegistry.getSchema(type)
      const variants = [...(meta?.variants ?? [])].sort()
      const schemaKeys = getSchemaKeys(schema)
      return { type, variants, schemaKeys }
    })
    .sort((a, b) => a.type.localeCompare(b.type))

  const json = JSON.stringify(entries)
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
}
