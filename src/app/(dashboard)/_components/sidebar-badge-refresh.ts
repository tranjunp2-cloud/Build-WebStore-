import type { AgentChangeBatch } from '@/lib/agent-changes/types'

/** Records behind the sidebar badges: pending orders, active products, discounts. */
export const BADGE_ENTITY_KINDS = ['store_order', 'product', 'store_discount']

/**
 * Change sets that touch those records without changing a count: product edits, new products (drafts, not active),
 * other pages' data. A burst made only of these leaves the badges as they are.
 */
const KEEPS_COUNTS = /^(shop_product\.(update|create_drafts)|product\.create_drafts|blog\.|store\.categories_|store\.customers_|site\.)/

export const countsMayChange = ({ changes }: AgentChangeBatch): boolean => changes.some((c) => !KEEPS_COUNTS.test(c.kind))
