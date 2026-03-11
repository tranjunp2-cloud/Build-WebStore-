'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Bot, User } from 'lucide-react'

interface MessageBubbleProps {
    role: 'user' | 'assistant'
    content: string
}

/**
 * Simple markdown-to-HTML converter for bot responses.
 * Handles: headings, bold, italic, inline code, code blocks, lists, line breaks.
 */
function renderMarkdown(text: string): string {
    let html = text
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    // Code blocks (```...```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre class="my-2 rounded-lg bg-black/30 border border-white/10 p-3 text-xs overflow-x-auto"><code>${code.trim()}</code></pre>`
    })

    // Inline code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1.5 py-0.5 text-xs text-cyan-300 font-mono">$1</code>')

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-white mt-3 mb-1">$1</h4>')
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-white mt-3 mb-1">$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white mt-3 mb-1">$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-white mt-3 mb-1">$1</h1>')

    // Bold + Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-semibold text-white"><em>$1</em></strong>')
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-300">$1</li>')
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1.5 space-y-0.5">$1</ul>')

    // Numbered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-300">$1</li>')

    // Paragraphs — double newlines
    html = html.replace(/\n\n/g, '</p><p class="mt-2">')

    // Single newlines (that aren't already inside block elements)
    html = html.replace(/\n/g, '<br/>')

    return `<p>${html}</p>`
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
    const isUser = role === 'user'
    const renderedContent = useMemo(() => {
        if (isUser) return null
        return renderMarkdown(content)
    }, [content, isUser])

    return (
        <div
            className={cn(
                'flex gap-3 px-4 py-3',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            {/* Avatar */}
            <div
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    isUser
                        ? 'bg-gradient-to-br from-blue-500 to-purple-500'
                        : 'bg-gradient-to-br from-cyan-500 to-teal-400'
                )}
            >
                {isUser ? (
                    <User className="h-4 w-4 text-white" />
                ) : (
                    <Bot className="h-4 w-4 text-white" />
                )}
            </div>

            {/* Message bubble */}
            <div
                className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    isUser
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md'
                        : 'bg-white/[0.06] text-gray-200 border border-white/10 rounded-bl-md backdrop-blur-sm'
                )}
            >
                {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{content}</div>
                ) : (
                    <div
                        className="break-words prose-sm prose-invert [&_p]:my-0"
                        dangerouslySetInnerHTML={{ __html: renderedContent || '' }}
                    />
                )}
            </div>
        </div>
    )
}

export function TypingIndicator() {
    return (
        <div className="flex gap-3 px-4 py-3">
            {/* Bot avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-teal-400">
                <Bot className="h-4 w-4 text-white" />
            </div>

            {/* Typing dots */}
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/10 px-4 py-3 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
            </div>
        </div>
    )
}
