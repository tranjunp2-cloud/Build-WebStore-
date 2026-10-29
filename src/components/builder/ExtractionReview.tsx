'use client'

import { useState } from 'react'
import type { BusinessInfo } from '@/store/builderStore'
import { useI18n } from '@/i18n'

interface ExtractionReviewProps {
    extractedData: {
        businessName: string
        industry: string
        shortDescription: string
        products: string
    }
    /** Real customer reviews / FAQ answers found on the page — they are used on the new site as they are */
    testimonialCount?: number
    faqCount?: number
    onApply: (data: Partial<BusinessInfo>) => void
    onSkip: () => void
}

export function ExtractionReview({ extractedData, testimonialCount = 0, faqCount = 0, onApply, onSkip }: ExtractionReviewProps) {
    const { t, ti } = useI18n()
    const r = t.onboarding.form.extractionReview
    const [data, setData] = useState(extractedData)
    const hasRealContent = testimonialCount > 0 || faqCount > 0

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <h3 className="text-sm font-semibold text-blue-300">{r.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{r.subtitle}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4" role="status">
                {hasRealContent ? (
                    <>
                        <h4 className="text-xs font-semibold text-slate-200">{r.realContentTitle}</h4>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-slate-300">
                            {testimonialCount > 0 ? <li>{ti(r.testimonialsFound, { count: testimonialCount })}</li> : null}
                            {faqCount > 0 ? <li>{ti(r.faqFound, { count: faqCount })}</li> : null}
                        </ul>
                        <p className="mt-1.5 text-xs text-slate-400">{r.realContentNote}</p>
                    </>
                ) : (
                    <p className="text-xs text-slate-400">{r.noRealContent}</p>
                )}
            </div>

            <div className="space-y-3">
                <div>
                    <label className="text-[11px] font-medium text-slate-400">{r.businessName}</label>
                    <input
                        type="text"
                        value={data.businessName}
                        onChange={(e) => setData({ ...data, businessName: e.target.value })}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-medium text-slate-400">{r.industry}</label>
                    <input
                        type="text"
                        value={data.industry}
                        onChange={(e) => setData({ ...data, industry: e.target.value })}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-medium text-slate-400">{r.description}</label>
                    <textarea
                        value={data.shortDescription}
                        onChange={(e) => setData({ ...data, shortDescription: e.target.value })}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-medium text-slate-400">{r.products}</label>
                    <textarea
                        value={data.products}
                        onChange={(e) => setData({ ...data, products: e.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none"
                    />
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onSkip}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                    {r.skip}
                </button>
                <button
                    type="button"
                    onClick={() => onApply(data)}
                    className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                    {r.apply}
                </button>
            </div>
        </div>
    )
}
