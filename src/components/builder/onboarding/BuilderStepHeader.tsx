interface BuilderStepHeaderProps {
    title: string
    subtitle: string
    description: string
}

const BUILDER_LOGO_URL = '/assets/builder/builder-brand-logo.png'

export function BuilderStepHeader({
    title,
    subtitle,
    description,
}: BuilderStepHeaderProps) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-5">
                {/* The PNG mark sits inside a large transparent glow canvas: render it oversized and let a 52px box own the layout. */}
                <div className="relative size-[52px] shrink-0">
                    <img
                        alt="Builder Logo"
                        className="absolute left-1/2 top-1/2 size-[136px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                        src={BUILDER_LOGO_URL}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h1 className="font-['Inter'] text-lg font-bold leading-[26px] text-white">
                        {title}
                    </h1>
                    <p className="text-xs leading-4 text-[#cbd5e1]">
                        {subtitle}
                    </p>
                </div>
            </div>
            {description ? (
                <p className="text-sm leading-5 text-[#94a3b8]">
                    {description}
                </p>
            ) : null}
        </div>
    )
}
