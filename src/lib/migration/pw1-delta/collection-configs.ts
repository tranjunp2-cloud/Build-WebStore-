/**
 * Loads the app's Payload config once, applies the importer's migration guards (the same ones the original
 * import runtime used) and exposes the sanitized collection configs that `buildEntities` needs.
 * No database connection is made here.
 */
import type { SanitizedCollectionConfig, SanitizedConfig } from 'payload'
import { guardCollection } from '../pw1-json/runtime'

let guarded: Promise<SanitizedConfig> | undefined

export function guardedPayloadConfig(): Promise<SanitizedConfig> {
  guarded ??= (async () => {
    process.env.PAYLOAD_PUSH_SCHEMA = 'false'
    const { default: configPromise } = await import('../../../payload.config')
    const config = await configPromise
    // guardCollection mutates in place; the memoized promise guarantees it runs once per process.
    for (const collection of config.collections) guardCollection(collection)
    return config
  })()
  return guarded
}

export async function collectionConfigs(): Promise<Record<string, SanitizedCollectionConfig>> {
  const config = await guardedPayloadConfig()
  return Object.fromEntries(config.collections.map(collection => [collection.slug, collection]))
}
