import type { CollectionConfig } from 'payload'

/**
 * TemplateQualityScores — persists per-template rubric score snapshots.
 *
 * Each row = one scoring run: (template, rubricVersion, scoredAt).
 * Multiple rows per template are normal — history is preserved.
 * Latest score is the row with the highest scoredAt for a given template.
 *
 * Written by: POST /api/admin/templates/[id]/score
 * Read by:    GET  /api/admin/templates/[id]/quality
 */
export const TemplateQualityScores: CollectionConfig = {
    slug: 'template-quality-scores',
    admin: {
        useAsTitle: 'rubricVersion',
        description: 'Rubric score snapshots per template. Written by the scoring API.',
        defaultColumns: ['template', 'rubricVersion', 'avgScore', 'passRubric', 'scorer', 'scoredAt'],
    },
    access: {
        read: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        create: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        update: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
        delete: ({ req }) => Boolean(req.user?.roles?.includes('super-admin')),
    },
    fields: [
        {
            name: 'template',
            type: 'relationship',
            relationTo: 'templates',
            required: true,
            index: true,
        },
        {
            name: 'rubricVersion',
            type: 'select',
            required: true,
            options: [
                { label: 'v1', value: 'v1' },
                { label: 'v1.1', value: 'v1.1' },
                { label: 'v1.2', value: 'v1.2' },
                { label: 'v1.3', value: 'v1.3' },
            ],
        },
        {
            name: 'avgScore',
            type: 'number',
            required: true,
            min: 0,
            max: 10,
            admin: { description: 'Weighted average score 0–10.' },
        },
        {
            name: 'passRubric',
            type: 'checkbox',
            defaultValue: false,
            admin: { description: 'True when avgScore ≥ rubric pass threshold.' },
        },
        {
            name: 'dimensions',
            type: 'array',
            admin: { description: '11-dimension breakdown.' },
            fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'score', type: 'number', required: true, min: 0, max: 10 },
                { name: 'weight', type: 'number', required: true },
                { name: 'criteriaMet', type: 'number', defaultValue: 0 },
                { name: 'criteriaTotal', type: 'number', defaultValue: 0 },
            ],
        },
        {
            name: 'scorer',
            type: 'text',
            defaultValue: 'manual',
            admin: { description: 'Who triggered the score: "manual", "cron", etc.' },
        },
        {
            name: 'scoredAt',
            type: 'date',
            admin: { description: 'When this score was computed. Set automatically.' },
            hooks: {
                beforeChange: [
                    ({ value }) => value ?? new Date().toISOString(),
                ],
            },
        },
    ],
    timestamps: true,
}
