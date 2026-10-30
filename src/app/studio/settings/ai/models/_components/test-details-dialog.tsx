'use client'

import { Dialog } from '@/app/studio/_components/ai-limits/dialog'
import { fmtWhen } from '@/lib/admin/ai-providers/format'
import { fmtMs, testLabel } from '@/lib/admin/ai-providers/status'
import type { TestResult } from '@/lib/admin/ai-providers/types'

const TODO: Record<string, string> = {
    'invalid-key': 'The key was refused. Set a new key here; it wins over the environment.',
    quota: 'Top up the account, or move this provider lower in the chains. Every call skips it until a test passes.',
    timeout: 'The server did not answer in time. Check it is up and the base URL is right.',
    'not-found': 'The test model does not exist at this provider. Check the base URL and the model name.',
    error: 'The request failed. Check the base URL and the key, then test again.',
}

export function TestDetailsDialog({ name, result, onClose, onTestAgain }: { name: string; result: TestResult; onClose: () => void; onTestAgain: () => void }) {
    return (
        <Dialog title={`${name} test`} onClose={onClose}>
            <dl className="pm-kv">
                <dt>Result</dt><dd>{result.ok ? <span className="pm-ok">OK</span> : <b className={result.code === 'quota' ? 'pm-warn' : 'pm-err'}>{testLabel(result.code)}</b>}</dd>
                <dt>Model tried</dt><dd className="acl-mono">{result.model}</dd>
                <dt>Took</dt><dd>{result.ms === null ? 'No answer' : fmtMs(result.ms)} · {fmtWhen(result.at)}</dd>
                {result.message && <><dt>Provider said</dt><dd className="acl-mono">{result.message}</dd></>}
                {!result.ok && TODO[result.code] && <><dt>What to do</dt><dd>{TODO[result.code]}</dd></>}
            </dl>
            <div className="acl-actions">
                <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={onTestAgain}>Test again</button>
            </div>
        </Dialog>
    )
}
