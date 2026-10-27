// 1px gradient ring around a rounded card. The mask cuts out the content box so only the ring
// is painted (Tailwind arbitrary mask utilities don't compose reliably, hence inline styles).
export function GradientHairline({ gradient, radiusClassName = 'rounded-[17px]' }: { gradient: string; radiusClassName?: string }) {
    return (
        <div
            aria-hidden
            className={`pointer-events-none absolute -inset-px p-px ${radiusClassName}`}
            style={{
                background: gradient,
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
            }}
        />
    )
}
