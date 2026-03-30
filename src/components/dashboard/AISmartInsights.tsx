'use client'

import { Sparkles, TrendingUp, TrendingDown, Info } from 'lucide-react'

type Props = {
    views: number
    prevViews: number
}

export function AISmartInsights({ views, prevViews }: Props) {
    if (views === 0 && prevViews === 0) return null
    
    let message = ''
    let type: 'up' | 'down' | 'neutral'
    
    if (prevViews === 0 && views > 0) {
        message = "Traffic is picking up! You have new visitors compared to the previous period."
        type = 'up'
    } else {
        const diff = views - prevViews
        const percent = Math.round((Math.abs(diff) / prevViews) * 100)
        
        if (diff > 0) {
            message = `Trending: Traffic is up ${percent}% compared to the previous period.`
            type = 'up'
            if (percent > 50) message = `🚀 Viral alert! Traffic has surged by ${percent}% recently.`
        } else if (diff < 0) {
            message = `Traffic dropped by ${percent}% compared to the previous period. Consider checking your SEO or running a campaign.`
            type = 'down'
            if (percent > 30) message = `⚠️ Warning: Significant traffic drop (${percent}%). Check your site's health and SEO rankings.`
        } else {
            message = "Traffic is stable compared to the previous period."
            type = 'neutral'
        }
    }

    return (
        <div className="flex items-start gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-purple-100 shadow-sm">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
            <div className="flex-1">
                <p className="font-semibold text-white">AI Smart Insight</p>
                <p className="mt-1 flex items-center gap-1.5 text-gray-300">
                    {type === 'up' && <TrendingUp className="h-4 w-4 text-emerald-400" />}
                    {type === 'down' && <TrendingDown className="h-4 w-4 text-rose-400" />}
                    {type === 'neutral' && <Info className="h-4 w-4 text-blue-400" />}
                    {message}
                </p>
            </div>
        </div>
    )
}
