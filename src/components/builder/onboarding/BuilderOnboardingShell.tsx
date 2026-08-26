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
            <div className={cn("grid min-h-screen w-full lg:grid-cols-2", gridClassName)}>
                <div className="overflow-y-auto">{left}</div>
                <div
                    className={cn(
                        'relative hidden overflow-hidden lg:flex lg:items-center lg:justify-center',
                        rightPaneClassName,
                    )}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(131.71deg,rgba(59,130,246,0.1)_0%,rgba(45,212,191,0.1)_50%,rgba(0,0,0,0)_100%)]" />
                    <div
                        className={cn(
                            'relative z-10 w-full max-w-[960px] px-10 xl:px-16',
                            rightContentClassName,
                        )}
                    >
                        {right}
                    </div>
                </div>
            </div>
        </div>
    )
}
