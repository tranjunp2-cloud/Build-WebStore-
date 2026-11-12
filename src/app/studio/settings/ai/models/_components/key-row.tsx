import { CircleAlert } from 'lucide-react'
import { fmtWhen } from '@/lib/admin/ai-providers/format'
import { ENV_KEY } from '@/lib/admin/ai-providers/status'
import type { ProviderView } from '@/lib/admin/ai-providers/types'

export type KeyMode = 'add' | 'replace' | 'reentry' | 'override'

interface Props {
    provider: ProviderView
    onKey: (mode: KeyMode) => void
    onRemove: () => void
}

/** API key line of a provider: only the last 4 characters are ever shown. */
export function KeyRow({ provider, onKey, onRemove }: Props) {
    const { key } = provider
    if (key.state === 'none') {
        return <><span className="pm-grow pm-dim">Not set</span><button type="button" className="btn btn-sm" onClick={() => onKey('add')}>Add key</button></>
    }
    if (key.state === 'needs-reentry') {
        return (
            <>
                <span className="pm-grow pm-reentry"><CircleAlert className="pm-ic" aria-hidden="true" /> Can&apos;t be read after the secret key changed. Paste it again.</span>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onKey('reentry')}>Re-enter key</button>
            </>
        )
    }
    const masked = <span className="pm-key">•••• {key.last4 ?? ''}</span>
    if (key.state === 'env') {
        return (
            <>
                <span className="pm-grow">{masked} <span className="pm-keymeta">from {ENV_KEY[provider.id] ?? 'an environment variable'} in the environment</span></span>
                <button type="button" className="btn btn-sm" onClick={() => onKey('override')}>Set key in Studio</button>
            </>
        )
    }
    return (
        <>
            <span className="pm-grow">{masked} <span className="pm-keymeta">set by {key.setBy ?? 'an admin'}{key.setAt ? ` on ${fmtWhen(key.setAt)}` : ''}</span></span>
            <button type="button" className="btn btn-sm" onClick={() => onKey('replace')}>Replace</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onRemove}>Remove</button>
        </>
    )
}
