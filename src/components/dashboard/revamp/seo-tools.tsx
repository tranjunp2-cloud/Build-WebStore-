'use client'

/**
 * SEO automation — sitemap resubmit + auto-meta toggle (both real, persisted).
 * Ports the design SeoTools styling; wires the existing /api/seo endpoints.
 * All text driven by t.dashboard.revamp.tools.*
 */
import { useState } from 'react'
import { Network, TextSearch, Zap, RefreshCw, Loader2, Bot } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { SectionHead, HelpTip } from './atoms'

export function SeoTools({
    siteId, autoMetaEnabled, aiCrawlersEnabled,
}: {
    siteId: string | number | null; autoMetaEnabled: boolean; aiCrawlersEnabled: boolean
}) {
    const { t, ti } = useI18n()
    const toolsT = t.dashboard.revamp.tools

    const [autoMeta, setAutoMeta] = useState(autoMetaEnabled)
    const [savingMeta, setSavingMeta] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [aiCrawlers, setAiCrawlers] = useState(aiCrawlersEnabled)
    const [savingAiCrawlers, setSavingAiCrawlers] = useState(false)

    const toggleMeta = async () => {
        if (!siteId || savingMeta) return
        const next = !autoMeta
        setAutoMeta(next)
        setSavingMeta(true)
        try {
            const res = await fetch('/api/seo/auto-meta-toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: String(siteId), enabled: next }),
            })
            if (!res.ok) throw new Error('failed')
            toast.success(next ? toolsT.metaOn : toolsT.metaOff)
        } catch {
            setAutoMeta(!next)
            toast.error(toolsT.metaError)
        } finally {
            setSavingMeta(false)
        }
    }

    const toggleAiCrawlers = async () => {
        if (!siteId || savingAiCrawlers) return
        const next = !aiCrawlers
        setAiCrawlers(next)
        setSavingAiCrawlers(true)
        try {
            const res = await fetch('/api/seo/ai-crawlers-toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: String(siteId), enabled: next }),
            })
            if (!res.ok) throw new Error('failed')
            toast.success(next ? toolsT.aiCrawlersOn : toolsT.aiCrawlersOff)
        } catch {
            setAiCrawlers(!next)
            toast.error(toolsT.aiCrawlersError)
        } finally {
            setSavingAiCrawlers(false)
        }
    }

    const generateSitemap = async () => {
        if (!siteId || generating) return
        setGenerating(true)
        try {
            const res = await fetch('/api/seo/sitemap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: String(siteId) }),
            })
            const data = await res.json()
            if (data.success) {
                const count = data.data?.pageCount ?? 0
                toast.success(count > 0 ? ti(toolsT.sitemapDone, { count }) : toolsT.sitemapRegenerated)
            } else {
                toast.error(toolsT.sitemapError)
            }
        } catch {
            toast.error(toolsT.sitemapError)
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="section">
            <SectionHead icon="wrench" title={toolsT.title} sub={toolsT.subtitle} />

            <div className="card tool-card automation-list">
                {/* Sitemap */}
                <div className="auto-row">
                    <span className="sw-ic"><Network aria-hidden /></span>
                    <div className="sw-text">
                        <div className="t">
                            {toolsT.sitemap}
                            <HelpTip tip={toolsT.sitemapTip} />
                        </div>
                        <div className="d">{toolsT.sitemapDesc}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={generateSitemap} disabled={!siteId || generating}>
                        {generating ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                        {toolsT.resubmit}
                    </button>
                </div>

                {/* Auto meta */}
                <div className="auto-row">
                    <span className="sw-ic"><TextSearch aria-hidden /></span>
                    <div className="sw-text">
                        <div className="t">
                            {toolsT.autoMeta}
                            <HelpTip tip={toolsT.autoMetaTip} />
                            {autoMeta && <span className="active-badge"><Zap aria-hidden />{toolsT.active}</span>}
                        </div>
                        <div className="d">{toolsT.autoMetaDesc}</div>
                    </div>
                    <div
                        className={`switch ${autoMeta ? 'on' : ''}`}
                        role="switch"
                        aria-checked={autoMeta}
                        aria-label={toolsT.autoMeta}
                        tabIndex={0}
                        onClick={toggleMeta}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMeta() } }}
                        style={savingMeta ? { cursor: 'wait' } : undefined}
                    />
                </div>

                {/* AI crawlers */}
                <div className="auto-row">
                    <span className="sw-ic"><Bot aria-hidden /></span>
                    <div className="sw-text">
                        <div className="t">
                            {toolsT.aiCrawlers}
                            <HelpTip tip={toolsT.aiCrawlersTip} />
                            {aiCrawlers && <span className="active-badge"><Zap aria-hidden />{toolsT.active}</span>}
                        </div>
                        <div className="d">{toolsT.aiCrawlersDesc}</div>
                    </div>
                    <div
                        className={`switch ${aiCrawlers ? 'on' : ''}`}
                        role="switch"
                        aria-checked={aiCrawlers}
                        aria-label={toolsT.aiCrawlers}
                        tabIndex={0}
                        onClick={toggleAiCrawlers}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAiCrawlers() } }}
                        style={savingAiCrawlers ? { cursor: 'wait' } : undefined}
                    />
                </div>
            </div>
        </div>
    )
}
