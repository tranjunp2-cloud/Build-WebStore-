import { notFound } from 'next/navigation'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { generateSiteWithAI } from '@/lib/ai/openai-generator'
import { getCategoryContent } from '@/lib/ai/content'
import type { GenerationResult } from '@/lib/ai/generate-blocks'

export const dynamic = 'force-dynamic'

/**
 * AI-first harness — calls real OpenAI to generate fresh blocks per category.
 *
 * Unlike /test-harness/[fixtureId] (template-first, reads matrix.json), this
 * route ignores precomposed matrix and hits generateSiteWithAI with
 * GEN_MODE=ai-first. Uses 1 sample business per category from content library.
 *
 * Cached in module memory per category — same category request returns cached
 * result until server restart. Append ?refresh=1 to force regen.
 *
 * Cost: 1 gpt-4o call per category (~$0.01), ~5-15s latency. Only use for
 * review + A/B comparison vs template-first. DO NOT automate — cost adds up.
 */

type Params = { category: string }

const cache = new Map<string, GenerationResult>()

async function genForCategory(category: string): Promise<GenerationResult | null> {
    const content = getCategoryContent(category)
    const biz = content?.businesses?.[0]
    if (!biz) return null

    const prevMode = process.env.GEN_MODE
    process.env.GEN_MODE = 'ai-first'
    try {
        const { result } = await generateSiteWithAI(
            {
                businessName: biz.name,
                industry: category,
                shortDescription: biz.description,
                products: biz.products?.join?.(', ') ?? '',
                phone: biz.phone,
                email: biz.email,
                address: biz.address,
            },
            undefined,
            'en',
        )
        return result
    } finally {
        if (prevMode === undefined) delete process.env.GEN_MODE
        else process.env.GEN_MODE = prevMode
    }
}

export default async function AIHarnessPage({
    params,
    searchParams,
}: {
    params: Promise<Params>
    searchParams: Promise<{ refresh?: string }>
}) {
    const { category } = await params
    const { refresh } = await searchParams

    const content = getCategoryContent(category)
    if (!content) notFound()

    let result = cache.get(category)
    if (!result || refresh === '1') {
        try {
            const generated = await genForCategory(category)
            if (!generated) notFound()
            result = generated
            cache.set(category, result)
        } catch (err) {
            return (
                <div className="p-10 font-mono">
                    <div className="bg-red-50 border border-red-300 rounded-lg p-6">
                        <h1 className="text-2xl font-bold text-red-700 mb-2">AI gen failed for {category}</h1>
                        <pre className="text-sm text-red-600 whitespace-pre-wrap">
                            {(err as Error).message}
                        </pre>
                        <p className="mt-4 text-sm text-gray-700">
                            Check: OPENAI_API_KEY in .env.local, OpenAI quota, network.
                        </p>
                    </div>
                </div>
            )
        }
    }

    const layout = (result.pages?.[0]?.blocks ?? result.blocks) as unknown as Record<string, unknown>[]
    const site = { theme: result.theme as Record<string, unknown> }
    const page = { layout }

    return (
        <div data-harness-ai-category={category}>
            <div className="fixed top-2 right-2 z-[100] bg-purple-600 text-white text-xs px-3 py-1.5 rounded-full font-mono shadow-lg">
                AI-FIRST · {category} · {result.siteName}
            </div>
            <SiteRenderer site={site as never} page={page as never} />
        </div>
    )
}
