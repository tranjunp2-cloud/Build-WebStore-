import Link from 'next/link'
import './settings-tabs.css'

/** "Limits & prices | Providers & models" — shown on every AI settings page. */
export function AiSettingsTabs({ active }: { active: 'limits' | 'models' }) {
    return (
        <div className="pm-tabwrap">
            <nav className="pm-tabs" aria-label="AI settings pages">
                <Link href="/studio/settings/ai" aria-current={active === 'limits' ? 'page' : undefined}>Limits &amp; prices</Link>
                <Link href="/studio/settings/ai/models/overview" aria-current={active === 'models' ? 'page' : undefined}>Providers &amp; models</Link>
            </nav>
        </div>
    )
}
