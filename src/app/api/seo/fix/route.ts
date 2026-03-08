import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import OpenAI from 'openai'

/**
 * POST /api/seo/fix
 * Uses AI (GPT-4o-mini) to auto-generate missing meta titles and descriptions
 * for all pages in a site.
 *
 * Body: { siteId: string }
 */

export async function POST(request: NextRequest) {
    try {
        const { siteId } = await request.json()
        if (!siteId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'siteId is required' } },
                { status: 422 }
            )
        }

        const payload = await getPayload({ config })

        // Get site info
        const site = await payload.findByID({ collection: 'sites', id: siteId })
        if (!site) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Site not found' } },
                { status: 404 }
            )
        }

        // Get all pages
        const pagesResult = await payload.find({
            collection: 'pages',
            where: { site: { equals: siteId } },
            limit: 50,
            depth: 1,
        })

        if (pagesResult.docs.length === 0) {
            return NextResponse.json({
                success: true,
                data: { fixedPages: 0, message: 'No pages to fix' },
            })
        }

        // Collect pages that need fixing
        const pagesToFix = pagesResult.docs.filter(page => {
            const hasTitle = page.seo?.title || (site.seo as any)?.metaTitle
            const hasDesc = page.seo?.description || (site.seo as any)?.metaDescription
            return !hasTitle || !hasDesc
        })

        if (pagesToFix.length === 0) {
            return NextResponse.json({
                success: true,
                data: { fixedPages: 0, message: 'All pages already have SEO metadata' },
            })
        }

        // Use OpenAI to generate SEO metadata
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const fixResults = []
        for (const page of pagesToFix) {
            // Extract page content for context
            const blocks = (page as any).layout || []
            const contentParts: string[] = []
            for (const block of blocks) {
                if (block.headline) contentParts.push(`Heading: ${block.headline}`)
                if (block.subheadline) contentParts.push(`Subheading: ${block.subheadline}`)
                if (block.body) contentParts.push(`Body: ${block.body}`)
            }

            const pageContent = contentParts.join('\n') || `Page: ${page.title}`

            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an SEO specialist for Malaysian businesses. Generate optimized meta title (max 60 chars) and meta description (max 155 chars) for the website page described. The business is called "${site.name}". Output JSON only: {"metaTitle":"...","metaDescription":"..."}`
                        },
                        { role: 'user', content: pageContent },
                    ],
                    temperature: 0.3,
                    max_tokens: 200,
                    response_format: { type: 'json_object' },
                })

                const result = JSON.parse(completion.choices[0]?.message?.content || '{}')

                if (result.metaTitle || result.metaDescription) {
                    // Update the page SEO
                    const seoUpdate: any = {}
                    if (result.metaTitle && !page.seo?.title) {
                        seoUpdate['seo.title'] = result.metaTitle
                    }
                    if (result.metaDescription && !page.seo?.description) {
                        seoUpdate['seo.description'] = result.metaDescription
                    }

                    await payload.update({
                        collection: 'pages',
                        id: page.id,
                        data: {
                            seo: {
                                ...(page.seo || {}),
                                title: result.metaTitle || page.seo?.title,
                                description: result.metaDescription || page.seo?.description,
                            } as any,
                        },
                    })

                    fixResults.push({
                        pageId: page.id,
                        title: page.title,
                        metaTitle: result.metaTitle,
                        metaDescription: result.metaDescription,
                    })
                }
            } catch (aiError: any) {
                console.error(`[SEO Fix] AI error for page ${page.id}:`, aiError.message)
                fixResults.push({
                    pageId: page.id,
                    title: page.title,
                    error: aiError.message,
                })
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                fixedPages: fixResults.filter(r => !r.error).length,
                totalPages: pagesToFix.length,
                results: fixResults,
            },
        })
    } catch (error: any) {
        console.error('[SEO Fix Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            { status: 500 }
        )
    }
}
