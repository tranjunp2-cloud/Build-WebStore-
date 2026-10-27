import type { ReactNode } from 'react'

interface BuilderOptionGridProps {
    children: ReactNode
}

/** 2 columns on phones; from sm up, 4 columns that drop to 3 when the column gets narrow. */
export function BuilderOptionGrid({ children }: BuilderOptionGridProps) {
    return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-[10px] sm:[grid-template-columns:repeat(auto-fill,minmax(max(163px,calc((100%_-_24px)/4)),1fr))]">
            {children}
        </div>
    )
}
