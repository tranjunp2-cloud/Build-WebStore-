import { Settings } from 'lucide-react'
import { ComingSoonEmpty } from '../_components/coming-soon-empty'

export const metadata = { title: 'Settings' }

export default function SettingsPage() {
    return (
        <div style={{ padding: 'var(--pad)' }}>
            <ComingSoonEmpty
                icon={Settings}
                title="Settings"
                description="Admin preferences, API keys, integration configuration."
            />
        </div>
    )
}
