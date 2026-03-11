'use client'

import {
    GitBranch,
    Rocket,
    Code2,
    HelpCircle,
    Layers,
} from 'lucide-react'

interface QuickActionsProps {
    onSelect: (question: string) => void
    disabled?: boolean
}

const quickActions = [
    {
        label: 'Project phase?',
        question: 'Dự án PrimeWeb hiện đang ở phase nào? Roadmap sắp tới như thế nào?',
        icon: Layers,
    },
    {
        label: 'Tech stack',
        question: 'Tech stack của PrimeWeb gồm những gì? Giải thích tổng quan kiến trúc.',
        icon: Code2,
    },
    {
        label: 'Deploy guide',
        question: 'Hướng dẫn quy trình deploy PrimeWeb lên staging và production.',
        icon: Rocket,
    },
    {
        label: 'Git workflow',
        question: 'Quy trình Git workflow của team, branching strategy, và commit conventions.',
        icon: GitBranch,
    },
    {
        label: 'Coding rules',
        question: 'Tóm tắt coding conventions và best practices của dự án PrimeWeb.',
        icon: HelpCircle,
    },
]

export function QuickActions({ onSelect, disabled }: QuickActionsProps) {
    return (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-thin scrollbar-thumb-white/10">
            {quickActions.map((action) => {
                const Icon = action.icon
                return (
                    <button
                        key={action.label}
                        onClick={() => onSelect(action.question)}
                        disabled={disabled}
                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-gray-400 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Icon className="h-3 w-3" />
                        <span>{action.label}</span>
                    </button>
                )
            })}
        </div>
    )
}
