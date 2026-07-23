'use client'

import Image from 'next/image'
import { useState, useEffect, type ReactNode } from 'react'
import { ArrowUpRight, Lock } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { PlatformUser } from '@/types/user'
import { getDisplayName, getAvatarUrl, getInitial } from './profile-utils'

type Props = {
    user: Pick<PlatformUser, 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar'>
    ssoUrl: string
}

type FieldProps = { label: string; value: ReactNode }

function Field({ label, value }: FieldProps) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-[.6px] text-[hsl(var(--muted-foreground))] opacity-60">
                {label}
            </span>
            <span className="text-[15px] font-medium text-[hsl(var(--foreground))] leading-[22px] break-words">
                {value}
            </span>
        </div>
    )
}

// Owner read-only single page (F23 GH-1614 P4): 2-col grid = read-only Profile Card (2fr)
// + unified SSO widget (1fr), equal height. Pure presentational — no API calls, no forms.
// 2FA stays hidden until the SSO contract provides an authoritative per-owner status.
export function OwnerProfileView({ user, ssoUrl }: Props) {
    const { t } = useI18n()
    const [imgFailed, setImgFailed] = useState(false)
    const rawUrl = getAvatarUrl(user.avatar)
    useEffect(() => { setImgFailed(false) }, [rawUrl])
    const avatarUrl = imgFailed ? null : rawUrl
    const displayName = getDisplayName(user.firstName, user.lastName, user.email)
    const initial = getInitial(user.firstName, user.email)

    return (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 items-stretch">
            {/* Profile Card (2fr) — read-only identity + info grid */}
            <div className="bg-[hsl(var(--card))] border border-solid border-[hsl(var(--border))] rounded-2xl p-6 flex flex-col gap-6">
                {/* Identity row */}
                <div className="flex items-center gap-4">
                    <div
                        className="relative size-[72px] rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-[0_0_0_3px_hsl(var(--info)/0.3)]"
                        style={{ backgroundColor: 'hsl(var(--info))' }}
                    >
                        {avatarUrl ? (
                            <Image
                                src={avatarUrl}
                                alt={displayName}
                                fill
                                className="object-cover"
                                unoptimized
                                onError={() => setImgFailed(true)}
                            />
                        ) : (
                            <span className="text-[30px] font-semibold !text-white select-none leading-none">{initial}</span>
                        )}
                    </div>
                    <div className="flex gap-3 items-center flex-wrap min-w-0">
                        <span className="text-[22px] font-bold text-[hsl(var(--foreground))] tracking-[-0.4px] leading-7">
                            {displayName}
                        </span>
                        <div className="bg-[hsl(var(--primary)/0.1)] border border-solid border-[hsl(var(--primary)/0.2)] px-[13px] py-[5px] rounded-[12px] flex-shrink-0">
                            <span className="text-[hsl(var(--primary))] text-[10px] font-black uppercase tracking-[1px]">
                                {t.profile.banner.roleOwner}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Divider + read-only info grid */}
                <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label={t.profile.general.email} value={user.email} />
                    <Field label={t.profile.general.phone} value={user.phone || '—'} />
                    <Field
                        label={t.profile.owner.passwordLabel}
                        value={
                            <span className="tracking-[2px] text-[hsl(var(--muted-foreground))]">
                                &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                            </span>
                        }
                    />
                </div>
            </div>

            {/* SSO Widget (1fr) — single unified exit path to SSO portal */}
            <div className="rounded-2xl p-6 flex flex-col gap-3 bg-[hsl(var(--info)/0.08)] border border-solid border-[hsl(var(--info)/0.2)]">
                <div className="size-11 rounded-xl bg-[hsl(var(--info)/0.15)] flex items-center justify-center">
                    <Lock className="size-[22px] text-[hsl(var(--info))]" aria-hidden />
                </div>
                <h2 className="text-[18px] font-bold leading-6 text-[hsl(var(--foreground))]">
                    {t.profile.sso.widgetTitle}
                </h2>
                <p className="text-[13px] leading-5 text-[hsl(var(--muted-foreground))]">
                    {t.profile.sso.widgetDescription}
                </p>

                {ssoUrl ? (
                    <a
                        href={ssoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--info))] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
                    >
                        {t.profile.sso.goToPortal}
                        <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                    </a>
                ) : (
                    <div className="mt-auto flex flex-col gap-2">
                        <span
                            aria-disabled="true"
                            className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-[14px] font-semibold cursor-not-allowed"
                        >
                            {t.profile.sso.goToPortal}
                            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                        </span>
                        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                            {t.profile.sso.urlMissing}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
