import type { Entity } from './projection'
import type { CollectionName, ImportDiagnostic } from './types'
import { MigrationError } from './errors'

/** One source row can emit both a business document and its media. */
export function targetDiagnosticEntity(entities: Entity[], diagnostic: ImportDiagnostic): Entity {
  let collection: CollectionName | undefined
  switch (diagnostic.code) {
    case 'TARGET_USER_CREATOR_BINDING_REQUIRED': collection = 'users'; break
    case 'SUBSCRIPTION_CANCEL_FLAG_ABSENT': collection = 'plan-subscriptions'; break
    case 'ORDER_PAYMENT_METHOD_UNVERIFIED':
    case 'ORDER_PAYMENT_METHOD_OMITTED': collection = 'orders'; break
    case 'RAW_VALUE_UNVERIFIED':
    case 'TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP': collection = 'products'; break
    case 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED':
      collection = diagnostic.table === 'blog_categories' ? 'blog_categories' : 'blogs'
      break
  }
  // Historical diagnostics name the target collection instead of the source table.
  const sourceTable = diagnostic.table === 'blogs' ? 'blog_posts' : diagnostic.table
  const matches = entities.filter(entity => collection !== undefined && entity.collection === collection &&
    entity.sourceEntity === sourceTable && entity.sourceId === diagnostic.sourceId && entity.storeId === diagnostic.storeId)
  if (matches.length !== 1) throw new MigrationError('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
  return matches[0]
}
