import type { Access, CollectionConfig, Field } from 'payload'

/**
 * AI usage logs — one row per AI call, readable in Payload's default list/edit views (super-admins only).
 *
 * Two sources share this table (`source`):
 * - `ai-platform` (current): copied from the ai-platform usage ledger by /api/cron/ai-usage-sync
 *   (lib/ai-platform/usage-sync). `platformEventId` is the ledger row id and makes the copy idempotent. The readable
 *   columns (summary, task label, area, battery cost…) are derived at copy time in lib/ai-platform/usage-sync-map.
 * - `prime-web` (legacy): written while prime-web called OpenAI in-process, before the AI platform cutover
 *   (plan 261021). Kept read-only for history, never dropped.
 *
 * Shops see none of this: they see one "AI" battery (% left) and a picture count. `batteryCostUsd` is what a call
 * took from that battery (its price, else tokens at the platform's fallback rates; pictures count separately).
 *
 * Retention: no TTL at DB level; ops can run a cleanup cron later if storage grows.
 *
 * PII note: no prompt or completion content is stored, only metadata (user, tenant, task, page, model, tokens,
 * cost, latency, outcome, error code).
 */

const superAdmin: Access = ({ req }) => (req.user as { roles?: string[] | null } | null)?.roles?.includes('super-admin') || false

const usd = { step: 0.000001 }

/** Shown only on rows the AI platform wrote (legacy rows have none of these). */
const platformOnly = (data: Record<string, unknown> | undefined) => data?.source === 'ai-platform'

const overview: Field[] = [
    {
        type: 'row',
        fields: [
            { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, admin: { width: '50%', description: 'Shop the call was billed to' } },
            { name: 'user', type: 'relationship', relationTo: 'users', index: true, admin: { width: '50%', description: 'Who asked (empty for scheduled jobs)' } },
        ],
    },
    {
        name: 'plan',
        type: 'text',
        index: true,
        admin: { readOnly: true, description: 'Plan code the shop was on when the call was copied (empty on rows copied before plans were recorded)' },
    },
    {
        type: 'row',
        fields: [
            {
                name: 'feature',
                type: 'select',
                index: true,
                options: [
                    { label: 'Assistant', value: 'assistant' },
                    { label: 'Writing tools', value: 'writing' },
                    { label: 'Pictures', value: 'pictures' },
                    { label: 'Other', value: 'other' },
                ],
                admin: { width: '33%', description: 'What the shop sees it as: the AI battery (Assistant, Writing tools) or Pictures' },
            },
            {
                name: 'area',
                type: 'select',
                index: true,
                options: [
                    { label: 'Dashboard', value: 'dashboard' },
                    { label: 'Web editor', value: 'web-editor' },
                    { label: 'Products', value: 'products' },
                    { label: 'Blog & pages', value: 'blog' },
                    { label: 'Orders', value: 'orders' },
                    { label: 'Customers', value: 'customers' },
                    { label: 'Discounts', value: 'discounts' },
                    { label: 'Inventory', value: 'inventory' },
                    { label: 'Reports', value: 'reports' },
                    { label: 'Settings', value: 'settings' },
                    { label: 'Media', value: 'media' },
                    { label: 'Website setup', value: 'website-setup' },
                    { label: 'Store migration', value: 'migration' },
                    { label: 'Tool / background', value: 'background' },
                    { label: 'Chat deleted', value: 'chat-deleted' },
                    { label: 'Other', value: 'other' },
                ],
                admin: { width: '33%', description: 'Where in the app: the assistant chat’s page, else the task family' },
            },
            {
                name: 'outcome',
                type: 'select',
                index: true,
                options: [
                    { label: 'OK', value: 'ok' },
                    { label: 'No result', value: 'refused' },
                    { label: 'Error', value: 'error' },
                ],
                admin: { width: '33%', description: '“No result”: the model answered but produced nothing usable (no draft, no question)' },
            },
        ],
    },
    {
        type: 'row',
        fields: [
            { name: 'taskLabel', type: 'text', admin: { width: '50%', description: 'What the AI did' } },
            { name: 'task', type: 'text', index: true, admin: { width: '50%', description: 'AI platform task id' } },
        ],
    },
    {
        type: 'row',
        admin: { condition: (data) => Boolean(data?.pageTitle || data?.pagePath) },
        fields: [
            { name: 'pageTitle', type: 'text', admin: { width: '50%', description: 'Page the assistant chat was open on' } },
            { name: 'pagePath', type: 'text', admin: { width: '50%' } },
        ],
    },
    {
        name: 'errorLabel',
        type: 'text',
        admin: { description: 'Why it failed, in words', condition: (data) => Boolean(data?.errorLabel || data?.errorCode) },
    },
    {
        name: 'errorDetail',
        type: 'textarea',
        admin: { readOnly: true, description: "Status and the provider's message, keys masked (e.g. 400: …)", condition: (data) => Boolean(data?.errorDetail) },
    },
]

const modelAndTokens: Field[] = [
    {
        type: 'row',
        fields: [
            { name: 'provider', type: 'text', admin: { width: '50%', description: 'Model provider that answered' } },
            {
                name: 'model',
                type: 'text',
                required: true,
                index: true,
                admin: { width: '50%', description: 'Model id that answered (“unknown” when the platform did not record one)' },
            },
        ],
    },
    {
        type: 'row',
        fields: [
            { name: 'tokensIn', label: 'Input tokens', type: 'number', required: true, defaultValue: 0, admin: { width: '25%' } },
            {
                name: 'cachedTokensIn',
                label: 'Cached input tokens',
                type: 'number',
                admin: { width: '25%', description: 'Part of the input served from the provider cache (much cheaper)' },
            },
            { name: 'tokensOut', label: 'Output tokens', type: 'number', required: true, defaultValue: 0, admin: { width: '25%' } },
            { name: 'totalTokens', label: 'Total tokens', type: 'number', admin: { width: '25%', condition: platformOnly } },
        ],
    },
    {
        name: 'cacheHitPercent',
        label: 'Cache hit %',
        type: 'number',
        admin: { description: 'Cached input ÷ input. A long assistant chat should stay high; a sudden drop means the prompt prefix changed', condition: platformOnly },
    },
]

const costAndTime: Field[] = [
    {
        type: 'row',
        fields: [
            {
                name: 'costUsd',
                label: 'Cost (USD)',
                type: 'number',
                admin: { width: '33%', ...usd, description: 'From the price book; empty when the model has no price on file' },
            },
            {
                name: 'batteryCostUsd',
                label: 'Battery cost (USD)',
                type: 'number',
                admin: { width: '33%', ...usd, description: 'What it took from the shop’s AI battery (fallback rates when unpriced; pictures 0)', condition: platformOnly },
            },
            {
                name: 'priced',
                type: 'checkbox',
                admin: { width: '33%', description: 'The model has a price on file', condition: platformOnly },
            },
        ],
    },
    { name: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, defaultValue: 0, admin: { description: 'Wall-clock time of the model call' } },
]

const technical: Field[] = [
    {
        type: 'row',
        fields: [
            { name: 'runId', type: 'text', admin: { width: '50%', description: 'AI platform run (one assistant message)' } },
            { name: 'threadId', type: 'text', admin: { width: '50%', description: 'AI platform chat the run belongs to' } },
        ],
    },
    {
        type: 'row',
        fields: [
            { name: 'organizationId', type: 'text', admin: { width: '50%', description: 'AI platform organization (maps to the tenant)' } },
            {
                name: 'platformEventId',
                type: 'number',
                unique: true,
                index: true,
                admin: { width: '50%', description: 'AI platform ledger row id (makes the copy idempotent)', readOnly: true },
            },
        ],
    },
    {
        type: 'row',
        fields: [
            { name: 'success', type: 'checkbox', required: true, defaultValue: true, index: true, admin: { width: '50%' } },
            { name: 'errorCode', type: 'text', admin: { width: '50%', description: 'Raw error name when the call failed', condition: (data) => data?.success === false } },
        ],
    },
    {
        name: 'endpoint',
        type: 'select',
        index: true,
        admin: { description: 'Legacy rows only (prime-web called OpenAI directly); new rows use task', condition: (data) => Boolean(data?.endpoint) },
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
]

export const AiUsageLogs: CollectionConfig = {
    slug: 'ai-usage-logs',
    labels: { singular: 'AI usage log', plural: 'AI usage logs' },
    admin: {
        description: 'Every AI call: which shop and person, what it did and where, model, tokens, cost, outcome. Filter by Tenant, Feature, Area or Outcome.',
        group: 'AI',
        defaultColumns: ['createdAt', 'summary', 'tenant', 'user', 'model', 'batteryCostUsd', 'durationMs', 'outcome'],
        listSearchableFields: ['summary', 'task', 'model', 'pageTitle', 'runId'],
        useAsTitle: 'summary',
        pagination: { defaultLimit: 50 },
    },
    defaultSort: '-createdAt',
    access: {
        // Only super-admins can see aggregate AI usage (cost data is sensitive).
        read: superAdmin,
        create: () => false, // Read-only history; usage is metered in the ai-platform ledger
        update: () => false,
        delete: superAdmin,
    },
    fields: [
        {
            name: 'summary',
            type: 'text',
            admin: { description: 'Feature · what the AI did · where (· outcome when not OK)', readOnly: true },
        },
        {
            type: 'tabs',
            tabs: [
                { label: 'Overview', fields: overview },
                { label: 'Model & tokens', fields: modelAndTokens },
                { label: 'Cost & time', fields: costAndTime },
                { label: 'Technical', fields: technical },
            ],
        },
        {
            name: 'source',
            type: 'select',
            required: true,
            defaultValue: 'prime-web',
            index: true,
            options: [
                { label: 'AI platform', value: 'ai-platform' },
                { label: 'prime-web (legacy)', value: 'prime-web' },
            ],
            admin: { description: 'Where the row came from', position: 'sidebar' },
        },
    ],
    timestamps: true,
}
