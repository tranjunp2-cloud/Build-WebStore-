import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'

/**
 * TemplateIssues — internal issue tracker for template/block/gen quality.
 * NOT user-facing. Super-admin only.
 *
 * Polymorphic relation via relatedType + relatedId (soft FK, validated on create).
 * Timeline auto-populated by beforeChange hook on status/severity/assignedTo changes.
 */

const appendTimelineHook: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
    const timeline: Array<{
        event: string
        actor: number | null
        data: Record<string, unknown>
        at: string
    }> = Array.isArray(data.timeline) ? [...data.timeline] : []

    const now = new Date().toISOString()

    if (originalDoc) {
        if (data.status && data.status !== originalDoc.status) {
            timeline.push({
                event: 'status_change',
                actor: null,
                data: { from: originalDoc.status, to: data.status },
                at: now,
            })
            if (data.status === 'fixed' || data.status === 'wont-fix') {
                data.resolvedAt = now
            }
        }
        if (data.assignedTo !== undefined && data.assignedTo !== originalDoc.assignedTo) {
            timeline.push({
                event: 'assignment_change',
                actor: null,
                data: { from: originalDoc.assignedTo ?? null, to: data.assignedTo ?? null },
                at: now,
            })
        }
        if (data.severity && data.severity !== originalDoc.severity) {
            timeline.push({
                event: 'severity_change',
                actor: null,
                data: { from: originalDoc.severity, to: data.severity },
                at: now,
            })
        }
    }

    return { ...data, timeline }
}

export const TemplateIssues: CollectionConfig = {
    slug: 'template-issues',
    admin: {
        useAsTitle: 'title',
        description: 'Internal issue tracker for template/block/gen quality. Super-admin only.',
        defaultColumns: ['title', 'severity', 'status', 'category', 'relatedType', 'assignedTo', 'createdAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    hooks: {
        beforeChange: [appendTimelineHook],
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            maxLength: 300,
        },
        {
            name: 'description',
            type: 'textarea',
            maxLength: 10000,
            admin: { description: 'Plain text — markdown rendered client-side with sanitization.' },
        },
        {
            name: 'severity',
            type: 'select',
            required: true,
            index: true,
            defaultValue: 'medium',
            options: [
                { label: 'Critical', value: 'critical' },
                { label: 'High', value: 'high' },
                { label: 'Medium', value: 'medium' },
                { label: 'Low', value: 'low' },
            ],
        },
        {
            name: 'category',
            type: 'select',
            required: true,
            options: [
                { label: 'Accessibility', value: 'accessibility' },
                { label: 'Performance', value: 'performance' },
                { label: 'Content', value: 'content' },
                { label: 'UI', value: 'ui' },
                { label: 'AI Quality', value: 'ai-quality' },
                { label: 'Other', value: 'other' },
            ],
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            index: true,
            defaultValue: 'open',
            options: [
                { label: 'Open', value: 'open' },
                { label: 'In Review', value: 'in-review' },
                { label: 'Fixed', value: 'fixed' },
                { label: "Won't Fix", value: 'wont-fix' },
            ],
        },
        {
            name: 'relatedType',
            type: 'select',
            required: true,
            index: true,
            options: [
                { label: 'Template', value: 'template' },
                { label: 'Generation', value: 'generation' },
                { label: 'Block', value: 'block' },
                { label: 'Runtime', value: 'runtime' },
            ],
        },
        {
            name: 'relatedId',
            type: 'text',
            required: true,
            index: true,
            admin: { description: 'Template id / Generation id / Block slug / Runtime provider key (polymorphic soft FK).' },
        },
        {
            name: 'reportedBy',
            type: 'relationship',
            relationTo: 'users',
            admin: { description: 'User who reported this issue (optional).' },
        },
        {
            name: 'assignedTo',
            type: 'relationship',
            relationTo: 'users',
            admin: { description: 'Assignee (optional).' },
        },
        {
            name: 'comments',
            type: 'array',
            admin: { description: 'Append-only comment thread.' },
            fields: [
                {
                    name: 'author',
                    type: 'relationship',
                    relationTo: 'users',
                },
                {
                    name: 'body',
                    type: 'textarea',
                    required: true,
                    maxLength: 5000,
                },
                {
                    name: 'createdAt',
                    type: 'date',
                    defaultValue: () => new Date().toISOString(),
                },
            ],
        },
        {
            name: 'timeline',
            type: 'array',
            admin: { description: 'Auto-populated audit trail. Do not edit manually.' },
            fields: [
                { name: 'event', type: 'text', required: true },
                { name: 'actor', type: 'relationship', relationTo: 'users' },
                { name: 'data', type: 'json' },
                {
                    name: 'at',
                    type: 'date',
                    defaultValue: () => new Date().toISOString(),
                },
            ],
        },
        {
            name: 'resolvedAt',
            type: 'date',
            admin: { description: 'Set automatically when status → fixed or wont-fix.' },
        },
    ],
    timestamps: true,
}
