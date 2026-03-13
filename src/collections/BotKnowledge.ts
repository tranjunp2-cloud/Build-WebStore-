import type { CollectionConfig } from 'payload'

/**
 * BotKnowledge — Persistent memory for PrimeBot
 *
 * Stores long-term knowledge that the bot accumulates:
 * - Code changes (auto-ingested from GitHub commits/PRs)
 * - Architecture decisions (extracted from PR descriptions)
 * - Feature history (who built what, when, why)
 * - Conversation insights (key learnings from team Q&A)
 * - Team notes (manually added context)
 *
 * This collection IS the bot's "brain" — it gets smarter over time
 * as more entries are added from various sources.
 */
export const BotKnowledge: CollectionConfig = {
    slug: 'bot-knowledge',
    admin: {
        description: 'PrimeBot persistent memory — knowledge accumulated from code, PRs, conversations.',
        group: 'Internal',
        useAsTitle: 'title',
        defaultColumns: ['title', 'category', 'source', 'author', 'createdAt'],
    },
    access: {
        // Only super-admins and the bot (via API key) can manage knowledge
        create: () => true, // Bot needs to write via internal API
        read: () => true,   // Bot needs to read for Q&A
        update: ({ req }) => req.user?.roles?.includes('super-admin') || false,
        delete: ({ req }) => req.user?.roles?.includes('super-admin') || false,
    },
    fields: [
        // ── Core Content ─────────────────────────────────────────────
        {
            name: 'title',
            type: 'text',
            required: true,
            admin: { description: 'Brief title of this knowledge entry' },
        },
        {
            name: 'content',
            type: 'textarea',
            required: true,
            admin: {
                description: 'Detailed knowledge content — what the bot should know',
                rows: 8,
            },
        },

        // ── Classification ───────────────────────────────────────────
        {
            name: 'category',
            type: 'select',
            required: true,
            defaultValue: 'code_change',
            options: [
                { label: '🔧 Code Change', value: 'code_change' },
                { label: '🏗️ Architecture Decision', value: 'architecture' },
                { label: '✨ Feature', value: 'feature' },
                { label: '🐛 Bug Fix', value: 'bug_fix' },
                { label: '🚀 Deployment', value: 'deployment' },
                { label: '💬 Conversation Insight', value: 'conversation_insight' },
                { label: '📝 Team Note', value: 'team_note' },
                { label: '📋 Sprint/Planning', value: 'planning' },
            ],
            index: true,
        },

        // ── Source Tracking ──────────────────────────────────────────
        {
            name: 'source',
            type: 'select',
            required: true,
            defaultValue: 'github_commit',
            options: [
                { label: 'GitHub Commit', value: 'github_commit' },
                { label: 'GitHub PR', value: 'github_pr' },
                { label: 'Lark Conversation', value: 'conversation' },
                { label: 'Manual Entry', value: 'manual' },
                { label: 'CI/CD Pipeline', value: 'ci_cd' },
            ],
        },
        {
            name: 'sourceUrl',
            type: 'text',
            admin: { description: 'Link to original source (GitHub PR URL, commit URL, etc.)' },
        },
        {
            name: 'sourceId',
            type: 'text',
            admin: { description: 'Unique ID from source (commit SHA, PR number, etc.)' },
            index: true,
        },

        // ── People & Context ─────────────────────────────────────────
        {
            name: 'author',
            type: 'text',
            admin: { description: 'Who created this change/knowledge (GitHub username or name)' },
            index: true,
        },
        {
            name: 'relatedFiles',
            type: 'array',
            admin: { description: 'Files involved in this change' },
            fields: [
                { name: 'path', type: 'text', required: true },
            ],
        },
        {
            name: 'tags',
            type: 'array',
            admin: { description: 'Searchable tags (e.g., "auth", "middleware", "AI", "deploy")' },
            fields: [
                { name: 'tag', type: 'text', required: true },
            ],
        },

        // ── Metadata ─────────────────────────────────────────────────
        {
            name: 'branch',
            type: 'text',
            admin: { description: 'Git branch this relates to' },
        },
        {
            name: 'importance',
            type: 'select',
            defaultValue: 'normal',
            options: [
                { label: '🔴 Critical', value: 'critical' },
                { label: '🟡 Important', value: 'important' },
                { label: '🟢 Normal', value: 'normal' },
                { label: '⚪ Low', value: 'low' },
            ],
        },
    ],
    timestamps: true,
}
