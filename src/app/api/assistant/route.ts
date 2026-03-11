import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { SYSTEM_PROMPTS, selectModel } from '@/lib/ai/config'

export const maxDuration = 30

export async function POST(req: Request) {
    try {
        // Auth check — verify payload-token cookie exists
        const cookieHeader = req.headers.get('cookie') || ''
        const hasToken = cookieHeader.includes('payload-token=')

        if (!hasToken) {
            return Response.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { messages } = await req.json()

        if (!messages || !Array.isArray(messages)) {
            return Response.json(
                { error: 'Messages array is required' },
                { status: 400 }
            )
        }

        const model = selectModel('assistant-chat')

        const result = streamText({
            model: openai(model),
            system: SYSTEM_PROMPTS['assistant-chat'],
            messages,
            maxTokens: 1024,
            temperature: 0.7,
        })

        return result.toDataStreamResponse()
    } catch (error) {
        console.error('[AssistantBot] Error:', error)
        return Response.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
