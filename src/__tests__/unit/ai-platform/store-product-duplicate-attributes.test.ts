// @vitest-environment node
// GH-2380: a Payload ValidationError for duplicate attributes reaches the merchant as a clear 422.
import { describe, it, expect } from 'vitest'
import { ValidationError } from 'payload'
import { saveFailure } from '@/lib/ai-platform/appliers/store-product-shared'
import { DUPLICATE_ATTRIBUTE_MESSAGE } from '@/lib/products/attribute-names'

describe('[TC-F08-04-147] AI applier surfaces duplicate attribute names', () => {
    it('maps the ValidationError to a 422 naming the problem', () => {
        const error = new ValidationError({ collection: 'products', errors: [{ path: 'attributes.1.key', message: DUPLICATE_ATTRIBUTE_MESSAGE }] })
        const failure = saveFailure(error)
        expect(failure.status).toBe(422)
        expect(failure.message).toContain('Each attribute name must be unique.')
    })
})
