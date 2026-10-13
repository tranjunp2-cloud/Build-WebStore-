// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Products } from '@/collections/Products'
import { guardCollection, migrationContext } from '@/lib/migration/pw1-json/runtime'

describe('[TC-F42-IMP-HISTORICAL-WEIGHT] Historical Product publish gate', () => {
  it.each(['private', 'ordinary', 'forged'] as const)('limits the missing-weight exception for %s requests', async mode => {
    // Arrange: wrap a copy of the real hooks; never modify the application config.
    const config = { ...Products, fields: [], hooks: { beforeChange: [...Products.hooks!.beforeChange!] } }
    guardCollection(config)
    const data = { status: 'active', price: 10, sku: 'PW1-2486', inventory: 1, weight: 0, hasVariants: false }
    const context = mode === 'private' ? migrationContext() : mode === 'forged' ? { migrationProfile: 'pw1-json-v1' } : {}
    // Act / Assert
    const result = config.hooks.beforeChange[1]({ data, context } as never)
    if (mode === 'private') await expect(result).resolves.toEqual(data)
    else await expect(result).rejects.toThrow('PUBLISH_BLOCKED')
  })
  it('still rejects other missing publish requirements during migration', async () => {
    const config = { ...Products, fields: [], hooks: { beforeChange: [...Products.hooks!.beforeChange!] } }
    guardCollection(config)
    const data = { status: 'active', price: 0, sku: '', inventory: 1, weight: 0, hasVariants: false }
    await expect(config.hooks.beforeChange[1]({ data, context: migrationContext() } as never)).rejects.toThrow('PUBLISH_BLOCKED')
  })
})
