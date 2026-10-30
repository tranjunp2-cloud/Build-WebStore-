import { AiSettingsTabs } from '../_components/ai-settings-tabs'

export default function Loading() {
    return (
        <div className="page aiq-page" aria-busy="true">
            <div className="page-head" style={{ marginBottom: 12 }}>
                <div>
                    <h1 className="page-title">AI settings</h1>
                    <p className="page-sub">Loading settings…</p>
                </div>
            </div>
            <AiSettingsTabs active="limits" />
            {[1, 2, 3].map((n) => (
                <section key={n} className="aiq-card" style={{ height: 160, margin: '12px 0', opacity: 0.5 }} />
            ))}
        </div>
    )
}
