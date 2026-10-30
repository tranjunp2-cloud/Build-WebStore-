/**
 * /studio/settings/ai/models/** — Providers & models: tab bar (Limits & prices | Providers & models), left rail, then the page.
 * The rail's problem counts load in a Suspense boundary, so this shell renders even while ai-platform is slow or down.
 */
import { Suspense, type ReactNode } from 'react'
import { AiSettingsTabs } from '../../_components/ai-settings-tabs'
import { ModelsRail } from './_components/models-rail'
import { RailWithBadges } from './_components/rail-with-badges'
import './_styles/pm-layout.css'
import './_styles/pm-providers.css'
import './_styles/pm-edit.css'

export default function ModelsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="page pm-page">
            <div className="page-head">
                <div>
                    <h1 className="page-title">AI settings</h1>
                    <p className="page-sub">Limits, prices, providers and models for every AI call. Changes to providers and models take effect within 1 min, no redeploy.</p>
                </div>
            </div>
            <AiSettingsTabs active="models" />
            <div className="pm-layout">
                <div className="pm-secnav-wrap">
                    <Suspense fallback={<ModelsRail badges={{ providers: 0, routing: 0 }} />}><RailWithBadges /></Suspense>
                </div>
                <div className="pm-secs">{children}</div>
            </div>
        </div>
    )
}
