'use client'

import { useState } from 'react'
import type { BusinessInfo } from '@/store/builderStore'

interface ExtractionReviewProps {
    extractedData: {
        businessName: string
        industry: string
        shortDescription: string
        products: string
    }
    onApply: (data: Partial<BusinessInfo>) => void
    onSkip: () => void
}

export function ExtractionReview({ extractedData, onApply, onSkip }: ExtractionReviewProps) {
    const [data, setData] = useState(extractedData)

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <h3 className="text-sm font-semibold text-blue-300">Review extracted info</h3>
                <p className="mt-1 text-xs text-slate-400">Edit any fields before applying to your form.</p>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="text-[11px] font-medium text-slate-400">Business Name</label>
                    <input
                        type="text"
                        value={data.businessName}
                        onChange={(e) => setData({ ...data, businessName: e.target.value })}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-medium text-slate-400">Industry</label>
                    <input
                        type="text"
                        value={data.industry}
                        onChange={(e) => setData({ ...data, industry: e.target.value })}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-medium text-slate-400">Description</label>
                    <textarea
                        value={data.shortDescription}
                        onChange={(e) => setData({ ...data, shortDescription: e.target.value })}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-medium text-slate-400">Products / Services</label>
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
                    Skip & enter manually
                </button>
                <button
                    type="button"
                    onClick={() => onApply(data)}
                    className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                    Apply to form
                </button>
            </div>
        </div>
    )
}
