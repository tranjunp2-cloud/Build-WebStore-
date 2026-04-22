'use client'

/**
 * GenerationRawJson — pretty-prints outputSnapshot JSON with a copy button.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { GenerationRecord } from './generation-types'

type Props = { record: GenerationRecord }

export function GenerationRawJson({ record }: Props) {
    const [copied, setCopied] = useState(false)

    const json = record.outputSnapshot
        ? JSON.stringify(record.outputSnapshot, null, 2)
        : null

    async function handleCopy() {
        if (!json) return
        try {
            await navigator.clipboard.writeText(json)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // clipboard API may be blocked in some envs — silent fail
        }
    }

    if (!json) {
        return (
            <p style={{ color: 'var(--text-3)', fontSize: 13, padding: '16px 0' }}>
                No output snapshot stored for this generation.
            </p>
        )
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy JSON'}
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elev)',
                    color: copied ? 'var(--success, #22c55e)' : 'var(--text-2)',
                    fontSize: 12,
                    cursor: 'pointer',
                    zIndex: 1,
                }}
            >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
            </button>
            <pre
                style={{
                    margin: 0,
                    padding: '12px',
                    paddingTop: 40,
                    background: 'var(--bg-sunk)',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: 'var(--text)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 420,
                    overflowY: 'auto',
                }}
            >
                {json}
            </pre>
        </div>
    )
}
