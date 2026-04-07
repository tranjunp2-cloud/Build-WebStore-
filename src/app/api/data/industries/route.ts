import { NextResponse } from 'next/server'
import { TEMPLATE_CATEGORY_OPTIONS } from '@/collections/Templates'

/**
 * GET /api/data/industries
 * Returns all template categories from static config.
 * Public endpoint — used by builder form to show industry options.
 */
export async function GET() {
    try {
        const categories = TEMPLATE_CATEGORY_OPTIONS.map((option) => {
            const [icon, ...labelParts] = option.label.split(' ')
            return {
                value: option.value,
                label: labelParts.join(' '),
                icon,
            }
        })

        return NextResponse.json({ docs: categories })
    } catch (error: any) {
        console.error('Industries API error:', error)
        return NextResponse.json({ docs: [] }, { status: 500 })
    }
}
