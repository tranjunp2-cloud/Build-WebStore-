/**
 * POST /api/ai/edit-block
 * AI-powered block editing: takes a natural language instruction
 * and applies changes to a specific block or the entire site.
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { blockRegistry } from '@/blocks/registry'
import { getCurrentUser } from '@/lib/auth'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { instruction, block, blockIndex, allBlocks, theme, siteName } = await req.json()

        if (!instruction) {
            return NextResponse.json({ error: 'Instruction is required' }, { status: 400 })
        }

        // Build context-aware system prompt
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
  "changes": { "field": "new_value", ... }
}

For changing the theme:
{
  "action": "update_theme",
  "changes": { "primaryColor": "#hex", ... }
}

For adding a new block:
{
  "action": "add_block",
  "afterIndex": ${blockIndex ?? -1},
  "block": { "blockType": "...", "variant": "...", ... }
}

For deleting a block:
{
  "action": "delete_block",
  "blockIndex": ${blockIndex ?? 0}
}

For rewriting text content:
{
  "action": "update_block",
  "blockIndex": ${blockIndex ?? 0},
  "changes": { "headline": "new text", "subheadline": "new text" }
}

## RULES
1. Respond ONLY with the JSON object
2. "changes" should only include fields that are being modified
3. For text changes, generate professional, natural content
4. For theme changes, use tasteful colors that work together
5. blockType in new blocks MUST be one of the available types
6. If the user asks to add a section, use add_block with appropriate content`

        const openai = getOpenAI()
        if (!openai) {
            return NextResponse.json({
                action: 'update_block',
                blockIndex: blockIndex ?? 0,
                changes: {},
                message: 'AI editing requires OpenAI API key. Please set OPENAI_API_KEY in .env.local',
            })
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

        const result = JSON.parse(content)

        // Validate if adding a new block
        if (result.action === 'add_block' && result.block?.blockType) {
            if (!blockRegistry.has(result.block.blockType)) {
                return NextResponse.json({ error: `Unknown block type: ${result.block.blockType}` }, { status: 400 })
            }
        }

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[AI Edit Block Error]', error)
        return NextResponse.json(
            { error: error?.message || 'AI editing failed' },
            { status: 500 },
        )
    }
}
