export type AiChatEnterBehavior = 'ignore' | 'block' | 'submit'

type AiChatEnterInput = {
    key: string
    prompt: string
    shiftKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    isComposing?: boolean
}

export function getAiChatEnterBehavior({
    key,
    prompt,
    shiftKey = false,
    ctrlKey = false,
    metaKey = false,
    isComposing = false,
}: AiChatEnterInput): AiChatEnterBehavior {
    if (key !== 'Enter' || shiftKey || ctrlKey || metaKey || isComposing) return 'ignore'
    return prompt.trim() ? 'submit' : 'block'
}
