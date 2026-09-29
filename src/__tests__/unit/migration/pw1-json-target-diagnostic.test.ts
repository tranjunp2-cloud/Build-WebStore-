import { describe, expect, it } from 'vitest'
import { targetDiagnosticEntity } from '@/lib/migration/pw1-json/target-diagnostic'
import type { Entity } from '@/lib/migration/pw1-json/projection'
import type { ImportDiagnostic } from '@/lib/migration/pw1-json/types'

const diagnostic: ImportDiagnostic = { code: 'TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED', severity: 'blocker', table: 'blog_posts', sourceId: '185', storeId: '3', field: 'slug' }
const blog: Entity = { collection: 'blogs', ref: '@blogs:blog_posts:185', sourceEntity: 'blog_posts', sourceId: '185', storeId: '3', data: { slug: 'wine-for-beginners' }, refs: [], sourceChecksum: 'test' }
const media: Entity = { ...blog, collection: 'media', ref: '@media:blog_posts:185', data: {} }

describe('[TC-F42-IMP-TARGET-ENTITY] Target diagnostic identity', () => {
  it.each([[media, blog], [blog, media]])('selects blog regardless of media ordering %#', (...entities) => {
    // Arrange / Act
    const result = targetDiagnosticEntity(entities, diagnostic)
    // Assert
    expect(result).toBe(blog)
  })
  it('accepts the historical blogs table alias', () => {
    // Arrange / Act
    const result = targetDiagnosticEntity([media, blog], { ...diagnostic, table: 'blogs' })
    // Assert
    expect(result).toBe(blog)
  })
  it.each([
    ['TARGET_PRODUCT_SLUG_GLOBAL_UNIQUE_GAP', 'products', 'products'],
    ['RAW_VALUE_UNVERIFIED', 'products', 'products'],
    ['TARGET_USER_CREATOR_BINDING_REQUIRED', 'users', 'users'],
    ['SUBSCRIPTION_CANCEL_FLAG_ABSENT', 'plan_subscriptions', 'plan-subscriptions'],
    ['ORDER_PAYMENT_METHOD_UNVERIFIED', 'orders', 'orders'],
    ['ORDER_PAYMENT_METHOD_OMITTED', 'orders', 'orders'],
    ['TARGET_BLOG_SLUG_TENANT_MIGRATION_REQUIRED', 'blog_categories', 'blog_categories'],
  ] as const)('selects the business collection for %s / %s', (code, table, collection) => {
    // Arrange
    const entity: Entity = { ...blog, collection, sourceEntity: table }
    const image: Entity = { ...entity, collection: 'media' }
    // Act
    const result = targetDiagnosticEntity([image, entity], { ...diagnostic, code, table })
    // Assert
    expect(result).toBe(entity)
  })
  it.each([[], [media], [blog, { ...blog }], [{ ...blog, storeId: '4' }], [{ ...blog, sourceId: '186' }], [{ ...blog, sourceEntity: 'products' }]])('rejects absent or ambiguous matching targets %#', (...entities) => {
    // Arrange / Act / Assert
    expect(() => targetDiagnosticEntity(entities, diagnostic)).toThrow('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
  })
  it('rejects unknown diagnostic codes', () => {
    // Arrange / Act / Assert
    expect(() => targetDiagnosticEntity([blog], { ...diagnostic, code: 'UNKNOWN' })).toThrow('TARGET_DIAGNOSTIC_SOURCE_MISMATCH')
  })
})
