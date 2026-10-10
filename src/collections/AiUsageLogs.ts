import type { CollectionConfig } from 'payload'

/**
 * AI usage logs — per-call observability for AI endpoints.
 *
 * Purpose: track actual OpenAI spend per user/tenant/endpoint/model so we can
 * (1) attribute cost overages to specific users/flows, (2) verify phase-03/04
 * cost savings land in production, (3) feed a billing/usage UI later.
 *
 * Write pattern: fire-and-forget from `logAiUsage()` helper in src/lib/ai/log-usage.ts
 * — a failed log MUST NOT break the AI request, so all writes use `.catch(() => {})`.
 *
 * Retention: no TTL at DB level; ops can run a cleanup cron later if storage grows.
 *
 * PII note: we do NOT store prompt content or completion content here. Only
 * metadata (user id, endpoint, model, token counts, cost, latency, error code).
 * Prompt/response inspection happens through OpenAI dashboard if needed.
 *
 * Source: plans/260414-0914-ai-model-optimization/phase-05-gateway-observability.md
 */
export const AiUsageLogs: CollectionConfig = {
    slug: 'ai-usage-logs',
    admin: {
        description: 'Per-call AI usage metrics — tokens, cost, latency per endpoint.',
        defaultColumns: ['createdAt', 'endpoint', 'model', 'costUsd', 'durationMs', 'success'],
        useAsTitle: 'endpoint',
    },
    access: {
        // Only super-admins can see aggregate AI usage (cost data is sensitive).
        read: ({ req }) => req.user?.roles?.includes('super-admin') || false,
        create: () => false, // Written via logAiUsage() helper, not the admin API
        update: () => false,
        delete: ({ req }) => req.user?.roles?.includes('super-admin') || false,
    },
    fields: [
        {
            name: 'user',
            type: 'relationship',
            relationTo: 'users',
            index: true,
            admin: { description: 'User who triggered the AI call' },
        },
        {
            name: 'tenant',
            type: 'relationship',
            relationTo: 'tenants',
            index: true,
        },
        {
            name: 'endpoint',
            type: 'select',
            required: true,
            index: true,
            options: [
                { label: 'Site generation', value: 'site-generation' },
                { label: 'Chat edit (block)', value: 'chat-edit' },
                { label: 'Inline edit', value: 'inline-edit' },
                { label: 'SEO generation', value: 'seo-generation' },
                { label: 'Content rewrite', value: 'content-rewrite' },
                { label: 'Product description', value: 'product-description' },
                { label: 'URL extraction', value: 'url-extraction' },
                { label: 'Bulk parse', value: 'bulk-parse' },
                { label: 'Brand analysis (PW1 migration)', value: 'brand-analysis' },
            ],
        },
        {
            name: 'model',
            type: 'text',
            required: true,
            index: true,
            admin: { description: 'Exact model string returned by OpenAI (e.g. gpt-4.1-mini-2025-04-14)' },
        },
        {
            name: 'tokensIn',
            type: 'number',
            required: true,
            defaultValue: 0,
            admin: { description: 'Prompt tokens (prompt_tokens from usage)' },
        },
        {
            name: 'tokensOut',
            type: 'number',
            required: true,
            defaultValue: 0,
            admin: { description: 'Completion tokens (completion_tokens from usage)' },
        },
        {
            name: 'costUsd',
            type: 'number',
            required: true,
            defaultValue: 0,
            admin: {
                description: 'Estimated cost in USD (computed from pricing table, ±5% of actual)',
                step: 0.000001,
            },
        },
        {
            name: 'durationMs',
            type: 'number',
            required: true,
            defaultValue: 0,
            admin: { description: 'Wall-clock latency in milliseconds' },
        },
        {
            name: 'success',
            type: 'checkbox',
            required: true,
            defaultValue: true,
            index: true,
        },
        {
            name: 'errorCode',
            type: 'text',
            admin: {
                description: 'OpenAI error code or local exception name if success=false',
                condition: (data) => data?.success === false,
            },
        },
    ],
    timestamps: true,
}
