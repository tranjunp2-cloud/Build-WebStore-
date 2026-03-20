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
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
                <img
                    alt=""
                    className="h-auto w-1/5 shrink-0 object-contain translate-x-[-30%]"
                    src={BUILDER_LOGO_URL}
                />
                <div className="flex flex-col translate-x-[-40%]">
                    <h1 className="text-[20px] font-semibold leading-7 text-white">
                        {title}
                    </h1>
                    <p className="text-xs leading-4 text-[#94a3b8]">
                        {subtitle}
                    </p>
                </div>
            </div>
            {description ? (
                <p className="text-sm leading-5 text-[#94a3b8] -mt-11">
                    {description}
                </p>
            ) : null}
        </div>
    )
}
