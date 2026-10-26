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
                {/* Flat rail: no gradient wash. Preflight is off, so the divider needs the full border shorthand. */}
                <div
                    className={cn(
                        'relative hidden overflow-hidden bg-[#0f172a] [border-left:1px_solid_rgba(148,163,184,0.12)] lg:flex lg:items-center lg:justify-center',
                        rightPaneClassName,
                    )}
                >
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
