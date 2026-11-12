import { describe, it, expect } from 'vitest'
import { XENDIT_ENABLED } from '@/lib/payment/xendit-visibility'

describe('Xendit temporary kill switch default (GH-2132)', () => {
    // Guards against accidentally committing the flag as true. Restoring Xendit on purpose = update this test too.
    it('[TC-F34X-24-09] ships disabled', () => {
        expect(XENDIT_ENABLED).toBe(false)
    })
})
