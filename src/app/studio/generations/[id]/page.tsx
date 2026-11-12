/** Full, shareable F41 operations detail — never rendered as a raw Payload view. */
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { requireStudioAccess } from '@/lib/admin/auth-guard'
import { GenerationDebugDetail } from '../_components/generation-debug-detail'

export const metadata: Metadata = { title: 'Generation detail' }

export default async function GenerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    await requireStudioAccess()
    const { id } = await params
    return <GenerationDebugDetail generationId={id} />
}
