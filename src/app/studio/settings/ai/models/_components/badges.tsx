import type { Source } from '@/lib/admin/ai-providers/types'
import type { Tone } from '@/lib/admin/ai-providers/status'

const SOURCE: Record<Source, { text: string; tone: string }> = {
    studio: { text: 'Studio', tone: 'acl-tone-info' },
    env: { text: 'Environment', tone: 'acl-tone-mute' },
    default: { text: 'Default', tone: 'acl-tone-mute' },
    none: { text: 'Not set', tone: 'acl-tone-mute' },
}

/** Where a value comes from: Studio (saved here), Environment (Vercel env), Default (code). */
export function SourceBadge({ source }: { source: Source }) {
    return <span className={`badge ${SOURCE[source].tone} pm-nodot`}>{SOURCE[source].text}</span>
}

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
    return <span className={`badge acl-tone-${tone}`}>{children}</span>
}
