import type { ReactNode } from 'react'

interface BuilderOptionGridProps {
    children: ReactNode
}

// 4 columns on wide panes, 3 on narrower ones, 2 on phones (cards never shrink below ~150px).
export function BuilderOptionGrid({ children }: BuilderOptionGridProps) {
    return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 pr-1.5 pt-1.5 sm:grid-cols-3 xl:grid-cols-4">
            {children}
        </div>
    )
}
