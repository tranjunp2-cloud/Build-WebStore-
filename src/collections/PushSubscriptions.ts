import type { CollectionConfig, AccessResult } from 'payload'

/**
 * F16-07 — Push Subscriptions Collection
 * Stores Web Push API subscription endpoints per user per tenant.
 * Each browser/device gets a unique subscription.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (!data || operation !== 'create' || !req.user) return data
        try {
          data.user = req.user.id
          const userWithTenants = req.user as { tenants?: Array<{ tenant: string | number | { id: string | number } }> }
          const firstTenant = userWithTenants.tenants?.[0]?.tenant
          data.tenant = typeof firstTenant === 'object' ? firstTenant?.id : firstTenant
        } catch (err) {
          console.error('[PushSubscriptions] beforeChange failed', err)
        }
        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'endpoint',
    description: 'Web Push notification subscriptions.',
    defaultColumns: ['user', 'tenant', 'isActive', 'createdAt'],
  },
  access: {
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => {
      if (!req.user) return false
      if (req.user.roles?.includes('super-admin')) return true
      return { user: { equals: req.user.id } } as AccessResult
    },
    update: ({ req }) => {
      if (!req.user) return false
      if (req.user.roles?.includes('super-admin')) return true
      return { user: { equals: req.user.id } } as AccessResult
    },
    delete: ({ req }) => {
      if (!req.user) return false
      if (req.user.roles?.includes('super-admin')) return true
      return { user: { equals: req.user.id } } as AccessResult
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
    },
    {
      name: 'endpoint',
      type: 'text',
      required: true,
      admin: { description: 'Push service URL (unique per browser)' },
    },
    {
      name: 'p256dh',
      type: 'text',
      required: true,
      admin: { description: 'Client public key for push encryption' },
    },
    {
      name: 'auth',
      type: 'text',
      required: true,
      admin: { description: 'Client auth secret for push encryption' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: { description: 'Deactivated when push endpoint expires (410 Gone)' },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: { description: 'Browser/device info for debugging multi-device' },
    },
  ],
  timestamps: true,
}
