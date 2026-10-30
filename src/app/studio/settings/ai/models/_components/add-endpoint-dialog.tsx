'use client'

import { useState } from 'react'
import { Dialog } from '@/app/studio/_components/ai-limits/dialog'
import { callApi, describeFailure } from '@/lib/admin/ai-providers/browser-api'
import type { SettingsView } from '@/lib/admin/ai-providers/types'

const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/

interface Props {
    existing: string[]
    onClose: () => void
    onAdded: (view: SettingsView, name: string) => void
}

function checkUrl(url: string): string | null {
    try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? null : 'Use an http:// or https:// address.'
    } catch {
        return 'Enter a full address, for example https://my-server.example.com/v1.'
    }
}

export function AddEndpointDialog({ existing, onClose, onAdded }: Props) {
    const [name, setName] = useState('')
    const [baseUrl, setBaseUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [reasoning, setReasoning] = useState(false)
    const [structured, setStructured] = useState(true)
    const [errors, setErrors] = useState<{ name?: string; baseUrl?: string; form?: string }>({})
    const [busy, setBusy] = useState(false)

    async function submit() {
        const next: typeof errors = {}
        if (!name) next.name = 'Give the endpoint a short name.'
        else if (!NAME.test(name)) next.name = 'Use lowercase letters, digits and dashes only.'
        else if (existing.includes(`compat-${name}`)) next.name = `compat-${name} already exists. Pick another name.`
        next.baseUrl = checkUrl(baseUrl.trim()) ?? undefined
        if (next.name || next.baseUrl) return setErrors(next)
        setBusy(true)
        const result = await callApi<SettingsView>('POST', '/endpoints', {
            name, baseUrl: baseUrl.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), reasoning, structuredOutputs: structured,
        })
        setBusy(false)
        if (!result.ok) return setErrors({ form: describeFailure(result) })
        setApiKey('')
        onAdded(result.data, name)
    }

    return (
        <Dialog title="Add OpenAI-compatible endpoint" busy={busy} onClose={onClose}>
            <div className="pm-dlg-field">
                <label htmlFor="ep-name">Name</label>
                <input id="ep-name" className="input" value={name} placeholder="e.g. vllm-kl" autoComplete="off" onChange={(e) => { setName(e.target.value.trim().toLowerCase()); setErrors({}) }} aria-invalid={errors.name ? true : undefined} />
                {errors.name ? <p className="acl-err" role="alert">{errors.name}</p> : <p className="acl-hint">Shown in chains as <span className="acl-mono">compat-{name || '<name>'}:&lt;model&gt;</span>. Lowercase letters, digits and dashes.</p>}
            </div>
            <div className="pm-dlg-field">
                <label htmlFor="ep-url">Base URL</label>
                <input id="ep-url" className="input" style={{ fontFamily: 'var(--mono)' }} value={baseUrl} placeholder="https://my-server.example.com/v1" autoComplete="off" onChange={(e) => { setBaseUrl(e.target.value); setErrors({}) }} aria-invalid={errors.baseUrl ? true : undefined} />
                {errors.baseUrl ? <p className="acl-err" role="alert">{errors.baseUrl}</p> : <p className="acl-hint">Usually ends in /v1.</p>}
            </div>
            <div className="pm-dlg-field">
                <label htmlFor="ep-key">API key <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input id="ep-key" className="input" type="password" autoComplete="off" value={apiKey} placeholder="Leave empty if the server needs none" onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <label className="pm-check"><input type="checkbox" checked={reasoning} onChange={(e) => setReasoning(e.target.checked)} /><span>Supports reasoning effort<small>Sends the tier&apos;s effort. Turn on only if the server accepts reasoning_effort.</small></span></label>
            <label className="pm-check"><input type="checkbox" checked={structured} onChange={(e) => setStructured(e.target.checked)} /><span>Supports structured outputs<small>Lets tasks ask for exact JSON. Most vLLM and SGLang servers do.</small></span></label>
            {errors.form && <p className="acl-err" role="alert">{errors.form}</p>}
            <div className="acl-actions">
                <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add endpoint'}</button>
            </div>
        </Dialog>
    )
}
