interface BuilderStepHeaderProps {
    title: string
    subtitle: string
    description: string
}

const BUILDER_LOGO_URL = '/assets/builder/builder-logo.png'

export function BuilderStepHeader({
    title,
    subtitle,
    description,
}: BuilderStepHeaderProps) {
    return (
        <div className="flex flex-col gap-3 pt-8">
            <div className="flex items-center gap-3">
                <img
                    alt="Builder Logo"
                    className="size-10 shrink-0 object-contain"
                    src={BUILDER_LOGO_URL}
                />
                <div className="flex flex-col">
                    <h1 className="font-['Inter'] text-[20px] font-semibold leading-7 text-white">
                        {title}
                    </h1>
                    <p className="text-sm leading-5 text-[#94a3b8]">
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
