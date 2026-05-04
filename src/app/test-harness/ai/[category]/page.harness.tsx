import { renderAIHarness } from './ai-render'

export const dynamic = 'force-dynamic'

export default async function AIHarnessPage({
    params,
    searchParams,
}: {
    params: Promise<{ category: string }>
    searchParams: Promise<{ refresh?: string }>
}) {
    const { category } = await params
    const { refresh } = await searchParams
    return renderAIHarness(category, undefined, refresh === '1')
}
