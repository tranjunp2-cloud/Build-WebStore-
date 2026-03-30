import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'

/**
 * GET /api/templates/categories
 * Returns template categories that actually exist in the database.
 */
export const GET = withAuth(async () => {
    try {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'templates',
            limit: 100,
            depth: 0,
            pagination: false,
        })

        const usedValues = new Set<string>()

        for (const template of result.docs || []) {
            const categories = Array.isArray((template as any).category)
                ? (template as any).category
                : [(template as any).category].filter(Boolean)

            for (const value of categories) {
                if (typeof value === 'string' && value.trim()) {
                    usedValues.add(value)
                }
            }
        }

        const categories = TEMPLATE_CATEGORY_OPTIONS
            .filter((option) => usedValues.has(option.value))
            .map((option) => {
                const [icon, ...labelParts] = option.label.split(' ')
                return {
                    value: option.value,
                    label: labelParts.join(' '),
                    icon,
                }
            })

        return NextResponse.json({ docs: categories })
    } catch (error: any) {
        console.error('Templates categories error:', error)
        return NextResponse.json({
            docs: [],
            error: 'Failed to load categories',
        }, { status: 500 })
    }
})
