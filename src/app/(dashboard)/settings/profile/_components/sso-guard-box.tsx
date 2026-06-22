'use client'

import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'

type Props = {
    ssoUrl: string
    variant?: 'general' | 'security'
}

export function SsoGuardBox({ ssoUrl, variant = 'general' }: Props) {
    const { t } = useI18n()
    const s = t.profile.sso

    const isGeneral = variant === 'general'
    const title = isGeneral ? s.generalTitle : s.securityTitle
    const notice = isGeneral ? s.generalNotice : s.securityNotice
    const linkText = isGeneral ? s.generalLink : s.securityLink

    return (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-[12px] p-[24px] w-full">
            <div className="flex flex-col gap-3">
                <h2 className="text-[24px] font-bold text-white leading-8">{title}</h2>
                <div className="flex flex-col items-start">
                    <p className="text-[16px] text-[hsl(var(--muted-foreground))] leading-6">{notice}</p>
                    {ssoUrl ? (
                        <a
                            href={ssoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 py-2 text-[16px] font-medium text-[hsl(var(--info))] underline decoration-solid hover:text-[hsl(var(--info)/0.8)] transition-colors"
                        >
                            <span>{linkText}</span>
                            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
                        </a>
                    ) : (
                        <span className="inline-flex items-center gap-1 py-2 text-[16px] font-medium text-[hsl(var(--info)/0.5)] underline decoration-solid cursor-not-allowed">
                            {linkText} <ArrowRight className="w-4 h-4 shrink-0" aria-hidden />
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
