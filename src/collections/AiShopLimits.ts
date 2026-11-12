import type { Access, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { type ShopLimitMode, shopLimitProblem } from '@/lib/ai-platform/shop-limit-schema'

/**
 * Per-shop override of the plan's AI limits (one row per shop). Edited in Prime Studio (AI usage → Shops) or here.
 * Read by lib/ai-platform/plan-limits → the `lim` claim of the ai-platform context token (cached 60 s).
 * - custom: every limit that is set replaces the plan's value; empty = keep the plan's
 * - unlimited: all budgets off (a VIP shop); blocked: AI is refused for the shop
 * An expired override (expiresAt in the past) is ignored, the plan applies again. Platform caps always apply on top.
 */

const superAdmin: Access = ({ req }) => (req.user as { roles?: string[] | null } | null)?.roles?.includes('super-admin') || false

const usd = { step: 0.01 }

export const AiShopLimits: CollectionConfig = {
    slug: 'ai-shop-limits',
    labels: { singular: 'AI shop limit', plural: 'AI shop limits' },
    admin: {
        description: 'A shop’s own AI limits, replacing its plan’s. Expired rows are ignored. Platform caps always apply on top.',
        group: 'AI',
        useAsTitle: 'reason',
        defaultColumns: ['tenant', 'mode', 'aiBudgetUsd', 'aiBudgetUsdMonthly', 'expiresAt', 'updatedAt'],
    },
    defaultSort: '-updatedAt',
    access: { read: superAdmin, create: superAdmin, update: superAdmin, delete: superAdmin },
    hooks: {
        beforeChange: [
            ({ data, originalDoc, req }) => {
                const merged = { ...(originalDoc ?? {}), ...(data ?? {}) } as Record<string, unknown>
                const message = shopLimitProblem(merged as Parameters<typeof shopLimitProblem>[0])
                if (message) throw new ValidationError({ collection: 'ai-shop-limits', errors: [{ message, path: 'mode' }] })
                const userId = (req?.user as { id?: number | string } | null | undefined)?.id
                if (userId !== undefined) return { ...data, setBy: userId }
                return data
            },
        ],
    },
    fields: [
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            required: true,
            unique: true,
            admin: { description: 'The shop. One override per shop.' },
        },
        {
            name: 'mode',
            type: 'select',
            required: true,
            defaultValue: 'custom',
            options: [
                { label: 'Custom limits', value: 'custom' },
                { label: 'Unlimited', value: 'unlimited' },
                { label: 'Blocked (AI off)', value: 'blocked' },
            ] satisfies Array<{ label: string; value: ShopLimitMode }>,
            admin: { description: 'Custom: the limits below replace the plan’s. Unlimited: no budgets. Blocked: AI is refused.' },
        },
        {
            type: 'row',
            fields: [
                { name: 'aiBudgetUsd', type: 'number', min: 0, admin: { width: '50%', ...usd, condition: (data) => data?.mode === 'custom', description: 'USD per rolling 24 h (chat + writing tools). Empty = keep the plan’s.' } },
                { name: 'picturesPerDay', type: 'number', min: 0, admin: { width: '50%', step: 1, condition: (data) => data?.mode === 'custom', description: 'Pictures per rolling 24 h. Empty = keep the plan’s.' } },
            ],
        },
        {
            type: 'row',
            fields: [
                { name: 'aiBudgetUsdMonthly', type: 'number', min: 0, admin: { width: '50%', ...usd, condition: (data) => data?.mode === 'custom', description: 'USD per calendar month (Malaysia time). Empty = keep the plan’s.' } },
                { name: 'siteBudgetUsd', type: 'number', min: 0, admin: { width: '50%', ...usd, condition: (data) => data?.mode === 'custom', description: 'USD per rolling 24 h for website setup. Empty = keep the plan’s.' } },
            ],
        },
        { name: 'reason', type: 'text', required: true, maxLength: 500, admin: { description: 'Why this shop is different (shown in Studio).' } },
        { name: 'expiresAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Empty = until removed. After this time the plan applies again.' } },
        { name: 'setBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar', description: 'Who set it last' } },
    ],
    timestamps: true,
}
