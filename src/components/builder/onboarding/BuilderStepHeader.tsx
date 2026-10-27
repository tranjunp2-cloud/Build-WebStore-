import { cn } from '@/lib/utils'

interface BuilderStepHeaderProps {
    title: string
    subtitle: string
    description?: string
    /** `form` = info step (bold title, brighter subtitle); `chat` = generating / done. */
    variant?: 'form' | 'chat'
}

const BUILDER_LOGO_URL = '/assets/builder/builder-logo-webstore.webp'

export function BuilderStepHeader({
    title,
    subtitle,
    description,
    variant = 'form',
}: BuilderStepHeaderProps) {
    return (
        <div className="flex-none">
            <div className="flex items-center gap-5">
                <img
                    alt=""
                    className="size-[52px] flex-none [filter:drop-shadow(0_0_14px_rgba(34,211,238,.4))]"
                    src={BUILDER_LOGO_URL}
                />
                <div className="min-w-0">
                    <h1
                        className={cn(
                            'text-lg leading-[26px] text-white',
                            variant === 'form' ? 'font-bold' : 'font-semibold',
                        )}
                    >
                        {title}
                    </h1>
                    <p
                        className={cn(
                            'mt-0.5 text-[11px] leading-4',
                            variant === 'form' ? 'text-[#cbd5e1]' : 'text-[#94a3b8]',
                        )}
                    >
                        {subtitle}
                    </p>
                </div>
            </div>
            {description ? (
                <p className="mt-6 text-[13px] leading-5 text-[#94a3b8]">
                    {description}
                </p>
            ) : null}
        </div>
    )
}
