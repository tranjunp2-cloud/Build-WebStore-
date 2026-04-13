'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

export function GenerateSitemapButton({ siteId }: { siteId: string | number }) {
    const { t, ti } = useI18n()
    const [loading, setLoading] = useState(false)
    const seo = t.dashboard.seo

    const handleClick = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/seo/sitemap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: String(siteId) }),
            })
            const data = await res.json()
            if (data.success) {
                const count = data.data?.pageCount ?? 0
                toast.success(count > 0
                    ? ti(seo.sitemapCount, { count })
                    : seo.sitemapEmpty)
            } else {
                toast.error(seo.sitemapError)
            }
        } catch {
            toast.error(seo.sitemapError)
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="flex items-center justify-center px-[16px] pt-[8.5px] pb-[9px] bg-transparent border border-solid border-[#374151] text-white rounded-[8px] font-semibold text-[13px] leading-[1.21em] hover:!border-[#3B82F6] hover:text-[#3B82F6] transition-colors disabled:opacity-50"
        >
            {loading ? `⏳ ${seo.generating}` : `🗺️ ${seo.generateSitemap}`}
        </button>
    )
}
