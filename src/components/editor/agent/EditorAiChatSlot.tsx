'use client'

import dynamic from 'next/dynamic'

// assistant-ui + the agent stylesheet load as their own chunk, after the editor is interactive.
const EditorAgentChat = dynamic(() => import('./EditorAgentChat'), { ssr: false })

/** The editor's "AI chat" tab: the web builder copilot (server threads, change cards, undo). */
export function EditorAiChatSlot({ siteId }: { siteId: string }) {
    return siteId ? <EditorAgentChat siteId={siteId} /> : null
}
