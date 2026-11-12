import { Plus, Server } from 'lucide-react'
import { Switch } from '@/app/studio/_components/ai-limits/switch'
import { providerStatus } from '@/lib/admin/ai-providers/status'
import type { ProviderView, TestResult } from '@/lib/admin/ai-providers/types'
import { ToneBadge } from './badges'
import type { KeyMode } from './key-row'
import { TestRow } from './test-row'

interface Props {
    endpoints: ProviderView[]
    enabled: Record<string, boolean>
    baseUrl: Record<string, string>
    options: Record<string, { reasoning: boolean; structuredOutputs: boolean }>
    problems: Record<string, string>
    tests: Record<string, { result: TestResult | null; running: boolean; error?: string | null }>
    onEnabled: (id: string, on: boolean) => void
    onBaseUrl: (id: string, url: string) => void
    onOption: (id: string, option: 'reasoning' | 'structuredOutputs', on: boolean) => void
    onKey: (id: string, mode: KeyMode) => void
    onRemove: (id: string) => void
    onTest: (id: string) => void
    onDetails: (id: string) => void
    onAdd: () => void
}

/** Any OpenAI-compatible server (self-hosted, proxies). Its models show as compat-<name>:<model> in chains. */
export function EndpointsCard(props: Props) {
    const { endpoints, enabled, baseUrl, options, problems, tests } = props
    return (
        <section className="aiq-card" aria-label="Custom endpoints">
            <div className="aiq-card-head">
                <div>
                    <div className="aiq-card-title">Custom endpoints</div>
                    <div className="aiq-card-sub">Any OpenAI-compatible server (self-hosted, proxies). Its models show as compat-&lt;name&gt;:&lt;model&gt; in chains.</div>
                </div>
                <button type="button" className="btn btn-sm" onClick={props.onAdd}><Plus className="pm-ic" aria-hidden="true" />Add endpoint</button>
            </div>
            {endpoints.length === 0
                ? <p className="pm-empty">No custom endpoints yet. Add one to use a self-hosted or regional model.</p>
                : <ul className="pm-rows">
                    {endpoints.map((e) => {
                        const status = providerStatus({ ...e, enabled: enabled[e.id] })
                        const test = tests[e.id] ?? { result: e.lastTest, running: false }
                        return (
                            <li key={e.id}>
                                <span className="pm-tile"><Server className="pm-ic" aria-hidden="true" /></span>
                                <div className="pm-row-main">
                                    <div className="pm-ep-name"><b id={`pm-name-${e.id}`} className="pm-mono">{e.id}</b><ToneBadge tone={status.tone}>{status.text}</ToneBadge>
                                        <span className="pm-keymeta">{e.key.state === 'env' ? 'key from the environment' : e.key.last4 ? `key •••• ${e.key.last4}` : 'no key'}</span></div>
                                    <input
                                        className="input pm-in pm-mono" style={{ width: '100%', marginTop: 4 }} value={baseUrl[e.id] ?? ''} aria-label={`${e.id} base URL`}
                                        onChange={(ev) => props.onBaseUrl(e.id, ev.target.value)} placeholder={e.baseUrlSource === 'env' && e.baseUrl ? `Environment: ${e.baseUrl}` : 'https://my-server.example.com/v1'} aria-invalid={problems[e.id] ? true : undefined}
                                    />
                                    {problems[e.id] && <span className="pm-err pm-small" role="alert">{problems[e.id]}</span>}
                                    <div className="pm-ep-flags">
                                        {(['reasoning', 'structuredOutputs'] as const).map((flag) => (
                                            <label key={flag} className="pm-check pm-small">
                                                <input type="checkbox" checked={options[e.id]?.[flag] ?? false} onChange={(ev) => props.onOption(e.id, flag, ev.target.checked)} />
                                                {flag === 'reasoning' ? 'Reasoning effort' : 'Structured outputs'}
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pm-field-row" style={{ marginTop: 6 }}>
                                        <TestRow provider={e} result={test.result} running={test.running} error={test.error} onTest={() => props.onTest(e.id)} onDetails={() => props.onDetails(e.id)} />
                                    </div>
                                </div>
                                <span className="pm-ep-act">
                                    <Switch checked={enabled[e.id]} onChange={(on) => props.onEnabled(e.id, on)} labelledBy={`pm-name-${e.id}`}>{enabled[e.id] ? 'On' : 'Off'}</Switch>
                                    <button type="button" className="btn btn-sm" onClick={() => props.onKey(e.id, 'replace')}>Replace key</button>
                                    {/* an endpoint that only exists in the environment cannot be removed here */}
                                    {e.baseUrlSource === 'studio'
                                        ? <button type="button" className="btn btn-sm btn-ghost" onClick={() => props.onRemove(e.id)} aria-label={`Remove ${e.id}`}>Remove</button>
                                        : <span className="pm-small pm-dim">From environment</span>}
                                </span>
                            </li>
                        )
                    })}
                </ul>}
        </section>
    )
}
