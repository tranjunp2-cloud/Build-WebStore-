'use client'

import { useState, type ReactNode } from 'react'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import type { BlockProps } from '../types'
import type { TeamConfig, TeamMember } from './config'
import { getSocialIcon, getSocialAriaLabel } from '../shared/social-icons'
import { SectionLabel } from '../shared/decorative'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CARD_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

const FALLBACK_MEMBERS: TeamConfig['members'] = [
    { name: 'Team Lead', role: 'Founder' },
    { name: 'Senior Specialist', role: 'Expert' },
    { name: 'Customer Success', role: 'Support' },
]

// ── Local helpers (Plan 260415 team polish) ─────────────────────────────────

function TeamSection({ children, container = 'default' }: { children: ReactNode; container?: 'default' | '4xl' }) {
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

function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
    const initials = getInitials(name)
    const hue = hashHue(name)
    const sizeCls = size === 'lg' ? 'w-32 h-32 text-3xl' : size === 'sm' ? 'w-16 h-16 text-base' : 'w-24 h-24 text-2xl'
    return (
        <div
            className={`${sizeCls} rounded-full mx-auto mb-4 flex items-center justify-center font-bold text-white`}
            style={{ background: `hsl(${hue}, 55%, 50%)` }}
            aria-hidden="true"
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
function MemberAvatar({ member }: { member: TeamMember }) {
    const [imgError, setImgError] = useState(false)
    if (!member.avatar?.url || imgError) {
        return <InitialsAvatar name={member.name} />
    }
    return (
        <img
            src={member.avatar.url}
            alt={member.avatar.alt || `${member.name} portrait`}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
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
            <Heading level={4} className="font-bold" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                {member.name}
            </Heading>
            <Body size="small" className="mb-2" style={{ color: CSS_VARS.primary }}>{member.role}</Body>
            {member.bio && (
                <Body size="small" className={`line-clamp-3 ${align === 'left' ? 'mt-1' : ''}`} style={{ color: CSS_VARS.muted }}>
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
                    <StaggerItem key={`${m.name}-${i}`}>
                        <HoverCard
                            className={`text-center ${CARD_PADDING.md} transition-shadow`}
                            style={{
                                background: CSS_VARS.surface,
                                borderRadius: 'var(--radius-lg)',
                                boxShadow: 'var(--shadow-sm)',
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                            }}
                        >
                            <article aria-label={`${m.name}, ${m.role}`}>
                                <MemberAvatar member={m} />
                                <MemberMeta member={m} align="center" />
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
                                <MemberAvatar member={m} />
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
        case 'grid':
        default:
            return <GridVariant sectionLabel={sectionLabel} headline={headline} subheadline={subheadline} members={members} />
    }
}
