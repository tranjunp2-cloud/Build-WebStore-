import { CircleCheck, CircleX, LoaderCircle, PlugZap } from 'lucide-react'
import { fmtWhen } from '@/lib/admin/ai-providers/format'
import { fmtMs, testLabel } from '@/lib/admin/ai-providers/status'
import type { ProviderView, TestResult } from '@/lib/admin/ai-providers/types'

interface Props {
    provider: ProviderView
    result: TestResult | null
    running: boolean
    error?: string | null
    onTest: () => void
    onDetails: () => void
}

/** Test button + the last result (green OK with latency, red/amber reason with a Details link). */
export function TestRow({ provider, result, running, error, onTest, onDetails }: Props) {
    const unusable = provider.key.state === 'none' || provider.key.state === 'needs-reentry'
    return (
        <>
            {running
                ? <button type="button" className="btn btn-sm" disabled><LoaderCircle className="pm-ic pm-spin" aria-hidden="true" />Testing…</button>
                : <button type="button" className="btn btn-sm" disabled={unusable} onClick={onTest}><PlugZap className="pm-ic" aria-hidden="true" />Test</button>}
            {error && <span className="pm-test pm-err" role="alert">{error}</span>}
            {!error && !result && <span className="pm-test pm-dim">Not tested yet</span>}
            {!error && result && (result.ok
                ? <span className="pm-test"><span className="pm-ok"><CircleCheck className="pm-ic" aria-hidden="true" /></span>OK{result.ms !== null && ` · ${fmtMs(result.ms)}`} · {fmtWhen(result.at)}</span>
                : <>
                    <span className="pm-test"><span className={result.code === 'quota' ? 'pm-warn' : 'pm-err'}><CircleX className="pm-ic" aria-hidden="true" /></span>{testLabel(result.code)} · {fmtWhen(result.at)}</span>
                    <button type="button" className="pm-link" onClick={onDetails}>Details</button>
                </>)}
        </>
    )
}
