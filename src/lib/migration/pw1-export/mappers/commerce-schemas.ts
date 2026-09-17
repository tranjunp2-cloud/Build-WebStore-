import { z } from 'zod'
const reference = z.string().regex(/^@[a-z_-]+:[a-z_]+:[^:]+$/)
const dates = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}
const amount = z.number().finite().nonnegative()
const address = {
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().min(1),
}
export const customerDocumentSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
    rank: z.enum(['bronze', 'silver', 'gold', 'vip']).optional(),
    addresses: z
      .array(
        z
          .object({ ...address, label: z.string(), isDefault: z.boolean() })
          .strict(),
      )
      .max(10),
    firstOrderAt: z.string().datetime().optional(),
    latestOrderAt: z.string().datetime().optional(),
    ...dates,
  })
  .strict()
export const discountDocumentSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    site: reference,
    code: z.string().regex(/^[A-Z0-9_-]+$/),
    type: z.enum(['percentage', 'fixed']),
    value: amount,
    status: z.literal('inactive'),
    usageCount: z.literal(0),
    usageLimit: z.number().int().positive().optional(),
    description: z.string().max(500).optional(),
    startsAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    ...dates,
  })
  .strict()
export const orderDocumentSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    site: reference,
    orderNumber: z.string().min(1),
    customer: reference.nullable(),
    customerName: z.string().min(1),
    customerEmail: z.string().optional(),
    customerPhone: z.string().optional(),
    items: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            product: reference.optional(),
            productName: z.string().min(1),
            quantity: z.number().int().positive(),
            unitPrice: amount,
            variant: z.string().optional(),
          })
          .strict(),
      )
      .min(1),
    currency: z.enum(['MYR', 'USD', 'SGD']),
    subtotal: amount,
    shippingFee: amount,
    discountAmount: amount.int(),
    tax: amount,
    total: amount,
    status: z.enum([
      'pending',
      'ready_to_ship',
      'shipped',
      'completed',
      'cancelled',
      'payment_failed',
    ]),
    paymentStatus: z.enum([
      'paid',
      'awaiting_payment',
      'failed',
      'payment_failed',
      'unpaid',
    ]),
    shippingAddress: z.object(address).strict(),
    locale: z.literal('en'),
    verificationSource: z.literal('manual'),
    paymentMethod: z.literal('cod').optional(),
    paymentProvider: z.literal('stripe').optional(),
    trackingNumber: z.string().optional(),
    parcelWeight: amount.int(),
    shippingCourierName: z.string().optional(),
    notes: z.string().optional(),
    discountCode: z.string().optional(),
    discount: reference.optional(),
    ...dates,
  })
  .strict()
