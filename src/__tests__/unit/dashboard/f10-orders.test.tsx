/**
 * Unit Tests — F10 Order Management
 * Coverage Map:
 *   - Utilities: formatPrice
 *   - Config: STATUS_CONFIG
 *
 * Note: OrderMobileCard / OrderStatusBadge (the old `orders/components/*`
 * variants) were removed in the design-system unification — they had no
 * production importers (the live UI inlines the mobile card into OrdersTable
 * and uses `_components/OrderStatusBadge`). Their tests were dropped with them.
 */

import { describe, it, expect } from 'vitest'
import { formatPrice, STATUS_CONFIG } from '@/app/(dashboard)/orders/types'

describe('F10 Order Tracking Types & Utils', () => {
    it('formatPrice formats strictly to 2 decimal places with correct currency symbol', () => {
        expect(formatPrice(100.5, 'MYR')).toBe('RM 100.50')
        expect(formatPrice(50, 'SGD')).toBe('S$50.00')
        expect(formatPrice(1234.56, 'USD')).toBe('$1234.56')
    })

    it('STATUS_CONFIG has correct mapping for known statuses', () => {
        expect(STATUS_CONFIG.pending.label).toBe('Pending')
        expect(STATUS_CONFIG.completed.label).toBe('Completed')
        expect(STATUS_CONFIG.cancelled.label).toBe('Cancelled')
    })
})
