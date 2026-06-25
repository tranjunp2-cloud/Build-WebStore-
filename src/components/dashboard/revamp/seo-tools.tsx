'use client'

/**
 * SEO automation — sitemap resubmit + auto-meta toggle (both real, persisted).
 * Ports the design SeoTools styling; wires the existing /api/seo endpoints.
 * Auto-alt row from the design is omitted (no backend yet) rather than faked.
 */
import { useState } from 'react'
import { Network, TextSearch, Zap, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SectionHead, HelpTip } from './atoms'

export function SeoTools({ siteId, autoMetaEnabled }: { siteId: string | number | null; autoMetaEnabled: boolean }) {
    const [autoMeta, setAutoMeta] = useState(autoMetaEnabled)
    const [savingMeta, setSavingMeta] = useState(false)
    const [generating, setGenerating] = useState(false)

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
            toast.success(next ? 'Auto meta tags turned on' : 'Auto meta tags turned off')
        } catch {
            setAutoMeta(!next)
            toast.error('Could not update setting')
        } finally {
            setSavingMeta(false)
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
                toast.success(count > 0 ? `Sitemap submitted — ${count} URLs sent to Google` : 'Sitemap regenerated')
            } else {
                toast.error('Could not generate sitemap')
            }
        } catch {
            toast.error('Could not generate sitemap')
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="section">
            <SectionHead icon="wrench" title="SEO action tools" sub="AI works quietly in the background so customers can find your store on Google" />

            <div className="card tool-card automation-list">
                {/* Sitemap */}
                <div className="auto-row">
                    <span className="sw-ic"><Network aria-hidden /></span>
                    <div className="sw-text">
                        <div className="t">
                            Sitemap
                            <HelpTip tip="A sitemap lists every page in your store. We hand it to Google so it can find and list all your products." />
                        </div>
                        <div className="d">Submit your sitemap so Google can discover and index all your pages.</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={generateSitemap} disabled={!siteId || generating}>
                        {generating ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                        Resubmit to Google
                    </button>
                </div>

                {/* Auto meta */}
                <div className="auto-row">
                    <span className="sw-ic"><TextSearch aria-hidden /></span>
                    <div className="sw-text">
                        <div className="t">
                            Auto-write search titles &amp; descriptions
                            <HelpTip tip="This is the headline customers see on Google. AI writes a short, tempting one for every page automatically." />
                            {autoMeta && <span className="active-badge"><Zap aria-hidden />Active</span>}
                        </div>
                        <div className="d">AI writes short, catchy titles that draw customers in when they search on Google.</div>
                    </div>
                    <div
                        className={`switch ${autoMeta ? 'on' : ''}`}
                        role="switch"
                        aria-checked={autoMeta}
                        aria-label="Auto-write search titles and descriptions"
                        onClick={toggleMeta}
                        style={savingMeta ? { cursor: 'wait' } : undefined}
                    />
                </div>
            </div>
        </div>
    )
}
