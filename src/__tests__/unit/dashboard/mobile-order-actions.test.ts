import { describe, expect, it } from 'vitest'
import { getMobileOrderActions } from '@/app/(dashboard)/orders/_components/mobile-order-actions'

describe('mobile order actions', () => {
  it('keeps confirmation and cancellation available for unconfirmed orders', () => {
    expect(getMobileOrderActions('pending')).toEqual(['confirm', 'cancel'])
    expect(getMobileOrderActions('new')).toEqual(['confirm', 'cancel'])
  })

  it('routes confirmed orders to the fulfillment flow instead of a direct status update', () => {
    expect(getMobileOrderActions('confirmed')).toEqual(['ship', 'cancel'])
  })

  it('does not expose terminal or shipment actions after label creation', () => {
    expect(getMobileOrderActions('ready_to_ship')).toEqual([])
    expect(getMobileOrderActions('shipped')).toEqual([])
    expect(getMobileOrderActions('completed')).toEqual([])
    expect(getMobileOrderActions('cancelled')).toEqual([])
  })
})
