import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BuilderOnboardingShellProps {
    left: ReactNode
    right?: ReactNode
    className?: string
    gridClassName?: string
    rightPaneClassName?: string
    rightContentClassName?: string
}

export function BuilderOnboardingShell({
    left,
    right,
    className,
    gridClassName,
    rightPaneClassName,
    rightContentClassName,
}: BuilderOnboardingShellProps) {
    return (
        <div
            className={cn(
                "min-h-screen w-full overflow-hidden bg-[#0b1120] text-white font-['Inter']",
                className,
            )}
        >
            <div className={cn('grid min-h-screen w-full lg:grid-cols-2', gridClassName)}>
                <div className="min-w-0 overflow-y-auto bg-[#0a0e17]">{left}</div>
                <div
                    className={cn(
                        'relative hidden h-[100dvh] min-w-0 overflow-y-auto lg:flex',
                        rightPaneClassName,
                    )}
                >
                    <div className={cn('relative z-10 w-full', rightContentClassName)}>
                        {right}
                    </div>
                </div>
            </div>
        </div>
    )
}
