'use client'

import type { ReactNode } from 'react'
import { AnimatedSection, StaggerGrid, StaggerItem, HoverCard } from '../shared/animations'
import type { BlockProps } from '../types'
import type { TeamConfig, TeamMember } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, CARD_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

const TEAM_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`
const TEAM_CONTAINER_4XL = `max-w-4xl mx-auto ${INNER_PADDING}`

function TeamSection({ children, container = 'default' }: { children: ReactNode; container?: 'default' | '4xl' }) {
    return (
        <AnimatedSection className={SECTION_PADDING.default} style={{ color: CSS_VARS.text, background: CSS_VARS.background }}>
            <div className={container === '4xl' ? TEAM_CONTAINER_4XL : TEAM_CONTAINER}>{children}</div>
        </AnimatedSection>
    )
}

function InitialsAvatar({ name }: { name: string }) {
    const initial = name.charAt(0).toUpperCase()
    return (
        <div
            className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: CSS_VARS.primary }}
            aria-hidden="true"
        >
            {initial}
        </div>
    )
}

function MemberAvatar({ member }: { member: TeamMember }) {
    if (member.avatar?.url) {
        return (
            <img
                src={member.avatar?.url}
                alt={member.avatar?.alt || member.name}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                loading="lazy"
            />
        )
    }
    return <InitialsAvatar name={member.name} />
}

function SocialLinks({ socials }: { socials: TeamMember['socials'] }) {
    if (!socials?.length) return null
    return (
        <div className="flex justify-center gap-3 mt-3">
            {socials.map((s, i) => (
                <a
                    key={i}
                    href={s?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${TOUCH_TARGET.min} inline-flex items-center justify-center`}
                    style={{
                        color: CSS_VARS.primary,
                        background: 'rgba(var(--brand-primary-rgb), 0.1)',
                    }}
                    aria-label={`Visit ${s.platform}`}
                >
                    {s.platform}
                </a>
            ))}
        </div>
    )
}

function SectionHeader({ headline, subheadline }: { headline?: string; subheadline?: string }) {
    if (!headline) return null
    return (
        <div className="text-center mb-12">
            <Heading level={2} className="mb-3" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                <RichText text={headline} as="span" />
            </Heading>
            {subheadline && (
                <Body className="max-w-2xl mx-auto" style={{ color: CSS_VARS.muted }}>
                    <RichText text={subheadline} as="span" />
                </Body>
            )}
        </div>
    )
}

function MemberMeta({ member, align = 'center' }: { member: TeamMember; align?: 'center' | 'left' }) {
    return (
        <>
            <Heading level={4} className="font-bold" style={{ fontFamily: CSS_VARS.fontHeading, color: CSS_VARS.text }}>
                {member.name}
            </Heading>
            <Body size="small" className="mb-2" style={{ color: CSS_VARS.primary }}>{member.role}</Body>
            {member.bio && (
                <Body size="small" className={align === 'center' ? 'line-clamp-3' : 'mt-1'} style={{ color: CSS_VARS.muted }}>
                    {member.bio}
                </Body>
            )}
        </>
    )
}

function GridVariant({ headline, subheadline, members }: { headline?: string; subheadline?: string; members: TeamMember[] }) {
    return (
        <TeamSection>
            <SectionHeader headline={headline} subheadline={subheadline} />
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {members.map((m, i) => (
                    <StaggerItem key={i}>
                        <HoverCard
                            className={`text-center ${CARD_PADDING.md} transition-shadow`}
                            style={{
                                background: CSS_VARS.surface,
                                borderRadius: CSS_VARS.radiusLg,
                                boxShadow: CSS_VARS.shadowSm,
                                border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                            }}
                        >
                            <article aria-label={`${m.name}, ${m.role}`}>
                                <MemberAvatar member={m} />
                                <MemberMeta member={m} align="center" />
                                <SocialLinks socials={m.socials} />
                            </article>
                        </HoverCard>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </TeamSection>
    )
}

function ListVariant({ headline, subheadline, members }: { headline?: string; subheadline?: string; members: TeamMember[] }) {
    return (
        <TeamSection container="4xl">
            <SectionHeader headline={headline} subheadline={subheadline} />
            <StaggerGrid className="flex flex-col gap-4">
                {members.map((m, i) => (
                    <StaggerItem
                        key={i}
                        className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 transition-shadow hover:shadow-md"
                        style={{
                            background: CSS_VARS.surface,
                            borderRadius: CSS_VARS.radiusLg,
                            boxShadow: CSS_VARS.shadowSm,
                            border: '1px solid rgba(var(--brand-primary-rgb), 0.08)',
                        }}
                    >
                        <article className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full" aria-label={`${m.name}, ${m.role}`}>
                            <div className="flex-shrink-0">
                                <MemberAvatar member={m} />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <MemberMeta member={m} align="left" />
                                <SocialLinks socials={m.socials} />
                            </div>
                        </article>
                    </StaggerItem>
                ))}
            </StaggerGrid>
        </TeamSection>
    )
}

export function TeamBlock({ block }: BlockProps<TeamConfig>) {
    const { headline, subheadline, members = [], variant = 'grid' } = block

    if (!members.length) return null

    switch (variant) {
        case 'list':
            return <ListVariant headline={headline} subheadline={subheadline} members={members} />
        case 'grid':
        default:
            return <GridVariant headline={headline} subheadline={subheadline} members={members} />
    }
}
