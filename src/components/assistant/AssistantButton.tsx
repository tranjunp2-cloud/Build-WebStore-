'use client'

import { Bot } from 'lucide-react'
import { useAssistantStore } from '@/store/assistantStore'
import { cn } from '@/lib/utils'

export function AssistantButton() {
    const { toggle, isOpen } = useAssistantStore()

    return (
        <button
            id="assistant-bot-trigger"
            onClick={toggle}
            className={cn(
                'fixed bottom-6 right-6 z-50',
                'flex h-14 w-14 items-center justify-center rounded-full',
                'bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-400',
                'shadow-lg shadow-cyan-500/25',
                'transition-all duration-300 ease-out',
                'hover:scale-110 hover:shadow-xl hover:shadow-cyan-500/40',
                'active:scale-95',
                'group',
                isOpen && 'scale-0 opacity-0 pointer-events-none'
            )}
            title="PrimeBot Assistant"
            aria-label="Open PrimeBot Assistant"
        >
            <Bot className="h-6 w-6 text-white transition-transform duration-300 group-hover:rotate-12" />

            {/* Subtle glow ring */}
            <span className="absolute -inset-1 rounded-full bg-cyan-400/20 animate-pulse" />
        </button>
    )
}
