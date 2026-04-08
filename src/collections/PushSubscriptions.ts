import type { CollectionConfig, AccessResult } from 'payload'

/**
 * F16-07 — Push Subscriptions Collection
 * Stores Web Push API subscription endpoints per user per tenant.
 * Each browser/device gets a unique subscription.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
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
