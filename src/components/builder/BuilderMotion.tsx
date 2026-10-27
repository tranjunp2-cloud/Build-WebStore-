import type { CSSProperties } from 'react'

/**
 * Keyframes shared by the builder onboarding screens (info step, generating
 * panel, done state). Rendered once per screen; the `bld-*` classes respect
 * prefers-reduced-motion.
 */
const BUILDER_MOTION_CSS = `
@keyframes bld-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes bld-fade{from{opacity:0}to{opacity:1}}
@keyframes bld-scan{from{transform:translateY(0)}to{transform:translateY(196px)}}
@keyframes bld-shimmer{from{background-position:150% 0}to{background-position:-50% 0}}
@keyframes bld-sweep{from{transform:translateX(-120%)}to{transform:translateX(330%)}}
@keyframes bld-caret{50%{opacity:0}}
@keyframes bld-ring{from{transform:scale(1);opacity:.85}to{transform:scale(1.9);opacity:0}}
@keyframes bld-type{from{max-width:0}to{max-width:var(--bld-type-w,100%)}}
@keyframes bld-glow{0%{box-shadow:0 0 0 0 rgba(56,189,248,.5),0 0 12px rgba(45,212,191,.3)}70%{box-shadow:0 0 0 8px rgba(56,189,248,0),0 0 18px rgba(45,212,191,.45)}100%{box-shadow:0 0 0 0 rgba(56,189,248,0),0 0 12px rgba(45,212,191,.3)}}
.bld-in{animation:bld-in .4s ease-out both}
.bld-fade{animation:bld-fade .4s ease-out both}
.bld-glow{animation:bld-glow 2.4s ease-out infinite}
.bld-caret{animation:bld-caret 1s steps(1) infinite}
.bld-scan{animation:bld-scan 1.6s ease-in-out infinite alternate}
.bld-sweep{animation:bld-sweep 1.2s ease-out both}
.bld-ring{animation:bld-ring 1.4s ease-out .35s 2 both}
.bld-type{display:inline-block;overflow:hidden;white-space:nowrap;vertical-align:bottom;animation:bld-type var(--bld-type-ms,1.1s) steps(var(--bld-type-steps,12)) both}
.bld-shimmer{background-color:rgba(148,163,184,.12);background-image:linear-gradient(90deg,rgba(148,163,184,0) 0%,rgba(148,163,184,.3) 50%,rgba(148,163,184,0) 100%);background-size:200% 100%;animation:bld-shimmer 1.4s linear infinite}
@media (prefers-reduced-motion:reduce){
.bld-in,.bld-fade,.bld-glow,.bld-caret,.bld-scan,.bld-sweep,.bld-ring,.bld-type,.bld-shimmer{animation:none}
.bld-glow{box-shadow:0 0 14px rgba(45,212,191,.4)}
.bld-shimmer{background-image:none;background-color:rgba(148,163,184,.18)}
.bld-scan,.bld-sweep,.bld-ring{display:none}
}
`

export function BuilderMotionStyles() {
    return <style>{BUILDER_MOTION_CSS}</style>
}

/** 1px gradient hairline drawn on top of a rounded card (mask-composite border). */
export function BuilderGradientBorder({ gradient, radius = 17 }: { gradient: string; radius?: number }) {
    const style: CSSProperties = {
        background: gradient,
        borderRadius: radius,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
    }
    return <div aria-hidden className="pointer-events-none absolute -inset-px p-px" style={style} />
}

export const BUILDER_CARD_BORDER =
    'linear-gradient(165deg,rgba(56,189,248,.6) 0%,rgba(56,189,248,.1) 32%,rgba(148,163,184,.04) 58%,rgba(45,212,191,.45) 100%)'

/** Gradient-stroke lucide sparkles (bare icon, no tile) used in card headers. */
export function BuilderSparkleGradient({ size = 30 }: { size?: number }) {
    return (
        <svg
            aria-hidden
            fill="none"
            height={size}
            stroke="url(#bld-spark-grad)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
            width={size}
        >
            <defs>
                <linearGradient gradientUnits="userSpaceOnUse" id="bld-spark-grad" x1="2" x2="22" y1="2" y2="22">
                    <stop offset="0" stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#2dd4bf" />
                </linearGradient>
            </defs>
            <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
        </svg>
    )
}
