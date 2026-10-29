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
                    {/* Soft navy with faint teal corners (toned down from the prototype per design review). */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(20,90,90,0.14),transparent_55%),radial-gradient(ellipse_at_0%_100%,rgba(20,90,90,0.12),transparent_55%),linear-gradient(160deg,#0e1729_0%,#0c1626_50%,#0b1322_100%)]" />
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
