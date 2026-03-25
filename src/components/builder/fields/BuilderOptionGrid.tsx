import type { ReactNode } from 'react'

interface BuilderOptionGridProps {
    children: ReactNode
}

export function BuilderOptionGrid({ children }: BuilderOptionGridProps) {
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {children}
        </div>
    )
}
