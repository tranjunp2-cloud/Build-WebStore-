'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import type { BlockProps } from '../types'
import type { TeamConfig, TeamMember } from './config'
import { getSocialIcon, getSocialAriaLabel } from '../shared/social-icons'
import {
    SectionLabel,
    LayeredShapes,
    GridLines,
    NoiseTexture,
} from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CARD_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'
import { X } from 'lucide-react'

const FALLBACK_MEMBERS: TeamConfig['members'] = [
    { name: 'Team Lead', role: 'Founder' },
    { name: 'Senior Specialist', role: 'Expert' },
    { name: 'Customer Success', role: 'Support' },
]

// ── Local helpers (Plan 260415 team polish) ─────────────────────────────────

function TeamSection({
    children,
    container = 'default',
    decorative,
}: {
    children: ReactNode
    container?: 'default' | '4xl'
    decorative?: ReactNode
}) {
    if (decorative) {
        // Wrap manually so decorative sits as sibling of SectionWrapper inside
        // AnimatedSection — absolute children fill the full section, not just
        // the inner content box.
        return (
            <AnimatedSection
                className="relative overflow-hidden"
                style={{ color: CSS_VARS.text, background: CSS_VARS.background }}
            >
                {decorative}
                <SectionWrapper
                    as="div"
                    padding="default"
                    container="default"
                    background="transparent"
                    innerClassName={`${container === '4xl' ? '!max-w-4xl ' : ''}relative z-10`.trim()}
                >
                    {children}
                </SectionWrapper>
            </AnimatedSection>
        )
    }
    return (
        <SectionWrapper
            as={AnimatedSection}
            padding="default"
            container="default"
            innerClassName={container === '4xl' ? '!max-w-4xl' : ''}
            style={{ color: CSS_VARS.text, background: CSS_VARS.background }}
        >
            {children}
        </SectionWrapper>
    )
}

/**
 * Plan 260415 Lỗi B — InitialsAvatar giờ lấy 2 ký tự đầu + sinh hue từ hash
 * tên để mỗi member có màu khác nhau. Deterministic per name (cùng tên → cùng
 * màu) để avoid flash giữa renders.
 */
function getInitials(name: string): string {
    const words = name.split(/\s+/).filter(Boolean)
    if (words.length === 0) return '?'
    if (words.length === 1) return words[0]!.charAt(0).toUpperCase()
    return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase()
}

function hashHue(name: string): number {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) % 360
    }
    return hash
}

function InitialsAvatar({ name, size = 'md', imageIndex }: { name: string; size?: 'sm' | 'md' | 'lg'; imageIndex?: number }) {
    const initials = getInitials(name)
    const hue = hashHue(name)
    const sizeCls = size === 'lg' ? 'w-32 h-32 text-3xl' : size === 'sm' ? 'w-16 h-16 text-base' : 'w-24 h-24 text-2xl'
    return (
        <div
            className={`${sizeCls} rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-white`}
            style={{ background: `hsl(${hue}, 55%, 50%)` }}
            aria-hidden="true"
            data-image-index={imageIndex}
        >
            {initials}
        </div>
    )
}

/**
 * Plan 260415 Lỗi C + 7T — `<img>` với onError fallback sang InitialsAvatar.
 * Nếu avatar URL 404 hoặc load fail → tự swap sang initials đẹp, không icon
 * broken. Vẫn dùng raw <img> (chưa next/image) để giảm scope PR.
 */
function MemberAvatar({ member, imageIndex }: { member: TeamMember; imageIndex?: number }) {
    const [imgError, setImgError] = useState(false)
    if (!member.image?.url || imgError) {
        return <InitialsAvatar name={member.name} imageIndex={imageIndex} />
    }
    return (
        <img
            src={member.image.url}
            alt={member.image.alt || `${member.name} portrait`}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
            data-image-index={imageIndex}
        />
    )
}

/**
 * Plan 260415 Lỗi D + 8T + 1T — social links giờ dùng shared SOCIAL_ICONS
 * (reuse từ footer). Text pill → real icon trong rounded square button.
 * aria-label semantic: "Email John" cho email, "Call John" cho phone,
 * "Visit John on LinkedIn" cho platforms khác.
 */
function SocialLinks({ socials, name }: { socials: TeamMember['socials']; name: string }) {
    if (!socials?.length) return null
    return (
        <div className="flex justify-center gap-2 mt-3">
            {socials.map((s, i) => {
                const Icon = getSocialIcon(s.platform)
                const ariaLabel = getSocialAriaLabel(s.platform, name)
                const isExternal = s.url?.startsWith('http')
                return (
                    <a
                        key={`${s.platform}-${i}`}
                        href={s.url}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        aria-label={ariaLabel}
                        className={`w-11 h-11 ${TOUCH_TARGET.min} rounded-full flex items-center justify-center transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.4)]`}
                        style={{
                            color: CSS_VARS.primary,
                            background: 'rgba(var(--brand-primary-rgb), 0.1)',
                        }}
                    >
                        <Icon size={16} />
                    </a>
                )
            })}
        </div>
    )
}

/**
 * Plan 260415 Lỗi A — SectionHeader giờ nhận prop `sectionLabel` + `align`.
 * About block đã có eyebrow, team thêm để rhythm sync.
 */
function SectionHeader({
    sectionLabel,
    headline,
    subheadline,
    align = 'center',
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    align?: 'center' | 'left'
}) {
    if (!headline && !sectionLabel) return null
    const alignCls = align === 'center' ? 'text-center' : 'text-left'
    return (
        <div className={`${alignCls} mb-12`}>
            {sectionLabel && <SectionLabel color={CSS_VARS.primary}>{sectionLabel}</SectionLabel>}
            {headline && (
                <Heading level={2} className="mb-3" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                    <RichText text={headline} as="span" />
                </Heading>
            )}
            {subheadline && (
                <Body className={align === 'center' ? 'max-w-2xl mx-auto' : 'max-w-2xl'} style={{ color: CSS_VARS.muted }}>
                    <RichText text={subheadline} as="span" />
                </Body>
            )}
        </div>
    )
}

/**
 * Plan 260415 Lỗi 10T — bio giờ có line-clamp ở cả 2 variants (grid + list).
 * List variant trước kia bio không clamp → long bio push layout. Giờ clamp-3.
 */
function MemberMeta({ member, align = 'center' }: { member: TeamMember; align?: 'center' | 'left' }) {
    return (
        <>
            <Heading level={4} className="font-bold break-words" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                {member.name}
            </Heading>
            <Body size="small" className="mb-2 break-words" style={{ color: CSS_VARS.primary }}>{member.role}</Body>
            {member.bio && (
                <Body size="small" className={`line-clamp-3 break-words ${align === 'left' ? 'mt-1' : ''}`} style={{ color: CSS_VARS.muted }}>
                    {member.bio}
                </Body>
            )}
        </>
    )
}

// ── Config type extension helper ────────────────────────────────────────────
// Plan 260415 Lỗi A — team config chưa có sectionLabel field; dùng type cast
// tạm thời, config schema cập nhật scope follow-up.
function getSectionLabel(block: TeamConfig): string | undefined {
    return (block as unknown as { sectionLabel?: string }).sectionLabel
}

function GridVariant({
    sectionLabel,
    headline,
    subheadline,
    members,
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    members: TeamMember[]
}) {
    return (
        <TeamSection>
            <SectionHeader sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} />
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {members.map((m, i) => (
                    <StaggerItem key={`${m.name}-${i}`} className="h-full">
                        <HoverCard
                            className={`text-center ${CARD_PADDING.md} transition-shadow h-full flex flex-col`}
                            style={{
                                background: CSS_VARS.surface,
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-sm)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                            }}
                        >
                            <article aria-label={`${m.name}, ${m.role}`} className="flex flex-col h-full flex-1 justify-between">
                                <div>
                                    <MemberAvatar member={m} imageIndex={i} />
                                    <MemberMeta member={m} align="center" />
                                </div>
                                <SocialLinks socials={m.socials} name={m.name} />
                            </article>
                        </HoverCard>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </TeamSection>
    )
}

function ListVariant({
    sectionLabel,
    headline,
    subheadline,
    members,
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    members: TeamMember[]
}) {
    return (
        <TeamSection container="4xl">
            <SectionHeader sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} />
            <StaggerGrid className="flex flex-col gap-4">
                {members.map((m, i) => (
                    <StaggerItem
                        key={`${m.name}-${i}`}
                        className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 transition-shadow hover:shadow-md"
                        style={{
                            background: CSS_VARS.surface,
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-sm)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                        }}
                    >
                        <article className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full" aria-label={`${m.name}, ${m.role}`}>
                            <div className="flex-shrink-0">
                                <MemberAvatar member={m} imageIndex={i} />
                            </div>
                            <div className="flex-1 text-center sm:text-left min-w-0">
                                <MemberMeta member={m} align="left" />
                                <SocialLinks socials={m.socials} name={m.name} />
                            </div>
                        </article>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </TeamSection>
    )
}

// ── A5 (260417) — 4 new team variants for pool diversity ─────────────────────

/**
 * cards-hover-reveal: avatar + name visible by default, hover reveals bio
 * overlay sliding up. Pure CSS (group-hover Tailwind), no JS state.
 * A4 vocab: LayeredShapes — organic background.
 */
function CardsHoverRevealVariant({
    sectionLabel,
    headline,
    subheadline,
    members,
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    members: TeamMember[]
}) {
    return (
        <TeamSection decorative={<LayeredShapes color={CSS_VARS.primary} opacity={0.08} />}>
            <SectionHeader sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} />
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {members.map((m, i) => (
                    <StaggerItem key={`${m.name}-${i}`}>
                        <article
                            className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-default"
                            aria-label={`${m.name}, ${m.role}`}
                            style={{
                                background: CSS_VARS.surface,
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                            }}
                        >
                            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
                                <MemberAvatar member={m} imageIndex={i} />
                            </div>
                            <div
                                className="absolute inset-x-0 bottom-0 p-5 text-center translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                                style={{
                                    background: `linear-gradient(to top, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.85))`,
                                    color: '#ffffff',
                                }}
                            >
                                <p className="font-bold text-base">{m.name}</p>
                                <p className="text-sm opacity-90 mb-1">{m.role}</p>
                                {m.bio && (
                                    <p className="text-xs opacity-85 line-clamp-3">{m.bio}</p>
                                )}
                                <SocialLinks socials={m.socials} name={m.name} />
                            </div>
                            <div className="absolute inset-x-0 bottom-0 py-3 text-center transition-opacity duration-300 group-hover:opacity-0">
                                <p className="font-semibold text-sm" style={{ color: CSS_VARS.text }}>{m.name}</p>
                                <p className="text-xs" style={{ color: CSS_VARS.muted }}>{m.role}</p>
                            </div>
                        </article>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </TeamSection>
    )
}

/**
 * horizontal-scroll: snap-scroll row of member cards. Touch-friendly on mobile,
 * unusual horizontal layout on desktop. Pure CSS scroll-snap, no JS.
 * A4 vocab: GridLines — architectural backdrop.
 */
function HorizontalScrollVariant({
    sectionLabel,
    headline,
    subheadline,
    members,
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    members: TeamMember[]
}) {
    return (
        <TeamSection decorative={<GridLines color={CSS_VARS.primary} spacing={48} opacity={0.05} />}>
            <SectionHeader sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} />
            <div
                className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4"
                style={{ scrollbarWidth: 'thin' }}
                role="region"
                aria-label="Team members carousel"
            >
                {members.map((m, i) => (
                    <article
                        key={`${m.name}-${i}`}
                        className={`shrink-0 w-72 snap-center text-center ${CARD_PADDING.md} flex flex-col justify-between`}
                        style={{
                            background: CSS_VARS.surface,
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-sm)',
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                        }}
                        aria-label={`${m.name}, ${m.role}`}
                    >
                        <div>
                            <MemberAvatar member={m} imageIndex={i} />
                            <MemberMeta member={m} align="center" />
                        </div>
                        <SocialLinks socials={m.socials} name={m.name} />
                    </article>
                ))}
            </div>
        </TeamSection>
    )
}

/**
 * bio-modal: compact avatar grid; click opens HTML <dialog> with full bio.
 * Uses native <dialog> for a11y (Esc to close, focus trap, backdrop).
 * A4 vocab: NoiseTexture — film texture.
 */
function BioModalVariant({
    sectionLabel,
    headline,
    subheadline,
    members,
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    members: TeamMember[]
}) {
    const [active, setActive] = useState<TeamMember | null>(null)
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) return
        if (active && !dialog.open) dialog.showModal()
        if (!active && dialog.open) dialog.close()
    }, [active])

    return (
        <TeamSection decorative={<NoiseTexture opacity={0.05} />}>
            <SectionHeader sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} />
            <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {members.map((m, i) => (
                    <StaggerItem key={`${m.name}-${i}`} className="h-full">
                        <button
                            type="button"
                            onClick={() => setActive(m)}
                            className={`w-full h-full text-center p-4 rounded-xl transition-all hover:scale-[1.03] flex flex-col items-center justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.5)] ${TOUCH_TARGET.min}`}
                            style={{
                                background: CSS_VARS.surface,
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                            }}
                            aria-label={`Open bio for ${m.name}`}
                        >
                            <MemberAvatar member={m} imageIndex={i} />
                            <div className="w-full min-w-0">
                                <p className="font-semibold text-sm truncate" style={{ color: CSS_VARS.text }}>{m.name}</p>
                                <p className="text-xs truncate" style={{ color: CSS_VARS.muted }}>{m.role}</p>
                            </div>
                        </button>
                    </StaggerItem>
                ))}
            </StaggerGrid>
            <dialog
                ref={dialogRef}
                onClose={() => setActive(null)}
                onClick={(e) => {
                    if (e.target === dialogRef.current) setActive(null)
                }}
                className="rounded-2xl p-0 max-w-md w-[92vw] backdrop:bg-black/50"
            >
                {active && (
                    <div className="p-6 relative" style={{ background: CSS_VARS.surface, color: CSS_VARS.text }}>
                        <button
                            type="button"
                            onClick={() => setActive(null)}
                            className={`absolute top-3 right-3 p-2 rounded-full opacity-60 hover:opacity-100 ${TOUCH_TARGET.min} flex items-center justify-center`}
                            aria-label="Close bio"
                        >
                            <X size={18} />
                        </button>
                        <div className="text-center">
                            <MemberAvatar member={active} />
                            <Heading level={4} className="font-bold mb-1">{active.name}</Heading>
                            <Body size="small" className="mb-4" style={{ color: CSS_VARS.primary }}>{active.role}</Body>
                            {active.bio && (
                                <Body size="small" className="text-left" style={{ color: CSS_VARS.muted }}>
                                    {active.bio}
                                </Body>
                            )}
                            <SocialLinks socials={active.socials} name={active.name} />
                        </div>
                    </div>
                )}
            </dialog>
        </TeamSection>
    )
}

/**
 * compact-row: dense single-row layout per member (small avatar + name + role +
 * 1-line bio). Like a LinkedIn search result. No decorative — minimal aesthetic.
 */
function CompactRowVariant({
    sectionLabel,
    headline,
    subheadline,
    members,
}: {
    sectionLabel?: string
    headline?: string
    subheadline?: string
    members: TeamMember[]
}) {
    return (
        <TeamSection container="4xl">
            <SectionHeader sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} />
            <ul className="flex flex-col divide-y" style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.08)' }}>
                {members.map((m, i) => (
                    <li
                        key={`${m.name}-${i}`}
                        className="flex items-center gap-4 py-4"
                        style={{ borderColor: 'rgba(var(--brand-primary-rgb), 0.08)' }}
                    >
                        <div className="flex-shrink-0 w-12 h-12">
                            {m.image?.url ? (
                                <img
                                    src={m.image.url}
                                    alt={m.image.alt || `${m.name} portrait`}
                                    className="w-12 h-12 rounded-full object-cover"
                                    loading="lazy"
                                    data-image-index={i}
                                />
                            ) : (
                                <div
                                    className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                    style={{ background: `hsl(${hashHue(m.name)}, 55%, 50%)` }}
                                    aria-hidden="true"
                                    data-image-index={i}
                                >
                                    {getInitials(m.name)}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <p className="font-semibold text-sm" style={{ color: CSS_VARS.text }}>{m.name}</p>
                                <p className="text-xs" style={{ color: CSS_VARS.primary }}>{m.role}</p>
                            </div>
                            {m.bio && (
                                <p className="text-xs truncate mt-0.5" style={{ color: CSS_VARS.muted }}>{m.bio}</p>
                            )}
                        </div>
                        <div className="flex-shrink-0 hidden sm:block">
                            <SocialLinks socials={m.socials} name={m.name} />
                        </div>
                    </li>
                ))}
            </ul>
        </TeamSection>
    )
}

/**
 * Plan 260415 Lỗi 14T — members.length === 0 trước đây return null silent.
 * Giờ return null nhưng log dev warning để admin biết block đang rỗng.
 */
function useEmptyWarning(count: number) {
    if (typeof window !== 'undefined' && count === 0 && process.env.NODE_ENV === 'development') {
        console.warn('[team] members array is empty — block rendered nothing')
    }
}

export function TeamBlock({ block }: BlockProps<TeamConfig>) {
    const { headline, subheadline, members: rawMembers = [], variant = 'grid' } = block
    const members = rawMembers.length > 0 ? rawMembers : FALLBACK_MEMBERS
    const sectionLabel = getSectionLabel(block)

    useEmptyWarning(members.length)

    if (!members.length) return null

    switch (variant) {
        case 'list':
            return <ListVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
        case 'cards-hover-reveal':
            return <CardsHoverRevealVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
        case 'horizontal-scroll':
            return <HorizontalScrollVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
        case 'bio-modal':
            return <BioModalVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
        case 'compact-row':
            return <CompactRowVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
        case 'grid':
        default:
            return <GridVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
    }
}
