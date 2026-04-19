/**
 * /studio/templates/[id]/edit
 * Server component: fetches template, extracts sections, renders BuilderShell.
 */
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { BuilderShell } from './_components/builder-shell'
import type { Section } from '@/lib/admin/builder-store'

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps) {
    const { id } = await params
    return { title: `Edit template #${id}` }
}

export default async function BuilderEditPage({ params }: PageProps) {
    await requireSuperAdmin()
    const { id } = await params

    const payload = await getPayload({ config })

    let template: Record<string, unknown> | null = null
    try {
        template = await payload.findByID({
            collection: 'templates',
            id,
            depth: 0,
        }) as Record<string, unknown>
    } catch {
        notFound()
    }

    if (!template) notFound()

    // Extract sections from templatePages[0].layout
    const pages = Array.isArray(template.templatePages) ? template.templatePages : []
    const firstPage = pages[0] as Record<string, unknown> | undefined
    const rawLayout = firstPage?.layout

    const initialSections: Section[] = Array.isArray(rawLayout)
        ? (rawLayout as Section[]).filter(
            (s): s is Section =>
                s !== null &&
                typeof s === 'object' &&
                typeof s.id === 'string' &&
                typeof s.blockType === 'string',
        )
        : []

    return (
        <BuilderShell
            templateId={Number(template.id)}
            initialName={typeof template.name === 'string' ? template.name : ''}
            initialStatus={typeof template.status === 'string' ? template.status : 'draft'}
            initialSections={initialSections}
        />
    )
}
