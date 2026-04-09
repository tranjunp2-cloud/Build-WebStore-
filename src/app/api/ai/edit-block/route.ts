/**
 * POST /api/ai/edit-block
 * AI-powered block editing: takes a natural language instruction
 * and applies changes to a specific block or the entire site.
 */

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { blockRegistry } from '@/blocks/registry'
import {
    createAddSectionBlock,
    getAddSectionLabel,
    inferAddSectionType,
    isAddSectionInstruction,
    normalizeAddSectionBlock,
} from '@/lib/ai/add-section'
import { editBlockSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

type AIEditPayload = {
    instruction: string
    block?: Record<string, unknown> | null
    blockIndex?: number | null
    allBlocks?: Record<string, unknown>[]
    theme?: Record<string, unknown>
    siteName?: string
}

type AIEditResult = {
    action: 'update_block' | 'update_theme' | 'add_block' | 'delete_block' | 'undo' | 'reorder_block'
    changes?: Record<string, unknown>
    blockIndex?: number
    afterIndex?: number
    block?: Record<string, unknown>
    message?: string
}

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

function describeAction(result: AIEditResult): string {
    if (result.message) return result.message

    switch (result.action) {
        case 'update_theme':
            return 'Updated the website theme and colors.'
        case 'add_block': {
            const sectionType = inferAddSectionType('', String(result.block?.blockType || ''))
            return `Added a ${getAddSectionLabel(sectionType)} section to the page.`
        }
        case 'delete_block':
            return 'Removed the selected section from the page.'
        case 'update_block':
        default:
            return 'Updated the content of the selected section.'
    }
}

async function generateEditResult(data: AIEditPayload): Promise<AIEditResult> {
    const { instruction, block, allBlocks, theme, siteName } = data
    const blockIndex = data.blockIndex ?? 0
    const inferredSectionType = inferAddSectionType(instruction)
    const defaultAfterIndex = Math.max(-1, (allBlocks?.length || 0) - 1)

    const blockMetas = blockRegistry.getAllMeta()
    const availableTypes = blockMetas.map(m => `${m.type} (${m.name}): variants=[${m.variants.join(',')}]`).join('\n')

    const systemPrompt = `You are an AI website editor. The user wants to modify their website.

## CONTEXT
- Site name: "${siteName || 'Website'}"
- Current theme: ${JSON.stringify(theme || {})}
- Total blocks on page: ${allBlocks?.length || 0}
${block ? `- Currently editing block #${blockIndex + 1}: type="${block.blockType}"` : '- No specific block selected'}

## AVAILABLE BLOCK TYPES
${availableTypes}

## TASK
Based on the user's instruction, return a JSON response with the action to take.

## RESPONSE FORMAT
For modifying an existing block:
{
  "action": "update_block",
  "blockIndex": ${blockIndex ?? 0},
  "changes": { "field": "new_value", ... },
  "message": "A short explanation of what was changed."
}

For changing the theme:
{
  "action": "update_theme",
  "changes": { "primaryColor": "#hex", ... },
  "message": "A short explanation of what was changed."
}

For adding a new block:
{
  "action": "add_block",
  "afterIndex": ${blockIndex ?? -1},
  "block": { "blockType": "...", "variant": "...", ... },
  "message": "A short explanation of what was changed."
}

For deleting a block:
{
  "action": "delete_block",
  "blockIndex": ${blockIndex ?? 0},
  "message": "A short explanation of what was changed."
}

For undoing the previous action:
{
  "action": "undo",
  "message": "A short explanation of what was changed."
}

## RULES
1. Respond ONLY with the JSON object
2. Always include a concise "message" explaining the applied change
3. "changes" should only include fields that are being modified
4. For text changes, generate professional, natural content
5. For theme changes, use tasteful colors that work together
6. blockType in new blocks MUST be one of the available types
7. If the user asks to add a section, use add_block with appropriate content
8. Supported add-section types: testimonials, faq, gallery, features, team, newsletter, banner, cta
9. New sections should be appended to the bottom by default unless the user explicitly asks otherwise
10. If the user asks to undo, revert, or go back to the previous state, use the "undo" action with a polite message.`

    const openai = getOpenAI()
    if (!openai) {
        if (isAddSectionInstruction(instruction) && inferredSectionType) {
            const fallbackBlock = createAddSectionBlock({
                instruction,
                requestedType: inferredSectionType,
                siteName,
                theme,
            })

            if (fallbackBlock) {
                return {
                    action: 'add_block',
                    afterIndex: defaultAfterIndex,
                    block: fallbackBlock,
                    message: `Added a ${getAddSectionLabel(inferredSectionType)} section to the page.`,
                }
            }
        }

        return {
            action: 'update_block',
            blockIndex: blockIndex ?? 0,
            changes: {},
            message: 'AI editing requires OPENAI_API_KEY. Please set it before using chat editing.',
        }
    }

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: instruction },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
        throw new Error('Empty AI response')
    }

    const result = JSON.parse(content) as AIEditResult

    if (result.action === 'add_block') {
        const normalizedBlock = normalizeAddSectionBlock(
            {
                instruction,
                requestedType: String(result.block?.blockType || inferredSectionType || ''),
                siteName,
                theme,
            },
            result.block,
        )

        if (!normalizedBlock?.blockType || !blockRegistry.has(String(normalizedBlock.blockType))) {
            throw new Error(`Unknown block type: ${String(normalizedBlock?.blockType || result.block?.blockType || 'unknown')}`)
        }

        result.block = normalizedBlock
        result.afterIndex = typeof result.afterIndex === 'number' ? result.afterIndex : defaultAfterIndex

        const validation = blockRegistry.validate(String(result.block.blockType), result.block)
        if (!validation.success) {
            const fallbackBlock = createAddSectionBlock({
                instruction,
                requestedType: String(result.block.blockType),
                siteName,
                theme,
            })

            if (!fallbackBlock) {
                throw new Error(validation.error || 'Invalid block generated by AI')
            }

            result.block = fallbackBlock
        }
    }

    result.message = describeAction(result)
    return result
}

function createSSEMessage(event: string, data: unknown) {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export const POST = withAuth(async (user, req) => {
    try {
        // Rate Limit: 20 AI tasks per hour
        const rateLimit = checkRateLimit(String(user.id), 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const { data, errorResponse } = await parseRequest(req, editBlockSchema)
        if (errorResponse) return errorResponse
        const shouldStream = new URL(req.url).searchParams.get('stream') === 'true'

        if (!shouldStream) {
            const result = await generateEditResult(data!)
            return NextResponse.json(result)
        }

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            async start(controller) {
                const send = (event: string, payload: unknown) => {
                    controller.enqueue(encoder.encode(createSSEMessage(event, payload)))
                }

                try {
                    send('status', { message: 'AI is reading your request...' })
                    send('status', { message: 'Preparing changes for preview...' })

                    const result = await generateEditResult(data!)
                    send('action', result)
                    send('done', result)
                } catch (error: unknown) {
                    console.error('[AI Edit Block Stream Error]', error instanceof Error ? error.message : error)
                    send('error', { error: 'Failed to process AI request. Please try again.' })
                } finally {
                    controller.close()
                }
            },
        })

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
            },
        })

    } catch (error: unknown) {
        console.error('[AI Edit Block Error]', error instanceof Error ? error.message : error)
        return NextResponse.json(
            { error: 'AI editing failed. Please try again later.' },
            { status: 500 },
        )
    }
})
