import type { Access, CollectionConfig } from 'payload'
import type { AiCapAlertScope } from '@/lib/ai-platform/cap-alert-scopes'

/**
 * One row each time AI spend crosses an alert threshold: the platform's daily / monthly cap (thresholds from
 * `ai_platform_config.settings.caps.alertPercents`) or a shop reaching its own daily budget (threshold 100).
 * Written by /api/cron/ai-usage-sync (lib/admin/ai-caps/alerts) with raw SQL, once per (scope, period, threshold, shop):
 * a unique index makes a re-run or two overlapping runs harmless. Read-only here; shown in Studio.
 */

const superAdmin: Access = ({ req }) => (req.user as { roles?: string[] | null } | null)?.roles?.includes('super-admin') || false

export const AiCapAlerts: CollectionConfig = {
    slug: 'ai-cap-alerts',
    labels: { singular: 'AI cap alert', plural: 'AI cap alerts' },
    admin: {
        description: 'Spend crossed an alert threshold. One row per threshold per day / month (per shop for shop alerts).',
        group: 'AI',
        useAsTitle: 'periodKey',
        defaultColumns: ['createdAt', 'scope', 'periodKey', 'threshold', 'spentUsd', 'capUsd', 'tenant', 'notifiedLark'],
    },
    defaultSort: '-createdAt',
    access: { read: superAdmin, create: () => false, update: () => false, delete: superAdmin },
    fields: [
        {
            name: 'scope',
            type: 'select',
            required: true,
            index: true,
            options: [
                { label: 'Platform, day', value: 'platform-daily' },
                { label: 'Platform, month', value: 'platform-monthly' },
                { label: 'Shop, day', value: 'shop-daily' },
            ] satisfies Array<{ label: string; value: AiCapAlertScope }>,
        },
        { name: 'periodKey', type: 'text', required: true, admin: { description: 'Malaysia day (2026-10-29) or month (2026-10)' } },
        { name: 'threshold', type: 'number', required: true, admin: { description: 'Percent of the cap that was crossed' } },
        { name: 'spentUsd', type: 'number', required: true, admin: { step: 0.000001, description: 'Spend when the threshold was noticed' } },
        { name: 'capUsd', type: 'number', required: true, admin: { step: 0.000001 } },
        { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, admin: { description: 'Shop alerts only', condition: (data) => data?.scope === 'shop-daily' } },
        { name: 'notifiedLark', type: 'checkbox', defaultValue: false, admin: { description: 'The Lark message went out' } },
    ],
    timestamps: true,
}
