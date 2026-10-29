import { notFound } from 'next/navigation'
import { getBlogByIdAction } from '../actions'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import BlogEditorPageClient from './BlogEditorPageClient'

type BlogEditorPageProps = {
    params: Promise<{ id: string }>
}

export default async function BlogEditorPage({ params }: BlogEditorPageProps) {
    const { id } = await params

    if (id !== 'new') {
        try {
            const blog = await getBlogByIdAction(id)
            if (!blog) notFound()
        } catch (error) {
            if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('not found'))) {
                notFound()
            }
            throw error
        }
    }

    return <BlogEditorPageClient agentEnabled={isAiAgentEnabled()} />
}
