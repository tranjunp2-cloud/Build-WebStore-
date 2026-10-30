import { Switch } from '@/app/studio/_components/ai-limits/switch'
import { providerStatus } from '@/lib/admin/ai-providers/status'
import type { ProviderView, Source, TestResult } from '@/lib/admin/ai-providers/types'
import { SourceBadge, ToneBadge } from './badges'
import { KeyRow, type KeyMode } from './key-row'
import { TestRow } from './test-row'

const KEY_SOURCE: Record<ProviderView['key']['state'], Source> = { set: 'studio', 'needs-reentry': 'studio', env: 'env', none: 'none' }
const initials = (p: ProviderView) => p.label.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()

interface Props {
    provider: ProviderView
    enabled: boolean
    baseUrl: string
    problem?: string
    priced: ReadonlySet<string> | null
    test: { result: TestResult | null; running: boolean; error?: string | null }
    onEnabled: (on: boolean) => void
    onBaseUrl: (url: string) => void
    onKey: (mode: KeyMode) => void
    onRemoveKey: () => void
    onTest: () => void
    onDetails: () => void
}

/** Known models of the provider; a dashed chip means no price in Limits & prices (usage counts $0). */
function ModelChips({ provider, priced }: { provider: ProviderView; priced: ReadonlySet<string> | null }) {
    if (provider.models.length === 0) return <span className="pm-dim pm-small">Models appear here once a chain or the price book mentions them.</span>
    return (
        <span className="pm-chips">
            {provider.models.map((model) => {
                const unpriced = priced !== null && !priced.has(`${provider.id}:${model}`)
                return (
                    <span key={model} className="pm-chip" data-unpriced={unpriced ? '' : undefined} title={unpriced ? 'No price in Limits & prices: usage counts $0' : undefined}>
                        {model}{unpriced && <> <i>no price</i></>}
                    </span>
                )
            })}
        </span>
    )
}

export function ProviderCard({ provider: p, enabled, baseUrl, problem, priced, test, onEnabled, onBaseUrl, onKey, onRemoveKey, onTest, onDetails }: Props) {
    const status = providerStatus({ ...p, enabled })
    const noKey = p.key.state === 'none'
    return (
        <section className="aiq-card pm-prov" data-off={enabled ? undefined : ''} aria-label={p.label}>
            <div className="pm-prov-head">
                <span className="pm-tile">{initials(p)}</span>
                <div className="pm-prov-name"><b id={`pm-name-${p.id}`}>{p.label}</b><SourceBadge source={KEY_SOURCE[p.key.state]} /><ToneBadge tone={status.tone}>{status.text}</ToneBadge></div>
                <Switch checked={enabled} onChange={onEnabled} disabled={noKey} labelledBy={`pm-name-${p.id}`}>{enabled ? 'On' : 'Off'}</Switch>
            </div>
            <dl className="pm-dl">
                <dt>API key</dt><dd><KeyRow provider={p} onKey={onKey} onRemove={onRemoveKey} /></dd>
                {noKey && <><dt /><dd className="pm-small pm-dim">Add a key to turn {p.label} on.</dd></>}
                <dt>Base URL</dt>
                <dd>
                    <input
                        className="input pm-in pm-mono pm-grow" value={baseUrl} onChange={(e) => onBaseUrl(e.target.value)} aria-label={`${p.label} base URL`}
                        placeholder={p.baseUrlSource === 'env' && p.baseUrl ? `Environment: ${p.baseUrl}` : p.defaultBaseUrl ? `Default: ${p.defaultBaseUrl}` : 'Default'} aria-invalid={problem ? true : undefined}
                    />
                    {problem && <span className="pm-err pm-small" role="alert">{problem}</span>}
                </dd>
                <dt>Test</dt><dd><TestRow provider={p} result={test.result} running={test.running} error={test.error} onTest={onTest} onDetails={onDetails} /></dd>
                <dt>Models</dt><dd><ModelChips provider={p} priced={priced} /></dd>
            </dl>
        </section>
    )
}
