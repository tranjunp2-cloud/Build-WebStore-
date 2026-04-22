'use client'

import { RichText } from './RichText'
import { hasInlineFormatting } from '@/lib/utils/rich-text-render'

/**
 * Shared decorative SVG components for block renderers.
 * Adds visual richness without requiring actual images.
 *
 * Phase A4 (260417) — 8 new primitives in ./decorative/* unlock per-variant
 * "decorative vocabulary" so 10 sites in the same category no longer share
 * the same gradient blob. Each block variant pins to a specific primitive
 * (see docs/design/decorative-vocabulary.md).
 */

export { MeshGradient } from './decorative/MeshGradient'
export { NoiseTexture } from './decorative/NoiseTexture'
export { LayeredShapes } from './decorative/LayeredShapes'
export { AsymmetricGrid } from './decorative/AsymmetricGrid'
export { DuotoneOverlay } from './decorative/DuotoneOverlay'
export { TypographicMark } from './decorative/TypographicMark'
export { GridLines } from './decorative/GridLines'
export { DiagonalStripe } from './decorative/DiagonalStripe'

// ── Gradient Blob — soft background accent ──────────────────────────────────

interface BlobProps {
    color: string
    className?: string
    size?: number
    opacity?: number
}

export function GradientBlob({ color, className = '', size = 400, opacity = 0.15 }: BlobProps) {
    return (
        <div
            className={`absolute pointer-events-none blur-3xl ${className}`}
            style={{
                width: size,
                height: size,
                background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                opacity,
            }}
        />
    )
}

// ── Dot Grid Pattern — subtle bg texture ────────────────────────────────────

interface DotGridProps {
    color?: string
    className?: string
    spacing?: number
}

export function DotGrid({ color = 'currentColor', className = '', spacing = 24 }: DotGridProps) {
    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{
                opacity: 0.04,
                backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`,
                backgroundSize: `${spacing}px ${spacing}px`,
            }}
        />
    )
}

// ── Wave Divider — section separator ────────────────────────────────────────

interface WaveDividerProps {
    color: string
    flip?: boolean
    className?: string
}

export function WaveDivider({ color, flip = false, className = '' }: WaveDividerProps) {
    return (
        <div className={`w-full overflow-hidden leading-[0] ${flip ? 'rotate-180' : ''} ${className}`}>
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-[60px]">
                <path
                    d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
                    fill={color}
                    fillOpacity="0.08"
                />
            </svg>
        </div>
    )
}

// ── Gradient Line — horizontal accent ───────────────────────────────────────

interface GradientLineProps {
    from: string
    to: string
    className?: string
    height?: number
}

export function GradientLine({ from, to, className = '', height = 2 }: GradientLineProps) {
    return (
        <div
            className={`w-full ${className}`}
            style={{
                height,
                background: `linear-gradient(90deg, ${from}, ${to}, transparent)`,
                borderRadius: 999,
            }}
        />
    )
}

// ── Icon Container — gradient icon wrapper ──────────────────────────────────

interface IconContainerProps {
    color: string
    children: React.ReactNode
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

export function IconContainer({ color, children, className = '', size = 'md' }: IconContainerProps) {
    const sizing = {
        sm: 'w-10 h-10 text-lg',
        md: 'w-14 h-14 text-2xl',
        lg: 'w-18 h-18 text-3xl',
    }[size]

    return (
        <div
            className={`inline-flex items-center justify-center rounded-2xl ${sizing} ${className}`}
            style={{
                background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                border: `1px solid ${color}25`,
                color,
            }}
        >
            {children}
        </div>
    )
}

// ── Glass Card — frosted glass effect ───────────────────────────────────────

interface GlassCardProps {
    color: string
    children: React.ReactNode
    className?: string
}

export function GlassCard({ color, children, className = '' }: GlassCardProps) {
    return (
        <div
            className={`backdrop-blur-sm rounded-2xl ${className}`}
            style={{
                background: `linear-gradient(135deg, ${color}08, ${color}03)`,
                border: `1px solid ${color}15`,
                boxShadow: `0 8px 32px ${color}08`,
            }}
        >
            {children}
        </div>
    )
}

// ── Section Label — styled overline text ────────────────────────────────────

interface SectionLabelProps {
    color: string
    children: React.ReactNode
}

export function SectionLabel({ color, children }: SectionLabelProps) {
    const content = typeof children === 'string' && hasInlineFormatting(children) 
        ? <RichText text={children} as="span" /> 
        : children

    return (
        <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{
                background: `${color}12`,
                color,
                border: `1px solid ${color}20`,
            }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {content}
        </div>
    )
}

// ── Floating Shapes — abstract decorative elements ──────────────────────────

interface FloatingShapeProps {
    color: string
    className?: string
}

export function FloatingCircle({ color, className = '' }: FloatingShapeProps) {
    return (
        <div
            className={`absolute rounded-full pointer-events-none ${className}`}
            style={{
                width: 6,
                height: 6,
                background: color,
                opacity: 0.3,
            }}
        />
    )
}

// ── Avatar Ring — styled avatar wrapper ─────────────────────────────────────

interface AvatarRingProps {
    color: string
    src?: string
    name: string
    size?: number
    imageIndex?: number
}

export function AvatarRing({ color, src, name, size = 48, imageIndex }: AvatarRingProps) {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

    return (
        <div
            className="rounded-full flex items-center justify-center font-bold text-sm"
            style={{
                width: size,
                height: size,
                background: src ? 'transparent' : `linear-gradient(135deg, ${color}, ${color}80)`,
                border: `2px solid ${color}40`,
                color: '#fff',
                boxShadow: `0 0 0 3px ${color}15`,
            }}
        >
            {src ? (
                <img src={src} alt={name} className="w-full h-full rounded-full object-cover" data-image-index={imageIndex} />
            ) : initials}
        </div>
    )
}
