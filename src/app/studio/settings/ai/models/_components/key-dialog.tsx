'use client'

import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useId, useState } from 'react'
import { Dialog } from '@/app/studio/_components/ai-limits/dialog'
import { describeFailure, type ApiResult } from '@/lib/admin/ai-providers/browser-api'
import { fmtMs, testLabel } from '@/lib/admin/ai-providers/status'
import type { SettingsView, TestResult } from '@/lib/admin/ai-providers/types'

interface Props {
    title: string
    fieldLabel: string
    hint?: string
    /** Test the typed key before it can be saved. Without it (gateway token) the key saves directly. */
    test?: (apiKey: string) => Promise<ApiResult<TestResult>>
    save: (apiKey: string) => Promise<ApiResult<SettingsView>>
    onClose: () => void
    onSaved: (view: SettingsView) => void
}

const MIN_KEY_LENGTH = 8

/**
 * Enter key -> Test -> Save. The key lives only in this component's state and the request body: it is cleared when the dialog
 * closes, never rendered back (password field; "Show" reveals what the admin typed), and the card shows only its last 4 characters.
 */
export function KeyDialog({ title, fieldLabel, hint, test, save, onClose, onSaved }: Props) {
    const fieldId = useId()
    const [apiKey, setApiKey] = useState('')
    const [show, setShow] = useState(false)
    const [busy, setBusy] = useState<'test' | 'save' | null>(null)
    const [passed, setPassed] = useState<{ key: string; result: TestResult } | null>(null)
    const [failed, setFailed] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const typed = apiKey.trim()
    const tested = passed !== null && passed.key === typed
    const needsTest = Boolean(test) && !tested

    async function submit() {
        if (typed.length < MIN_KEY_LENGTH) {
            setError(typed ? 'That looks too short for a key. Paste the whole key.' : 'Paste the key first.')
            return
        }
        setError(null)
        setFailed(null)
        if (needsTest && test) {
            setBusy('test')
            const result = await test(typed)
            setBusy(null)
            if (!result.ok) return setError(describeFailure(result))
            if (!result.data.ok) return setFailed(`${testLabel(result.data.code)}: ${result.data.message}. The key was not saved.`)
            return setPassed({ key: typed, result: result.data })
        }
        setBusy('save')
        const result = await save(typed)
        setBusy(null)
        if (!result.ok) return setError(describeFailure(result))
        setApiKey('')
        onSaved(result.data)
    }

    const label = busy === 'test' ? 'Testing…' : busy === 'save' ? 'Saving…' : needsTest ? 'Test key' : test ? 'Save key' : 'Save token'
    return (
        <Dialog title={title} busy={busy !== null} onClose={onClose}>
            {hint && <p className="acl-hint">{hint}</p>}
            <div className="pm-dlg-field">
                <label htmlFor={fieldId}>{fieldLabel}</label>
                <div className="pm-pass">
                    <input
                        id={fieldId} className="input" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value); setError(null); setFailed(null) }} aria-invalid={error ? true : undefined}
                    />
                    <button type="button" className="pm-icbtn" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'} aria-pressed={show}>
                        {show ? <EyeOff className="pm-ic" aria-hidden="true" /> : <Eye className="pm-ic" aria-hidden="true" />}
                    </button>
                </div>
                <p className="acl-hint">Encrypted when saved and never shown again; only the last 4 characters are kept.</p>
                {error && <p className="acl-err" role="alert">{error}</p>}
            </div>
            {failed && <p className="acl-err" role="alert">{failed}</p>}
            {tested && passed && <p className="acl-hint" role="status"><span className="pm-ok">Key works</span>{passed.result.ms !== null && ` · ${fmtMs(passed.result.ms)}`}. Save it to use it.</p>}
            <div className="acl-actions">
                <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy !== null}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={submit} disabled={busy !== null}>
                    {busy && <LoaderCircle className="pm-ic pm-spin" aria-hidden="true" />}{label}
                </button>
            </div>
        </Dialog>
    )
}
