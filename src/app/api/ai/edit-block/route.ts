/**
 * POST /api/ai/edit-block
 * AI-powered block editing: takes a natural language instruction
 * and applies changes to a specific block or the entire site.
 */

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { blockRegistry } from '@/blocks/registry'
import { selectModel } from '@/lib/ai/config'
import { logAiUsage } from '@/lib/ai/log-usage'
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
import { summarizeNestedField } from '@/lib/ai/summarize'
import { buildEnumPrompt } from '@/lib/theme/enums'

type AIEditPayload = {
    instruction: string
    block?: Record<string, unknown> | null
    blockIndex?: number | null
    allBlocks?: Record<string, unknown>[]
    theme?: Record<string, unknown>
    siteName?: string
    currentPageSlug?: string
    currentPageTitle?: string
    chatHistory?: { role: string; content: string }[]
}

type AIEditResult = {
    action: 'update_block' | 'update_multiple_blocks' | 'update_theme' | 'add_block' | 'delete_block' | 'undo' | 'reorder_block' | 'none'
    changes?: Record<string, unknown>
    blockIndex?: number
    afterIndex?: number
    block?: Record<string, unknown>
    message?: string
    updates?: { blockIndex: number; changes: Record<string, unknown> }[]
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
        case 'update_multiple_blocks': {
            const count = result.updates?.length || 0
            return `Updated ${count} sections on the page.`
        }
        case 'update_block':
        default:
            return 'Updated the content of the selected section.'
    }
}

/** Build a bounded, always-valid-JSON copy of a block for inclusion in the
 *  SELECTED BLOCK FULL DATA section. Caps string values + array lengths so
 *  the stringified result is never truncated mid-structure. */
function buildSafeBlockCopy(value: unknown, depth = 0): unknown {
    if (depth > 5) return '[deep]'
    if (typeof value === 'string') return value.length > 300 ? value.slice(0, 300) + '…' : value
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
    if (Array.isArray(value)) {
        const capped: unknown[] = value.slice(0, 10).map(v => buildSafeBlockCopy(v, depth + 1))
        if (value.length > 10) capped.push(`…+${value.length - 10} more`)
        return capped
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = buildSafeBlockCopy(v, depth + 1)
        }
        return out
    }
    return null
}

async function generateEditResult(data: AIEditPayload): Promise<AIEditResult> {
    const { instruction, block, allBlocks, theme, siteName, currentPageSlug, currentPageTitle, chatHistory } = data
    const blockIndex = data.blockIndex ?? 0
    const inferredSectionType = inferAddSectionType(instruction)
    const defaultAfterIndex = Math.max(-1, (allBlocks?.length || 0) - 1)

    const blockMetas = blockRegistry.getAllMeta().filter(m => m.aiVisible !== false)
    const availableTypes = blockMetas.map(m => `${m.type} (${m.name}): variants=[${m.variants.join(',')}]`).join('\n')

    // Build a concise block summary so AI knows the page structure and current content
    // Spec §1.3: "compact summary, NOT full JSON" — limit to key text fields, truncate long values
    const TEXT_FIELD_ALLOW = new Set([
        'headline', 'subheadline', 'title', 'subtitle', 'description',
        'ctaText', 'buttonText', 'label', 'tagline', 'copyright',
        'bodyText', 'sectionLabel', 'name', 'quote', 'content',
        'placeholder', 'html', 'code',
    ])
    const blockSummary = (allBlocks || []).map((b: Record<string, unknown>, i: number) => {
        const fields: string[] = []
        for (const [k, v] of Object.entries(b)) {
            if (['blockType', 'variant', 'id', '_order', '_path'].includes(k)) continue

            // Top-level strings (existing behavior)
            if (typeof v === 'string' && v.length > 0 && TEXT_FIELD_ALLOW.has(k)) {
                fields.push(`${k}: "${v.length > 80 ? v.slice(0, 80) + '…' : v}"`)
                continue
            }

            // Nested arrays and objects
            const nested = summarizeNestedField(k, v)
            if (nested) fields.push(nested)
        }
        const selected = i === blockIndex ? ' ← SELECTED' : ''
        return `  [${i}] ${b.blockType}${selected}\n      ${fields.join('\n      ') || '(no text fields)'}`
    }).join('\n')

    const systemPrompt = `You are an AI website editor. The user wants to modify their website.

## CONTEXT
- Site name: "${siteName || 'Website'}"
- Current page: "${currentPageTitle || 'Home'}" (slug: /${currentPageSlug || 'home'})
- Current theme: ${JSON.stringify(theme || {})}
- Total blocks on page: ${allBlocks?.length || 0}
${block ? `- Currently editing block #${blockIndex + 1}: type="${block.blockType}"` : '- No specific block selected'}
${block ? `\n## SELECTED BLOCK FULL DATA\n\`\`\`json\n${JSON.stringify(buildSafeBlockCopy(block), null, 2)}\n\`\`\`` : ''}

## CURRENT PAGE BLOCKS
${blockSummary || '(empty page)'}

## AVAILABLE BLOCK TYPES
${availableTypes}

## TASK
Based on the user's instruction, return a JSON response with the action to take.

## RESPONSE FORMAT
For modifying an existing block:
{
  "action": "update_block",
  "blockIndex": <index from CURRENT PAGE BLOCKS list above>,
  "changes": { "field": "new_value", ... },
  "message": "A short explanation of what was changed."
}
${block ? `The user has selected block #${blockIndex + 1}, so use blockIndex ${blockIndex} unless the instruction clearly refers to a different block.` : 'No block is selected — determine the correct blockIndex from the CURRENT PAGE BLOCKS list based on the user instruction.'}

For modifying MULTIPLE blocks at once (e.g., translate entire page, change tone across all sections):
{
  "action": "update_multiple_blocks",
  "updates": [
    { "blockIndex": 0, "changes": { "headline": "...", "subheadline": "..." } },
    { "blockIndex": 1, "changes": { "title": "...", "description": "..." } },
    ...
  ],
  "message": "A short explanation of what was changed."
}
IMPORTANT: Use "update_multiple_blocks" when the instruction applies to the ENTIRE PAGE or multiple sections (e.g., "translate all", "change all text to...", "make everything formal"). Use "update_block" when targeting a single specific section.
Each entry in "updates" follows the same rules as "changes" in "update_block" — include COMPLETE arrays for nested fields, use exact field names from CURRENT PAGE BLOCKS.

For changing the theme:
{
  "action": "update_theme",
  "changes": { "primaryColor": "#hex", ... },
  "message": "A short explanation of what was changed."
}
Theme field constraints (use ONLY these values):
${buildEnumPrompt()}
- Colors (primaryColor, secondaryColor, accentColor, etc.): any valid hex color

For adding a new block:
{
  "action": "add_block",
  "afterIndex": <index after which to insert, or -1 for top>,
  "block": { "blockType": "...", "variant": "...", ... },
  "message": "A short explanation of what was changed."
}

For deleting a block:
{
  "action": "delete_block",
  "blockIndex": <index from CURRENT PAGE BLOCKS list>,
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
3. "changes" should only include fields that are being modified. For array fields, include the COMPLETE array (not just changed items)
4. For text changes, generate professional, natural content
5. For theme changes, use tasteful colors that work together
6. blockType in new blocks MUST be one of the available types
7. If the user asks to add a section, use add_block with appropriate content
8. Supported add-section types: testimonials, faq, gallery, features, team, newsletter, banner, cta
9. New sections should be appended to the bottom by default unless the user explicitly asks otherwise
10. If the user asks to undo, revert, or go back to the previous state, use the "undo" action with a polite message.

## NESTED FIELD FORMAT (CRITICAL)
When modifying array fields (ctaButtons, features, items, links, testimonials, plans, etc.),
you MUST return the COMPLETE array in "changes", not individual items.

Example — changing a CTA button label:
WRONG: {"action":"update_block","blockIndex":0,"changes":{"buttonText":"Buy Now"}}
RIGHT: {"action":"update_block","blockIndex":0,"changes":{
  "ctaButtons":[{"label":"Buy Now","url":"#","style":"primary"},{"label":"View Collection","url":"#","style":"secondary"}]
},"message":"Translated CTA buttons to English."}

Example — updating FAQ items (field name is "faqs", NOT "items"):
{"action":"update_block","blockIndex":2,"changes":{
  "faqs":[{"question":"New Q1","answer":"New A1"},{"question":"New Q2","answer":"New A2"}]
}}

Example — updating navigation links:
{"action":"update_block","blockIndex":0,"changes":{
  "links":[{"label":"Home","url":"/"},{"label":"About","url":"/about"},{"label":"Contact","url":"/contact"}]
}}

Common nested field schemas:
- ctaButtons: [{label:string, url:string, style:"primary"|"secondary"|"outline"|"ghost"}]
- features/items: [{title:string, description:string, icon?:string}]
- faqs (FAQ items — field name is "faqs"): [{question:string, answer:string}]
- links (navigation): [{label:string, url:string, children?:[{label:string, url:string}]}]
- testimonials: [{quote:string, name:string, title?:string, company?:string}]
- plans (pricing): [{name:string, price:string, period?:string, description?:string, features:string[], ctaLabel:string, ctaUrl:string}]
- stats: [{value:string, label:string, prefix?:string, suffix?:string}]
- steps: [{title:string, description:string, icon?:string}]
- columns (footer): [{title:string, links:[{label:string, url:string}]}]
- images/gallery: [{url:string, alt?:string, caption?:string}]

IMPORTANT RULES for nested fields:
1. Always use the EXACT field name from CURRENT PAGE BLOCKS or SELECTED BLOCK FULL DATA (e.g., "ctaButtons" not "buttonText" or "cta")
2. Return the FULL array — partial updates will lose other items
3. Preserve items you're NOT modifying — copy them as-is from the SELECTED BLOCK FULL DATA
4. When translating, translate ALL items in the array, not just one

## SCOPE RESTRICTIONS
- You are ONLY allowed to edit this website's content, layout, theme, and blocks.
- If the user asks anything unrelated to website editing (general knowledge, coding help, personal questions, etc.), respond with:
  {"action": "none", "message": "I can only help with editing your website. Please ask me to change text, colors, layout, or add/remove sections."}
- When a specific block is selected, PREFER "update_block" targeting that block. Only use "update_theme" if the user explicitly asks to change the overall theme/colors/fonts.
- Do NOT use "update_theme" when the user asks to change a specific section's color — use "update_block" with the block's own color/style fields instead.
- IMPORTANT: Always set "blockIndex" to the correct index from the CURRENT PAGE BLOCKS list. Do NOT guess — use the index shown in square brackets [N].`

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

    const callStart = Date.now()
    let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>
    try {
        // Spec §1.3: include last 10 chat messages for conversational context
        // Cap each message at 300 chars to control token cost
        const historyMessages: { role: 'user' | 'assistant'; content: string }[] = (chatHistory || [])
            .slice(-10)
            .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
                (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 300) }))

        completion = await openai.chat.completions.create({
            model: selectModel('chat-edit'),
            messages: [
                { role: 'system', content: systemPrompt },
                ...historyMessages,
                { role: 'user', content: instruction },
            ],
            // phase-04: lower temperature 0.7 → 0.3 — edit-block needs fidelity, not variety.
            // User request "change hero headline to X" should return X verbatim, not a creative rephrasing.
            temperature: 0.3,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
        })
    } catch (err) {
        logAiUsage({
            endpoint: 'chat-edit',
            model: selectModel('chat-edit'),
            tokensIn: 0,
            tokensOut: 0,
            durationMs: Date.now() - callStart,
            success: false,
            errorCode: err instanceof Error ? err.name : 'unknown',
        })
        throw err
    }

    logAiUsage({
        endpoint: 'chat-edit',
        model: completion.model,
        tokensIn: completion.usage?.prompt_tokens ?? 0,
        tokensOut: completion.usage?.completion_tokens ?? 0,
        durationMs: Date.now() - callStart,
        success: true,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
        throw new Error('Empty AI response')
    }

    const result = JSON.parse(content) as AIEditResult

    // Handle scope rejection — AI determined the request is out of scope
    if (result.action === 'none') {
        return result
    }

    // Filter out-of-bounds blockIndex entries for multi-block updates.
    // AI occasionally returns indices past the page length — frontend silently
    // skips them, leaving the user's "Updated N sections" message misleading.
    if (result.action === 'update_multiple_blocks' && Array.isArray(result.updates) && allBlocks) {
        const maxIndex = allBlocks.length - 1
        const original = result.updates.length
        result.updates = result.updates.filter(u =>
            Number.isInteger(u.blockIndex) && u.blockIndex >= 0 && u.blockIndex <= maxIndex,
        )
        if (result.updates.length < original) {
            console.warn(`[AI edit-block] Filtered ${original - result.updates.length} out-of-bounds updates`)
        }
        if (result.updates.length === 0) {
            result.action = 'none'
            result.message = 'AI response contained no valid block updates.'
            return result
        }
    }

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
        const rateLimit = await checkRateLimit(String(user.id), 20)
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
