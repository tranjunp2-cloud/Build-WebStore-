import { ChevronRight, Info } from 'lucide-react'
import type { GatewayView } from '@/lib/admin/ai-providers/types'

interface Props {
    gateway: GatewayView
    baseUrl: string
    paths: Record<string, string>
    problem?: string
    onBaseUrl: (url: string) => void
    onPath: (provider: string, path: string) => void
    onToken: () => void
    onRemoveToken: () => void
}

/** Optional gateway (for example Cloudflare AI Gateway) in front of every provider. Collapsed: most installs never use it. */
export function GatewayCard({ gateway, baseUrl, paths, problem, onBaseUrl, onPath, onToken, onRemoveToken }: Props) {
    const on = Boolean(gateway.baseUrl)
    return (
        <section className="aiq-card" aria-label="Gateway">
            <details className="pm-adv">
                <summary>
                    <ChevronRight className="pm-ic" aria-hidden="true" />
                    <div><b>Gateway · advanced</b><span>{on ? `On: every call goes through ${gateway.baseUrl}` : 'Off. Calls go straight to each provider.'}</span></div>
                </summary>
                <div className="pm-adv-body">
                    <dl className="pm-dl">
                        <dt>Base URL</dt>
                        <dd>
                            <input className="input pm-in pm-mono pm-grow" value={baseUrl} onChange={(e) => onBaseUrl(e.target.value)} aria-label="Gateway base URL" placeholder="https://gateway.ai.cloudflare.com/v1/<account>/<gateway>" aria-invalid={problem ? true : undefined} />
                            {problem && <span className="pm-err pm-small" role="alert">{problem}</span>}
                        </dd>
                        <dt>Token</dt>
                        <dd>
                            <span className="pm-grow pm-dim">{gateway.tokenSet ? 'Set' : 'Not set'}</span>
                            <button type="button" className="btn btn-sm" onClick={onToken}>{gateway.tokenSet ? 'Replace token' : 'Add token'}</button>
                            {gateway.tokenSet && <button type="button" className="btn btn-sm btn-ghost" onClick={onRemoveToken}>Remove token</button>}
                        </dd>
                        <dt>Paths</dt>
                        <dd>
                            <div className="pm-paths pm-grow">
                                {Object.entries(paths).map(([id, path]) => (
                                    <label key={id}>{id}<input className="input pm-in pm-mono" value={path} onChange={(e) => onPath(id, e.target.value)} /></label>
                                ))}
                            </div>
                        </dd>
                    </dl>
                    <p className="pm-note" style={{ padding: '0 16px 14px' }}><Info className="pm-ic" aria-hidden="true" />Leave the base URL empty to call providers directly. Paths are added after the base URL, one per provider.</p>
                </div>
            </details>
        </section>
    )
}
