import { BarChart2 } from 'lucide-react'
import { ComingSoonEmpty } from '../_components/coming-soon-empty'

export const metadata = { title: 'Analytics' }

export default function AnalyticsPage() {
    return (
        <div style={{ padding: 'var(--pad)' }}>
            <ComingSoonEmpty
                icon={BarChart2}
                title="Analytics"
                description="Deep-dive reports on generation quality, user behavior, and content performance."
                ctaHref="/studio/performance"
                ctaLabel="View AI quality metrics"
            />
        </div>
    )
}
