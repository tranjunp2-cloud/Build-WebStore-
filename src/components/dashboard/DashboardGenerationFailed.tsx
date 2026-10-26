'use client'

import Link from 'next/link'
import { useI18n } from '@/i18n'
import { Mascot } from '@/mascot'

export function DashboardGenerationFailed() {
    const { t } = useI18n()

    return (
        <div className="flex w-full flex-col items-center justify-center p-8">
            <div className="flex flex-col items-center gap-[18px]">
                {/* Illustration */}
                <Mascot scene="maintenance" size={260} className="max-w-full" label={t.mascot.generationIllustration} />

                {/* Heading */}
                <h2 className="m-0 text-center text-[30px] font-extrabold leading-[36px] tracking-[-0.75px] text-[hsl(var(--foreground))]">
                    {t.dashboard.generationFailed.title}
                </h2>

                {/* Description */}
                <p className="m-0 max-w-[421px] text-center text-[16px] font-medium leading-[26px] text-[hsl(var(--muted-foreground))]">
                    {t.dashboard.generationFailed.description}
                </p>

                {/* Action Stack — only buttons constrained to 448px */}
                <div className="flex w-full max-w-[448px] flex-col">
                    {/* Primary: Choose template */}
                    <Link
                        href="/templates"
                        className="relative flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] no-underline shadow-[0px_0px_40px_-10px_hsl(var(--primary)/0.15)] transition-all hover:brightness-110"
                        style={{
                            backgroundImage: 'linear-gradient(90deg, hsl(var(--info)) 0%, hsl(var(--primary)) 100%)',
                        }}
                    >
                        <svg className="h-[13px] w-[18px]" viewBox="0 0 17.9167 13.3333" fill="#DDE2F8">
                            <path d="M1.66667 13.3333C1.20833 13.3333 0.815972 13.1701 0.489583 12.8438C0.163194 12.5174 0 12.125 0 11.6667V1.66667C0 1.20833 0.163194 0.815972 0.489583 0.489583C0.815972 0.163194 1.20833 0 1.66667 0H6.66667L8.33333 1.66667H15C15.4583 1.66667 15.8507 1.82986 16.1771 2.15625C16.5035 2.48264 16.6667 2.875 16.6667 3.33333H7.64583L5.97917 1.66667H1.66667V1.66667V1.66667V11.6667V11.6667V11.6667L3.66667 5H17.9167L15.7708 12.1458C15.6597 12.5069 15.4549 12.7951 15.1562 13.0104C14.8576 13.2257 14.5278 13.3333 14.1667 13.3333H1.66667V13.3333M3.41667 11.6667H14.1667L15.6667 6.66667H4.91667L3.41667 11.6667V11.6667M3.41667 11.6667L4.91667 6.66667V6.66667L3.41667 11.6667V11.6667V11.6667M1.66667 3.33333V1.66667V1.66667V1.66667V1.66667V3.33333V3.33333V3.33333" />
                        </svg>
                        <span className="text-[16px] font-semibold !text-white">
                            {t.dashboard.generationFailed.chooseTemplate}
                        </span>
                    </Link>

                    {/* Secondary: Try again with AI */}
                    <div className="pt-3">
                        <Link
                            href="/builder/new"
                            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] border border-[hsl(var(--border)/0.2)] bg-[hsl(var(--secondary))] no-underline transition-all hover:brightness-110"
                        >
                            <svg className="size-[13px]" viewBox="0 0 13.3333 13.3333" fill="white">
                                <path d="M6.66667 13.3333C4.80556 13.3333 3.22917 12.6875 1.9375 11.3958C0.645833 10.1042 0 8.52778 0 6.66667C0 4.80556 0.645833 3.22917 1.9375 1.9375C3.22917 0.645833 4.80556 0 6.66667 0C7.625 0 8.54167 0.197917 9.41667 0.59375C10.2917 0.989583 11.0417 1.55556 11.6667 2.29167V0H13.3333V5.83333H7.5V4.16667H11C10.5556 3.38889 9.94792 2.77778 9.17708 2.33333C8.40625 1.88889 7.56944 1.66667 6.66667 1.66667C5.27778 1.66667 4.09722 2.15278 3.125 3.125C2.15278 4.09722 1.66667 5.27778 1.66667 6.66667C1.66667 8.05556 2.15278 9.23611 3.125 10.2083C4.09722 11.1806 5.27778 11.6667 6.66667 11.6667C7.73611 11.6667 8.70139 11.3611 9.5625 10.75C10.4236 10.1389 11.0278 9.33333 11.375 8.33333H13.125C12.7361 9.80556 11.9444 11.0069 10.75 11.9375C9.55556 12.8681 8.19444 13.3333 6.66667 13.3333V13.3333" />
                            </svg>
                            <span className="text-[16px] font-bold !text-white">
                                {t.dashboard.generationFailed.retryAi}
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
