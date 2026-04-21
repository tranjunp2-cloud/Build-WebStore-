import { renderAIHarness } from '../ai-render'

export const dynamic = 'force-dynamic'

export default async function AIHarnessSubPage({
    params,
    searchParams,
}: {
    params: Promise<{ category: string; slug: string }>
    searchParams: Promise<{ refresh?: string }>
}) {
    const { category, slug } = await params
    const { refresh } = await searchParams
    return renderAIHarness(category, slug, refresh === '1')
}
