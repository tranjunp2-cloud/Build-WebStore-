export type MobileOrderAction = 'confirm' | 'ship' | 'cancel'

const CANCELLABLE_STATUSES = new Set([
  'pending',
  'new',
  'confirmed',
  'paid',
  'processing',
])

/**
 * Returns only actions that are safe for the current order workflow. Shipping
 * remains a navigation to the fulfillment form because that form validates
 * courier, collection method, weight, and EasyParcel state before creating a label.
 */
export function getMobileOrderActions(status: string): MobileOrderAction[] {
  if (status === 'pending' || status === 'new') {
    return ['confirm', 'cancel']
  }

  if (status === 'confirmed') {
    return ['ship', 'cancel']
  }

  return CANCELLABLE_STATUSES.has(status) ? ['cancel'] : []
}
