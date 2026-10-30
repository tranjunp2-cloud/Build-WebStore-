'use client'

import { useEffect, useRef } from 'react'
import styles from '../ai-settings.module.css'

interface Props {
    lines: string[]
    saving: boolean
    onCancel: () => void
    onConfirm: () => void
}

export function SaveConfirm({ lines, saving, onCancel, onConfirm }: Props) {
    const confirmRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        confirmRef.current?.focus()
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !saving && onCancel()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onCancel, saving])
    return (
        <>
            <div className={styles.scrim} onClick={saving ? undefined : onCancel} />
            <div className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="ais-cf-title">
                <h2 id="ais-cf-title" className="aiq-card-title">Save {lines.length} {lines.length === 1 ? 'change' : 'changes'}?</h2>
                <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
                <p className={`${styles.small} ${styles.dim}`}>Takes effect within ~6 min. A shop over its new limit gets &quot;AI is out for today&quot; until its last 24 hours drop below it.</p>
                <div className={styles.actions}>
                    <button type="button" className="btn btn-sm" onClick={onCancel} disabled={saving}>Cancel</button>
                    <button type="button" ref={confirmRef} className="btn btn-sm btn-primary" onClick={onConfirm} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                </div>
            </div>
        </>
    )
}
