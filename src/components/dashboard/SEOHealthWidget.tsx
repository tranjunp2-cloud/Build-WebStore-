'use client'

import Link from 'next/link'
import { Activity, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/i18n'

export function SEOHealthWidget({ score }: { score: number }) {
    const { t } = useI18n()
    const isGood = score >= 80

    return (
        <div className="flex flex-col rounded-xl border border-white/10 bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-purple-400" />
                <h3 className="font-bold text-white">{t.dashboard.overview.seo.title}</h3>
            </div>

            <div className="flex items-end gap-3 mb-6">
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-sky-400">
                    {score}
                </div>
                <div className="text-sm text-gray-400 mb-1">/ 100</div>
            </div>

            <div className={`flex items-center gap-2 text-sm font-medium mb-6 ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isGood ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {isGood ? t.dashboard.overview.seo.statusGood : t.dashboard.overview.seo.statusWarning}
            </div>

            <div className="mt-auto">
                <Link 
                    href="/dashboard/seo"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors border border-white/10"
                >
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    {t.dashboard.overview.seo.fixAll}
                </Link>
            </div>
        </div>
    )
}
